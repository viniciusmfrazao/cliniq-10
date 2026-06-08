import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendWhatsappMessage } from '@/lib/whatsapp'

/**
 * POST /api/documento/send-from-template
 * Cria um documento a partir de um template e envia pelo WhatsApp.
 * Body: { patientId, appointmentId?, templateId }
 */
function generateToken(): string {
  const bytes = new Uint8Array(24)
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes, b => b.toString(36).padStart(2, '0')).join('').slice(0, 32)
}

function fillVariables(content: string, vars: Record<string, string>): string {
  // Suporta {{VARIAVEL}} (duplas chaves) e {variavel} (simples)
  return content
    .replace(/\{\{([\w_]+)\}\}/g, (_, key) => vars[key] ?? vars[key.toLowerCase()] ?? `{{${key}}}`)
    .replace(/\{([\w_]+)\}/g, (_, key) => vars[key] ?? vars[key.toLowerCase()] ?? `{${key}}`)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'nao_autenticado' }, { status: 401 })

  const { data: userRow } = await supabase
    .from('users').select('id, clinic_id').eq('id', user.id).maybeSingle()
  if (!userRow?.clinic_id) return NextResponse.json({ ok: false, error: 'sem_clinica' }, { status: 403 })

  const clinicId = userRow.clinic_id as string

  let body: { patientId?: string; appointmentId?: string; templateId?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ ok: false, error: 'json_invalido' }, { status: 400 })
  }

  const { patientId, appointmentId, templateId } = body
  if (!patientId || !templateId) {
    return NextResponse.json({ ok: false, error: 'patientId e templateId obrigatorios' }, { status: 400 })
  }

  const svc = createServiceClient()

  // Buscar paciente
  const { data: patient } = await svc
    .from('patients').select('id, name, phone, cpf, email, clinic_id').eq('id', patientId).maybeSingle()
  if (!patient || patient.clinic_id !== clinicId) {
    return NextResponse.json({ ok: false, error: 'paciente_nao_encontrado' }, { status: 404 })
  }

  // Buscar template
  const { data: template } = await svc
    .from('document_templates').select('*, image_url').eq('id', templateId).eq('clinic_id', clinicId).maybeSingle()
  if (!template) {
    return NextResponse.json({ ok: false, error: 'template_nao_encontrado' }, { status: 404 })
  }

  // Buscar nome da clínica e procedimento
  const { data: clinic } = await svc.from('clinics').select('name').eq('id', clinicId).maybeSingle()
  const clinicName = clinic?.name || 'sua clínica'

  let procedureName = ''
  if (appointmentId) {
    const { data: appt } = await svc
      .from('appointments').select('procedures(name)').eq('id', appointmentId).maybeSingle()
    procedureName = (appt?.procedures as any)?.name || ''
  }

  // Preencher variáveis do template
  const today = new Date().toLocaleDateString('pt-BR')
  const firstName = patient.name.split(' ')[0]
  const vars: Record<string, string> = {
    // Formato minúsculo {var}
    nome_paciente: patient.name,
    nome: patient.name,
    primeiro_nome: firstName,
    data: today,
    data_hoje: today,
    procedimento: procedureName,
    clinica: clinicName,
    nome_clinica: clinicName,
    // Formato MAIÚSCULO {{VAR}} — padrão do editor de templates
    PACIENTE_NOME: patient.name,
    PACIENTE_CPF: patient.cpf || '',
    PACIENTE_EMAIL: patient.email || '',
    PACIENTE_TELEFONE: patient.phone || '',
    DATA: today,
    HORA: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
    CLINICA_NOME: clinicName,
    PROCEDIMENTO: procedureName,
  }
  const filledContent = fillVariables(template.content || '', vars)

  // Criar documento enviado
  const token = generateToken()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: doc, error: errDoc } = await svc
    .from('documents_sent')
    .insert({
      clinic_id: clinicId,
      template_id: templateId,
      patient_id: patientId,
      appointment_id: appointmentId || null,
      name: template.name,
      content: filledContent,
      status: template.requires_signature !== false ? 'pending' : 'sent',
      sent_by: userRow.id,
      sign_token: token,
      expires_at: expiresAt,
    })
    .select('id')
    .single()

  if (errDoc || !doc) {
    return NextResponse.json({ ok: false, error: 'erro_criar_documento' }, { status: 500 })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://app.clinike.com.br'
  const link = `${siteUrl}/assinar/${token}`

  // Enviar pelo WhatsApp
  const phone = (patient.phone || '').trim()
  if (!phone) {
    return NextResponse.json({ ok: true, sent: 'link_only', link, document_id: doc.id })
  }

  const requiresSignature = template.requires_signature !== false
  const hasAttachment = !!(template as any).image_url
  const fileUrl = (template.image_url || '') as string
  const isPdf = hasAttachment && fileUrl.toLowerCase().endsWith('.pdf')

  // Construir mensagem de texto contextual
  let message: string
  if (hasAttachment && requiresSignature) {
    // Anexo (PDF/imagem) + assinatura → mensagem curta com link após o anexo
    const procPart = procedureName ? ` referente ao procedimento *${procedureName}*` : ''
    message =
      `Olá ${firstName}! 👋\n\n` +
      `Acima segue o documento da *${clinicName}*${procPart}.\n\n` +
      `Após a leitura, por favor assine digitalmente aqui:\n${link}\n\n` +
      `O link expira em 7 dias. Qualquer dúvida é só chamar! 🤍`
  } else if (hasAttachment && !requiresSignature) {
    // Só anexo, sem assinatura
    message =
      `Olá ${firstName}! 👋\n\n` +
      `Acima segue o documento da *${clinicName}*. Qualquer dúvida é só chamar! 🤍`
  } else if (requiresSignature) {
    // Sem anexo, com assinatura (texto do template é o documento)
    message =
      `Olá ${firstName}! 👋\n\n` +
      `Antes do seu atendimento na *${clinicName}*, por favor leia e assine o documento abaixo:\n\n` +
      `${link}\n\n` +
      `O link expira em 7 dias. Qualquer dúvida é só chamar! 🤍`
  } else {
    // Sem anexo, sem assinatura → manda o conteúdo do template
    message = filledContent || `Olá ${firstName}! 👋\n\nSegue o documento da *${clinicName}*. Qualquer dúvida é só chamar! 🤍`
  }

  // 1. Se houver anexo, envia PRIMEIRO (o paciente vê o documento antes da mensagem)
  if (hasAttachment) {
    try {
      const { data: waData } = await svc
        .from('clinic_whatsapp')
        .select('instance_name')
        .eq('clinic_id', clinicId)
        .eq('status', 'connected')
        .limit(1)
        .maybeSingle()

      const { data: evSettings } = await svc
        .from('app_settings')
        .select('key, value')
        .in('key', ['evolution_url', 'evolution_master_key'])

      const evUrl = evSettings?.find((s: any) => s.key === 'evolution_url')?.value
      const evKey = evSettings?.find((s: any) => s.key === 'evolution_master_key')?.value
      const instance = waData?.instance_name

      if (evUrl && evKey && instance) {
        const fileName = isPdf
          ? (template.name ? `${template.name}.pdf` : 'documento.pdf')
          : undefined
        await fetch(`${evUrl}/message/sendMedia/${instance}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': evKey },
          body: JSON.stringify({
            number: phone.replace(/\D/g, '').replace(/^(?!55)/, '55'),
            mediatype: isPdf ? 'document' : 'image',
            media: fileUrl,
            caption: '',
            ...(fileName ? { fileName } : {}),
          }),
        })
      }
    } catch (e) {
      console.error('Erro ao enviar anexo do template:', e)
    }
  }

  // 2. Enviar texto DEPOIS (com link de assinatura quando aplicável)
  const result = await sendWhatsappMessage({ clinicId, phone, message, purpose: 'any' })

  // Marcar como enviado
  // Atualiza whatsapp_sent_at; status fica como foi inserido:
  // - 'pending' (aguardando assinatura) se requires_signature
  // - 'sent' se não requer assinatura
  await svc.from('documents_sent').update({
    whatsapp_sent_at: new Date().toISOString(),
    ...(requiresSignature ? {} : { status: 'sent' }),
  }).eq('id', doc.id)

  if (!result.ok) {
    return NextResponse.json({ ok: false, link, document_id: doc.id, error: result.error })
  }

  return NextResponse.json({ ok: true, sent: 'whatsapp', link: requiresSignature ? link : null, document_id: doc.id })
}



