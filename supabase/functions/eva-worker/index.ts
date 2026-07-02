// eva-worker: processa a fila eva_queue
// Roda via cron a cada 10s — reivindica itens prontos e dispara eva-process
//
// ANTI-DUPLICACAO: usa a RPC claim_eva_queue, que faz UPDATE ... FOR UPDATE
// SKIP LOCKED atomicamente. Dois ciclos do cron concorrentes NUNCA pegam o
// mesmo item — o segundo simplesmente nao ve os itens ja travados.
//
// SEGURANCA CONTRA PERDA: o item so e DELETADO da fila APOS o processamento
// terminar. Se a Eva falhar/travar, o item permanece na fila (com locked_until)
// e volta a ser elegivel quando o lock expira (90s) — a mensagem nao se perde.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const WORKER_SECRET = Deno.env.get('WORKER_SECRET') ?? ''

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
}

Deno.serve(async (req) => {
  // Verificar secret para evitar chamadas não autorizadas
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  if (WORKER_SECRET && token !== WORKER_SECRET && token !== SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'env vars ausentes' }), { status: 500 })
  }

  // ─── CAMADA 2: WATCHDOG de conversas paradas ─────────────────────────────
  //
  // ~1x por minuto (quando o segundo do relogio < 10, pra rodar so 1 dos ~6
  // ciclos por minuto), busca conversas onde a ULTIMA msg e do paciente, foi
  // ha >3min, e nao ha resposta nem entrada na fila. Reenfileira pra Eva
  // responder — assim NENHUM paciente fica no vacuo, mesmo se algo falhar.
  if (new Date().getSeconds() < 10) {
    try {
      const stuckResp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/eva_stuck_conversations`, {
        method: 'POST', headers, body: '{}',
      })
      if (stuckResp.ok) {
        const stuck = await stuckResp.json() as Array<{ clinic_id: string; phone: string; instance: string | null }>
        if (stuck && stuck.length > 0) {
          console.log(JSON.stringify({ evt: 'eva_watchdog', stuck: stuck.length }))

          // Pré-carrega a instância padrão de cada clínica envolvida
          // (evita usar o fallback inválido 'cliniq' quando instance=null)
          const clinicIds = [...new Set(stuck.map(s => s.clinic_id))]
          const instanceMap = new Map<string, string>()
          for (const cid of clinicIds) {
            try {
              const r = await fetch(
                `${SUPABASE_URL}/rest/v1/clinic_whatsapp?clinic_id=eq.${cid}&status=eq.connected&select=instance_name&order=is_default.desc&limit=1`,
                { headers },
              )
              if (r.ok) {
                const rows = await r.json() as Array<{ instance_name: string }>
                if (rows?.[0]?.instance_name) instanceMap.set(cid, rows[0].instance_name)
              }
            } catch { /* segue */ }
          }

          for (const s of stuck) {
            // Usa a instância da conversa, senão busca a da clínica, senão pula
            const instance = s.instance || instanceMap.get(s.clinic_id)
            if (!instance) {
              console.log(JSON.stringify({ evt: 'eva_watchdog_skip', reason: 'no_instance', clinic: s.clinic_id }))
              continue
            }
            await fetch(`${SUPABASE_URL}/rest/v1/eva_queue`, {
              method: 'POST',
              headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
              body: JSON.stringify({
                clinic_id: s.clinic_id,
                phone: s.phone,
                instance,
                process_after: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }),
            }).catch(() => {})
          }
        }
      }
    } catch (_e) {
      // watchdog é best-effort; nunca derruba o worker
    }
  }

  // 1) Reivindicar itens atomicamente (claim_eva_queue trava com SKIP LOCKED).
  //    Lock de 90s: tempo de sobra pro debounce (15s) + Claude + tools.
  const claimResp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/claim_eva_queue`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ p_limit: 50, p_lock_seconds: 90 }),
  })

  if (!claimResp.ok) {
    const err = await claimResp.text()
    return new Response(
      JSON.stringify({ error: `claim failed: ${err.slice(0, 200)}` }),
      { status: 500 },
    )
  }

  const items = await claimResp.json() as Array<{
    id: string
    clinic_id: string
    phone: string
    instance: string
    customer_name: string | null
  }>

  if (!items || items.length === 0) {
    return new Response(JSON.stringify({ ok: true, processed: 0 }), { status: 200 })
  }

  console.log(JSON.stringify({ evt: 'eva_worker_run', items: items.length }))

  // 2) Processar cada item reivindicado e deletar SO apos sucesso.
  const evaUrl = `${SUPABASE_URL}/functions/v1/eva-process`
  const results: Array<{ phone: string; status: string }> = []

  await Promise.all(items.map(async (item) => {
    let processedOk = false
    try {
      // Buscar última mensagem do user para esse phone (+ metadata pra marcar como lida)
      const convResp = await fetch(
        `${SUPABASE_URL}/rest/v1/eva_conversations?clinic_id=eq.${item.clinic_id}&phone=eq.${item.phone}&role=eq.user&order=created_at.desc&limit=1&select=content,metadata`,
        { headers },
      )

      const convData = convResp.ok ? await convResp.json() : []
      const lastUserMsg = convData?.[0]?.content ?? ''
      const lastMsgMeta = convData?.[0]?.metadata as { evolution_message_id?: string } | null | undefined

      if (!lastUserMsg) {
        // Sem mensagem pra processar — remove da fila (nao ha o que fazer)
        processedOk = true
        results.push({ phone: item.phone.slice(-8), status: 'skip_no_msg' })
        return
      }

      // Disparar eva-process. messageId=null => sem debounce (o worker ja
      // espera o process_after, entao o debounce ja foi cumprido na fila).
      // readMessageId/remoteJid (campos separados) permitem marcar a msg
      // como lida antes do Eva responder, sem afetar o debounce.
      const evaResp = await fetch(evaUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          clinicId: item.clinic_id,
          phone: item.phone,
          instance: item.instance,
          customerName: item.customer_name ?? null,
          userText: lastUserMsg,
          skipSend: false,
          messageId: null,
          readMessageId: lastMsgMeta?.evolution_message_id ?? null,
          remoteJid: `${item.phone}@s.whatsapp.net`,
        }),
      })

      processedOk = evaResp.ok
      results.push({ phone: item.phone.slice(-8), status: evaResp.ok ? 'ok' : `err_${evaResp.status}` })
    } catch (e: any) {
      // Exceção — NÃO deleta (processedOk fica false), item volta à fila após lock
      results.push({ phone: item.phone.slice(-8), status: `exception_${e.message?.slice(0, 50)}` })
    } finally {
      // 3) Deleta da fila SOMENTE se processou com sucesso. Em caso de falha,
      //    o item permanece travado e volta a ser elegivel apos os 90s — assim
      //    uma falha transitoria da Eva nao faz a mensagem do paciente sumir.
      if (processedOk) {
        await fetch(
          `${SUPABASE_URL}/rest/v1/eva_queue?id=eq.${item.id}`,
          { method: 'DELETE', headers },
        ).catch(() => {})
      }
    }
  }))

  console.log(JSON.stringify({ evt: 'eva_worker_done', results }))

  return new Response(
    JSON.stringify({ ok: true, processed: items.length, results }),
    { status: 200 },
  )
})
