import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendWhatsappMessage } from '@/lib/whatsapp'

/**
 * POST /api/anamnese/send
 *
 * Cria (ou reaproveita) uma anamnese pro paciente e dispara o link via
 * WhatsApp da clínica (Evolution API). Se a clínica não tiver WhatsApp
 * conectado, devolve só o link pra o usuário copiar.
 *
 * Body: { patientId: string, appointmentId?: string }
 *
 * Idempotência: se o paciente já tem uma anamnese ativa (status
 * pending/viewed) com expires_at no futuro, reaproveita o mesmo token —
 * evita inflar a tabela com fichas duplicadas se o usuário clicar 2x.
 */
type SendBody = {
  patientId?: string
  appointmentId?: string
}

const ANAMNESE_TTL_DAYS = 7

function generateToken(): string {
  // 32 chars alfanuméricos. Usa crypto.getRandomValues quando disponível
  // (mais seguro que Math.random). Fallback pra Math.random só se algum
  // runtime estranho não expor crypto.
  const bytes = new Uint8Array(24)
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 32)
}

function siteUrl(req: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    new URL(req.url).origin
  )
}

export async function POST(req: NextRequest) {
  // ========== AUTH ==========
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'nao_autenticado' }, { status: 401 })
  }

  const { data: userRow } = await supabase
    .from('users')
    .select('id, clinic_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!userRow?.clinic_id) {
    return NextResponse.json({ ok: false, error: 'usuario_sem_clinica' }, { status: 403 })
  }
  const clinicId = userRow.clinic_id as string
  const userId = userRow.id as string

  // ========== BODY ==========
  let body: SendBody
  try {
    body = (await req.json()) as SendBody
  } catch {
    return NextResponse.json({ ok: false, error: 'json_invalido' }, { status: 400 })
  }

  const { patientId, appointmentId } = body
  if (!patientId) {
    return NextResponse.json({ ok: false, error: 'patientId_obrigatorio' }, { status: 400 })
  }

  // ========== PACIENTE ==========
  // Garantimos que o paciente é da mesma clínica do user (RLS reforça,
  // mas validamos explicitamente pra dar erro claro).
  const svc = createServiceClient()
  const { data: patient, error: errPatient } = await svc
    .from('patients')
    .select('id, name, phone, clinic_id')
    .eq('id', patientId)
    .maybeSingle()

  if (errPatient || !patient) {
    return NextResponse.json({ ok: false, error: 'paciente_nao_encontrado' }, { status: 404 })
  }
  if (patient.clinic_id !== clinicId) {
    return NextResponse.json({ ok: false, error: 'paciente_outra_clinica' }, { status: 403 })
  }

  // ========== ANAMNESE: REUSAR OU CRIAR ==========
  // Reusa anamnese ativa (pending/viewed) com expires_at no futuro.
  // Quem já preencheu (status='completed') NÃO conta — quer dizer que
  // o usuário pediu uma nova ficha, então criamos outra mesmo.
  const nowIso = new Date().toISOString()
  const { data: existingActive } = await svc
    .from('anamneses')
    .select('id, token, status, expires_at')
    .eq('clinic_id', clinicId)
    .eq('patient_id', patientId)
    .in('status', ['pending', 'viewed'])
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let anamneseId: string
  let token: string
  let reused = false

  if (existingActive) {
    anamneseId = existingActive.id as string
    token = existingActive.token as string
    reused = true
  } else {
    token = generateToken()
    const expiresAt = new Date(Date.now() + ANAMNESE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const { data: created, error: errCreate } = await svc
      .from('anamneses')
      .insert({
        clinic_id: clinicId,
        patient_id: patientId,
        status: 'pending',
        sent_by: userId,
        token,
        expires_at: expiresAt,
      })
      .select('id, token')
      .maybeSingle()

    if (errCreate || !created) {
      return NextResponse.json(
        { ok: false, error: `erro_criar_anamnese: ${errCreate?.message || 'desconhecido'}` },
        { status: 500 },
      )
    }
    anamneseId = created.id as string
    token = created.token as string
  }

  const link = `${siteUrl(req)}/anamnese/${token}`

  // ========== ENVIO PELO WHATSAPP DA CLÍNICA ==========
  // Só tenta se o paciente tem telefone. Caso contrário devolve só o link
  // pro usuário copiar/compartilhar manualmente.
  const phone = (patient.phone || '').trim()
  if (!phone) {
    return NextResponse.json({
      ok: true,
      anamnese_id: anamneseId,
      token,
      link,
      sent: 'link_only',
      reused,
      reason: 'paciente_sem_telefone',
    })
  }

  // Busca clinic name pro template (best-effort)
  const { data: clinic } = await svc
    .from('clinics')
    .select('name')
    .eq('id', clinicId)
    .maybeSingle()
  const clinicName = clinic?.name || 'sua clínica'

  const firstName = (patient.name || '').trim().split(/\s+/)[0] || 'tudo bem'
  const message =
    `Olá ${firstName}! 👋\n\n` +
    `Antes do seu atendimento na ${clinicName}, por favor preencha sua ficha de anamnese:\n\n` +
    `${link}\n\n` +
    `Leva uns 3 minutos. O link expira em ${ANAMNESE_TTL_DAYS} dias.`

  const result = await sendWhatsappMessage({ clinicId, phone, message, purpose: 'automation' })

  if (!result.ok) {
    return NextResponse.json({
      ok: true,
      anamnese_id: anamneseId,
      token,
      link,
      sent: 'link_only',
      reused,
      reason: `whatsapp_falhou: ${result.error}`,
      whatsapp_code: result.code,
    })
  }

  // Registra horário exato do envio via WhatsApp
  void svc
    .from('anamneses')
    .update({ whatsapp_sent_at: new Date().toISOString() })
    .eq('token', token)

  // Se tem appointmentId, deixa o link de anamnese vinculado nas notes
  // do agendamento (nice-to-have, ignora erro).
  if (appointmentId) {
    void svc
      .from('appointments')
      .update({ anamnese_token: token })
      .eq('id', appointmentId)
      .eq('clinic_id', clinicId)
      .then((r) => {
        // Coluna pode não existir nessa instalação — ignora silenciosamente.
        if (r.error && !/column/i.test(r.error.message)) {
          console.warn('[anamnese/send] update appointment.anamnese_token:', r.error.message)
        }
      })
  }

  return NextResponse.json({
    ok: true,
    anamnese_id: anamneseId,
    token,
    link,
    sent: 'whatsapp',
    reused,
  })
}
