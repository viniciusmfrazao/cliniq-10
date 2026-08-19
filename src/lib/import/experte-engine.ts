import type { ParsedFile } from './types'
import { fileByKey } from './engine'
import { cleanText, parseNumber, normKey } from './transforms'
import { expertePreset } from './presets/experte'

/** Experte concatena múltiplos procedimentos por vírgula (não por " / " como o Clinicorp). */
export function splitProceduresComma(raw: unknown): string[] {
  const s = cleanText(raw)
  if (!s) return []
  return s.split(',').map(p => p.trim()).filter(Boolean)
}

export interface ExperteAnalysis {
  files: {
    fileName: string
    specKey: string | null
    label: string
    rows: number
    columns: number
  }[]
  professionals: { name: string; appointments: number }[]
  procedures: { name: string; price: number | null; durationMinutes: number | null; active: boolean; appointments: number }[]
  paymentForms: { raw: string; count: number; suggested: string }[]
  counts: {
    patients: number
    appointments: number
    appointmentsByStatus: Record<string, number>
    entradas: number
    entradasTotal: number
  }
  duplicatePatientNames: string[]
  warnings: string[]
}

export function analyzeExperte(parsed: ParsedFile[]): ExperteAnalysis {
  const warnings: string[] = []
  const specMap = new Map(expertePreset.files.map(s => [s.key, s]))

  const patientsFile = fileByKey(parsed, 'Patients')
  const profFile = fileByKey(parsed, 'Professionals')
  const typesFile = fileByKey(parsed, 'ConsultationTypes')
  const apptFile = fileByKey(parsed, 'Consultations')
  const parcelsFile = fileByKey(parsed, 'FinancialParcels')

  // --- Profissionais ---
  const profCount = new Map<string, number>()
  for (const r of apptFile?.rows || []) {
    const name = cleanText(r['Nome Profissional'])
    if (!name) continue
    profCount.set(name, (profCount.get(name) || 0) + 1)
  }
  for (const r of profFile?.rows || []) {
    const name = cleanText(r['Nome'])
    if (name && !profCount.has(name)) profCount.set(name, 0)
  }
  const professionals = [...profCount.entries()]
    .map(([name, appointments]) => ({ name, appointments }))
    .sort((a, b) => b.appointments - a.appointments)

  // --- Procedimentos (tipos cadastrados + variações que aparecem nos agendamentos) ---
  const procMap = new Map<string, { name: string; price: number | null; durationMinutes: number | null; active: boolean; appointments: number }>()
  for (const r of typesFile?.rows || []) {
    const name = cleanText(r['Nome'])
    if (!name) continue
    const price = parseNumber(r['Valor'])
    const duration = parseNumber(r['Duração (minutos)'])
    const active = (cleanText(r['Status']) || 'Ativo').toLowerCase() !== 'inativo'
    procMap.set(normKey(name), {
      name,
      price: price && price > 0 ? price : null,
      durationMinutes: duration && duration > 0 ? duration : null,
      active,
      appointments: 0,
    })
  }
  for (const r of apptFile?.rows || []) {
    for (const name of splitProceduresComma(r['Procedimentos'])) {
      const k = normKey(name)
      const cur = procMap.get(k) || { name, price: null, durationMinutes: null, active: true, appointments: 0 }
      cur.appointments++
      procMap.set(k, cur)
    }
  }
  const procedures = [...procMap.values()].sort((a, b) => a.name.localeCompare(b.name))

  // --- Formas de pagamento ---
  const formCount = new Map<string, number>()
  for (const r of parcelsFile?.rows || []) {
    const raw = cleanText(r['Método de pagamento']) || 'DESCONHECIDO'
    formCount.set(raw, (formCount.get(raw) || 0) + 1)
  }
  const paymentForms = [...formCount.entries()]
    .map(([raw, count]) => ({ raw, count, suggested: expertePreset.valueMaps.paymentForm[raw] || 'outro' }))
    .sort((a, b) => b.count - a.count)

  // --- Pacientes: nomes duplicados (não há coluna de id, o vínculo é por nome) ---
  const nameCount = new Map<string, number>()
  for (const r of patientsFile?.rows || []) {
    const name = cleanText(r['Nome'])
    if (!name) continue
    nameCount.set(name, (nameCount.get(name) || 0) + 1)
  }
  const duplicatePatientNames = [...nameCount.entries()].filter(([, n]) => n > 1).map(([name]) => name)
  if (duplicatePatientNames.length) {
    warnings.push(
      `${duplicatePatientNames.length} nome(s) de paciente duplicado(s) no arquivo — ` +
      `agendamentos desses pacientes podem ser vinculados à pessoa errada: ${duplicatePatientNames.join(', ')}`
    )
  }

  // --- Agendamentos por status ---
  const appointmentsByStatus: Record<string, number> = {}
  for (const r of apptFile?.rows || []) {
    const status = cleanText(r['Status']) || 'Sem status'
    appointmentsByStatus[status] = (appointmentsByStatus[status] || 0) + 1
  }

  // --- Entradas: exclui saldo inicial / transferências e valores zerados ---
  let entradasCount = 0
  let entradasTotal = 0
  for (const r of parcelsFile?.rows || []) {
    const categoria = cleanText(r['Categoria']) || ''
    if (categoria.toLowerCase() === 'transferências') continue
    const valor = parseNumber(r['Valor bruto']) || 0
    if (valor <= 0) continue
    entradasCount++
    entradasTotal += valor
  }

  // --- Avisos gerais ---
  for (const p of parsed) {
    if (!p.specKey) warnings.push(`Arquivo "${p.fileName}" não reconhecido e será ignorado.`)
    else if (p.rows.length === 0) {
      const spec = specMap.get(p.specKey)
      warnings.push(`"${p.fileName}" (${spec?.label || p.specKey}) veio sem linhas.`)
    }
  }
  if (!patientsFile) warnings.push('Arquivo de pacientes ausente — agendamentos e financeiro dependem dele.')

  const files = parsed.map(p => {
    const spec = p.specKey ? specMap.get(p.specKey) : undefined
    return {
      fileName: p.fileName,
      specKey: p.specKey,
      label: spec?.label || 'Não reconhecido',
      rows: p.rows.length,
      columns: p.headers.length,
    }
  })

  return {
    files,
    professionals,
    procedures,
    paymentForms,
    counts: {
      patients: patientsFile?.rows.length || 0,
      appointments: apptFile?.rows.length || 0,
      appointmentsByStatus,
      entradas: entradasCount,
      entradasTotal,
    },
    duplicatePatientNames,
    warnings,
  }
}
