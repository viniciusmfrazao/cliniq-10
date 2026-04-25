import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendWhatsappMessage } from '@/lib/whatsapp'

/**
 * POST /api/whatsapp/send
 *
 * 2 modos de autenticação:
 *
 * 1) Usuário logado (UI):
 *    Body: { phone, message }
 *    -> clinic_id é deduzido do user logado.
 *
 * 2) Server-to-server (pg_cron, N8N, jobs internos):
 *    Header: x-cron-secret: <CRON_SECRET>
 *    Body: { clinic_id, phone, message }
 */
export async function POST(req: NextRequest) {
  let body: { clinic_id?: string; phone?: string; message?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  const { phone, message } = body
  if (!phone || !message) {
    return NextResponse.json({ ok: false, error: 'phone e message são obrigatórios' }, { status: 400 })
  }

  let clinicId: string | undefined

  const cronSecret = req.headers.get('x-cron-secret')
  if (cronSecret && cronSecret === process.env.CRON_SECRET) {
    if (!body.clinic_id) {
      return NextResponse.json(
        { ok: false, error: 'clinic_id é obrigatório em chamadas server-to-server' },
        { status: 400 },
      )
    }
    const svc = createServiceClient()
    const { data: clinic } = await svc.from('clinics').select('id').eq('id', body.clinic_id).maybeSingle()
    if (!clinic) {
      return NextResponse.json({ ok: false, error: 'Clínica não encontrada' }, { status: 404 })
    }
    clinicId = body.clinic_id
  } else {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
    }
    const { data: userRow } = await supabase
      .from('users')
      .select('clinic_id')
      .eq('id', user.id)
      .maybeSingle()
    if (!userRow?.clinic_id) {
      return NextResponse.json({ ok: false, error: 'Usuário sem clínica' }, { status: 403 })
    }
    clinicId = userRow.clinic_id
  }

  const result = await sendWhatsappMessage({ clinicId: clinicId!, phone, message })
  if (!result.ok) {
    const status =
      result.code === 'not_configured' ? 412 :
      result.code === 'not_connected' ? 409 :
      result.code === 'evolution_error' ? 502 : 500
    return NextResponse.json({ ok: false, error: result.error, code: result.code }, { status })
  }
  return NextResponse.json({ ok: true, result: result.result })
}
