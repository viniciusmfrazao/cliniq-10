/**
 * Wrapper multi-tenant da Evolution API.
 *
 * - Lê URL e master API key do app_settings (cache 60s via getSettings).
 * - Não conhece nada de UI; só fala HTTP com a Evolution.
 * - Cada função retorna { ok: true, data } ou { ok: false, error, status? }.
 */

import { getSettings } from '@/lib/app-settings'

type FetchOk<T> = { ok: true; data: T }
type FetchErr = { ok: false; error: string; status?: number }
type FetchResult<T> = FetchOk<T> | FetchErr

export type EvolutionRawState = 'open' | 'connecting' | 'close' | 'unknown'
export type ClinicWhatsappStatus =
  | 'pending'
  | 'qr_pending'
  | 'connected'
  | 'disconnected'
  | 'error'

export function mapEvolutionStateToStatus(
  state: EvolutionRawState | string | null | undefined
): ClinicWhatsappStatus {
  switch (state) {
    case 'open':
      return 'connected'
    case 'connecting':
      return 'qr_pending'
    case 'close':
      return 'disconnected'
    default:
      return 'pending'
  }
}

async function getEvolutionConfig(): Promise<
  FetchResult<{ baseUrl: string; apiKey: string }>
> {
  const settings = await getSettings(['evolution_url', 'evolution_master_key'])
  if (!settings.evolution_url || !settings.evolution_master_key) {
    return {
      ok: false,
      error:
        'Evolution API não configurada. Super admin precisa preencher em /admin/evolution.',
    }
  }
  return {
    ok: true,
    data: {
      baseUrl: settings.evolution_url.replace(/\/$/, ''),
      apiKey: settings.evolution_master_key,
    },
  }
}

async function evolutionFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<FetchResult<T>> {
  const cfg = await getEvolutionConfig()
  if (!cfg.ok) return cfg

  const url = `${cfg.data.baseUrl}${path}`
  try {
    const r = await fetch(url, {
      ...init,
      headers: {
        apikey: cfg.data.apiKey,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
      cache: 'no-store',
    })

    const text = await r.text()
    let parsed: unknown
    try {
      parsed = text ? JSON.parse(text) : null
    } catch {
      parsed = text
    }

    if (!r.ok) {
      const msg =
        (parsed && typeof parsed === 'object' && 'message' in parsed
          ? String((parsed as { message: unknown }).message)
          : null) ||
        (typeof parsed === 'string' ? parsed : null) ||
        `HTTP ${r.status}`
      return { ok: false, error: msg, status: r.status }
    }

    return { ok: true, data: parsed as T }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Erro de rede',
    }
  }
}

/**
 * Gera o nome de instance para uma clínica nova: cliniq-<8chars-do-clinic-id>.
 * Compatível com slugs já existentes (clínicas antigas mantêm o nome do banco).
 */
export function generateInstanceName(clinicId: string): string {
  const short = clinicId.replace(/-/g, '').slice(0, 8).toLowerCase()
  return `cliniq-${short}`
}

/**
 * Monta a URL do webhook que a Evolution vai chamar quando rolarem eventos
 * dessa instance. Usa NEXT_PUBLIC_APP_URL com fallback pra clinike.vercel.app.
 */
export function buildWebhookUrl(instanceName: string, webhookToken: string): string {
  const base =
    (process.env.NEXT_PUBLIC_APP_URL || 'https://clinike.vercel.app').replace(
      /\/$/,
      ''
    )
  return `${base}/api/webhooks/evolution/${instanceName}?token=${encodeURIComponent(
    webhookToken
  )}`
}

// ----------------------------------------------------------------------------
// Operações de instance
// ----------------------------------------------------------------------------

export type CreateInstanceResult = {
  instance?: {
    instanceName?: string
    status?: string
  }
  qrcode?: {
    base64?: string
    code?: string
  }
  hash?: string
}

/**
 * Cria uma instance nova na Evolution, já com webhook configurado.
 * Idempotente do nosso lado: se a Evolution responder "already in use" (em qualquer
 * variação de mensagem), devolvemos ok pra cima.
 */
export async function createInstance(args: {
  instanceName: string
  webhookUrl: string
}): Promise<FetchResult<CreateInstanceResult>> {
  const body = {
    instanceName: args.instanceName,
    qrcode: true,
    integration: 'WHATSAPP-BAILEYS',
    webhook: {
      url: args.webhookUrl,
      byEvents: false,
      base64: true,
      events: ['QRCODE_UPDATED', 'CONNECTION_UPDATE', 'MESSAGES_UPSERT'],
    },
  }
  const r = await evolutionFetch<CreateInstanceResult>('/instance/create', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  if (!r.ok && isAlreadyExistsError(r)) {
    return { ok: true, data: {} }
  }
  return r
}

/**
 * Verifica se um erro retornado pela Evolution corresponde a "instance já existe".
 * Cobrir várias variantes que aparecem em diferentes versões e até casos de 403
 * que algumas versões cospem nessa situação.
 */
function isAlreadyExistsError(r: FetchErr): boolean {
  if (/already in use|already exists|name is already|duplicate|conflict/i.test(r.error)) {
    return true
  }
  // Algumas versões da Evolution retornam 403 puro nessa situação.
  // Não é forte, mas combinado com o fluxo é seguro: o caller só usa createInstance
  // quando achou conveniente provisionar.
  return false
}

/**
 * Verifica se uma instance existe na Evolution chamando getConnectionState.
 * Retorna { exists: boolean, state?: 'open' | 'close' | 'connecting' }.
 *
 * Tratamos 404 e mensagens de "not found" como exists=false e demais erros
 * como erro real (config errada, rede etc).
 */
export async function probeInstance(
  instanceName: string,
): Promise<FetchResult<{ exists: boolean; state?: EvolutionRawState }>> {
  const r = await getConnectionState(instanceName)
  if (r.ok) {
    return {
      ok: true,
      data: {
        exists: true,
        state: (r.data.instance?.state as EvolutionRawState) ?? 'unknown',
      },
    }
  }
  // 404 ou mensagem de "does not exist" -> instance ainda não existe
  if (r.status === 404 || /not found|does not exist|not exists/i.test(r.error)) {
    return { ok: true, data: { exists: false } }
  }
  return r
}

export type ConnectionState = {
  instance?: { instanceName?: string; state?: EvolutionRawState }
}

export async function getConnectionState(
  instanceName: string
): Promise<FetchResult<ConnectionState>> {
  return evolutionFetch<ConnectionState>(
    `/instance/connectionState/${encodeURIComponent(instanceName)}`,
    { method: 'GET' }
  )
}

export type ConnectQRResult = {
  base64?: string
  code?: string
  pairingCode?: string | null
  count?: number
}

/**
 * Pede um QR fresco (e ativa a instance se estiver em close).
 * Resposta tem base64 do QR.
 */
export async function getQRCode(
  instanceName: string
): Promise<FetchResult<ConnectQRResult>> {
  return evolutionFetch<ConnectQRResult>(
    `/instance/connect/${encodeURIComponent(instanceName)}`,
    { method: 'GET' }
  )
}

export async function logoutInstance(
  instanceName: string
): Promise<FetchResult<unknown>> {
  return evolutionFetch(`/instance/logout/${encodeURIComponent(instanceName)}`, {
    method: 'DELETE',
  })
}

export async function deleteInstance(
  instanceName: string
): Promise<FetchResult<unknown>> {
  // Evolution exige logout antes do delete em algumas versões; ignoramos erro.
  await logoutInstance(instanceName).catch(() => null)
  return evolutionFetch(`/instance/delete/${encodeURIComponent(instanceName)}`, {
    method: 'DELETE',
  })
}

/**
 * Atualiza o webhook de uma instance já criada (útil quando troca o domínio público).
 */
export async function setInstanceWebhook(args: {
  instanceName: string
  webhookUrl: string
}): Promise<FetchResult<unknown>> {
  return evolutionFetch(
    `/webhook/set/${encodeURIComponent(args.instanceName)}`,
    {
      method: 'POST',
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: args.webhookUrl,
          byEvents: false,
          base64: true,
          events: ['QRCODE_UPDATED', 'CONNECTION_UPDATE', 'MESSAGES_UPSERT'],
        },
      }),
    }
  )
}
