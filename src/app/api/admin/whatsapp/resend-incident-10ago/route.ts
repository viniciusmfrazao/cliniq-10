import { NextRequest, NextResponse } from 'next/server'
import { isSuperAdmin } from '@/lib/super-admin'
import { createServiceClient } from '@/lib/supabase/server'
import { sendWhatsappMessage, sendWhatsappImage } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/whatsapp/resend-incident-10ago?confirm=1
 *
 * One-off pra reenviar as duas mensagens confirmadas como perdidas na
 * janela morta do incidente de 10/ago/2026 (sessões zumbi, ~00:17 até o
 * fix do fallback sem presence em src/lib/whatsapp.ts):
 *
 *  1. Confirmação de agendamento — Maria Fernanda / CLÍNICA MARIANA DANTAS
 *     (appointment 3dc03805-9247-4067-89e1-fc3c51d1c1a5). agendamento_sent_at
 *     já estava marcado (o envio "aconteceu" às 09:10 do lado do app) mas caiu
 *     bem na janela sem entrega real. Em vez de remontar o template na mão,
 *     só destranca a fila (agendamento_sent_at = null,
 *     agendamento_scheduled_at = now()) — o cron
 *     /api/cron/msg-agendamento (roda de 5 em 5 min) reenvia com o template
 *     real da clínica, já usando o fallback novo.
 *
 *  2. Termo de Consentimento Ozonioterapia — Instituto Tacciane Olíveira
 *     (documents_sent 37d5c603-98ac-4c05-a498-69fca4164a42). Sem cron de
 *     retry pra documento, então reenvia direto aqui replicando a mesma
 *     lógica de /api/documento/send (texto + anexo se houver).
 *
 * Rota descartável — remover depois que confirmar que os dois chegaram.
 */
export async function GET(req: NextRequest) {
  const ok = await isSuperAdmin()
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const confirm = req.nextUrl.searchParams.get('confirm')
  if (confirm !== '1') {
    return new NextResponse(
      `<!doctype html><html><body style="font-family:sans-serif;padding:24px">
        <h3>Reenvio pontual — incidente 10/ago</h3>
        <p>1. Destrava a confirmação de agendamento da Maria Fernanda (Mariana Dantas) pro cron pegar em até 5min</p>
        <p>2. Reenvia o Termo de Consentimento Ozonioterapia (Instituto Tacciane Olíveira) agora</p>
        <p><a href="?confirm=1" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;border-radius:8px;text-decoration:none">Confirmar e rodar</a></p>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }

  const svc = createServiceClient()
  const log: string[] = []

  // ---------------------------------------------------------------------
  // 1) Mariana Dantas — destrava a fila do cron de confirmação de agendamento
  //    (rodada 1, já confirmada ok — mantido idempotente)
  // ---------------------------------------------------------------------
  const appointmentId = '3dc03805-9247-4067-89e1-fc3c51d1c1a5'
  const { data: appt, error: apptErr } = await svc
    .from('appointments')
    .update({ agendamento_sent_at: null, agendamento_scheduled_at: new Date().toISOString() })
    .eq('id', appointmentId)
    .select('id')
    .maybeSingle()

  if (apptErr) {
    log.push(`[Mariana Dantas] ERRO ao destravar fila: ${apptErr.message}`)
  } else if (!appt) {
    log.push('[Mariana Dantas] appointment não encontrado (id mudou?)')
  } else {
    log.push('[Mariana Dantas] fila destravada — cron /api/cron/msg-agendamento reenvia em até 5min')
  }

  // ---------------------------------------------------------------------
  // 2) Reenvio de documentos (rodada 1: Tacciane, já confirmada ok;
  //    rodada 2: 3 documentos da Sarah Pina achados na varredura completa
  //    00:17-17:07 depois do restart do container). Mesma lógica de
  //    /api/documento/send, via helper reutilizável.
  // ---------------------------------------------------------------------
  const documentoIds = [
    '37d5c603-98ac-4c05-a498-69fca4164a42', // Tacciane (rodada 1, idempotente)
    'd1c97f1b-82f4-4dea-bf04-61e9397587c7', // Sarah Pina / Thamires Carvalho — TERMO DE CONSENTIMENTO
    'f705c229-955a-4194-b9ab-6b4038c202af', // Sarah Pina / Thamires Carvalho — Cuidados Pos Procedimento
    '58de02e0-4632-4a4f-b7ad-21b53d7ea1cd', // Sarah Pina / Andressa Lopo Ribas — Cuidados Pos Procedimento
  ]

  for (const documentoId of documentoIds) {
    const { data: doc, error: errDoc } = await svc
      .from('documents_sent')
      .select('*, document_templates(name, image_url, requires_signature), patients(id, name, phone), clinic_id')
      .eq('id', documentoId)
      .maybeSingle()

    if (errDoc || !doc) {
      log.push(`[${documentoId}] ERRO ao buscar documento: ${errDoc?.message || 'não encontrado'}`)
      continue
    }

    const clinicId = doc.clinic_id as string
    const patient = doc.patients as unknown as { name: string; phone: string } | null
    const template = doc.document_templates as unknown as {
      name: string
      image_url: string | null
      requires_signature: boolean
    } | null
    const phone = (patient?.phone || '').trim()
    const label = `${patient?.name || documentoId} / ${template?.name || doc.name}`

    if (!phone) {
      log.push(`[${label}] ERRO: paciente sem telefone cadastrado`)
      continue
    }

    const { data: clinic } = await svc.from('clinics').select('name').eq('id', clinicId).maybeSingle()
    const clinicName = clinic?.name || 'nossa clínica'
    const firstName = (patient?.name || '').split(' ')[0]
    const templateName = template?.name || doc.name || 'documento'

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://app.clinike.com.br'
    const link = `${siteUrl}/assinar/${doc.sign_token}`

    const alreadySigned = doc.status === 'signed' && doc.signer_role === 'profissional'
    const message = alreadySigned
      ? `Olá ${firstName}! 👋\n\n` +
        `A ${clinicName} enviou o documento *"${templateName}"* já assinado:\n\n` +
        `${link}\n\n` +
        `Qualquer dúvida é só chamar! 🤍`
      : `Olá ${firstName}! 👋\n\n` +
        `A ${clinicName} enviou o documento *"${templateName}"* para você assinar digitalmente:\n\n` +
        `${link}\n\n` +
        `O link expira em 7 dias. Qualquer dúvida é só chamar! 🤍`

    const fileUrl = (template?.image_url || '') as string
    const hasAttachment = !!fileUrl
    const isPdf = hasAttachment && fileUrl.toLowerCase().endsWith('.pdf')

    if (hasAttachment) {
      const attResult = await sendWhatsappImage({
        clinicId,
        phone,
        media: fileUrl,
        mimetype: isPdf ? 'application/pdf' : 'image/jpeg',
        caption: '',
        fileName: isPdf ? `${templateName}.pdf` : undefined,
        purpose: 'automation',
      })
      log.push(
        attResult.ok
          ? `[${label}] anexo reenviado ok`
          : `[${label}] falha ao reenviar anexo: ${attResult.error}`,
      )
    }

    const result = await sendWhatsappMessage({ clinicId, phone, message, purpose: 'automation' })

    if (result.ok) {
      await svc
        .from('documents_sent')
        .update({
          whatsapp_sent_at: new Date().toISOString(),
          status: doc.status === 'pending' ? 'sent' : doc.status,
        })
        .eq('id', documentoId)
      log.push(`[${label}] reenviado com sucesso`)
    } else {
      log.push(`[${label}] ERRO ao reenviar: ${result.error}`)
    }
  }

  return new NextResponse(
    `<!doctype html><html><body style="font-family:sans-serif;padding:24px;white-space:pre-wrap">
      <h3>Resultado</h3>
      ${log.map((l) => `<div>${l.replace(/</g, '&lt;')}</div>`).join('')}
    </body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}
