/**
 * PIN de acesso rápido (6 dígitos).
 *
 * O PIN NÃO é uma credencial da conta e nunca é armazenado em lugar nenhum.
 * Ele apenas destrava o `refresh_token` do Supabase guardado no aparelho.
 *
 * POR QUE ASSIMÉTRICO (v2)
 * -----------------------
 * O middleware chama `getSession()` no servidor a cada navegação e devolve
 * Set-Cookie com o token rotacionado — sem disparar TOKEN_REFRESHED no
 * cliente. Ou seja: o token guardado envelhece o tempo todo e precisa ser
 * re-cifrado com frequência, inclusive quando o usuário ainda não digitou
 * o PIN naquela sessão.
 *
 * Com criptografia simétrica isso era impossível (re-cifrar exigia a chave
 * derivada do PIN, cacheada no sessionStorage — que o Safari descarta ao
 * fechar a aba). O blob ficava com um refresh_token já consumido e o PIN
 * morria com "Sua sessão expirou".
 *
 * Agora usamos um par de chaves por aparelho:
 *
 *   pública  (em claro)          -> cifra o token novo A QUALQUER MOMENTO
 *   privada  (cifrada com o PIN) -> só decifra quem digita os 6 dígitos
 *
 *   PIN --PBKDF2--> AES-GCM --decifra--> chave privada --> refresh_token
 *
 * A pública em claro não enfraquece nada: com ela só dá para escrever, não
 * para ler. Sem o PIN o conteúdo continua sendo lixo criptográfico.
 *
 * Envelope: o token é cifrado com uma chave AES aleatória e essa chave vai
 * cifrada por RSA-OAEP, para o tamanho do token nunca esbarrar no limite
 * do RSA.
 */

const BLOB_KEY = 'clinike_pin_v1' // mesma chave de storage; o campo `v` versiona
const DECLINED_KEY = 'clinike_pin_declined_v1'

export const PIN_LENGTH = 6
export const MAX_FAILS = 5
const ITERATIONS = 600_000
const DECLINE_DAYS = 30
const VERSION = 2

export interface PinRecord {
  v: 2
  email: string
  /** chave pública SPKI, base64 — em claro de propósito */
  pub: string
  /** chave privada PKCS8 cifrada com a chave derivada do PIN */
  privSalt: string
  privIv: string
  priv: string
  /** envelope do refresh_token */
  keyCt: string
  tokenIv: string
  tokenCt: string
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

const RSA_PARAMS = { name: 'RSA-OAEP', hash: 'SHA-256' } as const

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

/** Impressão digital curta do token, só para evitar re-selar à toa. */
async function fingerprint(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return toB64(new Uint8Array(digest).slice(0, 8))
}

/** Sela o token com a chave pública. Não precisa de PIN. */
async function sealToken(pubB64: string, token: string) {
  const pub = await crypto.subtle.importKey(
    'spki',
    fromB64(pubB64) as BufferSource,
    RSA_PARAMS,
    false,
    ['encrypt']
  )
  const aesRaw = crypto.getRandomValues(new Uint8Array(32))
  const key = await crypto.subtle.importKey('raw', aesRaw as BufferSource, 'AES-GCM', false, [
    'encrypt',
  ])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const tokenCt = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    new TextEncoder().encode(token)
  )
  const keyCt = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pub, aesRaw as BufferSource)
  return {
    keyCt: toB64(new Uint8Array(keyCt)),
    tokenIv: toB64(iv),
    tokenCt: toB64(new Uint8Array(tokenCt)),
    fp: await fingerprint(token),
  }
}

/* ------------------------------------------------------------ persistência */

export function readPinRecord(): PinRecord | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(BLOB_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PinRecord
    // Blobs v1 (simétricos) não são migráveis sem o PIN: descarta.
    if (parsed?.v !== VERSION || !parsed.pub || !parsed.priv || !parsed.tokenCt) {
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

/** Cadastra o PIN: gera o par do aparelho e sela o refresh_token atual. */
export async function setupPin(pin: string, email: string, refreshToken: string): Promise<void> {
  if (!isPinSupported()) throw new PinError('unsupported')

  const pair = (await crypto.subtle.generateKey(
    { ...RSA_PARAMS, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) },
    true,
    ['encrypt', 'decrypt']
  )) as CryptoKeyPair

  const pub = toB64(new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey)))
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))

  const privSalt = crypto.getRandomValues(new Uint8Array(16))
  const privIv = crypto.getRandomValues(new Uint8Array(12))
  const wrapKey = await deriveKey(pin, privSalt)
  const priv = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: privIv as BufferSource },
    wrapKey,
    pkcs8 as BufferSource
  )

  const sealed = await sealToken(pub, refreshToken)

  writeRecord({
    v: VERSION,
    email,
    pub,
    privSalt: toB64(privSalt),
    privIv: toB64(privIv),
    priv: toB64(new Uint8Array(priv)),
    ...sealed,
    fails: 0,
    createdAt: Date.now(),
  })
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

  const wrapKey = await deriveKey(pin, fromB64(record.privSalt))

  let pkcs8: ArrayBuffer
  try {
    pkcs8 = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(record.privIv) as BufferSource },
      wrapKey,
      fromB64(record.priv) as BufferSource
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

  const priv = await crypto.subtle.importKey('pkcs8', pkcs8, RSA_PARAMS, false, ['decrypt'])
  const aesRaw = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    priv,
    fromB64(record.keyCt) as BufferSource
  )
  const key = await crypto.subtle.importKey('raw', aesRaw, 'AES-GCM', false, ['decrypt'])
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(record.tokenIv) as BufferSource },
    key,
    fromB64(record.tokenCt) as BufferSource
  )

  if (record.fails > 0) writeRecord({ ...record, fails: 0 })

  return { refreshToken: new TextDecoder().decode(plain), email: record.email }
}

/**
 * Re-sela o token novo após uma rotação. Funciona SEM o PIN — é para isso
 * que a chave pública fica em claro. Silencioso e idempotente.
 */
export async function syncStoredToken(refreshToken: string): Promise<void> {
  if (!isPinSupported() || !refreshToken) return
  const record = readPinRecord()
  if (!record) return
  try {
    if ((await fingerprint(refreshToken)) === record.fp) return
    const sealed = await sealToken(record.pub, refreshToken)
    writeRecord({ ...record, ...sealed })
  } catch {}
}

/** Quantos erros ainda restam antes do bloqueio. */
export function remainingAttempts(): number {
  const record = readPinRecord()
  return record ? MAX_FAILS - record.fails : MAX_FAILS
}

/**
 * Scope do signOut. Com PIN cadastrado precisa ser 'local': o scope global
 * revoga o refresh_token no servidor e o blob guardado viraria um PIN que
 * não abre nada. Sair limpa a sessão do aparelho sem matar o PIN.
 */
export function signOutScope(): 'local' | 'global' {
  return hasPin() ? 'local' : 'global'
}

/**
 * Aparelho compartilhado: se entrou uma conta diferente da que cadastrou o
 * PIN, o blob antigo tem que sair — senão o PIN da pessoa anterior continua
 * pendurado destravando a conta dela.
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
