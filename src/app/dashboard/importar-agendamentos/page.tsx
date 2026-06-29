'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import * as XLSX from 'xlsx'

interface Row {
  Profissional: string
  Data: string
  'Horário': string
  Cliente: string
  'Serviço(s)': string
  Preço: number
  Observação?: string
}

interface Result {
  total: number
  inserted: number
  skipped: { name: string; reason: string }[]
}

function parseDate(s: string): string {
  // "Qui, 04/12/2025" -> "2025-12-04"
  const part = s.includes(',') ? s.split(', ')[1] : s
  const [d, m, y] = part.trim().split('/')
  return `${y}-${m}-${d}`
}

function parseTimes(horario: string, date: string): [string, string] {
  const parts = horario.split(' às ')
  const start = parts[0].trim()
  const end = parts[1]?.trim() ?? start
  return [`${date}T${start}:00-03:00`, `${date}T${end}:00-03:00`]
}

export default function ImportarAgendamentosPage() {
  const [clinicId, setClinicId] = useState('')
  const [professionalId, setProfessionalId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')

  const supabase = createClient()

  async function handleImport() {
    if (!clinicId || !professionalId || !file) {
      setError('Preencha todos os campos e selecione o arquivo.')
      return
    }
    setError('')
    setLoading(true)
    setResult(null)

    try {
      // 1. Buscar pacientes e procedimentos da clínica
      const [{ data: patients }, { data: procedures }] = await Promise.all([
        supabase.from('patients').select('id, name').eq('clinic_id', clinicId),
        supabase.from('procedures').select('id, name').eq('clinic_id', clinicId),
      ])

      if (!patients || !procedures) throw new Error('Erro ao buscar dados da clínica.')

      // Mapas normalizados (lowercase + trim)
      const patientMap = new Map<string, string>()
      for (const p of patients) patientMap.set(p.name.trim().toLowerCase(), p.id)

      const procedureMap = new Map<string, string>()
      for (const p of procedures) procedureMap.set(p.name.trim().toLowerCase(), p.id)

      // 2. Parse do XLSX
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows: Row[] = XLSX.utils.sheet_to_json(ws)

      const toInsert: object[] = []
      const skipped: { name: string; reason: string }[] = []

      for (const row of rows) {
        const clientName = String(row['Cliente'] ?? '').trim()
        const serviceName = String(row['Serviço(s)'] ?? '').trim().split(',')[0].trim()
        const dateStr = parseDate(String(row['Data'] ?? ''))
        const [startTime, endTime] = parseTimes(String(row['Horário'] ?? ''), dateStr)
        const price = Number(row['Preço'] ?? 0)
        const notes = row['Observação'] ? String(row['Observação']).trim() : null

        const patientId = patientMap.get(clientName.toLowerCase())
        if (!patientId) {
          skipped.push({ name: clientName, reason: 'paciente não encontrado' })
          continue
        }

        const procedureId = procedureMap.get(serviceName.toLowerCase()) ?? null

        toInsert.push({
          id: crypto.randomUUID(),
          clinic_id: clinicId,
          patient_id: patientId,
          professional_id: professionalId,
          procedure_id: procedureId,
          start_time: startTime,
          end_time: endTime,
          status: 'completed',
          notes,
          price,
          valor_cobrado: price,
        })
      }

      // 3. Inserir em lotes de 50
      let inserted = 0
      const BATCH = 50
      for (let i = 0; i < toInsert.length; i += BATCH) {
        const batch = toInsert.slice(i, i + BATCH)
        const { error: insertError } = await supabase.from('appointments').insert(batch)
        if (insertError) throw new Error(`Erro no lote ${i / BATCH}: ${insertError.message}`)
        inserted += batch.length
      }

      setResult({ total: rows.length, inserted, skipped })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-bold">Importar Agendamentos (XLSX)</h1>
      <p className="text-sm text-gray-500">
        Página temporária — apagar após uso.
      </p>

      <div className="card p-6 space-y-4">
        <div>
          <label className="label">ID da Clínica</label>
          <input
            className="input w-full font-mono text-sm"
            placeholder="be89c33a-..."
            value={clinicId}
            onChange={e => setClinicId(e.target.value.trim())}
          />
        </div>

        <div>
          <label className="label">ID do Profissional</label>
          <input
            className="input w-full font-mono text-sm"
            placeholder="20e72305-..."
            value={professionalId}
            onChange={e => setProfessionalId(e.target.value.trim())}
          />
        </div>

        <div>
          <label className="label">Arquivo XLSX</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            className="input w-full"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm">
            {error}
          </div>
        )}

        <button
          className="btn btn-primary w-full"
          onClick={handleImport}
          disabled={loading}
        >
          {loading ? 'Importando...' : 'Importar'}
        </button>
      </div>

      {result && (
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-lg">Resultado</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-gray-50 rounded p-3">
              <div className="text-2xl font-bold">{result.total}</div>
              <div className="text-xs text-gray-500">Total no arquivo</div>
            </div>
            <div className="bg-green-50 rounded p-3">
              <div className="text-2xl font-bold text-green-600">{result.inserted}</div>
              <div className="text-xs text-gray-500">Inseridos</div>
            </div>
            <div className="bg-yellow-50 rounded p-3">
              <div className="text-2xl font-bold text-yellow-600">{result.skipped.length}</div>
              <div className="text-xs text-gray-500">Ignorados</div>
            </div>
          </div>

          {result.skipped.length > 0 && (
            <div>
              <h3 className="font-medium text-sm mb-2">Registros ignorados:</h3>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {result.skipped.map((s, i) => (
                  <div key={i} className="text-sm flex justify-between bg-gray-50 px-3 py-1 rounded">
                    <span>{s.name}</span>
                    <span className="text-gray-400">{s.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
