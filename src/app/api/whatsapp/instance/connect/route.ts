import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUserClinic, canManageIntegrations } from '@/lib/auth-helpers'
import { getConnectionState, getQRCode } from '@/lib/evolution'

/**
 * Pede um QR fresco pra Evolution e persiste no banco.
 * Multi-numero: aceita ?instance_name= ou body.instance_name pra escolher
 * qual numero da clinica conectar. Sem param, opera na is_default.
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

  let row: { id: string; instance_name: string; status: string } | null = null
  if (instanceFilter) {
    const { data } = await svc
      .from('clinic_whatsapp')
      .select('id, instance_name, status')
      .eq('clinic_id', ctx.clinicId)
      .eq('instance_name', instanceFilter)
      .maybeSingle()
    row = data
  } else {
    const { data: def } = await svc
      .from('clinic_whatsapp')
      .select('id, instance_name, status')
      .eq('clinic_id', ctx.clinicId)
      .eq('is_default', true)
      .maybeSingle()
    if (def) row = def
    else {
      const { data: any } = await svc
        .from('clinic_whatsapp')
        .select('id, instance_name, status')
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

  const r = await getQRCode(row.instance_name)
  if (!r.ok) {
    await svc
      .from('clinic_whatsapp')
      .update({ status: 'error', last_event_at: new Date().toISOString() })
      .eq('id', row.id)
    let msg = `Evolution: ${r.error}`
    if (r.status === 401 || r.status === 403) {
      msg = `Evolution rejeitou a master key (${r.status}). Verifique URL e Master API Key em /admin/evolution.`
    } else if (r.status === 404) {
      msg = `Instance não encontrada na Evolution. Pode ter sido apagada lá. Tente "Remover instance" e configurar de novo.`
    }
    return NextResponse.json({ error: msg, evolution_status: r.status }, { status: 502 })
  }

  const base64 = r.data.base64 ?? null
  const expiresAt = new Date(Date.now() + 50_000).toISOString()

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
    pairing_code: r.data.pairingCode ?? null,
  })
}
