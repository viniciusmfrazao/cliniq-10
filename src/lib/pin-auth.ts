/**
 * PIN de acesso rápido (6 dígitos).
 *
 * O PIN NÃO é uma credencial da conta e nunca é armazenado nem enviado ao
 * servidor. Ele destrava, localmente, o SEGREDO DESTE APARELHO:
 *
 *   PIN --PBKDF2--> chave AES-GCM --decifra--> segredo do aparelho
 *   segredo --POST /api/pin/unlock--> sessão nova
 *
 * POR QUE NÃO GUARDAMOS MAIS O refresh_token (v1/v2)
 * --------------------------------------------------
 * O refresh_token é um alvo móvel: rotaciona a cada uso (inclusive no
 * middleware, server-side), é revogado por signOut global e por troca de
 * senha, e o GoTrue apaga a família inteira ao detectar reuso. Qualquer um
 * desses eventos deixava o blob apontando para um token inexistente e o
 * desbloqueio falhava com refresh_token_not_found.
 *
 * O segredo do aparelho é estável: só some se o próprio usuário revogar.
 * Cada desbloqueio cria uma sessão limpa no servidor, então rotação e
 * revogação deixam de importar.
 *
 * O servidor guarda apenas o SHA-256 do segredo — vazar a tabela não
 * destrava nada. E sem o PIN, o que está no aparelho é lixo criptográfico
 * (AES-GCM falha na autenticação, não decifra silenciosamente).
 */

const BLOB_KEY = 'clinike_pin_v1' // mesma chave de storage; o campo `v` versiona
const DECLINED_KEY = 'clinike_pin_declined_v1'

export const PIN_LENGTH = 6
export const MAX_FAILS = 5
const ITERATIONS = 600_000
const DECLINE_DAYS = 30
const VERSION = 3

export interface PinRecord {
  v: 3
  email: string
  deviceId: string
  salt: string
  iv: string
  ct: string
  fails: number
  createdAt: number
}

export type PinErrorCode =
  | 'no_pin'
  | 'wrong_pin'
  | 'locked'
  | 'unsupported'
  | 'device_rejected'
  | 'network'

export class PinError extends Error {
  code: PinErrorCode
  constructor(code: PinErrorCode, message?: string) {
    super(message ?? code)
    this.code = code
    this.name = 'PinError'
  }
}

/* ---------------------------------------------------------------- helpers */

function toB64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** WebCrypto exige secure context (https). Em http local o PIN fica indisponível. */
export function isPinSupported(): boolean {
  if (typeof window === 'undefined') return false
  return typeof window.crypto?.subtle?.deriveKey === 'function'
}

async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/* ------------------------------------------------------------ persistência */

export function readPinRecord(): PinRecord | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(BLOB_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PinRecord
    // Blobs v1/v2 guardavam refresh_token e não são migráveis: descarta.
    if (parsed?.v !== VERSION || !parsed.deviceId || !parsed.ct) {
      localStorage.removeItem(BLOB_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function hasPin(): boolean {
  return readPinRecord() !== null
}

export function pinEmail(): string | null {
  return readPinRecord()?.email ?? null
}

export function pinDeviceId(): string | null {
  return readPinRecord()?.deviceId ?? null
}

export function clearPin(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(BLOB_KEY)
  } catch {}
}

function writeRecord(record: PinRecord): void {
  localStorage.setItem(BLOB_KEY, JSON.stringify(record))
}

/* -------------------------------------------------------------- operações */

/**
 * Cadastra o PIN: gera o segredo do aparelho, registra o hash no servidor e
 * guarda o segredo cifrado localmente. Exige sessão válida (cookie).
 */
export async function setupPin(pin: string, label?: string): Promise<void> {
  if (!isPinSupported()) throw new PinError('unsupported')

  const secretBytes = crypto.getRandomValues(new Uint8Array(32))
  const secret = toB64(secretBytes)

  let payload: { deviceId?: string; email?: string; error?: string }
  try {
    const res = await fetch('/api/pin/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, label }),
    })
    payload = await res.json()
    if (!res.ok || !payload.deviceId) throw new PinError('device_rejected')
  } catch (err) {
    if (err instanceof PinError) throw err
    throw new PinError('network')
  }

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(pin, salt)
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    new TextEncoder().encode(secret)
  )

  writeRecord({
    v: VERSION,
    email: payload.email ?? '',
    deviceId: payload.deviceId!,
    salt: toB64(salt),
    iv: toB64(iv),
    ct: toB64(new Uint8Array(ct)),
    fails: 0,
    createdAt: Date.now(),
  })
  clearDeclined()
}

/**
 * Valida o PIN localmente e troca o segredo por uma sessão nova no servidor.
 * Após MAX_FAILS erros o blob é apagado e o usuário cai no login por senha.
 */
export async function unlockPin(pin: string): Promise<{ email: string }> {
  if (!isPinSupported()) throw new PinError('unsupported')
  const record = readPinRecord()
  if (!record) throw new PinError('no_pin')

  const key = await deriveKey(pin, fromB64(record.salt))

  let plain: ArrayBuffer
  try {
    plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(record.iv) as BufferSource },
      key,
      fromB64(record.ct) as BufferSource
    )
  } catch {
    const fails = record.fails + 1
    if (fails >= MAX_FAILS) {
      clearPin()
      throw new PinError('locked')
    }
    writeRecord({ ...record, fails })
    throw new PinError('wrong_pin', String(MAX_FAILS - fails))
  }

  const secret = new TextDecoder().decode(plain)

  let res: Response
  try {
    res = await fetch('/api/pin/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: record.deviceId, secret }),
    })
  } catch {
    // Rede fora: o PIN está certo, então não penaliza nem apaga nada.
    throw new PinError('network')
  }

  if (!res.ok) {
    // Aparelho revogado ou bloqueado no servidor: o blob não serve mais.
    clearPin()
    throw new PinError('device_rejected')
  }

  if (record.fails > 0) writeRecord({ ...record, fails: 0 })

  return { email: record.email }
}

/** Quantos erros ainda restam antes do bloqueio. */
export function remainingAttempts(): number {
  const record = readPinRecord()
  return record ? MAX_FAILS - record.fails : MAX_FAILS
}

/**
 * Aparelho compartilhado: se entrou outra conta, o PIN anterior tem que sair —
 * senão ele continua pendurado destravando a conta da pessoa de antes.
 */
export function clearPinIfOtherUser(email: string): void {
  const stored = pinEmail()
  if (!stored || !email) return
  if (stored.trim().toLowerCase() !== email.trim().toLowerCase()) clearPin()
}

/* --------------------------------------------------------------- "agora não" */

export function declinePin(): void {
  try {
    localStorage.setItem(DECLINED_KEY, String(Date.now()))
  } catch {}
}

function clearDeclined(): void {
  try {
    localStorage.removeItem(DECLINED_KEY)
  } catch {}
}

/** Só oferece o cadastro se não houver PIN e o usuário não tiver recusado há pouco. */
export function shouldOfferPin(): boolean {
  if (!isPinSupported() || hasPin()) return false
  try {
    const at = Number(localStorage.getItem(DECLINED_KEY) ?? 0)
    if (!at) return true
    return Date.now() - at > DECLINE_DAYS * 24 * 60 * 60 * 1000
  } catch {
    return true
  }
}
