import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUserClinic } from '@/lib/auth-helpers'

/**
 * Toggle Eva auto-reply (ligar/desligar Eva pra essa instância).
 *
 * Body: { enabled: boolean }
 *
 * Usa service role pra bypassar RLS — assim nao depende de policy de UPDATE
 * pra usuario admin/manager.
 */
export async function PATCH(request: Request) {
  const ctx = await getCurrentUserClinic()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'Campo "enabled" (boolean) obrigatório' }, { status: 400 })
  }

  const svc = createServiceClient()

  const { data: row, error: selErr } = await svc
    .from('clinic_whatsapp')
    .select('clinic_id')
    .eq('clinic_id', ctx.clinicId)
    .maybeSingle()

  if (selErr) {
    return NextResponse.json({ error: selErr.message }, { status: 500 })
  }
  if (!row) {
    return NextResponse.json({ error: 'WhatsApp ainda não configurado' }, { status: 404 })
  }

  const { error: updErr } = await svc
    .from('clinic_whatsapp')
    .update({ auto_reply_enabled: body.enabled })
    .eq('clinic_id', ctx.clinicId)

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, auto_reply_enabled: body.enabled })
}
