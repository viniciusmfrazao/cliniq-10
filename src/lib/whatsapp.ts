import { createServiceClient } from '@/lib/supabase/server'
import { getSettings } from '@/lib/app-settings'

export type SendResult =
  | { ok: true; result: unknown }
  | { ok: false; error: string; code: 'not_configured' | 'not_connected' | 'evolution_error' | 'unknown' }

function normalizePhone(raw: string): string {
  let p = raw.replace(/\D/g, '')
  if (!p.startsWith('55')) p = '55' + p
  return p
}

type ResolvedInstance = {
  instanceName: string
  baseUrl: string
  apiKey: string
}

async function resolveInstance(
  clinicId: string,
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
  const { data: wa } = await supabase
    .from('clinic_whatsapp')
    .select('instance_name, status')
    .eq('clinic_id', clinicId)
    .maybeSingle()

  if (!wa?.instance_name) {
    return {
      ok: false,
      error: { ok: false, code: 'not_configured', error: 'Clínica não tem WhatsApp configurado' },
    }
  }
  if (wa.status !== 'connected') {
    return {
      ok: false,
      error: {
        ok: false,
        code: 'not_connected',
        error: `WhatsApp da clínica não está conectado (status: ${wa.status})`,
      },
    }
  }

  return {
    ok: true,
    data: {
      instanceName: wa.instance_name,
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
 * Multi-tenant: cada clínica tem seu próprio instance_name na tabela clinic_whatsapp.
 */
export async function sendWhatsappMessage(args: {
  clinicId: string
  phone: string
  message: string
}): Promise<SendResult> {
  const { clinicId, phone, message } = args
  const r = await resolveInstance(clinicId)
  if (!r.ok) return r.error

  return postEvolution(
    `${r.data.baseUrl}/message/sendText/${r.data.instanceName}`,
    r.data.apiKey,
    { number: normalizePhone(phone), text: message },
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
}): Promise<SendResult> {
  const { clinicId, phone, media, mimetype, caption, fileName } = args
  const r = await resolveInstance(clinicId)
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
}): Promise<SendResult> {
  const { clinicId, phone, audio } = args
  const r = await resolveInstance(clinicId)
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
