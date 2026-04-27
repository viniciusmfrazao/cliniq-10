import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { mapEvolutionStateToStatus } from '@/lib/evolution'
import { getSettings } from '@/lib/app-settings'
import { fetchEvolutionMediaBase64 } from '@/lib/whatsapp'

/**
 * Webhook multi-tenant da Evolution.
 *
 * URL no formato: /api/webhooks/evolution/<instance_name>?token=<webhook_token>
 *
 * O <token> é único por clínica (clinic_whatsapp.webhook_token) e fica embutido
 * na URL configurada na Evolution. Se alguém tentar bater no webhook sem token
 * válido, devolvemos 401.
 */

type EvolutionEvent =
  | 'QRCODE_UPDATED'
  | 'CONNECTION_UPDATE'
  | 'MESSAGES_UPSERT'
  | string

type WebhookBody = {
  event?: EvolutionEvent
  instance?: string
  data?: Record<string, unknown>
  date_time?: string
  sender?: string
  destination?: string
}

type ParsedKind =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'sticker'
  | 'unknown'

type ParsedMessage = {
  kind: ParsedKind
  text: string | null // texto/caption pra preview
  mimetype: string | null
  fileName: string | null
  /**
   * `inlineBase64` é base64 vindo direto no webhook (Evolution v2 quando
   * webhookBase64=true coloca alguns campos `mediaKey` etc). Se não vier inline,
   * a gente baixa via /chat/getBase64FromMediaMessage.
   */
  inlineBase64: string | null
}

function pickMessageDetails(message: unknown): ParsedMessage {
  const empty: ParsedMessage = {
    kind: 'unknown',
    text: null,
    mimetype: null,
    fileName: null,
    inlineBase64: null,
  }
  if (!message || typeof message !== 'object') return empty
  const m = message as Record<string, unknown>

  // Texto puro
  if (typeof m.conversation === 'string') {
    return { ...empty, kind: 'text', text: m.conversation }
  }
  const ext = m.extendedTextMessage as Record<string, unknown> | undefined
  if (ext && typeof ext.text === 'string') {
    return { ...empty, kind: 'text', text: ext.text }
  }
  if (typeof m.text === 'string') {
    return { ...empty, kind: 'text', text: m.text }
  }

  // Mídias
  const img = m.imageMessage as Record<string, unknown> | undefined
  if (img) {
    return {
      kind: 'image',
      text: typeof img.caption === 'string' ? img.caption : '',
      mimetype: typeof img.mimetype === 'string' ? img.mimetype : 'image/jpeg',
      fileName: null,
      inlineBase64: typeof img.base64 === 'string' ? img.base64 : null,
    }
  }
  const audio = m.audioMessage as Record<string, unknown> | undefined
  if (audio) {
    return {
      kind: 'audio',
      text: '',
      mimetype: typeof audio.mimetype === 'string' ? audio.mimetype : 'audio/ogg; codecs=opus',
      fileName: null,
      inlineBase64: typeof audio.base64 === 'string' ? audio.base64 : null,
    }
  }
  const vid = m.videoMessage as Record<string, unknown> | undefined
  if (vid) {
    return {
      kind: 'video',
      text: typeof vid.caption === 'string' ? vid.caption : '',
      mimetype: typeof vid.mimetype === 'string' ? vid.mimetype : 'video/mp4',
      fileName: null,
      inlineBase64: typeof vid.base64 === 'string' ? vid.base64 : null,
    }
  }
  const doc = m.documentMessage as Record<string, unknown> | undefined
  if (doc) {
    return {
      kind: 'document',
      text: typeof doc.fileName === 'string' ? doc.fileName : 'Documento',
      mimetype:
        typeof doc.mimetype === 'string' ? doc.mimetype : 'application/octet-stream',
      fileName: typeof doc.fileName === 'string' ? doc.fileName : null,
      inlineBase64: typeof doc.base64 === 'string' ? doc.base64 : null,
    }
  }
  const stk = m.stickerMessage as Record<string, unknown> | undefined
  if (stk) {
    return {
      kind: 'sticker',
      text: '',
      mimetype: typeof stk.mimetype === 'string' ? stk.mimetype : 'image/webp',
      fileName: null,
      inlineBase64: typeof stk.base64 === 'string' ? stk.base64 : null,
    }
  }

  return empty
}

function extFromMime(mime: string | null | undefined): string {
  if (!mime) return 'bin'
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/webm': 'webm',
    'audio/wav': 'wav',
    'video/mp4': 'mp4',
    'video/3gpp': '3gp',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
    'application/pdf': 'pdf',
  }
  const cleaned = mime.split(';')[0].trim().toLowerCase()
  if (map[cleaned]) return map[cleaned]
  // fallback: pega depois da barra
  return cleaned.split('/').pop() || 'bin'
}

function previewFor(kind: ParsedKind, caption: string | null): string {
  if (caption && caption.trim()) {
    const prefix =
      kind === 'image' ? '🖼️ ' :
      kind === 'video' ? '🎬 ' :
      kind === 'document' ? '📎 ' : ''
    return prefix + caption
  }
  switch (kind) {
    case 'image':
      return '🖼️ Imagem'
    case 'audio':
      return '🎤 Mensagem de voz'
    case 'video':
      return '🎬 Vídeo (confira no celular)'
    case 'document':
      return '📎 Documento'
    case 'sticker':
      return 'Figurinha'
    default:
      return ''
  }
}

function jidToPhone(jid: string | undefined | null): string | null {
  if (!jid) return null
  const cleaned = jid.split('@')[0]
  // Evolution às vezes manda formato "55349xxxxxxx:1" pra device — limpamos
  return cleaned.replace(/[^0-9]/g, '') || null
}

async function logWebhook(args: {
  svc: ReturnType<typeof createServiceClient>
  instance: string
  event?: string | null
  statusCode: number
  error?: string | null
  body?: unknown
  headers?: Record<string, string>
  query?: Record<string, string>
}) {
  try {
    await args.svc.from('evolution_webhook_logs').insert({
      instance: args.instance,
      event: args.event ?? null,
      status_code: args.statusCode,
      error: args.error ?? null,
      body: args.body ?? null,
      headers: args.headers ?? null,
      query: args.query ?? null,
    })
  } catch (e) {
    console.error('[evolution-webhook] falha ao gravar log:', e)
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ instance: string }> },
) {
  const { instance } = await context.params
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  const svc = createServiceClient()

  // Captura headers e query crus pra log (limita a chaves seguras)
  const headerSnapshot: Record<string, string> = {}
  for (const [k, v] of req.headers.entries()) {
    if (/^(content-type|user-agent|x-forwarded-for|x-real-ip|host|accept|content-length)$/i.test(k)) {
      headerSnapshot[k] = v
    }
  }
  const querySnapshot: Record<string, string> = {}
  for (const [k, v] of url.searchParams.entries()) {
    querySnapshot[k] = k === 'token' ? `${v.slice(0, 4)}…(${v.length})` : v
  }

  if (!instance) {
    await logWebhook({
      svc,
      instance: 'unknown',
      statusCode: 400,
      error: 'instance ausente',
      headers: headerSnapshot,
      query: querySnapshot,
    })
    return NextResponse.json({ error: 'instance ausente' }, { status: 400 })
  }

  // Lê o body cedo (uma única vez); guarda raw mesmo se falhar
  const rawText = await req.text()
  let body: WebhookBody = {}
  let parseError: string | null = null
  try {
    body = rawText ? (JSON.parse(rawText) as WebhookBody) : {}
  } catch (e) {
    parseError = e instanceof Error ? e.message : 'JSON inválido'
  }

  if (!token) {
    await logWebhook({
      svc,
      instance,
      event: body.event,
      statusCode: 401,
      error: 'token ausente',
      body: parseError ? { __raw: rawText.slice(0, 4000), __parseError: parseError } : body,
      headers: headerSnapshot,
      query: querySnapshot,
    })
    return NextResponse.json({ error: 'token ausente' }, { status: 401 })
  }

  const { data: row } = await svc
    .from('clinic_whatsapp')
    .select('clinic_id, webhook_token, instance_name')
    .eq('instance_name', instance)
    .maybeSingle()

  if (!row || row.webhook_token !== token) {
    await logWebhook({
      svc,
      instance,
      event: body.event,
      statusCode: 401,
      error: 'token invalido ou instance nao encontrada',
      body: parseError ? { __raw: rawText.slice(0, 4000), __parseError: parseError } : body,
      headers: headerSnapshot,
      query: querySnapshot,
    })
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }

  if (parseError) {
    await logWebhook({
      svc,
      instance,
      statusCode: 400,
      error: `JSON inválido: ${parseError}`,
      body: { __raw: rawText.slice(0, 4000) },
      headers: headerSnapshot,
      query: querySnapshot,
    })
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  // Evolution manda em formatos distintos por versao:
  //   v1.x: 'MESSAGES_UPSERT'
  //   v2.x: 'messages.upsert'
  // Normalizamos: lower + troca '.' e '-' por '_'
  const event = (body.event ?? '')
    .toString()
    .toLowerCase()
    .replace(/[.-]/g, '_')
  const data = body.data ?? {}
  const clinicId = row.clinic_id

  // Acumula erros internos pra serem persistidos junto com o log final
  const internalErrors: string[] = []
  const debugTrace: string[] = []

  try {
    switch (event) {
      case 'qrcode_updated': {
        const qrcode = (data as { qrcode?: { base64?: string } }).qrcode
        const base64 = qrcode?.base64 ?? null
        await svc
          .from('clinic_whatsapp')
          .update({
            status: 'qr_pending',
            qr_code: base64,
            qr_expires_at: new Date(Date.now() + 50_000).toISOString(),
            last_event_at: new Date().toISOString(),
          })
          .eq('clinic_id', clinicId)
        break
      }

      case 'connection_update': {
        const state = (data as { state?: string }).state ?? 'unknown'
        const mapped = mapEvolutionStateToStatus(state)
        const updates: Record<string, unknown> = {
          status: mapped,
          last_event_at: new Date().toISOString(),
        }
        if (mapped === 'connected') {
          updates.connected_at = new Date().toISOString()
          updates.qr_code = null
          updates.qr_expires_at = null
          // Quando conecta, o JID vem em data.wuid ou data.profilePictureUrl etc
          const phoneFromJid =
            jidToPhone((data as { wuid?: string }).wuid) ??
            jidToPhone((data as { ownerJid?: string }).ownerJid)
          if (phoneFromJid) updates.phone_number = phoneFromJid
        }
        await svc
          .from('clinic_whatsapp')
          .update(updates)
          .eq('clinic_id', clinicId)
        break
      }

      case 'messages_upsert': {
        const key = (data as { key?: { remoteJid?: string; fromMe?: boolean; id?: string } }).key
        const fromMe = key?.fromMe === true
        const phone = jidToPhone(key?.remoteJid)
        const parsed = pickMessageDetails((data as { message?: unknown }).message)
        const pushName = (data as { pushName?: string }).pushName
        const messageId = key?.id

        debugTrace.push(
          `parsed: phone=${phone ?? 'null'} kind=${parsed.kind} fromMe=${fromMe} pushName=${pushName ?? 'null'}`,
        )

        if (!phone) {
          internalErrors.push('mensagem ignorada: phone=null')
          break
        }
        if (parsed.kind === 'unknown') {
          internalErrors.push('mensagem ignorada: tipo nao reconhecido')
          break
        }

        // Pra mídias (exceto vídeo, que a gente só sinaliza), tenta resolver
        // base64 e salvar no Storage privado.
        let mediaUrl: string | null = null
        let mediaPath: string | null = null
        const isMedia =
          parsed.kind === 'image' ||
          parsed.kind === 'audio' ||
          parsed.kind === 'document' ||
          parsed.kind === 'sticker'

        if (isMedia) {
          let base64: string | null = parsed.inlineBase64
          let mimetype: string | null = parsed.mimetype
          let fileName: string | null = parsed.fileName

          if (!base64 && messageId) {
            const fetched = await fetchEvolutionMediaBase64({
              instanceName: instance,
              messageKey: {
                remoteJid: key?.remoteJid,
                fromMe: key?.fromMe,
                id: messageId,
              },
            })
            if (fetched.ok) {
              base64 = fetched.base64
              mimetype = mimetype || fetched.mimetype
              fileName = fileName || fetched.fileName || null
              debugTrace.push('media base64 fetched')
            } else {
              internalErrors.push(`fetch base64: ${fetched.error}`)
            }
          }

          if (base64) {
            try {
              const buffer = Buffer.from(
                base64.replace(/^data:[^;]+;base64,/, ''),
                'base64',
              )
              const ext = extFromMime(mimetype)
              const safeId = (messageId ?? `${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '-')
              const path = `${clinicId}/${phone}/${safeId}.${ext}`
              const up = await svc.storage
                .from('whatsapp-media')
                .upload(path, buffer, {
                  contentType: mimetype || 'application/octet-stream',
                  upsert: true,
                })
              if (up.error) {
                internalErrors.push(`storage upload: ${up.error.message}`)
              } else {
                mediaPath = path
                // gera signed URL de 7 dias pra UI conseguir renderizar diretamente
                const signed = await svc.storage
                  .from('whatsapp-media')
                  .createSignedUrl(path, 60 * 60 * 24 * 7)
                if (signed.data?.signedUrl) {
                  mediaUrl = signed.data.signedUrl
                }
                debugTrace.push(`media stored: ${path}`)
              }
            } catch (err) {
              internalErrors.push(
                `decode/upload base64: ${err instanceof Error ? err.message : String(err)}`,
              )
            }
          }
        }

        // Conteúdo textual + preview pra lista
        const preview = previewFor(parsed.kind, parsed.text)
        const content = parsed.text || preview // sempre não-vazio

        const insertConv = await svc.from('eva_conversations').insert({
          clinic_id: clinicId,
          phone,
          role: fromMe ? 'assistant' : 'user',
          content,
          metadata: {
            evolution_message_id: messageId,
            push_name: pushName,
            kind: parsed.kind,
            mimetype: parsed.mimetype,
            file_name: parsed.fileName,
            media_path: mediaPath,
            media_url: mediaUrl,
            caption: parsed.text || null,
          },
        })
        if (insertConv.error) {
          internalErrors.push(
            `insert eva_conversations: ${insertConv.error.message} (code=${insertConv.error.code})`,
          )
        } else {
          debugTrace.push('eva_conversations inserted ok')
        }

        const updateLast = await svc
          .from('clinic_whatsapp')
          .update({ last_event_at: new Date().toISOString() })
          .eq('clinic_id', clinicId)
        if (updateLast.error) {
          internalErrors.push(
            `update clinic_whatsapp.last_event_at: ${updateLast.error.message}`,
          )
        }

        if (!fromMe) {
          const patientRes = await svc
            .from('patients')
            .select('id')
            .eq('clinic_id', clinicId)
            .eq('phone', phone)
            .maybeSingle()
          if (patientRes.error) {
            internalErrors.push(`select patients: ${patientRes.error.message}`)
          }

          if (!patientRes.data) {
            const leadRes = await svc
              .from('leads')
              .select('id')
              .eq('clinic_id', clinicId)
              .eq('phone', phone)
              .maybeSingle()
            if (leadRes.error) {
              internalErrors.push(`select leads: ${leadRes.error.message}`)
            }

            if (!leadRes.data) {
              const insertLead = await svc.from('leads').insert({
                clinic_id: clinicId,
                name: pushName || 'Lead WhatsApp',
                phone,
                source: 'whatsapp',
                status: 'new',
                notes: `Primeira mensagem: ${content.slice(0, 240)}`,
              })
              if (insertLead.error) {
                internalErrors.push(`insert leads: ${insertLead.error.message}`)
              } else {
                debugTrace.push('lead created')
              }
            }
          }

          // Donna só recebe texto/caption — pra mídia pura, sem caption,
          // mandamos um placeholder pra que ela saiba que rolou algo.
          try {
            await forwardToDonna({
              clinicId,
              phone,
              message: parsed.text || preview,
              pushName,
              kind: parsed.kind,
              mediaUrl,
            })
            debugTrace.push('forward Donna ok')
          } catch (err) {
            internalErrors.push(
              `forward Donna: ${err instanceof Error ? err.message : String(err)}`,
            )
          }
        }
        break
      }

      default:
        // log silencioso
        break
    }
  } catch (err) {
    console.error('[evolution-webhook] erro processando evento', event, err)
    await logWebhook({
      svc,
      instance,
      event,
      statusCode: 500,
      error: `THROWN: ${err instanceof Error ? err.message : String(err)}`,
      body,
      headers: headerSnapshot,
      query: querySnapshot,
    })
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }

  // Log final consolidado: ok=200, mas se teve erros internos eles ficam visiveis no campo error
  await logWebhook({
    svc,
    instance,
    event,
    statusCode: 200,
    error: internalErrors.length
      ? `INTERNAL: ${internalErrors.join(' | ')} || TRACE: ${debugTrace.join(' -> ')}`
      : debugTrace.length
        ? `TRACE: ${debugTrace.join(' -> ')}`
        : null,
    body,
    headers: headerSnapshot,
    query: querySnapshot,
  })
  return NextResponse.json({ ok: true })
}

async function forwardToDonna(payload: {
  clinicId: string
  phone: string
  message: string
  pushName?: string
  kind?: ParsedKind
  mediaUrl?: string | null
}) {
  const { n8n_donna_url, n8n_donna_secret } = await getSettings([
    'n8n_donna_url',
    'n8n_donna_secret',
  ])
  if (!n8n_donna_url) return

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (n8n_donna_secret) headers['x-cliniq-secret'] = n8n_donna_secret

  await fetch(n8n_donna_url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      event: 'whatsapp_message_received',
      clinic_id: payload.clinicId,
      data: {
        phone: payload.phone,
        message: payload.message,
        name: payload.pushName,
        kind: payload.kind ?? 'text',
        media_url: payload.mediaUrl ?? null,
      },
    }),
  })
}

// Útil pra Evolution validar a URL ao configurar
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ instance: string }> },
) {
  const { instance } = await context.params
  return NextResponse.json({ ok: true, instance })
}
