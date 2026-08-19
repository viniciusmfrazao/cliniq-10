// Importador dedicado para exports do sistema concorrente "Experte".
// Não usa a engine genérica (src/lib/import/engine.ts) porque aquela é
// modelada em cima das colunas do Clinicorp. Aqui as colunas são conhecidas
// e fixas (export em CSV dentro de um .zip), então o parsing é direto.
//
// Arquivos esperados dentro do .zip (todos opcionais, exceto patients e
// consultations que são o mínimo útil):
//   patients.csv, professionals.csv, consultation_types.csv,
//   consultations.csv, financial_titles.csv, financial_parcels.csv,
//   providers.csv, files/*.{jpg,webp,...}
//
// Notas de modelagem apuradas na amostra (clínica Eleva, ago/2026):
// - patients.csv não tem coluna de ID; o vínculo com consultations.csv
//   (que tem "ID Paciente") só é possível pelo nome (Nome Paciente == Nome).
// - Procedimentos em consultations.csv: múltiplos procedimentos por
//   consulta vêm separados por VÍRGULA. "+" aparece dentro do nome de
//   procedimentos individuais (ex.: "Banho de lua + esfoliação") — não é
//   delimitador.
// - financial_titles.csv / financial_parcels.csv na amostra só contêm
//   "Saldo Inicial" de abertura de conta (Experte), sem valor real de
//   receita — por isso não alimentam `entradas` nesta versão. Ver warning.
// - providers.csv normalmente só tem o fornecedor de exemplo do sistema —
//   ignorado.

import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import {
  cleanText, parseNumber, parseDateOnly, normalizePhone, normalizeCpf, normKey,
} from './transforms'
import type { RawRow } from './types'

export interface ExperteFiles {
  patients: RawRow[]
  professionals: RawRow[]
  consultationTypes: RawRow[]
  consultations: RawRow[]
  financialTitles: RawRow[]
  financialParcels: RawRow[]
  providers: RawRow[]
  missing: string[]
}

function parseCsvText(text: string): RawRow[] {
  if (!text || !text.trim()) return []
  const wb = XLSX.read(text, { type: 'string', raw: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return []
  return XLSX.utils.sheet_to_json(ws, { defval: null }) as RawRow[]
}

/** Extrai e faz o parse de todos os CSVs conhecidos de dentro do .zip enviado. */
export async function parseExperteZip(buffer: ArrayBuffer): Promise<ExperteFiles> {
  const zip = await JSZip.loadAsync(buffer)

  const findEntry = (name: string) =>
    Object.values(zip.files).find(f => !f.dir && f.name.toLowerCase().endsWith(name))

  async function readCsv(name: string): Promise<RawRow[]> {
    const entry = findEntry(name)
    if (!entry) return []
    const text = await entry.async('string')
    return parseCsvText(text)
  }

  const [patients, professionals, consultationTypes, consultations, financialTitles, financialParcels, providers] =
    await Promise.all([
      readCsv('patients.csv'),
      readCsv('professionals.csv'),
      readCsv('consultation_types.csv'),
      readCsv('consultations.csv'),
      readCsv('financial_titles.csv'),
      readCsv('financial_parcels.csv'),
      readCsv('providers.csv'),
    ])

  const missing: string[] = []
  if (!patients.length) missing.push('patients.csv')
  if (!consultations.length) missing.push('consultations.csv')

  return { patients, professionals, consultationTypes, consultations, financialTitles, financialParcels, providers, missing }
}

// ---------------------------------------------------------------------------

export interface ExperteAnalysis {
  counts: {
    patients: number
    patientsInactive: number
    professionals: number
    procedureTypes: number
    consultations: number
    consultationsByStatus: Record<string, number>
    dateFrom: string | null
    dateTo: string | null
  }
  professionals: { name: string; consultations: number }[]
  procedures: { name: string; price: number | null; durationMinutes: number | null; active: boolean; consultations: number; fromConsultationTypes: boolean }[]
  warnings: string[]
}

function splitProcedimentos(raw: unknown): string[] {
  const s = cleanText(raw)
  if (!s) return []
  return s.split(',').map(p => p.trim()).filter(Boolean)
}

export function analyzeExperte(files: ExperteFiles): ExperteAnalysis {
  const warnings: string[] = []

  const patientsInactive = files.patients.filter(p => cleanText(p['Status']) === 'Inativo').length

  // Profissionais: conta agendamentos por "Nome Profissional" em consultations.csv,
  // e inclui também quem só aparece em professionals.csv (0 agendamentos).
  const profCount = new Map<string, number>()
  for (const r of files.consultations) {
    const name = cleanText(r['Nome Profissional'])
    if (!name) continue
    profCount.set(name, (profCount.get(name) || 0) + 1)
  }
  for (const r of files.professionals) {
    const name = cleanText(r['Nome'])
    if (name && !profCount.has(name)) profCount.set(name, 0)
  }
  const professionals = [...profCount.entries()]
    .map(([name, n]) => ({ name, consultations: n }))
    .sort((a, b) => b.consultations - a.consultations)

  // Procedimentos: consultation_types.csv é a fonte de preço/duração.
  // Qualquer procedimento citado em consultations.csv que não exista lá
  // entra também, sem preço.
  const procMap = new Map<string, { name: string; price: number | null; durationMinutes: number | null; active: boolean; consultations: number; fromConsultationTypes: boolean }>()

  for (const r of files.consultationTypes) {
    const name = cleanText(r['Nome'])
    if (!name) continue
    procMap.set(normKey(name), {
      name,
      price: parseNumber(r['Valor']),
      durationMinutes: parseNumber(r['Duração (minutos)']),
      active: cleanText(r['Status']) !== 'Inativo',
      consultations: 0,
      fromConsultationTypes: true,
    })
  }
  for (const r of files.consultations) {
    for (const name of splitProcedimentos(r['Procedimentos'])) {
      const key = normKey(name)
      const cur = procMap.get(key) || { name, price: null, durationMinutes: null, active: true, consultations: 0, fromConsultationTypes: false }
      cur.consultations++
      procMap.set(key, cur)
    }
  }
  const procedures = [...procMap.values()].sort((a, b) => b.consultations - a.consultations)

  const unmatched = procedures.filter(p => !p.fromConsultationTypes)
  if (unmatched.length) {
    warnings.push(
      `${unmatched.length} procedimento(s) aparecem em consultations.csv mas não em consultation_types.csv ` +
      `(sem preço/duração conhecidos): ${unmatched.slice(0, 6).map(p => p.name).join(', ')}${unmatched.length > 6 ? '…' : ''}`
    )
  }

  const statusCount: Record<string, number> = {}
  let dateFrom: string | null = null
  let dateTo: string | null = null
  for (const r of files.consultations) {
    const st = cleanText(r['Status']) || 'Sem status'
    statusCount[st] = (statusCount[st] || 0) + 1
    const d = parseDateOnly(r['Data'])
    if (d) {
      if (!dateFrom || d < dateFrom) dateFrom = d
      if (!dateTo || d > dateTo) dateTo = d
    }
  }

  if (files.missing.length) {
    warnings.push(`Arquivo(s) não encontrados no .zip: ${files.missing.join(', ')}.`)
  }

  const financialRows = files.financialTitles.length + files.financialParcels.length
  if (financialRows) {
    warnings.push(
      `financial_titles.csv/financial_parcels.csv (${financialRows} linha(s)) não são importados nesta tela: ` +
      `na amostra só continham saldo inicial de conta do Experte, não receita real. Se precisar reconstruir o ` +
      `financeiro histórico, isso precisa de uma decisão separada (não dá para inferir com segurança destes arquivos).`
    )
  }

  if (files.providers.length) {
    warnings.push(`providers.csv (${files.providers.length} linha(s)) ignorado — normalmente é só o fornecedor de exemplo do sistema.`)
  }

  // Pacientes com nome duplicado: o vínculo consultations -> patients é feito
  // pelo nome (patients.csv não tem ID), então nomes repetidos podem misturar
  // o histórico de duas pessoas diferentes.
  const nameCount = new Map<string, number>()
  for (const p of files.patients) {
    const n = normKey(cleanText(p['Nome']) || '')
    if (!n) continue
    nameCount.set(n, (nameCount.get(n) || 0) + 1)
  }
  const dupNames = [...nameCount.entries()].filter(([, n]) => n > 1)
  if (dupNames.length) {
    warnings.push(
      `${dupNames.length} nome(s) de paciente repetidos em patients.csv — os agendamentos dessas pessoas vão ` +
      `todos para o primeiro cadastro encontrado com o nome (patients.csv não tem ID para desambiguar): ` +
      `${dupNames.slice(0, 5).map(([n]) => n).join(', ')}${dupNames.length > 5 ? '…' : ''}`
    )
  }

  return {
    counts: {
      patients: files.patients.length,
      patientsInactive,
      professionals: professionals.length,
      procedureTypes: procedures.length,
      consultations: files.consultations.length,
      consultationsByStatus: statusCount,
      dateFrom,
      dateTo,
    },
    professionals,
    procedures,
    warnings,
  }
}

// ---------------------------------------------------------------------------
// Helpers de transformação específicos do export Experte, reexportados para
// as rotas de execução.

export function experteGender(raw: unknown): string | null {
  const s = cleanText(raw)
  if (!s) return null
  if (s.toUpperCase().startsWith('F')) return 'F'
  if (s.toUpperCase().startsWith('M')) return 'M'
  return null
}

export function experteStatusToAppointmentStatus(status: string | null, startIso: string, now: Date): string {
  const s = (status || '').trim()
  if (s === 'Concluído') return 'completed'
  if (s === 'Não compareceu') return 'no_show'
  if (s === 'Confirmado') return new Date(startIso) < now ? 'completed' : 'confirmed'
  if (s === 'Cancelado' || s === 'Remarcado') return 'cancelled'
  if (s === 'Agendado') return new Date(startIso) < now ? 'completed' : 'scheduled'
  return new Date(startIso) < now ? 'completed' : 'scheduled'
}

export { cleanText, parseNumber, parseDateOnly, normalizePhone, normalizeCpf, normKey, splitProcedimentos }
