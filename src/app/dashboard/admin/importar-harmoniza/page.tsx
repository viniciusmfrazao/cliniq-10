'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'

type Result = {
  ok: boolean
  total: number
  imported: number
  patientsCreated: number
  skippedDeleted: number
  skippedNoDate: number
  skippedNoPatient: number
  skippedDuplicate: number
  errors: string[]
}

// IDs pré-preenchidos: Clínica Harmoniza / Dra Camila Marçal
const DEFAULT_CLINIC_ID = '1fd47cb1-c0ae-45bc-be32-3df321b99775'
const DEFAULT_PROFESSIONAL_ID = '35a24ca2-e231-4da1-afa7-8a4fd1b866d7'

export default function ImportarHarmonizaPage() {
  const [clinicId, setClinicId] = useState(DEFAULT_CLINIC_ID)
  const [professionalId, setProfessionalId] = useState(DEFAULT_PROFESSIONAL_ID)
  const [file, setFile] = useState<File | null>(null)
  const [defaultStatus, setDefaultStatus] = useState('completed')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')

  async function handleImport() {
    if (!file || !clinicId || !professionalId) {
      setError('Preencha clínica, profissional e selecione o arquivo.')
      return
    }
    setLoading(true)
    setError('')
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('clinicId', clinicId)
    formData.append('professionalId', professionalId)
    formData.append('defaultStatus', defaultStatus)

    try {
      const res = await fetch('/api/import/harmoniza-agendamentos', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) setError(data.error || 'Erro desconhecido')
      else setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Importar Agendamentos — Harmoniza</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Página administrativa temporária. Importa a planilha de agendamentos da Dra Camila,
          vinculando aos pacientes pelo telefone (cria os que não existirem).
        </p>
      </div>

      <div className="card p-6 space-y-5">
        <div>
          <label className="label">ID da Clínica</label>
          <input
            className="input w-full font-mono text-sm"
            value={clinicId}
            onChange={e => setClinicId(e.target.value.trim())}
          />
        </div>
        <div>
          <label className="label">ID do Profissional</label>
          <input
            className="input w-full font-mono text-sm"
            value={professionalId}
            onChange={e => setProfessionalId(e.target.value.trim())}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Arquivo Excel (.xlsx) *
          </label>
          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              file ? 'border-violet-400 bg-violet-50' : 'border-slate-200 hover:border-violet-300 hover:bg-slate-50'
            }`}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] || null)}
            />
            {file ? (
              <div className="flex items-center justify-center gap-2 text-violet-700">
                <Icon name="fileText" className="w-5 h-5" />
                <span className="text-sm font-medium">{file.name}</span>
                <span className="text-xs text-violet-500">({(file.size / 1024).toFixed(0)} KB)</span>
              </div>
            ) : (
              <div className="text-slate-400">
                <Icon name="upload" className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">Clique para selecionar o arquivo</p>
                <p className="text-xs mt-1">Suporta .xlsx e .xls</p>
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Status para agendamentos do passado sem status definido
          </label>
          <select
            value={defaultStatus}
            onChange={e => setDefaultStatus(e.target.value)}
            className="input w-full"
          >
            <option value="completed">Realizado (completed)</option>
            <option value="scheduled">Agendado (scheduled)</option>
          </select>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 text-xs text-slate-600 space-y-1">
          <p className="font-semibold text-slate-700 mb-2">Regras aplicadas:</p>
          <p>✅ Linhas marcadas como Deleted são ignoradas</p>
          <p>✅ Linhas Canceled entram como status &quot;cancelado&quot; (não são perdidas)</p>
          <p>✅ Status MISSED vira &quot;faltou&quot;; CONFIRMED futuro vira &quot;confirmado&quot;</p>
          <p>✅ Procedimento (texto livre) e observações vão para as notas do agendamento — nada é descartado</p>
          <p>✅ Paciente é casado pelo telefone; se não existir, é criado automaticamente</p>
          <p>✅ Roda de novo sem duplicar (agendamento igual já existente é pulado)</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          onClick={handleImport}
          disabled={loading || !file}
          className="w-full py-3 px-4 bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Importando... pode levar até 1 minuto
            </>
          ) : (
            <>
              <Icon name="upload" className="w-4 h-4" />
              Iniciar Importação
            </>
          )}
        </button>
      </div>

      {result && (
        <div className={`card p-6 ${result.ok ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
          <h2 className={`font-semibold mb-4 ${result.ok ? 'text-emerald-800' : 'text-red-800'}`}>
            {result.ok ? '✅ Importação concluída' : '⚠️ Importação com erros'}
          </h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-700">{result.imported}</p>
              <p className="text-xs text-emerald-600">Agendamentos importados</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-violet-700">{result.patientsCreated}</p>
              <p className="text-xs text-violet-600">Pacientes criados</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-500">{result.total}</p>
              <p className="text-xs text-slate-500">Total na planilha</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs text-slate-600 mb-3">
            <div>Deletados ignorados: <b>{result.skippedDeleted}</b></div>
            <div>Sem data válida: <b>{result.skippedNoDate}</b></div>
            <div>Sem paciente/telefone: <b>{result.skippedNoPatient}</b></div>
            <div>Duplicados (já existiam): <b>{result.skippedDuplicate}</b></div>
          </div>
          {result.errors.length > 0 && (
            <div className="bg-white/60 rounded-lg p-3">
              <p className="text-xs font-semibold text-red-700 mb-2">Erros encontrados:</p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-600">{e}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
