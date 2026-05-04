import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUserClinic, canManageIntegrations } from '@/lib/auth-helpers'
import { getConnectionState, getQRCode } from '@/lib/evolution'

/**
 * Pede um QR fresco pra Evolution e persiste no banco.
 * UI deve chamar isso ao abrir a tela e a cada N segundos enquanto status === 'qr_pending'.
 *
 * Defensivo: se a instance JÁ está conectada na Evolution, não pede QR
 * (pra não sobrescrever o status com qr_pending). Apenas sincroniza.
 */
export async function POST() {
  const ctx = await getCurrentUserClinic()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!canManageIntegrations(ctx.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const svc = createServiceClient()
  const { data: row } = await svc
    .from('clinic_whatsapp')
    .select('instance_name, status')
    .eq('clinic_id', ctx.clinicId)
    .maybeSingle()

  if (!row?.instance_name) {
    return NextResponse.json(
      { error: 'Instance ainda não provisionada. Chame POST /api/whatsapp/instance primeiro.' },
      { status: 412 },
    )
  }

  // Antes de pedir QR, checa estado atual: se já está conectado, não pede
  // (Evolution pode até retornar QR forçado, mas isso só desconectaria a sessão).
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
      .eq('clinic_id', ctx.clinicId)
    return NextResponse.json({
      ok: true,
      already_connected: true,
      status: 'connected',
    })
  }

  const r = await getQRCode(row.instance_name)
  if (!r.ok) {
    await svc
      .from('clinic_whatsapp')
      .update({ status: 'error', last_event_at: new Date().toISOString() })
      .eq('clinic_id', ctx.clinicId)
    let msg = `Evolution: ${r.error}`
    if (r.status === 401 || r.status === 403) {
      msg = `Evolution rejeitou a master key (${r.status}). Verifique URL e Master API Key em /admin/evolution.`
    } else if (r.status === 404) {
      msg = `Instance não encontrada na Evolution. Pode ter sido apagada lá. Tente "Remover instance" e configurar de novo.`
    }
    return NextResponse.json({ error: msg, evolution_status: r.status }, { status: 502 })
  }

  const base64 = r.data.base64 ?? null
  // QR da Evolution geralmente expira em ~60s. Damos 50 pra UI considerar stale.
  const expiresAt = new Date(Date.now() + 50_000).toISOString()

  await svc
    .from('clinic_whatsapp')
    .update({
      status: 'qr_pending',
      qr_code: base64,
      qr_expires_at: expiresAt,
      last_event_at: new Date().toISOString(),
    })
    .eq('clinic_id', ctx.clinicId)

  return NextResponse.json({
    ok: true,
    qr_code: base64,
    qr_expires_at: expiresAt,
    pairing_code: r.data.pairingCode ?? null,
  })
}
