import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUserClinic, canManageIntegrations } from '@/lib/auth-helpers'
import { logoutInstance } from '@/lib/evolution'
import { resolveClinicInstanceForApi } from '@/lib/whatsapp-route-helpers'

/**
 * Faz logout da instance (sem apagar). A clínica pode reconectar depois com QR novo.
 * Multi-numero: aceita ?instance_name= ou body.instance_name; senao opera na default.
 */
export async function POST(req: NextRequest) {
  const ctx = await getCurrentUserClinic()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!canManageIntegrations(ctx.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const svc = createServiceClient()
  const row = await resolveClinicInstanceForApi(svc, req, ctx.clinicId)
  if (!row) return NextResponse.json({ ok: true })

  const r = await logoutInstance(row.instance_name)

  await svc
    .from('clinic_whatsapp')
    .update({
      status: 'disconnected',
      qr_code: null,
      qr_expires_at: null,
      last_event_at: new Date().toISOString(),
    })
    .eq('id', row.id)

  if (!r.ok) {
    return NextResponse.json({
      ok: true,
      warning: `Logout local feito, Evolution respondeu: ${r.error}`,
    })
  }

  return NextResponse.json({ ok: true })
}
