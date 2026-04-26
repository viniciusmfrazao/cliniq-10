import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUserClinic, canManageIntegrations } from '@/lib/auth-helpers'
import { logoutInstance } from '@/lib/evolution'

/**
 * Faz logout da instance (sem apagar). A clínica pode reconectar depois com QR novo.
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
    .select('instance_name')
    .eq('clinic_id', ctx.clinicId)
    .maybeSingle()

  if (!row?.instance_name) {
    return NextResponse.json({ ok: true })
  }

  const r = await logoutInstance(row.instance_name)

  await svc
    .from('clinic_whatsapp')
    .update({
      status: 'disconnected',
      qr_code: null,
      qr_expires_at: null,
      last_event_at: new Date().toISOString(),
    })
    .eq('clinic_id', ctx.clinicId)

  if (!r.ok) {
    // Já marcamos como disconnected localmente; reportamos erro mas não 500
    return NextResponse.json({
      ok: true,
      warning: `Logout local feito, Evolution respondeu: ${r.error}`,
    })
  }

  return NextResponse.json({ ok: true })
}
