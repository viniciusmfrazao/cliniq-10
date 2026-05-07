/**
 * Helpers de data/hora SEMPRE no fuso da clinica (Brasil).
 *
 * Por que isso existe:
 * - O servidor (Vercel/Node) roda em UTC.
 * - `new Date().toISOString()` retorna UTC.
 * - As 21h de Brasilia ja sao 00h UTC do dia seguinte.
 *   Se voce usar `toISOString().split('T')[0]`, "hoje" vira amanha.
 *
 * Solucao: sempre formatar/calcular usando o timezone America/Sao_Paulo
 * (UTC-3, sem horario de verao) e converter pra ISO com offset explicito.
 */

export const BR_TZ = 'America/Sao_Paulo'
/** Offset fixo do Brasil (sem horario de verao desde 2019). */
export const BR_OFFSET = '-03:00'

/**
 * Retorna a data de hoje no fuso do Brasil no formato `YYYY-MM-DD`.
 * Ex: 25/04 21:00 BRT (= 26/04 00:00 UTC) -> "2026-04-25" (e nao "2026-04-26").
 */
export function todayBR(): string {
  // pt-BR retornaria "25/04/2026", mas en-CA ja vem "2026-04-25" — ideal
  return new Date().toLocaleDateString('en-CA', { timeZone: BR_TZ })
}

/**
 * Retorna o `YYYY-MM-DD` correspondente a uma `Date` no fuso do Brasil.
 */
export function dateBR(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: BR_TZ })
}

/**
 * Comeco do dia no fuso do Brasil, como ISO timestamptz.
 * Ex: today=2026-04-25 -> "2026-04-25T00:00:00-03:00".
 *
 * Usar isso em queries Supabase pra `start_time >= startOfDayBR()` etc.
 * O Postgres entende o offset e converte certo internamente.
 */
export function startOfDayBR(date?: string | Date): string {
  const day = normalizeDay(date)
  return `${day}T00:00:00${BR_OFFSET}`
}

export function endOfDayBR(date?: string | Date): string {
  const day = normalizeDay(date)
  return `${day}T23:59:59.999${BR_OFFSET}`
}

/**
 * Comeco do mes corrente no fuso do Brasil, como ISO timestamptz.
 */
export function startOfMonthBR(date?: Date): string {
  const ref = date ?? new Date()
  // Pega ano/mes ja convertidos pro fuso BR
  const y = ref.toLocaleDateString('en-CA', { timeZone: BR_TZ, year: 'numeric' })
  const m = ref.toLocaleDateString('en-CA', { timeZone: BR_TZ, month: '2-digit' })
  return `${y}-${m}-01T00:00:00${BR_OFFSET}`
}

/**
 * Fim do mes corrente no fuso do Brasil, como ISO timestamptz.
 */
export function endOfMonthBR(date?: Date): string {
  const ref = date ?? new Date()
  const y = Number(ref.toLocaleDateString('en-CA', { timeZone: BR_TZ, year: 'numeric' }))
  const m = Number(ref.toLocaleDateString('en-CA', { timeZone: BR_TZ, month: '2-digit' }))
  // Ultimo dia: dia 0 do mes seguinte
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const mm = String(m).padStart(2, '0')
  const dd = String(last).padStart(2, '0')
  return `${y}-${mm}-${dd}T23:59:59.999${BR_OFFSET}`
}

/**
 * Yesterday no fuso BR, como `YYYY-MM-DD`.
 */
export function yesterdayBR(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 1)
  return dateBR(d)
}

/**
 * Adiciona N dias a uma data (em milissegundos -> data BR).
 * Aceita ISO string ou Date. Retorna `YYYY-MM-DD`.
 */
export function addDaysBR(base: string | Date, days: number): string {
  const baseDate = typeof base === 'string' ? new Date(`${base}T12:00:00${BR_OFFSET}`) : base
  const next = new Date(baseDate.getTime() + days * 86400000)
  return dateBR(next)
}

/**
 * Se receber uma string ja em formato YYYY-MM-DD usa direto;
 * se for Date converte pro dia BR; se for undefined usa hoje BR.
 */
function normalizeDay(d?: string | Date): string {
  if (!d) return todayBR()
  if (typeof d === 'string') {
    // Aceita "YYYY-MM-DD" ou ISO completo (extrai so o YYYY-MM-DD)
    return d.length === 10 ? d : dateBR(new Date(d))
  }
  return dateBR(d)
}
