import { createServiceClient } from '@/lib/supabase/server'
import { getSettings } from '@/lib/app-settings'

export type SendResult =
  | { ok: true; result: unknown }
  | { ok: false; error: string; code: 'not_configured' | 'not_connected' | 'evolution_error' | 'unknown' }

export function normalizePhone(raw: string): string {
  let p = raw.replace(/\D/g, '')
  if (!p.startsWith('55')) p = '55' + p
  return p
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
  const r = await resolveInstance(clinicId, { purpose, instanceName, assignedTo })
  if (!r.ok) return r.error

  return postEvolution(
    `${r.data.baseUrl}/message/sendText/${r.data.instanceName}`,
    r.data.apiKey,
    { number: normalizePhone(phone), textMessage: { text: message } },
  )
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
  const r = await resolveInstance(clinicId, { purpose, instanceName, assignedTo })
  if (!r.ok) return r.error

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
  const r = await resolveInstance(clinicId, { purpose, instanceName, assignedTo })
  if (!r.ok) return r.error

  return postEvolution(
    `${r.data.baseUrl}/message/sendWhatsAppAudio/${r.data.instanceName}`,
    r.data.apiKey,
    {
      number: normalizePhone(phone),
      audio,
      encoding: true,
    },
  )
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
