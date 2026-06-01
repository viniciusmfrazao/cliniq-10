import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendWhatsappMessage } from '@/lib/whatsapp'

/**
 * POST /api/documento/send
 * Envia link de documento/assinatura pelo WhatsApp da clínica.
 * Body: { documentoId: string }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'nao_autenticado' }, { status: 401 })

  const { data: userRow } = await supabase
    .from('users').select('id, clinic_id').eq('id', user.id).maybeSingle()
  if (!userRow?.clinic_id) return NextResponse.json({ ok: false, error: 'sem_clinica' }, { status: 403 })

  const clinicId = userRow.clinic_id as string

  let body: { documentoId?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'json_invalido' }, { status: 400 }) }

  const { documentoId } = body
  if (!documentoId) return NextResponse.json({ ok: false, error: 'documentoId_obrigatorio' }, { status: 400 })

  const svc = createServiceClient()

  // Buscar documento com template e paciente
  const { data: doc, error: errDoc } = await svc
    .from('documents_sent')
    .select('*, document_templates(name), patients(id, name, phone)')
    .eq('id', documentoId)
    .eq('clinic_id', clinicId)
    .maybeSingle()

  if (errDoc || !doc) return NextResponse.json({ ok: false, error: 'documento_nao_encontrado' }, { status: 404 })

  const patient = doc.patients as any
  const template = doc.document_templates as any
  const phone = (patient?.phone || '').trim()
  if (!phone) return NextResponse.json({ ok: false, error: 'paciente_sem_telefone' }, { status: 400 })

  // Buscar nome da clínica
  const { data: clinic } = await svc.from('clinics').select('name').eq('id', clinicId).maybeSingle()
  const clinicName = clinic?.name || 'nossa clínica'
  const firstName = (patient.name || '').split(' ')[0]
  const templateName = template?.name || 'documento'

  // Construir link de assinatura
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://app.clinike.com.br'
  const link = `${siteUrl}/assinar/${doc.sign_token}`

  const message =
    `Olá ${firstName}! 👋\n\n` +
    `A ${clinicName} enviou o documento *"${templateName}"* para você assinar digitalmente:\n\n` +
    `${link}\n\n` +
    `O link expira em 7 dias. Qualquer dúvida é só chamar! 🤍`

  const result = await sendWhatsappMessage({ clinicId, phone, message, purpose: 'manual' })

  // Registrar envio no documento
  await svc.from('documents_sent').update({
    whatsapp_sent_at: new Date().toISOString(),
    whatsapp_sent_by: userRow.id,
    status: doc.status === 'pending' ? 'sent' : doc.status,
  }).eq('id', documentoId).then(() => {})

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error, link })
  }

  return NextResponse.json({ ok: true, sent: 'whatsapp', link })
}
