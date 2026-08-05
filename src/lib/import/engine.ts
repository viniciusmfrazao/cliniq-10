import * as XLSX from 'xlsx'
import type { ImportPreset, ParsedFile, RawRow } from './types'
import { cleanText, parseNumber, splitProcedures, normKey, parseFlag } from './transforms'

/** Lê planilhas e identifica a qual spec do preset cada arquivo pertence. */
export function parseWorkbooks(
  files: { name: string; buffer: ArrayBuffer }[],
  preset: ImportPreset
): ParsedFile[] {
  const out: ParsedFile[] = []

  for (const f of files) {
    const wb = XLSX.read(f.buffer, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = (ws ? XLSX.utils.sheet_to_json(ws, { defval: null }) : []) as RawRow[]
    const headers = ws
      ? ((XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })[0] as unknown[]) || [])
          .map(h => String(h ?? '').trim())
          .filter(Boolean)
      : []

    // Nome sem extensão e sem sufixo de download do tipo "__1_" / " (1)"
    const lowerName = f.name
      .toLowerCase()
      .replace(/\.(xlsx|xlsm|xls|csv)$/, '')
      .replace(/__\d+_?$/, '')
      .replace(/\s*\(\d+\)$/, '')

    let specKey: string | null = null

    // 1ª tentativa: nome do arquivo. O match MAIS LONGO vence, senão
    // "Patient" capturaria "PatientAnamnesis" e "Anamnesis" capturaria
    // "AnamnesisQuestions".
    let bestLen = 0
    for (const spec of preset.files) {
      for (const m of spec.matchNames) {
        if (lowerName.includes(m) && m.length > bestLen) {
          bestLen = m.length
          specKey = spec.key
        }
      }
    }

    // 2ª tentativa: assinatura de colunas (arquivo pode ter sido renomeado)
    if (!specKey) {
      for (const spec of preset.files) {
        if (spec.signatureColumns.length === 0) continue
        if (spec.signatureColumns.every(c => headers.includes(c))) { specKey = spec.key; break }
      }
    }

    out.push({ fileName: f.name, specKey, headers, rows })
  }

  return out
}

export function fileByKey(parsed: ParsedFile[], key: string): ParsedFile | undefined {
  // Se o mesmo spec vier em 2 arquivos (ex.: Budgets e Budgets__1_), usa o de mais linhas
  const matches = parsed.filter(p => p.specKey === key)
  if (matches.length === 0) return undefined
  return matches.reduce((a, b) => (b.rows.length > a.rows.length ? b : a))
}

export interface AnalysisResult {
  files: {
    fileName: string
    specKey: string | null
    label: string
    rows: number
    columns: number
    pending: boolean
    pendingReason?: string
    note?: string
  }[]
  duplicateFiles: string[]
  professionals: { key: string; name: string; appointments: number }[]
  procedures: { name: string; price: number | null; appointments: number; budgets: number }[]
  paymentForms: { raw: string; count: number; suggested: string }[]
  counts: {
    patients: number
    appointments: number
    appointmentsDeleted: number
    orcamentos: number
    orcamentoItens: number
    entradas: number
    entradasTotal: number
  }
  warnings: string[]
}

/** Monta tudo que a tela precisa mostrar antes de gravar qualquer coisa. */
export function analyze(parsed: ParsedFile[], preset: ImportPreset): AnalysisResult {
  const warnings: string[] = []
  const specMap = new Map(preset.files.map(s => [s.key, s]))

  // Arquivos idênticos / repetidos
  const seenSpecs = new Map<string, string[]>()
  for (const p of parsed) {
    if (!p.specKey) continue
    seenSpecs.set(p.specKey, [...(seenSpecs.get(p.specKey) || []), p.fileName])
  }
  const duplicateFiles: string[] = []
  for (const [key, names] of seenSpecs) {
    if (names.length > 1) {
      duplicateFiles.push(`${key}: ${names.join(', ')} — usando o de mais linhas`)
    }
  }

  const patientFile = fileByKey(parsed, 'Patient')
  const apptFile = fileByKey(parsed, 'Appointment')
  const budgetFile = fileByKey(parsed, 'Budgets')
  const headerFile = fileByKey(parsed, 'PaymentHeader')
  const itemFile = fileByKey(parsed, 'PaymentItem')
  const dentistFile = fileByKey(parsed, 'Dentist')

  // --- Profissionais ---
  const profCount = new Map<string, { name: string; n: number }>()
  for (const r of apptFile?.rows || []) {
    const id = cleanText(r['DentistId']) || cleanText(r['DentistName']) || ''
    const name = cleanText(r['DentistName']) || 'Sem nome'
    if (!id) continue
    const cur = profCount.get(id) || { name, n: 0 }
    cur.n++
    profCount.set(id, cur)
  }
  for (const r of dentistFile?.rows || []) {
    if (parseFlag(r['Deleted'])) continue
    const id = cleanText(r['id']) || ''
    const name = cleanText(r['Name']) || 'Sem nome'
    if (id && !profCount.has(id)) profCount.set(id, { name, n: 0 })
  }
  const professionals = [...profCount.entries()]
    .map(([key, v]) => ({ key, name: v.name, appointments: v.n }))
    .sort((a, b) => b.appointments - a.appointments)

  // --- Procedimentos (nomes atômicos, preço vindo dos orçamentos) ---
  const procMap = new Map<string, { name: string; price: number | null; appointments: number; budgets: number }>()

  const touchProc = (rawName: string, kind: 'appt' | 'budget', price?: number | null) => {
    const name = rawName.trim()
    if (!name) return
    const k = normKey(name)
    const cur = procMap.get(k) || { name, price: null, appointments: 0, budgets: 0 }
    if (kind === 'appt') cur.appointments++
    else cur.budgets++
    if (price !== null && price !== undefined && price > 0 && (cur.price === null || price > cur.price)) {
      cur.price = price
    }
    procMap.set(k, cur)
  }

  for (const r of apptFile?.rows || []) {
    for (const p of splitProcedures(r['Procedures'])) touchProc(p, 'appt')
  }
  for (const r of budgetFile?.rows || []) {
    const price = parseNumber(r['ProcedureFinalAmount']) ?? parseNumber(r['ProcedureAmount'])
    for (const p of splitProcedures(r['ProcedureName'])) touchProc(p, 'budget', price)
  }
  const procedures = [...procMap.values()].sort((a, b) => a.name.localeCompare(b.name))

  // --- Formas de pagamento ---
  const formCount = new Map<string, number>()
  for (const r of itemFile?.rows || []) {
    const raw = cleanText(r['Type']) || cleanText(r['PaymentForm_CharacteristicId']) || 'DESCONHECIDO'
    formCount.set(raw, (formCount.get(raw) || 0) + 1)
  }
  const paymentForms = [...formCount.entries()]
    .map(([raw, count]) => ({
      raw,
      count,
      suggested: preset.valueMaps.paymentForm[raw] || 'outro',
    }))
    .sort((a, b) => b.count - a.count)

  // --- Contagens ---
  const apptRows = apptFile?.rows || []
  const deleted = apptRows.filter(r => parseFlag(r['Deleted'])).length

  const budgetIds = new Set((budgetFile?.rows || []).map(r => String(r['BudgetId'] ?? '')).filter(Boolean))

  // Entradas: uma por PaymentHeader, valor = soma das parcelas não canceladas
  const itemsByHeader = new Map<string, number>()
  for (const r of itemFile?.rows || []) {
    if (parseFlag(r['Canceled'])) continue
    const h = String(r['PaymentHeaderId'] ?? '')
    if (!h) continue
    itemsByHeader.set(h, (itemsByHeader.get(h) || 0) + (parseNumber(r['Amount']) || 0))
  }
  let entradasTotal = 0
  let entradasCount = 0
  for (const r of headerFile?.rows || []) {
    const id = String(r['id'] ?? '')
    const v = itemsByHeader.get(id)
    if (v && v > 0) { entradasTotal += v; entradasCount++ }
  }

  // --- Avisos ---
  const bookEntry = fileByKey(parsed, 'BookEntry')
  if (bookEntry && bookEntry.rows.length > 0) {
    warnings.push(
      `BookEntry (${bookEntry.rows.length} linhas) é partida dobrada e não será importado como receita — ` +
      `a receita vem de PaymentHeader/PaymentItem.`
    )
  }
  for (const p of parsed) {
    if (!p.specKey) warnings.push(`Arquivo "${p.fileName}" não reconhecido e será ignorado.`)
    if (p.specKey && p.rows.length === 0) {
      const spec = specMap.get(p.specKey)
      warnings.push(`"${p.fileName}" (${spec?.label || p.specKey}) veio sem linhas.`)
    }
  }
  if (!patientFile) warnings.push('Arquivo de pacientes ausente — agendamentos e financeiro dependem dele.')

  const files = parsed.map(p => {
    const spec = p.specKey ? specMap.get(p.specKey) : undefined
    return {
      fileName: p.fileName,
      specKey: p.specKey,
      label: spec?.label || 'Não reconhecido',
      rows: p.rows.length,
      columns: p.headers.length,
      pending: !!spec?.pending,
      pendingReason: spec?.pendingReason,
      note: spec && spec.feeds.length === 0 && !spec.pending ? 'Usado apenas como referência' : undefined,
    }
  })

  return {
    files,
    duplicateFiles,
    professionals,
    procedures,
    paymentForms,
    counts: {
      patients: patientFile?.rows.length || 0,
      appointments: apptRows.length,
      appointmentsDeleted: deleted,
      orcamentos: budgetIds.size,
      orcamentoItens: budgetFile?.rows.length || 0,
      entradas: entradasCount,
      entradasTotal,
    },
    warnings,
  }
}
