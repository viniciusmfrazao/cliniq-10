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
  // Fallback ATUALIZADO: clinike.vercel.app foi descontinuado em 05/2026
  // quando migramos pra app.clinike.com.br. Quem nao setar a env publica
  // ainda funciona via fallback.
  const base =
    (process.env.NEXT_PUBLIC_APP_URL || 'https://app.clinike.com.br').replace(
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
  // Inclui integration para compatibilidade com v2.x (v1.x ignora o campo)
  const body = {
    instanceName: args.instanceName,
    qrcode: true,
    integration: 'WHATSAPP-BAILEYS',
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
  // 404/400 ou mensagem de "does not exist" -> instance ainda não existe
  if (r.status === 404 || r.status === 400 || /not found|does not exist|not exists|Bad Request/i.test(r.error)) {
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

/**
 * Reinicia o socket da instance sem desconectar/desemparelhar o WhatsApp.
 * Útil quando a sessão fica "fantasma" — open mas sem receber mensagens.
 * Mantém o pairing, evita QR scan novo.
 */
export async function restartInstance(
  instanceName: string
): Promise<FetchResult<unknown>> {
  return evolutionFetch(`/instance/restart/${encodeURIComponent(instanceName)}`, {
    method: 'POST',
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
  // IMPORTANTE: Evolution API v1.x exige formato FLAT com snake_case.
  // Formato nested { webhook: { ... } } com camelCase NAO funciona nesta versao
  // e faz o webhook ser ignorado silenciosamente, quebrando CONNECTION_UPDATE
  // e impedindo o app de saber quando a instancia conecta.
  return evolutionFetch(
    `/webhook/set/${encodeURIComponent(args.instanceName)}`,
    {
      method: 'POST',
      body: JSON.stringify({
        url: args.webhookUrl,
        webhook_by_events: false,
        webhook_base64: false,
        events: [
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE',
          'CONNECTION_UPDATE',
          'QRCODE_UPDATED',
          'CONTACTS_UPSERT',
        ],
      }),
    }
  )
}

export type WebhookInfo = {
  enabled?: boolean
  url?: string
  webhookByEvents?: boolean
  webhookBase64?: boolean
  events?: string[]
} & Record<string, unknown>

/**
 * Lê o webhook atualmente configurado em uma instance.
 * Versões diferentes da Evolution expõem em /webhook/find/{instance}.
 */
export async function getWebhookInfo(
  instanceName: string,
): Promise<FetchResult<WebhookInfo>> {
  return evolutionFetch<WebhookInfo>(
    `/webhook/find/${encodeURIComponent(instanceName)}`,
    { method: 'GET' },
  )
}

/**
 * Extrai a URL do webhook do retorno da Evolution.
 * Versoes diferentes serializam de jeito diferente: pode vir em data.url,
 * data.webhook.url, etc. Centralizamos aqui.
 */
export function extractWebhookUrl(info: WebhookInfo | null | undefined): string | null {
  if (!info) return null
  if (typeof info.url === 'string' && info.url) return info.url
  const nested = (info as Record<string, unknown>).webhook
  if (nested && typeof nested === 'object') {
    const u = (nested as Record<string, unknown>).url
    if (typeof u === 'string' && u) return u
  }
  return null
}

/**
 * Compara duas URLs ignorando trailing slash. Retorna true se sao "iguais".
 * Trata null/undefined como diferente.
 */
export function urlsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  return a.replace(/\/$/, '') === b.replace(/\/$/, '')
}

/**
 * Verifica se o webhook salvo na Evolution bate com o que o app espera.
 * Se nao bater, AUTO-CORRIGE chamando setInstanceWebhook.
 *
 * Retorna info detalhada pra logs/banner:
 *   - actualUrl: o que a Evolution tinha salvo (ou null se nao deu pra ler)
 *   - expectedUrl: o que o app esperava
 *   - drift: true quando estavam diferentes
 *   - fixed: true quando conseguiu corrigir
 *   - error: se algo deu errado em uma das chamadas
 */
export async function ensureWebhookHealthy(args: {
  instanceName: string
  webhookToken: string
}): Promise<{
  actualUrl: string | null
  expectedUrl: string
  drift: boolean
  fixed: boolean
  error: string | null
}> {
  const expectedUrl = buildWebhookUrl(args.instanceName, args.webhookToken)
  const info = await getWebhookInfo(args.instanceName)
  if (!info.ok) {
    // Nao conseguiu ler o webhook — pode ser instabilidade temporaria da Evolution.
    // NAO assumir drift: sem leitura confirmada, nao ha evidencia de URL errada.
    // Retornar sem drift para evitar falso positivo no banner.
    return {
      actualUrl: null,
      expectedUrl,
      drift: false,
      fixed: false,
      error: null,
    }
  }

  const actualUrl = extractWebhookUrl(info.data)
  const drift = !urlsMatch(actualUrl, expectedUrl)

  if (!drift) {
    return { actualUrl, expectedUrl, drift: false, fixed: false, error: null }
  }

  const set = await setInstanceWebhook({
    instanceName: args.instanceName,
    webhookUrl: expectedUrl,
  })

  return {
    actualUrl,
    expectedUrl,
    drift: true,
    fixed: set.ok,
    error: set.ok ? null : set.error,
  }
}
