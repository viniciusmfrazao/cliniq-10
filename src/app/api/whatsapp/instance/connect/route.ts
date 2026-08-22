import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUserClinic, canManageIntegrations } from '@/lib/auth-helpers'
import {
  buildWebhookUrl,
  createInstance,
  deleteInstance,
  generateInstanceName,
  getConnectionState,
  getQRCode,
  setInstanceWebhook,
} from '@/lib/evolution'

const QR_TTL_MS = 50_000

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Pede um QR fresco pra Evolution e persiste no banco.
 * Multi-numero: aceita ?instance_name= ou body.instance_name pra escolher
 * qual numero da clinica conectar. Sem param, opera na is_default.
 *
 * Auto-cura (ago/2026): a Evolution as vezes responde 200 no
 * GET /instance/connect SEM o base64 do QR — tipicamente quando a instance
 * ficou presa em 'connecting' com sessao Baileys morta, ou quando ela foi
 * apagada por fora. Antes disso o banco ia pra 'qr_pending' com qr_code null
 * e o front ficava esperando pra sempre um QR que nunca vinha (incidente
 * Dra Mariana Farah, 22/ago/2026 — cliente sem WhatsApp por 1h).
 *
 * Agora, se o connect nao devolver QR: retry -> recria a instance com o MESMO
 * nome e pega o QR da propria resposta do /instance/create (fonte confiavel).
 * Isso elimina a necessidade de apagar instance na mao no painel da Evolution.
 */
export async function POST(req: NextRequest) {
  const ctx = await getCurrentUserClinic()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!canManageIntegrations(ctx.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  // Aceita instance_name por query OU body
  const url = new URL(req.url)
  let instanceFilter = url.searchParams.get('instance_name')
  if (!instanceFilter) {
    try {
      const body = (await req.json()) as Record<string, unknown>
      if (typeof body.instance_name === 'string') instanceFilter = body.instance_name
    } catch {}
  }

  const svc = createServiceClient()

  const columns = 'id, instance_name, status, webhook_token'
  let row: {
    id: string
    instance_name: string
    status: string
    webhook_token: string | null
  } | null = null

  if (instanceFilter) {
    const { data } = await svc
      .from('clinic_whatsapp')
      .select(columns)
      .eq('clinic_id', ctx.clinicId)
      .eq('instance_name', instanceFilter)
      .maybeSingle()
    row = data
  } else {
    const { data: def } = await svc
      .from('clinic_whatsapp')
      .select(columns)
      .eq('clinic_id', ctx.clinicId)
      .eq('is_default', true)
      .maybeSingle()
    if (def) row = def
    else {
      const { data: any } = await svc
        .from('clinic_whatsapp')
        .select(columns)
        .eq('clinic_id', ctx.clinicId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      row = any ?? null
    }
  }

  if (!row?.instance_name) {
    return NextResponse.json(
      { error: 'Instance ainda não provisionada. Chame POST /api/whatsapp/instance primeiro.' },
      { status: 412 },
    )
  }

  const liveState = await getConnectionState(row.instance_name)
  if (liveState.ok && liveState.data.instance?.state === 'open') {
    await svc
      .from('clinic_whatsapp')
      .update({
        status: 'connected',
        qr_code: null,
        qr_expires_at: null,
        connected_at: new Date().toISOString(),
        last_event_at: new Date().toISOString(),
      })
      .eq('id', row.id)
    return NextResponse.json({
      ok: true,
      already_connected: true,
      status: 'connected',
      instance_name: row.instance_name,
    })
  }

  // --- Tentativa 1: connect normal --------------------------------------
  let base64: string | null = null
  let pairingCode: string | null = null
  let healed = false
  let lastError: { error: string; status?: number } | null = null

  const r1 = await getQRCode(row.instance_name)
  if (r1.ok) {
    base64 = r1.data.base64 ?? null
    pairingCode = r1.data.pairingCode ?? null
  } else {
    lastError = { error: r1.error, status: r1.status }
    // 401/403 = master key errada. Nao adianta auto-curar, aborta ja.
    if (r1.status === 401 || r1.status === 403) {
      await svc
        .from('clinic_whatsapp')
        .update({ status: 'error', last_event_at: new Date().toISOString() })
        .eq('id', row.id)
      return NextResponse.json(
        {
          error: `Evolution rejeitou a master key (${r1.status}). Verifique URL e Master API Key em /admin/evolution.`,
          evolution_status: r1.status,
        },
        { status: 502 },
      )
    }
  }

  // --- Tentativa 2: retry curto -----------------------------------------
  // A Evolution costuma devolver o QR na segunda chamada quando a primeira
  // pegou a instance ainda subindo o socket.
  if (!base64) {
    await sleep(1_500)
    const r2 = await getQRCode(row.instance_name)
    if (r2.ok) {
      base64 = r2.data.base64 ?? null
      pairingCode = r2.data.pairingCode ?? null
    } else {
      lastError = { error: r2.error, status: r2.status }
    }
  }

  // --- Tentativa 3: auto-cura -------------------------------------------
  // Recria a instance. Primeiro com o MESMO nome (preserva historico e
  // webhook). Se a Evolution recusar — tipicamente 403 'name already in
  // use' porque o delete nao conseguiu liberar o nome — cai pra um nome
  // NOVO e migra a row. O importante e a clinica voltar a funcionar; a
  // instance orfa que sobrar na Evolution e lixo, nao bloqueio.
  if (!base64) {
    healed = true

    await deleteInstance(row.instance_name).catch(() => null)
    await sleep(800)

    const attempts: string[] = [
      row.instance_name,
      `${generateInstanceName(ctx.clinicId)}-${Date.now().toString(36)}`,
    ]

    let activeName: string | null = null
    let activeToken: string | null = null
    let createError: { error: string; status?: number } | null = null

    for (const candidate of attempts) {
      const isSameName = candidate === row.instance_name
      const token = isSameName
        ? row.webhook_token ?? crypto.randomUUID().replace(/-/g, '')
        : crypto.randomUUID().replace(/-/g, '')
      const webhookUrl = buildWebhookUrl(candidate, token)

      const created = await createInstance({ instanceName: candidate, webhookUrl })
      if (!created.ok) {
        createError = { error: created.error, status: created.status }
        console.warn('[whatsapp/connect] create falhou, tentando proximo nome:', {
          candidate,
          status: created.status,
          error: created.error,
        })
        continue
      }

      activeName = candidate
      activeToken = token
      // O /instance/create e a fonte mais confiavel do QR nessa versao da
      // Evolution — o connect as vezes volta 200 vazio.
      base64 = created.data?.qrcode?.base64 ?? null

      const wh = await setInstanceWebhook({ instanceName: candidate, webhookUrl })
      if (!wh.ok) {
        console.warn('[whatsapp/connect] setInstanceWebhook falhou na auto-cura:', wh.error)
      }
      break
    }

    if (!activeName || !activeToken) {
      await svc
        .from('clinic_whatsapp')
        .update({ status: 'error', last_event_at: new Date().toISOString() })
        .eq('id', row.id)
      return NextResponse.json(
        {
          error: `Não foi possível recriar a instância na Evolution: ${createError?.error ?? 'erro desconhecido'}`,
          evolution_status: createError?.status,
        },
        { status: 502 },
      )
    }

    if (!base64) {
      await sleep(1_200)
      const r3 = await getQRCode(activeName)
      if (r3.ok) {
        base64 = r3.data.base64 ?? null
        pairingCode = r3.data.pairingCode ?? null
      } else {
        lastError = { error: r3.error, status: r3.status }
      }
    }

    // Se trocamos de nome, a row passa a apontar pra instance nova.
    // Preserva id/is_default/roles/label — so muda nome e token.
    if (activeName !== row.instance_name || activeToken !== row.webhook_token) {
      await svc
        .from('clinic_whatsapp')
        .update({ instance_name: activeName, webhook_token: activeToken })
        .eq('id', row.id)
      row.instance_name = activeName
      row.webhook_token = activeToken
    }
  }

  // --- Sem QR mesmo depois de tudo --------------------------------------
  // Nao deixa o banco em 'qr_pending' com qr_code null: isso e exatamente o
  // estado que trava o front num loop de polling infinito.
  if (!base64) {
    await svc
      .from('clinic_whatsapp')
      .update({
        status: 'error',
        qr_code: null,
        qr_expires_at: null,
        last_event_at: new Date().toISOString(),
      })
      .eq('id', row.id)
    console.error('[whatsapp/connect] sem QR apos auto-cura:', {
      instance: row.instance_name,
      lastError,
    })
    return NextResponse.json(
      {
        error:
          'A Evolution não devolveu o QR Code mesmo após recriar a instância. Tente novamente em alguns segundos; se persistir, use o "Reset total" deste número.',
        evolution_status: lastError?.status,
        evolution_error: lastError?.error,
      },
      { status: 502 },
    )
  }

  const expiresAt = new Date(Date.now() + QR_TTL_MS).toISOString()

  await svc
    .from('clinic_whatsapp')
    .update({
      status: 'qr_pending',
      qr_code: base64,
      qr_expires_at: expiresAt,
      last_event_at: new Date().toISOString(),
    })
    .eq('id', row.id)

  return NextResponse.json({
    ok: true,
    instance_name: row.instance_name,
    qr_code: base64,
    qr_expires_at: expiresAt,
    pairing_code: pairingCode,
    healed,
  })
}
