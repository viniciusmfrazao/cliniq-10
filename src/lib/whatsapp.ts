import { createServiceClient } from '@/lib/supabase/server'
import { getSettings } from '@/lib/app-settings'

/**
 * Valor de `leads.eva_pause_until` que representa "pausada por tempo
 * indeterminado". Usado sempre que um humano assume o atendimento (resposta
 * pelo painel ou digitação direta pelo WhatsApp da clínica). Só volta ao
 * automático quando alguém clica em "Devolver pra Eva", que zera o campo.
 */
export const PAUSE_INDEFINITE_ISO = '2099-12-31T23:59:59.999Z'

export type PersistResult = {
  ok: boolean
  conversation_id?: string
  evolution_message_id?: string | null
  media_path?: string | null
  warnings: string[]
}

/**
 * Grava a mensagem de saída (manual OU automação) em `eva_conversations`
 * logo após o envio, sem depender do eco do webhook da Evolution.
 *
 * Isso é necessário porque mensagens enviadas via API (automações e o
 * painel manual) muitas vezes NÃO voltam como evento `messages_upsert`
 * (fromMe=true) — dependendo da instância/versão da Evolution, o eco só
 * acontece para mensagens mandadas pelo próprio app do WhatsApp. Sem essa
 * gravação direta, a Eva nunca vê o que a automação mandou (fica sem
 * contexto pra responder) e a UI do painel fica com buraco na conversa.
 *
 * Dedupe: se o webhook chegar depois com o mesmo evolution_message_id,
 * a checagem por evolution_message_id evita duplicar a linha.
 */
export async function persistOutboundMessage(args: {
  clinicId: string
  phone: string
  type: 'text' | 'image' | 'video' | 'audio'
  message?: string
  caption?: string
  media?: string
  mimetype?: string
  fileName?: string
  evolutionResult: unknown
  purpose: 'manual' | 'automation'
  userId?: string | null
  /** Extra pra debug (ex: nome da automação, botões enviados). */
  extraMetadata?: Record<string, unknown>
}): Promise<PersistResult> {
  const warnings: string[] = []
  const svc = createServiceClient()
  const normalizedPhone = normalizePhone(args.phone)

  const evolutionMessageId =
    (args.evolutionResult as { key?: { id?: string } } | null | undefined)?.key?.id ?? null

  let mediaPath: string | null = null
  let mediaUrl: string | null = null
  let cleanedMime: string | null = null

  if ((args.type === 'image' || args.type === 'video' || args.type === 'audio') && args.media) {
    if (/^https?:\/\//i.test(args.media)) {
      // Media já é uma URL pública (comum em áudio de automação) — não
      // decodifica/reenvia pro storage, só referencia direto.
      mediaUrl = args.media
      cleanedMime = cleanMimeType(args.mimetype) ?? null
    } else try {
      const decoded = base64ToBuffer(args.media)
      const inferredMime =
        cleanMimeType(args.mimetype) ||
        cleanMimeType(decoded.detectedMime) ||
        (args.type === 'image' ? 'image/jpeg' : args.type === 'video' ? 'video/mp4' : 'audio/ogg')
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
      warnings.push(`decode/upload: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const previewByKind =
    args.type === 'image' ? '🖼️ Imagem' : args.type === 'video' ? '🎬 Vídeo' : args.type === 'audio' ? '🎤 Mensagem de voz' : ''
  const content = args.message || args.caption || previewByKind

  if (evolutionMessageId) {
    const { data: existing } = await svc
      .from('eva_conversations')
      .select('id, metadata')
      .eq('clinic_id', args.clinicId)
      .eq('evolution_message_id', evolutionMessageId)
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
        warnings: [...warnings, 'dedup: row ja existia'],
      }
    }
  }

  const insertRes = await svc
    .from('eva_conversations')
    .insert({
      clinic_id: args.clinicId,
      phone: normalizedPhone,
      role: 'assistant',
      // Autoria: 'manual' = uma pessoa da equipe digitou no painel;
      // 'automation' = disparo do sistema (lembrete, NPS, campanha).
      // A Eva usa isso pra não confundir mensagem alheia com memória própria.
      author: args.purpose === 'manual' ? 'human' : 'automation',
      content,
      metadata: {
        evolution_message_id: evolutionMessageId,
        kind: args.type,
        mimetype: cleanedMime,
        file_name: args.fileName ?? null,
        media_path: mediaPath,
        media_url: mediaUrl,
        caption: args.caption ?? null,
        outbound: true,
        outbound_purpose: args.purpose,
        ...(args.extraMetadata ?? {}),
      },
      evolution_message_id: evolutionMessageId,
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

  await svc
    .from('clinic_whatsapp')
    .update({ last_event_at: new Date().toISOString() })
    .eq('clinic_id', args.clinicId)

  return {
    ok: true,
    conversation_id: insertRes.data?.id,
    evolution_message_id: evolutionMessageId,
    media_path: mediaPath,
    warnings,
  }
}

export type SendResult =
  | { ok: true; result: unknown }
  | { ok: false; error: string; code: 'not_configured' | 'not_connected' | 'evolution_error' | 'unknown' | 'rate_limited' }

/**
 * Telefone internacional (não-BR) é reconhecido pelo "+" na frente, salvo
 * no cadastro do paciente (ex: "+1 305 555 0100" -> aqui chega como raw).
 * Nesse caso o código do país já está incluso e NÃO deve levar o prefixo "55".
 */
function isInternationalRaw(raw: string): boolean {
  return raw.trim().startsWith('+')
}

export function normalizePhone(raw: string): string {
  if (isInternationalRaw(raw)) {
    return raw.replace(/\D/g, '')
  }
  let p = raw.replace(/\D/g, '')
  if (!p.startsWith('55')) p = '55' + p
  return p
}

/**
 * Valida se um telefone (raw ou já normalizado) é um número válido para WhatsApp.
 *
 * BR: 55 + DDD (2 dígitos) + número (8 ou 9 dígitos) = 12 ou 13 dígitos, DDD 11-99.
 * Internacional (marcado com "+" no raw): aceita 8-15 dígitos após o código do país,
 * sem a regra de DDD brasileiro.
 *
 * IDs de usuário do Facebook/Instagram (ex: 159712721031297) têm 15+ dígitos
 * e são rejeitados aqui com mensagem clara.
 */
export function isValidPhone(raw: string): boolean {
  const p = normalizePhone(raw)
  if (isInternationalRaw(raw)) {
    return p.length >= 8 && p.length <= 15
  }
  // Deve começar com 55 e ter 12 (fixo) ou 13 (celular) dígitos
  if (!/^55\d{10,11}$/.test(p)) return false
  // DDD válido: 11–99
  const ddd = parseInt(p.slice(2, 4), 10)
  if (ddd < 11 || ddd > 99) return false
  return true
}

/**
 * Remove parametros tipo "; codecs=opus" do mimetype.
 * Bucket Storage compara `allowed_mime_types` por match exato.
 */
export function cleanMimeType(mime: string | null | undefined): string | null {
  if (!mime) return null
  return mime.split(';')[0].trim().toLowerCase() || null
}

/**
 * Mapa de mime -> extensao usada pelos paths no Storage.
 */
export function extFromMime(mime: string | null | undefined): string {
  const cleaned = cleanMimeType(mime)
  if (!cleaned) return 'bin'
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
  if (map[cleaned]) return map[cleaned]
  return cleaned.split('/').pop() || 'bin'
}

type ResolvedInstance = {
  instanceName: string
  baseUrl: string
  apiKey: string
}

/**
 * Proposito do envio — define qual numero da clinica usar quando ela tem
 * mais de um WhatsApp configurado.
 *
 *  - 'automation': cron jobs (NPS, aniversario, lembrete, recall, confirmacao)
 *  - 'manual':     secretaria mandando pelo painel (`/dashboard/whatsapp`)
 *  - 'inbound':    Eva respondendo lead (deveria usar a mesma instance que
 *                  recebeu — caller passa instanceName direto)
 *  - 'any':        nao se importa qual numero (usa o default)
 *
 * Hint: callers que querem escolher um numero especifico podem passar
 * `instanceName` direto pra resolveInstanceByName().
 */
export type SendPurpose = 'automation' | 'manual' | 'inbound' | 'any'

type ResolveOpts = {
  /** Quando informado, escolhe o numero certo conforme as flags da tabela. */
  purpose?: SendPurpose
  /** Quando informado, ignora purpose e usa esse instance especifico. */
  instanceName?: string
  /** Quando informado em manual, prioriza numero atribuido a esse user. */
  assignedTo?: string | null
}

type WaRow = {
  id: string
  instance_name: string
  status: string
  is_default: boolean | null
  role_inbound: boolean | null
  role_outbound_automation: boolean | null
  role_outbound_manual: boolean | null
  assigned_to: string | null
  label: string | null
}

/**
 * Escolhe a melhor instance da clinica conforme purpose.
 *
 * Algoritmo:
 *  1. Carrega todas as instances connected da clinica
 *  2. Filtra por papel adequado ao purpose
 *  3. Preferencia: assignedTo (manual) -> is_default -> primeira encontrada
 *  4. Se nao tem ninguem com o papel, fallback pro is_default
 *  5. Se nao tem default, fallback pra primeira connected
 *  6. Se nao tem nenhuma connected, retorna 'not_connected'
 */
async function resolveInstance(
  clinicId: string,
  opts: ResolveOpts = {},
): Promise<{ ok: true; data: ResolvedInstance } | { ok: false; error: SendResult }> {
  const settings = await getSettings(['evolution_url', 'evolution_master_key'])
  if (!settings.evolution_url || !settings.evolution_master_key) {
    return {
      ok: false,
      error: {
        ok: false,
        code: 'not_configured',
        error:
          'Evolution API não configurada (super_admin precisa preencher em /admin/evolution)',
      },
    }
  }

  const supabase = createServiceClient()

  // Caminho rapido: caller pediu um instance especifico
  if (opts.instanceName) {
    const { data } = await supabase
      .from('clinic_whatsapp')
      .select('instance_name, status')
      .eq('clinic_id', clinicId)
      .eq('instance_name', opts.instanceName)
      .maybeSingle()
    if (!data?.instance_name) {
      return {
        ok: false,
        error: {
          ok: false,
          code: 'not_configured',
          error: `Numero ${opts.instanceName} nao pertence a esta clinica`,
        },
      }
    }
    if (data.status !== 'connected') {
      return {
        ok: false,
        error: {
          ok: false,
          code: 'not_connected',
          error: `Numero ${opts.instanceName} nao esta conectado (status: ${data.status})`,
        },
      }
    }
    return {
      ok: true,
      data: {
        instanceName: data.instance_name,
        baseUrl: settings.evolution_url.replace(/\/$/, ''),
        apiKey: settings.evolution_master_key,
      },
    }
  }

  const { data: rows } = await supabase
    .from('clinic_whatsapp')
    .select(
      'id, instance_name, status, is_default, role_inbound, role_outbound_automation, role_outbound_manual, assigned_to, label',
    )
    .eq('clinic_id', clinicId)

  const list = ((rows ?? []) as WaRow[]).filter(r => r.instance_name)
  if (list.length === 0) {
    return {
      ok: false,
      error: {
        ok: false,
        code: 'not_configured',
        error: 'Clínica não tem WhatsApp configurado',
      },
    }
  }

  const connected = list.filter(r => r.status === 'connected')
  if (connected.length === 0) {
    return {
      ok: false,
      error: {
        ok: false,
        code: 'not_connected',
        error: `Nenhum WhatsApp da clínica está conectado (status: ${list[0]?.status})`,
      },
    }
  }

  const purpose = opts.purpose ?? 'any'

  // Filtragem por papel
  const matchingRole =
    purpose === 'automation'
      ? connected.filter(r => r.role_outbound_automation === true)
      : purpose === 'manual'
        ? connected.filter(r => r.role_outbound_manual === true)
        : purpose === 'inbound'
          ? connected.filter(r => r.role_inbound === true)
          : connected

  // Pool a usar: se ninguem tem o papel certo, cai pro is_default
  const pool = matchingRole.length > 0 ? matchingRole : connected

  // Em 'manual', priorizar numero atribuido ao user logado
  let chosen: WaRow | undefined
  if (purpose === 'manual' && opts.assignedTo) {
    chosen = pool.find(r => r.assigned_to === opts.assignedTo)
  }
  if (!chosen) chosen = pool.find(r => r.is_default === true)
  if (!chosen) chosen = pool[0]

  return {
    ok: true,
    data: {
      instanceName: chosen.instance_name,
      baseUrl: settings.evolution_url.replace(/\/$/, ''),
      apiKey: settings.evolution_master_key,
    },
  }
}

/**
 * Espaçamento anti-ban entre envios automatizados (purpose='automation') na
 * mesma instância. Evita rajada de dezenas de mensagens em poucos minutos
 * (padrão que mais associa a número a bloqueio no WhatsApp Web/Baileys).
 *
 * Usa a função atômica whatsapp_pace_send (Postgres) pra reservar o slot —
 * seguro contra corrida entre invocações de cron simultâneas. Se o gap ainda
 * não passou, espera (bounded pelo `deadlineMs`); se o gap for maior do que
 * o tempo restante do budget da function, desiste e devolve `false` — o
 * caller trata como "não enviado agora", o item fica pra ser pego no
 * próximo ciclo do cron (mesmo padrão que já existe pra outras falhas).
 *
 * Gap alvo: 6-12s randomizado (evita intervalo fixo, que também é sinal de bot).
 * Reduzido de 15-35s em jul/2026 — o gap antigo, somado ao MAX_SENDS_PER_RUN
 * baixo de cada cron, fazia a fila de confirmação/lembrete vazar ao longo do
 * dia em vez de sair no horário configurado pela clínica.
 */
async function paceAutomatedSend(instanceName: string, deadlineMs: number): Promise<boolean> {
  const svc = createServiceClient()
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: waitSec, error } = await svc.rpc('whatsapp_pace_send', {
      p_instance_name: instanceName,
      p_min_gap_seconds: 6,
      p_max_gap_seconds: 12,
    })
    if (error) return true // não bloqueia envio por falha no pacer
    const wait = Number(waitSec) || 0
    if (wait <= 0) return true
    if (Date.now() + wait * 1000 > deadlineMs) return false
    await new Promise((resolve) => setTimeout(resolve, wait * 1000))
  }
  // Esgotou as tentativas sem confirmar reserva (alta concorrência: muitos
  // leads disparando quase juntos). Mais seguro adiar do que assumir que
  // pode mandar sem reserva confirmada.
  return false
}

/**
 * Delay de "digitando..." (1-3s) antes do envio — sinal humano barato que a
 * Evolution já suporta nativamente no próprio sendText/sendButtons (campo
 * `delay` + `presence: 'composing'`), sem precisar de chamada separada.
 */
function randomTypingDelayMs(): number {
  return Math.floor(1000 + Math.random() * 2000)
}

async function postEvolution(
  url: string,
  apiKey: string,
  body: unknown,
): Promise<SendResult> {
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { apikey: apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const text = await r.text()
    if (!r.ok) {
      return { ok: false, code: 'evolution_error', error: `Evolution ${r.status}: ${text}` }
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = text
    }
    return { ok: true, result: parsed }
  } catch (err) {
    return {
      ok: false,
      code: 'unknown',
      error: err instanceof Error ? err.message : 'Erro desconhecido',
    }
  }
}

/**
 * Envia mensagem de texto via Evolution API usando a instance da clínica.
 * Multi-tenant + multi-numero: aceita opcionalmente `purpose` ou `instanceName`
 * pra escolher qual numero usar quando a clinica tem mais de um.
 */
export async function sendWhatsappMessage(args: {
  clinicId: string
  phone: string
  message: string
  /** Define qual numero usar quando a clinica tem multiplos. Default: 'any'. */
  purpose?: SendPurpose
  /** Forca um numero especifico (instance_name). Tem precedencia sobre purpose. */
  instanceName?: string
  /** Em manual, prioriza numero atribuido ao user (multi-secretaria). */
  assignedTo?: string | null
}): Promise<SendResult> {
  const { clinicId, phone, message, purpose, instanceName, assignedTo } = args

  if (!isValidPhone(phone)) {
    return {
      ok: false,
      code: 'evolution_error',
      error: `Número inválido: "${phone}" não é um telefone WhatsApp válido. Este lead pode ter vindo de anúncio no Facebook/Instagram sem número de telefone real.`,
    }
  }

  const r = await resolveInstance(clinicId, { purpose, instanceName, assignedTo })
  if (!r.ok) return r.error

  if (purpose === 'automation') {
    const canSend = await paceAutomatedSend(r.data.instanceName, Date.now() + 50_000)
    if (!canSend) {
      return { ok: false, code: 'rate_limited', error: 'Envio adiado para respeitar espaçamento anti-bloqueio; será tentado no próximo ciclo.' }
    }
  }

  const sendRes = await postEvolution(
    `${r.data.baseUrl}/message/sendText/${r.data.instanceName}`,
    r.data.apiKey,
    {
      number: normalizePhone(phone),
      text: message,
      delay: randomTypingDelayMs(),
      presence: 'composing',
    },
  )

  if (sendRes.ok && purpose === 'automation') {
    await persistOutboundMessage({
      clinicId,
      phone,
      type: 'text',
      message,
      evolutionResult: sendRes.result,
      purpose: 'automation',
    })
  }

  return sendRes
}

/**
 * Envia mensagem interativa com botões de resposta via Evolution API.
 * Usado nos lembretes D-1 e 2h para permitir CONFIRMAR / CANCELAR / NÃO SOU EU.
 * Quando o paciente toca um botão, a resposta chega como texto via webhook
 * e é interceptada pela Eva antes de chamar o Claude.
 *
 * Fallback automático: se a Evolution não suportar botões (Personal WA sem
 * WhatsApp Business API), retorna erro — o caller decide se tenta text.
 */
export async function sendWhatsappButtons(args: {
  clinicId: string
  phone: string
  /** Corpo principal da mensagem (aceita markdown WA: *negrito*, _itálico_). */
  body: string
  /** Texto pequeno abaixo dos botões (ex: nome da clínica). */
  footer?: string
  /** Max 3 botões. */
  buttons: Array<{ id: string; text: string }>
  purpose?: SendPurpose
  instanceName?: string
  assignedTo?: string | null
}): Promise<SendResult> {
  const { clinicId, phone, body, footer, buttons, purpose, instanceName, assignedTo } = args
  const r = await resolveInstance(clinicId, { purpose, instanceName, assignedTo })
  if (!r.ok) return r.error

  if (purpose === 'automation') {
    const canSend = await paceAutomatedSend(r.data.instanceName, Date.now() + 50_000)
    if (!canSend) {
      return { ok: false, code: 'rate_limited', error: 'Envio adiado para respeitar espaçamento anti-bloqueio; será tentado no próximo ciclo.' }
    }
  }

  const sendRes = await postEvolution(
    `${r.data.baseUrl}/message/sendButtons/${r.data.instanceName}`,
    r.data.apiKey,
    {
      number: normalizePhone(phone),
      title: body,
      footer: footer ?? '',
      buttons: buttons.slice(0, 3).map((b) => ({
        buttonId: b.id,
        buttonText: { displayText: b.text },
        type: 1,
      })),
      headerType: 1,
      delay: randomTypingDelayMs(),
      presence: 'composing',
    },
  )

  if (sendRes.ok && purpose === 'automation') {
    await persistOutboundMessage({
      clinicId,
      phone,
      type: 'text',
      message: body,
      evolutionResult: sendRes.result,
      purpose: 'automation',
      extraMetadata: {
        kind: 'buttons',
        buttons: buttons.slice(0, 3).map((b) => ({ id: b.id, text: b.text })),
        footer: footer ?? null,
      },
    })
  }

  return sendRes
}

/**
 * Envia uma imagem (com caption opcional) via Evolution API.
 * `media` aceita base64 puro (sem o prefixo data:) ou URL pública.
 */
export async function sendWhatsappImage(args: {
  clinicId: string
  phone: string
  media: string // base64 ou url
  mimetype: string
  caption?: string
  fileName?: string
  purpose?: SendPurpose
  instanceName?: string
  assignedTo?: string | null
}): Promise<SendResult> {
  const {
    clinicId, phone, media, mimetype, caption, fileName,
    purpose, instanceName, assignedTo,
  } = args

  if (!isValidPhone(phone)) {
    return {
      ok: false,
      code: 'evolution_error',
      error: `Número inválido: "${phone}" não é um telefone WhatsApp válido. Este lead pode ter vindo de anúncio no Facebook/Instagram sem número de telefone real.`,
    }
  }

  const r = await resolveInstance(clinicId, { purpose, instanceName, assignedTo })
  if (!r.ok) return r.error

  if (purpose === 'automation') {
    const canSend = await paceAutomatedSend(r.data.instanceName, Date.now() + 50_000)
    if (!canSend) {
      return { ok: false, code: 'rate_limited', error: 'Envio adiado para respeitar espaçamento anti-bloqueio; será tentado no próximo ciclo.' }
    }
  }

  return postEvolution(
    `${r.data.baseUrl}/message/sendMedia/${r.data.instanceName}`,
    r.data.apiKey,
    {
      number: normalizePhone(phone),
      mediatype: 'image',
      mimetype,
      media,
      caption: caption ?? '',
      fileName: fileName ?? `image-${Date.now()}.jpg`,
    },
  )
}

/**
 * Envia um vídeo (com caption opcional) via Evolution API.
 * Mesmo endpoint generico de midia usado pra imagem, so troca o mediatype.
 * `media` aceita base64 puro (sem o prefixo data:) ou URL pública.
 */
export async function sendWhatsappVideo(args: {
  clinicId: string
  phone: string
  media: string // base64 ou url
  mimetype: string
  caption?: string
  fileName?: string
  purpose?: SendPurpose
  instanceName?: string
  assignedTo?: string | null
}): Promise<SendResult> {
  const {
    clinicId, phone, media, mimetype, caption, fileName,
    purpose, instanceName, assignedTo,
  } = args

  if (!isValidPhone(phone)) {
    return {
      ok: false,
      code: 'evolution_error',
      error: `Número inválido: "${phone}" não é um telefone WhatsApp válido. Este lead pode ter vindo de anúncio no Facebook/Instagram sem número de telefone real.`,
    }
  }

  const r = await resolveInstance(clinicId, { purpose, instanceName, assignedTo })
  if (!r.ok) return r.error

  if (purpose === 'automation') {
    const canSend = await paceAutomatedSend(r.data.instanceName, Date.now() + 50_000)
    if (!canSend) {
      return { ok: false, code: 'rate_limited', error: 'Envio adiado para respeitar espaçamento anti-bloqueio; será tentado no próximo ciclo.' }
    }
  }

  return postEvolution(
    `${r.data.baseUrl}/message/sendMedia/${r.data.instanceName}`,
    r.data.apiKey,
    {
      number: normalizePhone(phone),
      mediatype: 'video',
      mimetype,
      media,
      caption: caption ?? '',
      fileName: fileName ?? `video-${Date.now()}.mp4`,
    },
  )
}

/**
 * Envia áudio como PTT (push-to-talk, mensagem de voz).
 * `audio` aceita base64 puro ou URL pública. Evolution converte automaticamente.
 */
export async function sendWhatsappAudio(args: {
  clinicId: string
  phone: string
  audio: string // base64 ou url
  purpose?: SendPurpose
  instanceName?: string
  assignedTo?: string | null
}): Promise<SendResult> {
  const { clinicId, phone, audio, purpose, instanceName, assignedTo } = args

  if (!isValidPhone(phone)) {
    return {
      ok: false,
      code: 'evolution_error',
      error: `Número inválido: "${phone}" não é um telefone WhatsApp válido. Este lead pode ter vindo de anúncio no Facebook/Instagram sem número de telefone real.`,
    }
  }

  const r = await resolveInstance(clinicId, { purpose, instanceName, assignedTo })
  if (!r.ok) return r.error

  if (purpose === 'automation') {
    const canSend = await paceAutomatedSend(r.data.instanceName, Date.now() + 50_000)
    if (!canSend) {
      return { ok: false, code: 'rate_limited', error: 'Envio adiado para respeitar espaçamento anti-bloqueio; será tentado no próximo ciclo.' }
    }
  }

  const sendRes = await postEvolution(
    `${r.data.baseUrl}/message/sendWhatsAppAudio/${r.data.instanceName}`,
    r.data.apiKey,
    {
      number: normalizePhone(phone),
      audio,
      encoding: true,
    },
  )

  if (sendRes.ok && purpose === 'automation') {
    await persistOutboundMessage({
      clinicId,
      phone,
      type: 'audio',
      media: audio,
      evolutionResult: sendRes.result,
      purpose: 'automation',
    })
  }

  return sendRes
}

export type EnvioMode = 'texto' | 'audio' | 'ambos'

/**
 * Envia o conteúdo de uma automação respeitando o modo configurado
 * (texto / áudio / ambos). Usado pelos crons de lembrete, aniversário,
 * contato pós-procedimento e pós-venda.
 *
 * Em modo 'ambos', envia o áudio primeiro e depois o texto — se o áudio
 * falhar (ex: rate_limited pelo pacer anti-ban), aborta sem enviar o texto,
 * pra não duplicar o disparo em execuções concorrentes do cron.
 */
export async function sendAutomationContent(args: {
  clinicId: string
  phone: string
  mode: EnvioMode
  text: string
  audioUrl: string | null | undefined
  instanceName?: string
  assignedTo?: string | null
}): Promise<SendResult> {
  const { clinicId, phone, mode, text, audioUrl, instanceName, assignedTo } = args

  if (mode === 'audio') {
    if (!audioUrl) {
      return { ok: false, code: 'evolution_error', error: 'Áudio não configurado para esta automação.' }
    }
    return sendWhatsappAudio({
      clinicId, phone, audio: audioUrl, purpose: 'automation', instanceName, assignedTo,
    })
  }

  const textResult = await sendWhatsappMessage({
    clinicId, phone, message: text, purpose: 'automation', instanceName, assignedTo,
  })

  if (mode === 'ambos' && audioUrl) {
    if (!textResult.ok) return textResult
    return sendWhatsappAudio({
      clinicId, phone, audio: audioUrl, purpose: 'automation', instanceName, assignedTo,
    })
  }

  return textResult
}

/**
 * Baixa uma mídia recebida via Evolution.
 *
 * Endpoint: POST /chat/getBase64FromMediaMessage/{instance}
 * Body: { message: { key } } — onde key é o objeto que veio em data.key
 *
 * Resposta esperada: { base64: string, mimetype: string, fileName?: string }
 */
export async function fetchEvolutionMediaBase64(args: {
  instanceName: string
  messageKey: { remoteJid?: string; fromMe?: boolean; id?: string }
}): Promise<
  | { ok: true; base64: string; mimetype: string; fileName?: string }
  | { ok: false; error: string }
> {
  const settings = await getSettings(['evolution_url', 'evolution_master_key'])
  if (!settings.evolution_url || !settings.evolution_master_key) {
    return { ok: false, error: 'Evolution não configurada' }
  }
  const baseUrl = settings.evolution_url.replace(/\/$/, '')
  const url = `${baseUrl}/chat/getBase64FromMediaMessage/${args.instanceName}`

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: settings.evolution_master_key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: { key: args.messageKey },
        convertToMp4: false,
      }),
    })
    const text = await r.text()
    if (!r.ok) {
      return { ok: false, error: `Evolution ${r.status}: ${text.slice(0, 200)}` }
    }
    let parsed: { base64?: string; mimetype?: string; fileName?: string }
    try {
      parsed = JSON.parse(text)
    } catch {
      return { ok: false, error: `Evolution retornou JSON inválido` }
    }
    if (!parsed.base64) {
      return { ok: false, error: 'Resposta sem base64' }
    }
    return {
      ok: true,
      base64: parsed.base64,
      mimetype: parsed.mimetype ?? 'application/octet-stream',
      fileName: parsed.fileName,
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Erro de rede',
    }
  }
}

/**
 * Decodifica base64 puro pra Buffer.
 * Aceita também data URLs (`data:<mime>;base64,<...>`).
 */
export function base64ToBuffer(base64OrDataUrl: string): { buffer: Buffer; detectedMime?: string } {
  const m = base64OrDataUrl.match(/^data:([^;]+);base64,(.*)$/)
  if (m) {
    return { buffer: Buffer.from(m[2], 'base64'), detectedMime: m[1] }
  }
  return { buffer: Buffer.from(base64OrDataUrl, 'base64') }
}
