import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUserClinic } from '@/lib/auth-helpers'

/**
 * Toggle Eva auto-reply (ligar/desligar Eva pra essa instância).
 *
 * Body: { enabled: boolean, instance_name?: string }
 *
 * Multi-numero: se instance_name vier, atualiza so essa; senao atualiza todas
 * que tem role_inbound=true (Eva escuta). Pra clinicas com 1 numero so o
 * comportamento eh identico ao anterior.
 */
export async function PATCH(request: Request) {
  const ctx = await getCurrentUserClinic()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await request.json().catch(() => null) as {
    enabled?: boolean
    instance_name?: string
  } | null
  if (!body || typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'Campo "enabled" (boolean) obrigatório' }, { status: 400 })
  }

  const svc = createServiceClient()

  let query = svc
    .from('clinic_whatsapp')
    .update({ auto_reply_enabled: body.enabled })
    .eq('clinic_id', ctx.clinicId)

  if (body.instance_name) {
    query = query.eq('instance_name', body.instance_name)
  } else {
    // Sem instance_name: aplica nas que tem role_inbound (Eva atende)
    query = query.eq('role_inbound', true)
  }

  const { data: affectedRows, error: updErr } = await query.select('id')

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }
  const affected = affectedRows?.length ?? 0
  if (affected === 0) {
    return NextResponse.json(
      { error: 'WhatsApp ainda não configurado' },
      { status: 404 },
    )
  }

  return NextResponse.json({
    ok: true,
    auto_reply_enabled: body.enabled,
    affected,
  })
}
