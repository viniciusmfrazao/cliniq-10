/**
 * PIN de acesso rápido (6 dígitos).
 *
 * O PIN NÃO é uma credencial da conta e nunca é armazenado em lugar nenhum.
 * Ele é apenas a chave que decifra o `refresh_token` do Supabase guardado
 * localmente no aparelho:
 *
 *   PIN --PBKDF2--> chave AES-GCM --decifra--> refresh_token --> sessão
 *
 * Sem o PIN correto, o que está no localStorage é lixo criptográfico
 * (AES-GCM falha na autenticação, não decifra silenciosamente).
 *
 * ROTAÇÃO: o Supabase invalida o refresh_token a cada uso. Se o blob guardado
 * ficar desatualizado, o PIN funciona uma vez e depois quebra. Por isso a
 * chave derivada fica em sessionStorage enquanto o app está aberto — assim
 * `syncStoredToken()` consegue re-cifrar o token novo a cada rotação sem
 * pedir o PIN de novo. O sessionStorage some quando o app é fechado, momento
 * em que as rotações também param.
 */

const BLOB_KEY = 'clinike_pin_v1'
const CACHED_KEY = 'clinike_pin_dk_v1'
const DECLINED_KEY = 'clinike_pin_declined_v1'

export const PIN_LENGTH = 6
export const MAX_FAILS = 5
const ITERATIONS = 600_000
const DECLINE_DAYS = 30

export interface PinRecord {
  v: 1
  email: string
  salt: string
  iv: string
  ct: string
  fp: string
  fails: number
  createdAt: number
}

export type PinErrorCode = 'no_pin' | 'wrong_pin' | 'locked' | 'unsupported' | 'stale_token'

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
    true, // extractable: precisamos exportar para o sessionStorage
    ['encrypt', 'decrypt']
  )
}

/** Impressão digital curta do token, só para evitar re-cifrar à toa. */
async function fingerprint(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return toB64(new Uint8Array(digest).slice(0, 8))
}

/* ------------------------------------------------------------ persistência */

export function readPinRecord(): PinRecord | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(BLOB_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PinRecord
    if (parsed?.v !== 1 || !parsed.ct || !parsed.salt || !parsed.iv) return null
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

export function clearPin(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(BLOB_KEY)
    sessionStorage.removeItem(CACHED_KEY)
  } catch {}
}

function writeRecord(record: PinRecord): void {
  localStorage.setItem(BLOB_KEY, JSON.stringify(record))
}

/* ----------------------------------------------------- cache da chave (sessão) */

async function cacheKey(key: CryptoKey): Promise<void> {
  try {
    const raw = await crypto.subtle.exportKey('raw', key)
    sessionStorage.setItem(CACHED_KEY, toB64(new Uint8Array(raw)))
  } catch {}
}

async function loadCachedKey(): Promise<CryptoKey | null> {
  try {
    const raw = sessionStorage.getItem(CACHED_KEY)
    if (!raw) return null
    return await crypto.subtle.importKey('raw', fromB64(raw) as BufferSource, 'AES-GCM', true, [
      'encrypt',
      'decrypt',
    ])
  } catch {
    return null
  }
}

/* -------------------------------------------------------------- operações */

async function encryptToken(key: CryptoKey, token: string, salt: Uint8Array, email: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    new TextEncoder().encode(token)
  )
  const record: PinRecord = {
    v: 1,
    email,
    salt: toB64(salt),
    iv: toB64(iv),
    ct: toB64(new Uint8Array(ct)),
    fp: await fingerprint(token),
    fails: 0,
    createdAt: Date.now(),
  }
  writeRecord(record)
}

/** Cadastra o PIN cifrando o refresh_token atual. */
export async function setupPin(pin: string, email: string, refreshToken: string): Promise<void> {
  if (!isPinSupported()) throw new PinError('unsupported')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await deriveKey(pin, salt)
  await encryptToken(key, refreshToken, salt, email)
  await cacheKey(key)
  clearDeclined()
}

/**
 * Valida o PIN e devolve o refresh_token.
 * Após MAX_FAILS erros o blob é apagado e o usuário cai no login por senha.
 */
export async function unlockPin(pin: string): Promise<{ refreshToken: string; email: string }> {
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

  if (record.fails > 0) writeRecord({ ...record, fails: 0 })
  await cacheKey(key)

  return { refreshToken: new TextDecoder().decode(plain), email: record.email }
}

/**
 * Re-cifra o token novo depois de uma rotação. Silencioso e idempotente:
 * sem chave em cache (ex.: app reaberto e ainda não destravado) não faz nada.
 */
export async function syncStoredToken(refreshToken: string): Promise<void> {
  if (!isPinSupported() || !refreshToken) return
  const record = readPinRecord()
  if (!record) return
  try {
    if ((await fingerprint(refreshToken)) === record.fp) return
    const key = await loadCachedKey()
    if (!key) return
    await encryptToken(key, refreshToken, fromB64(record.salt), record.email)
  } catch {}
}

/** Quantos erros ainda restam antes do bloqueio. */
export function remainingAttempts(): number {
  const record = readPinRecord()
  return record ? MAX_FAILS - record.fails : MAX_FAILS
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
