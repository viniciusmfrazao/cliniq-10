'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'

interface SkippedRow {
  name: string
  reason: string
}

interface Result {
  total: number
  inserted: number
  skipped: SkippedRow[]
}

export default function ImportarAgendamentosPage() {
  const [clinicId, setClinicId] = useState('')
  const [professionalId, setProfessionalId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')

  async function handleImport() {
    if (!clinicId || !professionalId || !file) {
      setError('Preencha todos os campos e selecione o arquivo.')
      return
    }
    setError('')
    setLoading(true)
    setResult(null)

    try {
      // Parse XLSX no browser
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)

      // Normalizar para chaves simples
      const rows = raw.map(r => ({
        data: String(r['Data'] ?? ''),
        horario: String(r['Hor\u00e1rio'] ?? r['Horario'] ?? r['Horário'] ?? ''),
        cliente: String(r['Cliente'] ?? '').trim(),
        servico: String(r['Servi\u00e7o(s)'] ?? r['Servico(s)'] ?? r['Serviço(s)'] ?? '').trim(),
        preco: Number(r['Pre\u00e7o'] ?? r['Preco'] ?? r['Preço'] ?? 0),
        observacao: r['Observa\u00e7\u00e3o'] != null ? String(r['Observação'] ?? r['Observacao'] ?? '').trim() : undefined,
      })).filter(r => r.cliente && r.data)

      // Enviar para API route (usa service role — sem RLS)
      const res = await fetch('/api/import-agendamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, professionalId, rows }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro na API')

      setResult({ total: rows.length, inserted: data.inserted, skipped: data.skipped })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-bold">Importar Agendamentos (XLSX)</h1>
      <p className="text-sm text-gray-500">Página temporária — apagar após uso.</p>

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

        <button className="btn btn-primary w-full" onClick={handleImport} disabled={loading}>
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
