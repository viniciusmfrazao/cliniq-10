import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getClientIp, getUserAgent, getClientCountry } from '@/lib/client-ip'

/**
 * POST /api/documento/sign-as-professional
 * Cria um documents_sent já assinado pela profissional logada (canvas),
 * capturando IP/User-Agent/país no servidor — mesmo conjunto probatório
 * (Lei 14.063/2020) usado na assinatura do paciente em /api/documents/sign/[token].
 *
 * Body: { templateId, patientId, appointmentId?, name, content, signature }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'nao_autenticado' }, { status: 401 })

  const { data: userRow } = await supabase
    .from('users')
    .select('id, name, clinic_id, professional_registration')
    .eq('id', user.id)
    .maybeSingle()
  if (!userRow?.clinic_id) return NextResponse.json({ ok: false, error: 'sem_clinica' }, { status: 403 })

  let body: {
    templateId?: string
    patientId?: string
    appointmentId?: string | null
    name?: string
    content?: string
    signature?: string
    signerUserId?: string | null
  }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'json_invalido' }, { status: 400 }) }

  const { templateId, patientId, appointmentId, name, content, signature, signerUserId } = body
  if (!templateId || !patientId || !name || !content || !signature) {
    return NextResponse.json({ ok: false, error: 'dados_incompletos' }, { status: 400 })
  }

  // Se um profissional diferente do usuario logado foi selecionado
  // (ex: recepcionista enviando em nome da medica), valida que pertence
  // a mesma clinica e usa o nome/registro dele no documento.
  let signer = { name: userRow.name as string, professional_registration: userRow.professional_registration as string | null }
  if (signerUserId && signerUserId !== userRow.id) {
    const { data: signerRow } = await supabase
      .from('users')
      .select('id, name, professional_registration, clinic_id')
      .eq('id', signerUserId)
      .eq('clinic_id', userRow.clinic_id)
      .maybeSingle()
    if (!signerRow) return NextResponse.json({ ok: false, error: 'profissional_invalido' }, { status: 400 })
    signer = { name: signerRow.name, professional_registration: signerRow.professional_registration }
  }

  const clientIp = getClientIp(req.headers)
  const userAgent = getUserAgent(req.headers)
  const country = getClientCountry(req.headers)

  const token = Array.from({ length: 32 }, () => Math.random().toString(36).charAt(2)).join('')
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)
  const now = new Date().toISOString()

  const svc = createServiceClient()
  const { data: sentDoc, error } = await svc
    .from('documents_sent')
    .insert({
      clinic_id: userRow.clinic_id,
      template_id: templateId,
      patient_id: patientId,
      appointment_id: appointmentId || null,
      name,
      content,
      status: 'signed',
      signer_role: 'profissional',
      signer_name: signer.name || null,
      signer_registration: signer.professional_registration || null,
      signature_data: signature,
      signature_ip: clientIp,
      signature_user_agent: userAgent,
      signature_country: country,
      signed_at: now,
      sent_by: userRow.id,
      sign_token: token,
      expires_at: expiresAt.toISOString(),
    })
    .select('id, sign_token')
    .single()

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, id: sentDoc.id, token: sentDoc.sign_token })
}
