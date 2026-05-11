import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  sendWhatsappMessage,
  sendWhatsappImage,
  sendWhatsappAudio,
  base64ToBuffer,
  cleanMimeType,
  extFromMime,
  normalizePhone,
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
  /** Multi-numero: instance_name especifico (opcional). Default: numero
   *  atribuido ao user logado, ou is_default da clinica. */
  instance_name?: string
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
 *
 * Persistência: depois do send bem-sucedido, inserimos a mensagem em
 * eva_conversations com role='assistant'. Pra mídias, fazemos upload do
 * mesmo base64 no bucket whatsapp-media. Isso garante que a UI mostra a
 * mensagem mesmo quando a Evolution não echo de volta o webhook
 * MESSAGES_UPSERT pra mensagens enviadas pela própria instance.
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
  let userId: string | null = null
  /** 'manual' = secretaria pelo painel; 'automation' = cron/n8n. */
  let purpose: 'manual' | 'automation' = 'manual'

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
    purpose = 'automation'
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
    userId = user.id
    purpose = 'manual'
    if (body.purpose === 'automation') purpose = 'automation'
  }

  const sharedOpts = {
    purpose,
    instanceName: body.instance_name,
    assignedTo: userId,
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
          ...sharedOpts,
        })
      : type === 'audio'
        ? await sendWhatsappAudio({
            clinicId: clinicId!,
            phone,
            audio: media!,
            ...sharedOpts,
          })
        : await sendWhatsappMessage({
            clinicId: clinicId!,
            phone,
            message: message!,
            ...sharedOpts,
          })

  if (!result.ok) {
    const status =
      result.code === 'not_configured' ? 412 :
      result.code === 'not_connected' ? 409 :
      result.code === 'evolution_error' ? 502 : 500
    return NextResponse.json({ ok: false, error: result.error, code: result.code }, { status })
  }

  // Persiste em eva_conversations pra a UI mostrar a mensagem mesmo se a
  // Evolution nao echoar o webhook. Tudo daqui pra frente eh best-effort:
  // se falhar, ainda retornamos ok (a mensagem foi entregue ao paciente).
  const persistResult = await persistOutboundMessage({
    clinicId: clinicId!,
    phone,
    type,
    message,
    caption,
    media,
    mimetype,
    fileName,
    evolutionResult: result.result,
    purpose,
  })

  return NextResponse.json({
    ok: true,
    result: result.result,
    persisted: persistResult,
  })
}

type PersistResult = {
  ok: boolean
  conversation_id?: string
  evolution_message_id?: string | null
  media_path?: string | null
  warnings: string[]
}

/**
 * Pausa indefinida da Eva quando humano assume conversa via painel.
 * Usar uma data muito distante porque o webhook compara com new Date().getTime().
 * Botão "Devolver pra Eva" zera de volta pra null.
 */
const PAUSE_INDEFINITE_ISO = '2099-12-31T23:59:59.999Z'

async function persistOutboundMessage(args: {
  clinicId: string
  phone: string
  type: 'text' | 'image' | 'audio'
  message?: string
  caption?: string
  media?: string
  mimetype?: string
  fileName?: string
  evolutionResult: unknown
  purpose: 'manual' | 'automation'
}): Promise<PersistResult> {
  const warnings: string[] = []
  const svc = createServiceClient()
  const normalizedPhone = normalizePhone(args.phone)

  // Tenta extrair messageId da resposta da Evolution (key.id).
  // Formato pode variar entre versoes — defensivo no parsing.
  const evolutionMessageId =
    (args.evolutionResult as { key?: { id?: string } } | null | undefined)?.key?.id ?? null

  let mediaPath: string | null = null
  let mediaUrl: string | null = null
  let cleanedMime: string | null = null

  if ((args.type === 'image' || args.type === 'audio') && args.media) {
    try {
      // Detecta mime do data URL se nao veio explicito
      const decoded = base64ToBuffer(args.media)
      const inferredMime =
        cleanMimeType(args.mimetype) ||
        cleanMimeType(decoded.detectedMime) ||
        (args.type === 'image' ? 'image/jpeg' : 'audio/ogg')
      cleanedMime = inferredMime
      const ext = extFromMime(inferredMime)
      const safeId = (evolutionMessageId ?? `${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '-')
      const path = `${args.clinicId}/${normalizedPhone}/${safeId}.${ext}`

      const up = await svc.storage.from('whatsapp-media').upload(path, decoded.buffer, {
        contentType: cleanedMime,
        upsert: true,
      })

      if (up.error) {
        warnings.push(`storage upload (mime=${cleanedMime}): ${up.error.message}`)
      } else {
        mediaPath = path
        const signed = await svc.storage
          .from('whatsapp-media')
          .createSignedUrl(path, 60 * 60 * 24 * 7)
        if (signed.error) {
          warnings.push(`signed url: ${signed.error.message}`)
        } else if (signed.data?.signedUrl) {
          mediaUrl = signed.data.signedUrl
        }
      }
    } catch (err) {
      warnings.push(
        `decode/upload: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  // Conteudo textual + preview
  const previewByKind =
    args.type === 'image' ? '🖼️ Imagem' : args.type === 'audio' ? '🎤 Mensagem de voz' : ''
  const content = args.message || args.caption || previewByKind

  // Dedupe: se ja temos uma row com esse evolution_message_id, nao duplica
  // (caso o webhook MESSAGES_UPSERT tenha chegado antes). Se existe, ainda
  // assim atualizamos media_path/media_url se a row anterior nao tinha.
  if (evolutionMessageId) {
    const { data: existing } = await svc
      .from('eva_conversations')
      .select('id, metadata')
      .eq('clinic_id', args.clinicId)
      .filter('metadata->>evolution_message_id', 'eq', evolutionMessageId)
      .limit(1)
      .maybeSingle()

    if (existing) {
      const existingMeta = (existing.metadata as Record<string, unknown> | null) ?? {}
      const needsMedia =
        !existingMeta.media_url && mediaUrl
          ? { media_path: mediaPath, media_url: mediaUrl }
          : null
      if (needsMedia) {
        await svc
          .from('eva_conversations')
          .update({ metadata: { ...existingMeta, ...needsMedia } })
          .eq('id', existing.id)
      }
      return {
        ok: true,
        conversation_id: existing.id,
        evolution_message_id: evolutionMessageId,
        media_path: mediaPath,
        warnings: [...warnings, 'dedup: row ja existia (webhook chegou primeiro)'],
      }
    }
  }

  const insertRes = await svc
    .from('eva_conversations')
    .insert({
      clinic_id: args.clinicId,
      phone: normalizedPhone,
      role: 'assistant',
      content,
      metadata: {
        evolution_message_id: evolutionMessageId,
        kind: args.type,
        mimetype: cleanedMime,
        file_name: args.fileName ?? null,
        media_path: mediaPath,
        media_url: mediaUrl,
        caption: args.caption ?? null,
        outbound: true, // marca que foi via /api/whatsapp/send
      },
    })
    .select('id')
    .maybeSingle()

  if (insertRes.error) {
    warnings.push(`insert eva_conversations: ${insertRes.error.message}`)
    return {
      ok: false,
      evolution_message_id: evolutionMessageId,
      media_path: mediaPath,
      warnings,
    }
  }

  // Atualiza last_event_at da clinica pra a lista de conversas reordenar
  await svc
    .from('clinic_whatsapp')
    .update({ last_event_at: new Date().toISOString() })
    .eq('clinic_id', args.clinicId)

  // INTERVENCAO HUMANA — quando a secretaria responde manualmente pelo painel,
  // pausamos a Eva indefinidamente naquele lead. So volta ao automatico quando
  // alguem clicar "Devolver pra Eva" no painel (limpa eva_pause_until + needs_human_review).
  if (args.purpose === 'manual') {
    const upd = await svc
      .from('leads')
      .update({
        eva_pause_until: PAUSE_INDEFINITE_ISO,
        last_contact_at: new Date().toISOString(),
      })
      .eq('clinic_id', args.clinicId)
      .eq('phone', normalizedPhone)
    if (upd.error) {
      warnings.push(`pause eva on manual: ${upd.error.message}`)
    }
  }

  return {
    ok: true,
    conversation_id: insertRes.data?.id,
    evolution_message_id: evolutionMessageId,
    media_path: mediaPath,
    warnings,
  }
}
