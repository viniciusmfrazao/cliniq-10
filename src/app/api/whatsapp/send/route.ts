import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  sendWhatsappMessage,
  sendWhatsappImage,
  sendWhatsappAudio,
} from '@/lib/whatsapp'
import { getSettings } from '@/lib/app-settings'

type SendBody = {
  clinic_id?: string
  phone?: string
  message?: string
  /** 'text' (default) | 'image' | 'audio' */
  type?: 'text' | 'image' | 'audio'
  /** base64 (puro ou data URL) ou URL pública pra mídia */
  media?: string
  mimetype?: string
  fileName?: string
  caption?: string
}

/**
 * POST /api/whatsapp/send
 *
 * 3 modos de autenticação:
 *
 * 1) Usuário logado (UI):
 *    Body: { phone, message } | { phone, type:'image', media, mimetype, caption? } | { phone, type:'audio', media }
 *
 * 2) Server-to-server CRON (pg_cron, jobs internos):
 *    Header: x-cron-secret: <CRON_SECRET (env)>
 *    Body: { clinic_id, phone, message }
 *
 * 3) Server-to-server N8N (Donna):
 *    Header: x-cliniq-secret: <n8n_donna_secret (app_settings)>
 *    Body: { clinic_id, phone, message }
 */
export async function POST(req: NextRequest) {
  let body: SendBody
  try {
    body = (await req.json()) as SendBody
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  const { phone, message, type = 'text', media, mimetype, fileName, caption } = body
  if (!phone) {
    return NextResponse.json({ ok: false, error: 'phone é obrigatório' }, { status: 400 })
  }
  if (type === 'text' && !message) {
    return NextResponse.json(
      { ok: false, error: 'message é obrigatório pra type=text' },
      { status: 400 },
    )
  }
  if ((type === 'image' || type === 'audio') && !media) {
    return NextResponse.json(
      { ok: false, error: 'media (base64 ou url) é obrigatório pra mídia' },
      { status: 400 },
    )
  }

  let clinicId: string | undefined

  const cronSecret = req.headers.get('x-cron-secret')
  const cliniqSecret = req.headers.get('x-cliniq-secret')

  const settings = cliniqSecret ? await getSettings(['n8n_donna_secret']) : null
  const expectedCliniqSecret = settings?.n8n_donna_secret

  const isValidCron = cronSecret && cronSecret === process.env.CRON_SECRET
  const isValidCliniq =
    cliniqSecret && expectedCliniqSecret && cliniqSecret === expectedCliniqSecret

  if (isValidCron || isValidCliniq) {
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

  // Roteamento por tipo
  const result =
    type === 'image'
      ? await sendWhatsappImage({
          clinicId: clinicId!,
          phone,
          media: media!,
          mimetype: mimetype || 'image/jpeg',
          caption,
          fileName,
        })
      : type === 'audio'
        ? await sendWhatsappAudio({
            clinicId: clinicId!,
            phone,
            audio: media!,
          })
        : await sendWhatsappMessage({ clinicId: clinicId!, phone, message: message! })

  if (!result.ok) {
    const status =
      result.code === 'not_configured' ? 412 :
      result.code === 'not_connected' ? 409 :
      result.code === 'evolution_error' ? 502 : 500
    return NextResponse.json({ ok: false, error: result.error, code: result.code }, { status })
  }
  return NextResponse.json({ ok: true, result: result.result })
}
