import type { TransformId, RawRow, FieldMap } from './types'

/** Telefone: guarda só dígitos, últimos 11. Aceita "+5514998362509" e "(14) 99654-4998". */
export function normalizePhone(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null
  const digits = String(raw).replace(/\D/g, '')
  if (!digits) return null
  return digits.length >= 11 ? digits.slice(-11) : digits
}

/**
 * CPF vindo de Excel costuma chegar como número (38664655804), perdendo o zero
 * à esquerda. Repadding para 11 dígitos resolve o caso comum.
 */
export function normalizeCpf(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null
  const digits = String(raw).replace(/\D/g, '')
  if (!digits) return null
  if (digits.length > 11) return null
  return digits.padStart(11, '0')
}

/** Extrai YYYY-MM-DD de ISO ("2026-07-16T03:00:00.000Z") ou de "23/07/2026 17:38:00". */
export function parseDateOnly(raw: unknown): string | null {
  if (!raw) return null
  const s = String(raw).trim()

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`

  return null
}

/** Combina data + hora ("13:00" ou "9:00") em timestamptz no fuso de Brasília. */
export function parseDateTime(dateRaw: unknown, timeRaw: unknown, fallbackTime = '09:00'): string | null {
  const date = parseDateOnly(dateRaw)
  if (!date) return null
  const t = String(timeRaw ?? '').trim() || fallbackTime
  const m = t.match(/^(\d{1,2}):(\d{2})/)
  const time = m ? `${m[1].padStart(2, '0')}:${m[2]}` : fallbackTime
  return `${date}T${time}:00-03:00`
}

/** Timestamp completo preservando hora, para created_at. */
export function parseTimestamp(raw: unknown): string | null {
  if (!raw) return null
  const s = String(raw).trim()
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}T${br[4]}:${br[5]}:00-03:00`
  const d = parseDateOnly(s)
  return d ? `${d}T12:00:00-03:00` : null
}

export function parseNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  const s = String(raw).trim().replace(/[R$\s]/g, '')
  // "1.234,56" -> "1234.56" | "1234.56" fica como está
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

/** Clinicorp marca booleanos com "X". */
export function parseFlag(raw: unknown): boolean {
  if (raw === null || raw === undefined) return false
  const s = String(raw).trim().toUpperCase()
  return s === 'X' || s === 'TRUE' || s === 'SIM' || s === '1'
}

/** Banco aceita apenas 'M' | 'F' | 'O' (patients_gender_check). */
export function parseGender(raw: unknown): string | null {
  if (!raw) return null
  const s = String(raw).trim().toUpperCase()
  if (s.startsWith('F')) return 'F'
  if (s.startsWith('M')) return 'M'
  if (s.startsWith('O')) return 'O'
  return null
}

export function cleanText(raw: unknown, maxLen = 1000): string | null {
  if (raw === null || raw === undefined) return null
  const s = String(raw).trim()
  if (!s || s === 'null' || s === 'undefined') return null
  return s.slice(0, maxLen)
}

export function applyTransform(id: TransformId, raw: unknown): unknown {
  switch (id) {
    case 'phone': return normalizePhone(raw)
    case 'cpf': return normalizeCpf(raw)
    case 'date': return parseDateOnly(raw)
    case 'datetime': return parseTimestamp(raw)
    case 'number': return parseNumber(raw)
    case 'gender': return parseGender(raw)
    case 'flag': return parseFlag(raw)
    case 'text':
    default: return cleanText(raw)
  }
}

/**
 * Resolve qual coluna de origem alimenta cada campo destino.
 * Overrides do operador têm precedência sobre os candidatos do preset.
 * Campos sem coluna correspondente ficam de fora — é isso que permite
 * importar planilhas com mais ou menos colunas que a amostra original.
 */
export function resolveColumns(
  headers: string[],
  fields: FieldMap[],
  overrides: Record<string, string> = {}
): Record<string, string> {
  const lower = new Map(headers.map(h => [h.toLowerCase().trim(), h]))
  const resolved: Record<string, string> = {}

  for (const f of fields) {
    const manual = overrides[f.target]
    if (manual === '__ignore__') continue
    if (manual && headers.includes(manual)) {
      resolved[f.target] = manual
      continue
    }
    for (const c of f.candidates) {
      const hit = lower.get(c.toLowerCase().trim())
      if (hit) { resolved[f.target] = hit; break }
    }
  }
  return resolved
}

/** Aplica o mapeamento resolvido a uma linha, devolvendo o objeto destino. */
export function mapRow(
  row: RawRow,
  fields: FieldMap[],
  resolved: Record<string, string>
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of fields) {
    const col = resolved[f.target]
    if (!col) continue
    const value = applyTransform(f.transform, row[col])
    if (value !== null && value !== undefined && value !== '') out[f.target] = value
  }
  return out
}

/**
 * "Botox / Bioestimulador de colageno" -> ["Botox", "Bioestimulador de colageno"]
 * O Clinicorp concatena múltiplos procedimentos num campo só.
 */
export function splitProcedures(raw: unknown): string[] {
  const s = cleanText(raw)
  if (!s) return []
  return s.split('/').map(p => p.trim()).filter(Boolean)
}

/** Chave de comparação tolerante a acento, caixa e espaço duplo. */
export function normKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}
