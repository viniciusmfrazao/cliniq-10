import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { mapEvolutionStateToStatus } from '@/lib/evolution'
import { getSettings } from '@/lib/app-settings'
import {
  fetchEvolutionMediaBase64,
  cleanMimeType,
  extFromMime,
  sendWhatsappMessage,
} from '@/lib/whatsapp'

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

/**
 * Tenta extrair a nota NPS (1-5) de uma mensagem de texto.
 *
 * Formatos aceitos:
 *  - "5"           — dígito puro
 *  - "5 muito bom" — dígito + comentário
 *  - "5️⃣"         — emoji keycap
 *  - "⭐⭐⭐⭐⭐"   — estrelas (1-5)
 *
 * Retorna { score: null } se não bateu.
 */
function parseNpsScore(text: string): { score: number | null; comment: string | null } {
  if (!text) return { score: null, comment: null }
  const trimmed = text.trim()

  // 1️⃣ a 5️⃣ keycap (digit + opcional VS-16 + combining enclosing keycap U+20E3)
  const keycap = trimmed.match(/^([1-5])\uFE0F?\u20E3/u)
  if (keycap) {
    const rest = trimmed.slice(keycap[0].length).trim()
    return { score: parseInt(keycap[1], 10), comment: rest || null }
  }

  // Dígito 1-5 no início (mensagem só com nota OU nota + comentário)
  const digit = trimmed.match(/^([1-5])(?:\b|$)/)
  if (digit) {
    const rest = trimmed.slice(1).replace(/^[\s\.,!:;-]+/, '').trim()
    return { score: parseInt(digit[1], 10), comment: rest || null }
  }

  // Estrelas (⭐ U+2B50 ou ★ U+2605) — mensagem só com estrelas
  const starsOnly = trimmed.replace(/[\s\u2B50\u2605]/g, '').length === 0
  if (starsOnly) {
    const count = (trimmed.match(/[\u2B50\u2605]/g) || []).length
    if (count >= 1 && count <= 5) {
      return { score: count, comment: null }
    }
  }

  return { score: null, comment: null }
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
    .select('clinic_id, webhook_token, instance_name, auto_reply_enabled, role_inbound')
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
        // Multi-numero: atualiza so a instance que recebeu o evento
        await svc
          .from('clinic_whatsapp')
          .update({
            status: 'qr_pending',
            qr_code: base64,
            qr_expires_at: new Date(Date.now() + 50_000).toISOString(),
            last_event_at: new Date().toISOString(),
          })
          .eq('clinic_id', clinicId)
          .eq('instance_name', instance)
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
        // Multi-numero: atualiza so a instance que recebeu o evento
        await svc
          .from('clinic_whatsapp')
          .update(updates)
          .eq('clinic_id', clinicId)
          .eq('instance_name', instance)
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

        // Bloqueio de tráfego sintético: qualquer mensagem com id no padrão
        // `STRESSTEST_*` (gerada por stress-test/03-webhook.js) é processada
        // apenas pra medir latência de auth/parsing — não cria lead, não
        // dispara Eva, não toca em storage. Evita poluição do CRM e
        // disparos pra números reais que possam coincidir.
        if (messageId && /^STRESSTEST_/.test(messageId)) {
          debugTrace.push('synthetic stress-test message — skipped persist')
          break
        }

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
        let mimetype: string | null = parsed.mimetype
        let fileName: string | null = parsed.fileName
        const isMedia =
          parsed.kind === 'image' ||
          parsed.kind === 'audio' ||
          parsed.kind === 'document' ||
          parsed.kind === 'sticker'

        if (isMedia) {
          let base64: string | null = parsed.inlineBase64

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
              // Limpa parametros tipo "; codecs=opus" — o bucket compara com
              // `allowed_mime_types` por match exato e rejeita silenciosamente
              // se o mime tiver codec parameters.
              const cleanedMime =
                cleanMimeType(mimetype) || 'application/octet-stream'
              debugTrace.push(
                `media upload: kind=${parsed.kind} bytes=${buffer.length} mime=${cleanedMime}`,
              )
              const up = await svc.storage
                .from('whatsapp-media')
                .upload(path, buffer, {
                  contentType: cleanedMime,
                  upsert: true,
                })
              if (up.error) {
                internalErrors.push(
                  `storage upload (mime=${cleanedMime}, ext=${ext}): ${up.error.message}`,
                )
              } else {
                mediaPath = path
                // gera signed URL de 7 dias pra UI conseguir renderizar diretamente
                const signed = await svc.storage
                  .from('whatsapp-media')
                  .createSignedUrl(path, 60 * 60 * 24 * 7)
                if (signed.error) {
                  internalErrors.push(`signed url: ${signed.error.message}`)
                } else if (signed.data?.signedUrl) {
                  mediaUrl = signed.data.signedUrl
                }
                debugTrace.push(`media stored: ${path}`)
              }
              // Atualiza o mimetype salvo no metadata pra a versao limpa
              // (deixa o frontend tranquilo pra renderizar audio/video tag)
              mimetype = cleanedMime
            } catch (err) {
              internalErrors.push(
                `decode/upload base64: ${err instanceof Error ? err.message : String(err)}`,
              )
            }
          } else {
            internalErrors.push(`media sem base64 disponivel (kind=${parsed.kind})`)
          }
        }

        // Conteúdo textual + preview pra lista
        const preview = previewFor(parsed.kind, parsed.text)
        let content = parsed.text || preview // sempre não-vazio

        // ─── TRANSCRIÇÃO DE ÁUDIO (Whisper) ──────────────────────────────
        // Se for áudio do paciente (fromMe=false), transcreve via Whisper.
        // O base64 pode vir inline ou ser buscado via fetchEvolutionMediaBase64.
        let transcription: string | null = null
        if (parsed.kind === 'audio' && !fromMe) {
          // base64 já resolvido acima no bloco de isMedia (pode ser inline ou fetched)
          const audioBase64 = parsed.inlineBase64 ?? (mediaPath ? null : null)
          
          // Busca o base64 se ainda não temos (o bloco isMedia só roda pra salvar no storage,
          // mas o base64 original pode ter sido consumido lá — re-fetch se necessário)
          let base64ForWhisper = parsed.inlineBase64
          if (!base64ForWhisper && messageId) {
            const fetched = await fetchEvolutionMediaBase64({
              instanceName: instance,
              messageKey: {
                remoteJid: key?.remoteJid,
                fromMe: key?.fromMe,
                id: messageId,
              },
            })
            if (fetched.ok) {
              base64ForWhisper = fetched.base64
              debugTrace.push('whisper: base64 re-fetched for transcription')
            }
          }

          if (base64ForWhisper) {
            try {
              const openAiKey = process.env.OPENAI_API_KEY
              if (openAiKey) {
                const audioBuffer = Buffer.from(
                  base64ForWhisper.replace(/^data:[^;]+;base64,/, ''),
                  'base64',
                )
                const blob = new Blob([audioBuffer], {
                  type: cleanMimeType(mimetype) || 'audio/ogg',
                })
                const form = new FormData()
                form.append('file', blob, 'audio.ogg')
                form.append('model', 'whisper-1')
                form.append('language', 'pt')

                const whisperRes = await fetch(
                  'https://api.openai.com/v1/audio/transcriptions',
                  {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${openAiKey}` },
                    body: form,
                  },
                )
                if (whisperRes.ok) {
                  const whisperData = (await whisperRes.json()) as { text?: string }
                  transcription = whisperData.text?.trim() || null
                  if (transcription) {
                    content = transcription
                    debugTrace.push(`whisper: "${transcription.slice(0, 80)}"`)
                  }
                } else {
                  const err = await whisperRes.text()
                  internalErrors.push(`whisper: ${whisperRes.status} ${err.slice(0, 100)}`)
                }
              } else {
                debugTrace.push('whisper: OPENAI_API_KEY não configurada')
              }
            } catch (err) {
              internalErrors.push(`whisper error: ${err instanceof Error ? err.message : String(err)}`)
            }
          } else {
            debugTrace.push('whisper: sem base64 disponível para transcrição')
          }
        }
        // ─────────────────────────────────────────────────────────────────

        const finalMime = cleanMimeType(mimetype) ?? cleanMimeType(parsed.mimetype)
        const baseMetadata = {
          evolution_message_id: messageId,
          instance_name: instance,
          push_name: pushName,
          kind: parsed.kind,
          mimetype: finalMime,
          file_name: fileName ?? parsed.fileName,
          media_path: mediaPath,
          media_url: mediaUrl,
          caption: parsed.text || null,
          transcription: transcription || undefined,
        }

        // Dedupe: se ja temos uma row pra esse messageId (porque o
        // /api/whatsapp/send inseriu antes, no caso de outbound), so
        // atualizamos media_path/media_url se a row nao tinha (pra texto
        // o /send ja insere completo, entao nao tem o que atualizar).
        let dedupHit = false
        if (messageId) {
          const { data: existing } = await svc
            .from('eva_conversations')
            .select('id, metadata')
            .eq('clinic_id', clinicId)
            .filter('metadata->>evolution_message_id', 'eq', messageId)
            .limit(1)
            .maybeSingle()
          if (existing) {
            dedupHit = true
            const existingMeta =
              (existing.metadata as Record<string, unknown> | null) ?? {}
            // Se a row anterior nao tinha media_url e agora a temos,
            // atualiza so essas chaves preservando o resto.
            if (!existingMeta.media_url && mediaUrl) {
              const merged = {
                ...existingMeta,
                media_path: mediaPath,
                media_url: mediaUrl,
                mimetype: finalMime ?? existingMeta.mimetype,
              }
              const { error: updErr } = await svc
                .from('eva_conversations')
                .update({ metadata: merged })
                .eq('id', existing.id)
              if (updErr) {
                internalErrors.push(`update merged metadata: ${updErr.message}`)
              } else {
                debugTrace.push('dedup: merged media into outbound row')
              }
            } else {
              debugTrace.push('dedup: outbound row ja completo')
            }
          }
        }

        if (!dedupHit) {
          const insertConv = await svc.from('eva_conversations').insert({
            clinic_id: clinicId,
            phone,
            role: fromMe ? 'assistant' : 'user',
            content,
            metadata: baseMetadata,
          })
          if (insertConv.error) {
            internalErrors.push(
              `insert eva_conversations: ${insertConv.error.message} (code=${insertConv.error.code})`,
            )
          } else {
            debugTrace.push('eva_conversations inserted ok')
          }
        }

        // Multi-numero: atualiza last_event_at so na instance que recebeu
        const updateLast = await svc
          .from('clinic_whatsapp')
          .update({ last_event_at: new Date().toISOString() })
          .eq('clinic_id', clinicId)
          .eq('instance_name', instance)
        if (updateLast.error) {
          internalErrors.push(
            `update clinic_whatsapp.last_event_at: ${updateLast.error.message}`,
          )
        }

        if (!fromMe) {
          // Flag local: motivos pra pular o disparo da Eva nessa msg.
          //   'auto_reply_off'    -> instância em modo manual (toggle off)
          //   'nps_anti_eco'      -> resposta NPS recém-capturada (cooldown 5min)
          //   'pause_until'       -> lead.eva_pause_until > now() (cooldown ativo)
          //   'human_review'      -> lead.needs_human_review=true (humano assumiu)
          //   'media_escalated'   -> midia (foto/audio/video) — humano cuida agora
          let evaShouldSkip:
            | false
            | 'auto_reply_off'
            | 'inbound_disabled'
            | 'nps_anti_eco'
            | 'pause_until'
            | 'human_review'
            | 'media_escalated' = false
          // Janela do anti-eco do NPS: 5 min depois da nota, Eva fica calada
          const NPS_COOLDOWN_MS = 5 * 60 * 1000
          let npsCooldownUntil: string | null = null

          // Toggle Eva auto/manual: se a instância está com Eva pausada, salvamos
          // a mensagem normalmente mas não disparamos eva-process. Secretária
          // responde manualmente pelo painel.
          if (row.auto_reply_enabled === false) {
            evaShouldSkip = 'auto_reply_off'
            debugTrace.push('eva skip: auto_reply_enabled=false')
          }

          // Multi-número: só a linha com "Eva atende mensagens recebidas" dispara a Eva.
          if (evaShouldSkip === false && row.role_inbound === false) {
            evaShouldSkip = 'inbound_disabled'
            debugTrace.push('eva skip: role_inbound=false (use este número só manual/automações)')
          }

          // .limit(1) + array pra ser resiliente a duplicatas (algum import
          // ou stress test antigo pode ter criado 2+ pacientes com mesmo
          // phone+clinic_id, o que quebra .maybeSingle()).
          const patientResRaw = await svc
            .from('patients')
            .select('id')
            .eq('clinic_id', clinicId)
            .eq('phone', phone)
            .order('created_at', { ascending: true })
            .limit(1)
          if (patientResRaw.error) {
            internalErrors.push(`select patients: ${patientResRaw.error.message}`)
          }
          const patientRes = {
            data: patientResRaw.data?.[0] ?? null,
            error: patientResRaw.error,
          }

          // Captura automática de resposta NPS — só pra texto de pacientes
          if (patientRes.data && parsed.kind === 'text' && parsed.text) {
            const { score, comment } = parseNpsScore(parsed.text)
            if (score != null) {
              const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
              const { data: pendingNps, error: errPending } = await svc
                .from('nps_responses')
                .select('id')
                .eq('clinic_id', clinicId)
                .eq('patient_id', patientRes.data.id)
                .is('replied_at', null)
                .in('status', ['sent', 'skipped'])
                .gte('sent_at', cutoff)
                .order('sent_at', { ascending: false })
                .limit(1)
                .maybeSingle()

              if (errPending) {
                // Tabela pode não existir ainda em ambientes sem o SQL rodado.
                if (!/nps_responses/i.test(errPending.message)) {
                  internalErrors.push(`select nps pending: ${errPending.message}`)
                }
              } else if (pendingNps?.id) {
                const { error: updErr } = await svc
                  .from('nps_responses')
                  .update({
                    score,
                    comment,
                    replied_at: new Date().toISOString(),
                    status: 'replied',
                  })
                  .eq('id', pendingNps.id)
                if (updErr) {
                  internalErrors.push(`update nps reply: ${updErr.message}`)
                } else {
                  debugTrace.push(`NPS captured: score=${score}`)
                  // Anti-eco: Eva fica calada por 5 min pra essa paciente
                  // (evita resposta "Que felicidade!" em cima do "5" puro).
                  // O lead update mais abaixo aplica o eva_pause_until.
                  if (evaShouldSkip === false) evaShouldSkip = 'nps_anti_eco'
                  npsCooldownUntil = new Date(Date.now() + NPS_COOLDOWN_MS).toISOString()
                }
              }
            }
          }

          // CRM: sempre garante um lead vivo pra essa conversa, mesmo se ja
          // existe paciente cadastrado com o mesmo telefone (paciente antigo
          // voltando pra novo procedimento conta como oportunidade de CRM).
          // Se ja tem lead, atualiza last_contact_at e o nome se estiver
          // generico ("Lead WhatsApp"); senao, cria novo.
          {
            const leadRes = await svc
              .from('leads')
              .select('id, name, status, eva_pause_until, needs_human_review')
              .eq('clinic_id', clinicId)
              .eq('phone', phone)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()
            if (leadRes.error) {
              internalErrors.push(`select leads: ${leadRes.error.message}`)
            }

            // Lead foi escalado pra humano (cancelamento/reclamacao/foto/etc).
            // Eva fica calada ate alguem clicar "Devolver pra Eva" no painel.
            if (evaShouldSkip === false && leadRes.data?.needs_human_review === true) {
              evaShouldSkip = 'human_review'
              debugTrace.push('eva skip: needs_human_review=true (humano assumiu)')
            }

            // Cooldown ainda ativo de evento anterior (NPS, manual, etc.)
            if (
              evaShouldSkip === false &&
              leadRes.data?.eva_pause_until &&
              new Date(leadRes.data.eva_pause_until).getTime() > Date.now()
            ) {
              evaShouldSkip = 'pause_until'
              debugTrace.push(
                `eva skip: lead em cooldown ate ${leadRes.data.eva_pause_until}`,
              )
            }

            if (!leadRes.data) {
              const insertLead = await svc.from('leads').insert({
                clinic_id: clinicId,
                name: pushName || 'Lead WhatsApp',
                phone,
                source: 'whatsapp',
                status: 'new',
                whatsapp_instance: instance,
                notes: `Primeira mensagem: ${content.slice(0, 240)}`,
                last_contact_at: new Date().toISOString(),
                eva_pause_until: npsCooldownUntil,
              })
              if (insertLead.error) {
                internalErrors.push(`insert leads: ${insertLead.error.message}`)
              } else {
                debugTrace.push('lead created')
              }
            } else {
              // Touch no lead existente: atualiza last_contact_at, e se o nome
              // estava generico ou vazio e agora temos pushName real, melhora.
              const patch: Record<string, unknown> = {
                last_contact_at: new Date().toISOString(),
              }
              const looksGeneric =
                !leadRes.data.name ||
                /^lead whatsapp$/i.test(leadRes.data.name) ||
                leadRes.data.name.trim().length < 2
              if (looksGeneric && pushName && pushName.trim().length >= 2) {
                patch.name = pushName.trim()
              }
              // Se estava marcado como lost/converted e ele esta voltando,
              // reativa pra contacted (oportunidade de re-engajar).
              if (leadRes.data.status === 'lost') {
                patch.status = 'contacted'
              }
              // Se NPS foi capturado agora, aplica cooldown de 5min na Eva
              // (sobrescreve cooldown anterior pra renovar a janela).
              if (npsCooldownUntil) {
                patch.eva_pause_until = npsCooldownUntil
              }
              const updLead = await svc
                .from('leads')
                .update(patch)
                .eq('id', leadRes.data.id)
              if (updLead.error) {
                internalErrors.push(`update lead touch: ${updLead.error.message}`)
              } else {
                debugTrace.push(`lead touched (id=${leadRes.data.id})`)
              }
            }
          }

          // ─── MÍDIA RECEBIDA: escalar pra humano ─────────────────────────
          // A Eva nao consegue ouvir audio, ver imagem ou ler video/documento
          // hoje. Antes ela recebia "🎤 Mensagem de voz" como texto e respondia
          // no escuro, gerando confusao. Agora detectamos midia, mandamos uma
          // resposta padrao avisando que a equipe vai assumir, e marcamos o
          // lead como needs_human_review pra aparecer destacado no CRM.
          //
          // Excecao: imagem/video/documento COM caption nao-vazio. Nesse caso
          // a Eva consegue responder a duvida do caption (ela nao precisa ver
          // a imagem em si, so o texto que veio junto).
          const isMediaToEscalate =
            (parsed.kind === 'audio' ||
              parsed.kind === 'image' ||
              parsed.kind === 'video' ||
              parsed.kind === 'document' ||
              parsed.kind === 'sticker') &&
            // audio com transcrição bem-sucedida: Eva responde normalmente, não escala
            !(parsed.kind === 'audio' && transcription) &&
            // pra image/video/document: so escala se NAO tem caption util
            (parsed.kind === 'audio' ||
              parsed.kind === 'sticker' ||
              !(parsed.text && parsed.text.trim().length >= 3))

          if (isMediaToEscalate) {
            const mediaLabel =
              parsed.kind === 'audio'
                ? 'mensagem de voz'
                : parsed.kind === 'image'
                  ? 'foto'
                  : parsed.kind === 'video'
                    ? 'vídeo'
                    : parsed.kind === 'document'
                      ? 'documento'
                      : 'figurinha'

            const autoReply =
              parsed.kind === 'sticker' || parsed.kind === 'audio'
                ? null // audio: Eva transcreve e responde. sticker: não precisa de resposta
                : `Recebi sua ${mediaLabel}! Ainda não consigo analisar este tipo de arquivo aqui. ` +
                  `Já estou avisando alguém da nossa equipe pra te responder com cuidado, tá? 💜`

            // Envia auto-resposta (best-effort — se falhar, segue o jogo)
            if (autoReply) {
              try {
                const sendRes = await sendWhatsappMessage({
                  clinicId,
                  phone,
                  message: autoReply,
                  instanceName: instance,
                })
                if (sendRes.ok) {
                  debugTrace.push(`media auto-reply sent (kind=${parsed.kind})`)
                  // Registra a resposta no historico da conversa
                  await svc.from('eva_conversations').insert({
                    clinic_id: clinicId,
                    phone,
                    role: 'assistant',
                    content: autoReply,
                    metadata: {
                      kind: 'text',
                      auto_reply_for_media: parsed.kind,
                      generated_by: 'media_escalation',
                    },
                  })
                } else {
                  internalErrors.push(
                    `media auto-reply failed: ${sendRes.error}`,
                  )
                }
              } catch (e) {
                internalErrors.push(
                  `media auto-reply threw: ${e instanceof Error ? e.message : String(e)}`,
                )
              }
            }

            // Marca o lead pra atendimento humano com motivo claro.
            // (Sticker tambem escala — eh sinal de que o lead precisa de atencao)
            const reviewReason = 'media_recebida'
            const reviewDetails =
              `Lead enviou ${mediaLabel}` +
              (parsed.text ? ` com legenda: "${parsed.text.slice(0, 200)}"` : '') +
              (mediaUrl ? ` — Mídia: ${mediaUrl}` : '')

            const { error: escErr } = await svc
              .from('leads')
              .update({
                needs_human_review: true,
                human_review_reason: reviewReason,
                human_review_details: reviewDetails,
                human_review_at: new Date().toISOString(),
                last_contact_at: new Date().toISOString(),
              })
              .eq('clinic_id', clinicId)
              .eq('phone', phone)
            if (escErr) {
              internalErrors.push(`escalate lead (media): ${escErr.message}`)
            } else {
              debugTrace.push(`lead escalated to human (media: ${parsed.kind})`)
            }

            // Pula completamente o forward pra Eva — humano cuida agora
            evaShouldSkip = 'media_escalated'
            debugTrace.push('eva skip: media_escalated_to_human')
          }

          // Disparo da Eva. Pula em 4 cenários:
          //   - toggle auto/manual desligado pra essa instância
          //   - resposta NPS recém-capturada (5min de silêncio anti-eco)
          //   - lead.eva_pause_until ainda no futuro (cooldown ativo)
          //   - midia recebida (audio/foto sem caption) — escalado pra humano
          if (evaShouldSkip) {
            debugTrace.push(`forward Donna SKIPPED (${evaShouldSkip})`)
          } else {
            // Donna só recebe texto/caption — pra mídia pura, sem caption,
            // mandamos um placeholder pra que ela saiba que rolou algo.
            try {
              const fwd = await forwardToDonna({
                clinicId,
                instance,
                phone,
                remoteJid: key?.remoteJid ?? `${phone}@s.whatsapp.net`,
                messageId: messageId ?? null,
                message: content, // usa content — já tem transcrição se áudio foi transcrito
                pushName,
                kind: parsed.kind,
                mediaUrl,
              })
              if (fwd.ok) {
                debugTrace.push(
                  `forward Donna ok (engine=${fwd.engine}, status=${fwd.status}${fwd.silentFail ? ', silentFail=' + fwd.silentFail : ''}${fwd.sent === false ? ', NOT_SENT' : ''})`,
                )
              } else {
                internalErrors.push(
                  `forward Donna FAIL (engine=${fwd.engine}, status=${fwd.status}): ${fwd.error?.slice(0, 400) ?? 'sem detalhes'}`,
                )
              }
            } catch (err) {
              internalErrors.push(
                `forward Donna threw: ${err instanceof Error ? err.message : String(err)}`,
              )
            }
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

type ForwardResult = {
  ok: boolean
  engine: 'edge' | 'n8n' | 'none'
  status: number
  error?: string
  /** Se a edge fez silentFail (lead em human review), aparece aqui */
  silentFail?: string
  /** Se a edge confirmou envio pela Evolution (false = falhou) */
  sent?: boolean
}

async function forwardToDonna(payload: {
  clinicId: string
  instance: string
  phone: string
  remoteJid: string
  messageId: string | null
  message: string
  pushName?: string
  kind?: ParsedKind
  mediaUrl?: string | null
}): Promise<ForwardResult> {
  // Roteador: lê app_settings.eva_engine pra decidir entre n8n (legado) ou
  // Edge Function eva-process (novo). Default: n8n (sem mudança).
  const settings = await getSettings([
    'eva_engine',
    'eva_edge_url',
    'eva_internal_secret',
    'n8n_donna_url',
    'n8n_donna_secret',
  ])
  const engine = (settings.eva_engine || 'n8n').toLowerCase()

  if (engine === 'edge') {
    return forwardToEdgeFunction(payload, {
      url: settings.eva_edge_url || '',
      secret: settings.eva_internal_secret || '',
    })
  }

  // ─── Legado: n8n ────────────────────────────────────────────────────────
  const { n8n_donna_url, n8n_donna_secret } = settings
  if (!n8n_donna_url) {
    return { ok: false, engine: 'none', status: 0, error: 'n8n_donna_url ausente' }
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (n8n_donna_secret) headers['x-cliniq-secret'] = n8n_donna_secret

  const evolutionLikeMessage =
    payload.kind === 'text' || !payload.kind
      ? { conversation: payload.message }
      : payload.kind === 'image'
        ? { imageMessage: { caption: payload.message, url: payload.mediaUrl ?? undefined } }
        : payload.kind === 'audio'
          ? { audioMessage: { url: payload.mediaUrl ?? undefined } }
          : payload.kind === 'video'
            ? { videoMessage: { caption: payload.message, url: payload.mediaUrl ?? undefined } }
            : payload.kind === 'document'
              ? { documentMessage: { caption: payload.message, url: payload.mediaUrl ?? undefined } }
              : { conversation: payload.message }

  try {
    const r = await fetch(n8n_donna_url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        event: 'messages.upsert',
        instance: payload.instance,
        clinic_id: payload.clinicId,
        data: {
          key: {
            remoteJid: payload.remoteJid,
            fromMe: false,
            id: payload.messageId ?? `cliniq-${Date.now()}`,
          },
          message: evolutionLikeMessage,
          pushName: payload.pushName ?? null,
          messageType: payload.kind ?? 'text',
        },
        _cliniq: {
          kind: payload.kind ?? 'text',
          media_url: payload.mediaUrl ?? null,
          forwarded_from: 'cliniq-app',
        },
      }),
    })
    if (!r.ok) {
      const txt = await r.text().catch(() => '')
      return { ok: false, engine: 'n8n', status: r.status, error: txt.slice(0, 400) }
    }
    return { ok: true, engine: 'n8n', status: r.status }
  } catch (err) {
    return {
      ok: false,
      engine: 'n8n',
      status: 0,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Encaminha pra Edge Function eva-process (novo motor).
 *
 * Autenticação: usa SUPABASE_SERVICE_ROLE_KEY como Bearer. Se houver
 * `eva_internal_secret` em app_settings, manda também em x-eva-secret pra
 * dar uma camada extra de proteção.
 */
async function forwardToEdgeFunction(
  payload: {
    clinicId: string
    instance: string
    phone: string
    message: string
    pushName?: string
    kind?: ParsedKind
    mediaUrl?: string | null
    messageId: string | null
  },
  cfg: { url: string; secret: string },
): Promise<ForwardResult> {
  if (!cfg.url) {
    return { ok: false, engine: 'edge', status: 0, error: 'eva_edge_url ausente em app_settings' }
  }
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return { ok: false, engine: 'edge', status: 0, error: 'SUPABASE_SERVICE_ROLE_KEY ausente no env do Vercel' }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  }
  if (cfg.secret) headers['x-eva-secret'] = cfg.secret

  try {
    const r = await fetch(cfg.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        clinicId: payload.clinicId,
        instance: payload.instance,
        phone: payload.phone,
        userText: payload.message,
        customerName: payload.pushName ?? null,
        kind: payload.kind ?? 'text',
        mediaUrl: payload.mediaUrl ?? null,
        messageId: payload.messageId ?? null,
      }),
    })

    const txt = await r.text().catch(() => '')

    if (!r.ok) {
      console.error(`[eva-edge] resposta ${r.status}: ${txt.slice(0, 400)}`)
      return { ok: false, engine: 'edge', status: r.status, error: txt.slice(0, 400) }
    }

    // Body pode trazer { silentFail, sent, errors } — captura pra log
    let silentFail: string | undefined
    let sent: boolean | undefined
    let bodyErrors: string | undefined
    try {
      const parsed = JSON.parse(txt) as {
        silentFail?: boolean
        reason?: string
        sent?: boolean
        errors?: string[]
      }
      if (parsed.silentFail) silentFail = parsed.reason ?? 'silent_fail'
      if (typeof parsed.sent === 'boolean') sent = parsed.sent
      if (Array.isArray(parsed.errors) && parsed.errors.length) {
        bodyErrors = parsed.errors.slice(0, 3).join(' | ').slice(0, 300)
      }
    } catch {
      // body não é JSON — sem problemas
    }

    if (sent === false || bodyErrors) {
      return {
        ok: false,
        engine: 'edge',
        status: r.status,
        silentFail,
        sent,
        error: `body errors: ${bodyErrors ?? 'sent=false'}`,
      }
    }

    return { ok: true, engine: 'edge', status: r.status, silentFail, sent }
  } catch (err) {
    return {
      ok: false,
      engine: 'edge',
      status: 0,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// Útil pra Evolution validar a URL ao configurar
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ instance: string }> },
) {
  const { instance } = await context.params
  return NextResponse.json({ ok: true, instance })
}
