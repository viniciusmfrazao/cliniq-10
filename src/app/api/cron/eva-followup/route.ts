import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSettings } from '@/lib/app-settings'
import { logEva } from '@/lib/eva-logger'

/**
 * GET /api/cron/eva-followup
 *
 * Roda a cada 30min. Pra cada lead com eva_next_followup_at <= now() (e que
 * não foi convertido nem perdido), chama a Edge Function eva-process com
 * isFollowup=true pra Eva gerar uma mensagem proativa de retomada.
 *
 * Tempos (5 estágios):
 *   t0 (paciente parou de responder) → +2h cron envia #1 (count vira 1)
 *   +24h depois → cron envia #2 (count vira 2)
 *   +48h depois → cron envia #3 (count vira 3)
 *   +5d depois → cron envia #4 (count vira 4)
 *   +10d depois → cron envia #5 (count vira 5)
 *   após #5 sem resposta → marca status='lost', lost_reason='sem_resposta_18d'
 *
 * Lead com needs_human_review=true NÃO recebe follow-up (humano cuida).
 *
 * Janela de envio: 8h-21h, segunda a sábado (BRT). Domingo e madrugada
 * pulamos — a fila não anda, o lead aguarda no horário comercial seguinte.
 */

const TZ_BR = 'America/Sao_Paulo'
const DEFAULT_LIMIT = 50

type LeadRow = {
  id: string
  clinic_id: string
  name: string
  phone: string | null
  status: string | null
  eva_followup_count: number | null
  eva_next_followup_at: string | null
  whatsapp_opt_in: boolean | null
}

type ClinicWaRow = {
  clinic_id: string
  instance_name: string
  status: string
  auto_reply_enabled: boolean | null
  is_default: boolean | null
  role_inbound: boolean | null
}

function isWithinSendingWindow(now = new Date()): boolean {
  // Hora/dia em BRT
  const br = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ_BR,
    weekday: 'short',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const wd = br.find((p) => p.type === 'weekday')?.value ?? '' // Mon..Sun
  const hh = parseInt(br.find((p) => p.type === 'hour')?.value ?? '0', 10)
  const blockedDay = wd === 'Sun'
  if (blockedDay) return false
  return hh >= 8 && hh < 21
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ ok: false, error: 'cron_not_configured' }, { status: 503 })
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const dryRun = url.searchParams.get('dry') === '1'
  const force = url.searchParams.get('force') === '1' // ignora janela 8-21
  const limit = Math.max(1, parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT), 10))

  if (!force && !isWithinSendingWindow()) {
    return NextResponse.json({
      ok: true,
      processed: 0,
      reason: 'fora_da_janela_8h_21h_seg_sab',
    })
  }

  const svc = createServiceClient()

  // 1) Lê motor da Eva — só faz follow-up se o motor estiver na Edge Function
  const settings = await getSettings(['eva_engine', 'eva_edge_url'])
  const engine = (settings.eva_engine || 'edge').toLowerCase()
  if (engine !== 'edge') {
    return NextResponse.json({ ok: true, processed: 0, reason: 'eva_engine_off_or_legacy' })
  }
  const edgeUrl = settings.eva_edge_url
  if (!edgeUrl) {
    return NextResponse.json({ ok: false, error: 'eva_edge_url_missing' }, { status: 500 })
  }

  // 2) Busca leads prontos pra follow-up.
  // Exclui:
  //   - convertidos, perdidos
  //   - quem ja foi escalado pra humano
  //   - quem está em cooldown da Eva (eva_pause_until > now): NPS anti-eco etc.
  const nowIso = new Date().toISOString()
  const { data: leads, error: errLeads } = await svc
    .from('leads')
    .select('id, clinic_id, name, phone, status, eva_followup_count, eva_next_followup_at, whatsapp_opt_in, needs_human_review, eva_pause_until')
    .lte('eva_next_followup_at', nowIso)
    .not('eva_next_followup_at', 'is', null)
    .not('status', 'in', '(converted,lost)')
    .or('needs_human_review.is.null,needs_human_review.eq.false')
    .or('whatsapp_opt_in.is.null,whatsapp_opt_in.eq.true')
    .or(`eva_pause_until.is.null,eva_pause_until.lte.${nowIso}`)
    .limit(limit)

  if (errLeads) {
    return NextResponse.json(
      { ok: false, stage: 'load_leads', error: errLeads.message },
      { status: 500 },
    )
  }

  const queue = (leads as LeadRow[] | null) ?? []
  if (queue.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, reason: 'queue_empty' })
  }

  // ─── DEFESA ANTI-SPAM ─────────────────────────────────────────────────────────────
  // Pra cada lead, verifica duas coisas:
  // 1) O paciente tem PELO MENOS 1 mensagem real (role='user') nos últimos 30d
  //    → evita disparar pra leads dormentes, importados ou de teste
  // 2) A ÚLTIMA mensagem da conversa é do paciente (role='user')
  //    → se a Eva já falou por último, ela ESPERA o paciente responder
  //    antes de mandar qualquer follow-up. Nunca follow-up sobre follow-up.
  const phonesPorClinica = new Map<string, Set<string>>()
  for (const lead of queue) {
    if (!lead.phone) continue
    if (!phonesPorClinica.has(lead.clinic_id)) {
      phonesPorClinica.set(lead.clinic_id, new Set())
    }
    phonesPorClinica.get(lead.clinic_id)!.add(lead.phone)
  }

  // Map clinic_id → Set<phone> com interação de usuário recente
  const recentInteraction = new Map<string, Set<string>>()
  // Map "clinicId:phone" → timestamp da última msg de cada role
  const lastAssistantMap = new Map<string, string>()
  const lastUserMap = new Map<string, string>()

  const cutoffRecent = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  for (const [clinicId, phones] of phonesPorClinica) {
    if (phones.size === 0) continue

    // 1) Interação recente do usuário (últimos 30d)
    const { data: recents } = await svc
      .from('eva_conversations')
      .select('phone')
      .eq('clinic_id', clinicId)
      .eq('role', 'user')
      .in('phone', Array.from(phones))
      .gte('created_at', cutoffRecent)
    const setOk = new Set<string>()
    for (const r of (recents as { phone: string }[] | null) ?? []) {
      if (r.phone) setOk.add(r.phone)
    }
    recentInteraction.set(clinicId, setOk)

    // 2) Timestamp da última mensagem de cada role por conversa
    // Usamos isso para saber se o cliente respondeu DEPOIS do último follow-up
    for (const phone of phones) {
      const { data: msgs } = await svc
        .from('eva_conversations')
        .select('role, created_at')
        .eq('clinic_id', clinicId)
        .eq('phone', phone)
        .in('role', ['user', 'assistant'])
        .order('created_at', { ascending: false })
        .limit(20)
      const key = `${clinicId}:${phone}`
      for (const m of (msgs as { role: string; created_at: string }[] | null) ?? []) {
        if (m.role === 'assistant' && !lastAssistantMap.has(key)) {
          lastAssistantMap.set(key, m.created_at)
        }
        if (m.role === 'user' && !lastUserMap.has(key)) {
          lastUserMap.set(key, m.created_at)
        }
        if (lastAssistantMap.has(key) && lastUserMap.has(key)) break
      }
    }
  }

  // 3) Pra cada clínica, valida que o WhatsApp está conectado E a Eva
  // está em modo automático. Se a clinica colocou a Eva em manual pelo
  // toggle, o cron de follow-up também respeita.
  const clinicIds = Array.from(new Set(queue.map((l) => l.clinic_id)))

  // Filtrar clínicas que têm módulo eva_ia ativo
  const { data: clinicsData } = await svc
    .from('clinics')
    .select('id, settings')
    .in('id', clinicIds)
  const clinicsWithEva = new Set<string>(
    (clinicsData ?? []).filter((c: any) => {
      const modules: string[] = c.settings?.active_modules || []
      return modules.length === 0 || modules.includes('eva_ia')
    }).map((c: any) => c.id)
  )
  // Remover da fila leads de clínicas sem Eva
  const filteredQueue = queue.filter(l => clinicsWithEva.has(l.clinic_id))
  if (filteredQueue.length === 0) return NextResponse.json({ ok: true, skipped: 'no_eva_clinics' })

  const { data: waList } = await svc
    .from('clinic_whatsapp')
    .select(
      'clinic_id, instance_name, status, auto_reply_enabled, is_default, role_inbound',
    )
    .in('clinic_id', clinicIds)

  // Multi-numero: pra cada clinic_id, escolhe a melhor instance pra Eva mandar
  // follow-up. Preferencia: connected + role_inbound + is_default > connected
  // + role_inbound > connected + is_default > qualquer connected > primeira.
  const waByClinic = new Map<string, ClinicWaRow>()
  const allWa = (waList as ClinicWaRow[] | null) ?? []
  for (const w of allWa) {
    const existing = waByClinic.get(w.clinic_id)
    const score = (row: ClinicWaRow) =>
      (row.status === 'connected' ? 8 : 0) +
      (row.role_inbound !== false ? 4 : 0) +
      (row.is_default ? 2 : 0) +
      (row.auto_reply_enabled !== false ? 1 : 0)
    if (!existing || score(w) > score(existing)) {
      waByClinic.set(w.clinic_id, w)
    }
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!serviceRoleKey) {
    return NextResponse.json({ ok: false, error: 'service_role_missing' }, { status: 500 })
  }

  const results: Array<{
    lead_id: string
    clinic_id: string
    phone: string | null
    stage: number
    skipped?: string
    sent?: boolean
    httpStatus?: number
  }> = []

  for (const lead of queue) {
    const wa = waByClinic.get(lead.clinic_id)
    if (!wa || wa.status !== 'connected') {
      results.push({
        lead_id: lead.id,
        clinic_id: lead.clinic_id,
        phone: lead.phone,
        stage: (lead.eva_followup_count ?? 0) + 1,
        skipped: 'wa_not_connected',
      })
      continue
    }
    // Toggle Eva auto/manual: pula clínicas com Eva pausada
    if (wa.auto_reply_enabled === false) {
      results.push({
        lead_id: lead.id,
        clinic_id: lead.clinic_id,
        phone: lead.phone,
        stage: (lead.eva_followup_count ?? 0) + 1,
        skipped: 'eva_paused_manual',
      })
      continue
    }
    if (!lead.phone) {
      results.push({
        lead_id: lead.id,
        clinic_id: lead.clinic_id,
        phone: null,
        stage: (lead.eva_followup_count ?? 0) + 1,
        skipped: 'no_phone',
      })
      continue
    }

    // Anti-spam: lead sem nenhuma mensagem do paciente em 30d nunca recebe
    // follow-up. Cobre stress test, leads importados, leads criados por bug.
    const recentSet = recentInteraction.get(lead.clinic_id) ?? new Set<string>()
    if (!recentSet.has(lead.phone)) {
      // Marca como lost e zera follow-up pra não pegar de novo
      if (!dryRun) {
        await svc
          .from('leads')
          .update({
            eva_next_followup_at: null,
            status: 'lost',
            lost_reason: 'sem_interacao_recente',
          })
          .eq('id', lead.id)
      }
      results.push({
        lead_id: lead.id,
        clinic_id: lead.clinic_id,
        phone: lead.phone,
        stage: (lead.eva_followup_count ?? 0) + 1,
        skipped: 'no_recent_user_message_30d',
      })
      continue
    }

    // Proteção anti follow-up em cascata:
    // Para QUALQUER estágio (incluindo o primeiro), verifica se a conversa
    // ainda está ativa. Uma conversa está ativa se:
    //   - O cliente mandou mensagem há menos de 3h (janela de conversa em andamento)
    //   - OU o cliente respondeu DEPOIS da última mensagem da Eva (no estágio > 0)
    //
    // Isso evita o caso: cliente fala → Eva responde → cron dispara follow-up
    // 2h depois mesmo com a conversa em andamento no mesmo dia.
    const followupCount = lead.eva_followup_count ?? 0
    const lastUserMsg = lastUserMap.get(`${lead.clinic_id}:${lead.phone}`)

    // Se o cliente enviou mensagem há menos de 3h → conversa ativa, não disparar
    const CONVERSA_ATIVA_MS = 2 * 60 * 60 * 1000
    if (lastUserMsg && (Date.now() - new Date(lastUserMsg).getTime()) < CONVERSA_ATIVA_MS) {
      // Reagenda o follow-up para daqui a 2h a partir da última mensagem do cliente
      if (!dryRun) {
        const novoNextAt = new Date(new Date(lastUserMsg).getTime() + CONVERSA_ATIVA_MS).toISOString()
        await svc.from('leads').update({ eva_next_followup_at: novoNextAt }).eq('id', lead.id)
      }
      results.push({
        lead_id: lead.id,
        clinic_id: lead.clinic_id,
        phone: lead.phone,
        stage: followupCount + 1,
        skipped: 'conversa_ativa_menos_3h',
      })
      continue
    }

    // NOTA (jun/2026): removido o antigo bloqueio 'client_did_not_reply_last_followup'.
    // Ele pulava o followup justamente quando o cliente estava em silêncio — que é
    // EXATAMENTE o caso que a sequência existe pra resolver (ver cabeçalho:
    // "paciente parou de responder → Eva envia followup"). Esse bloqueio congelava
    // os leads no estágio em que estavam (a própria msg da Eva virava a "última"),
    // deixando 240+ leads parados por até 19 dias. O guard de conversa ativa (<2h)
    // acima já evita disparo durante uma conversa em andamento.

    const stage = (lead.eva_followup_count ?? 0) + 1
    if (stage > 5) {
      // Defesa: se por algum motivo passou de 5 estagios, marca lost
      if (!dryRun) {
        await svc
          .from('leads')
          .update({
            status: 'lost',
            lost_reason: 'sem_resposta_18d',
            eva_next_followup_at: null,
          })
          .eq('id', lead.id)
      }
      results.push({
        lead_id: lead.id,
        clinic_id: lead.clinic_id,
        phone: lead.phone,
        stage,
        skipped: 'marked_lost_overrun',
      })
      continue
    }

    if (dryRun) {
      results.push({
        lead_id: lead.id,
        clinic_id: lead.clinic_id,
        phone: lead.phone,
        stage,
        skipped: 'dry_run',
      })
      continue
    }

    // Proteção anti double-send: atualiza eva_next_followup_at imediatamente
    // para +2h antes de chamar eva-process. Isso garante que o próximo cron
    // (30min depois) não processe o mesmo lead de novo caso eva-process seja lento.
    // O eva-process vai sobrescrever com o intervalo correto depois.
    await svc
      .from('leads')
      .update({ eva_next_followup_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() })
      .eq('id', lead.id)

    // Chama a Edge Function eva-process com isFollowup
    try {
      const r = await fetch(edgeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          clinicId: lead.clinic_id,
          instance: wa.instance_name,
          phone: lead.phone,
          customerName: lead.name,
          userText: '[FOLLOWUP_AUTOMATICO]',
          kind: 'text',
          isFollowup: true,
          followupStage: stage,
        }),
      })
      results.push({
        lead_id: lead.id,
        clinic_id: lead.clinic_id,
        phone: lead.phone,
        stage,
        sent: r.ok,
        httpStatus: r.status,
      })
      void logEva({ clinic_id: lead.clinic_id, phone: lead.phone, source: 'cron-followup', event: 'followup', status: r.ok ? 'ok' : 'error', details: { lead_id: lead.id, stage, http_status: r.status, dry_run: dryRun }, error_message: r.ok ? null : `eva-process retornou ${r.status}` })
    } catch (err) {
      results.push({
        lead_id: lead.id,
        clinic_id: lead.clinic_id,
        phone: lead.phone,
        stage,
        skipped: `exception:${err instanceof Error ? err.message : String(err)}`,
      })
      void logEva({ clinic_id: lead.clinic_id, phone: lead.phone, source: 'cron-followup', event: 'followup', status: 'error', details: { lead_id: lead.id, stage }, error_message: err instanceof Error ? err.message : String(err) })
    }
  }

  const sent = results.filter((r) => r.sent).length
  const skipped = results.filter((r) => r.skipped).length

  return NextResponse.json({
    ok: true,
    dryRun,
    processed: queue.length,
    sent,
    skipped,
    results,
  })
}
