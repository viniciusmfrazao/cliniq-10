'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'

type Result = {
  ok: boolean
  imported: number
  skipped: number
  patientsCreated: number
  errors: string[]
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [skipProfessionals, setSkipProfessionals] = useState('lucimeire')
  const [fictitiousName, setFictitiousName] = useState('Luiza Victoria')
  const [defaultStatus, setDefaultStatus] = useState('completed')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')

  async function handleImport() {
    if (!file) { setError('Selecione um arquivo Excel'); return }
    setLoading(true)
    setError('')
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('skipProfessionals', skipProfessionals)
    formData.append('fictitiousName', fictitiousName)
    formData.append('defaultStatus', defaultStatus)

    try {
      const res = await fetch('/api/import/appointments', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erro desconhecido')
      } else {
        setResult(data)
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Importar Agendamentos</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Importe agendamentos de outro sistema via planilha Excel
        </p>
      </div>

      <div className="card p-6 space-y-5">
        {/* Upload do arquivo */}
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

        {/* Profissionais para ignorar */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Profissionais para ignorar
          </label>
          <p className="text-xs text-slate-500 mb-2">
            Separe por vírgula. Agendamentos desses profissionais serão pulados.
          </p>
          <input
            type="text"
            value={skipProfessionals}
            onChange={e => setSkipProfessionals(e.target.value)}
            placeholder="ex: lucimeire, joão silva"
            className="input w-full"
          />
        </div>

        {/* Profissional fictício */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Profissional fictício (para profissionais não cadastrados)
          </label>
          <p className="text-xs text-slate-500 mb-2">
            Se deixar em branco, agendamentos de profissionais não encontrados serão ignorados.
          </p>
          <input
            type="text"
            value={fictitiousName}
            onChange={e => setFictitiousName(e.target.value)}
            placeholder="ex: Luiza Victoria"
            className="input w-full"
          />
        </div>

        {/* Status padrão */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Status para agendamentos do passado
          </label>
          <p className="text-xs text-slate-500 mb-2">
            Agendamentos com data futura serão importados como &quot;Agendado&quot; automaticamente.
          </p>
          <select
            value={defaultStatus}
            onChange={e => setDefaultStatus(e.target.value)}
            className="input w-full"
          >
            <option value="completed">Realizado (completed)</option>
            <option value="scheduled">Agendado (scheduled)</option>
            <option value="cancelled">Cancelado (cancelled)</option>
          </select>
        </div>

        {/* Regras de importação */}
        <div className="bg-slate-50 rounded-xl p-4 text-xs text-slate-600 space-y-1">
          <p className="font-semibold text-slate-700 mb-2">Regras aplicadas:</p>
          <p>✅ Agendamentos deletados e cancelados são ignorados automaticamente</p>
          <p>✅ Pacientes já cadastrados (mesmo telefone) não são duplicados</p>
          <p>✅ Pacientes novos são criados automaticamente com os dados do Excel</p>
          <p>✅ Profissionais são mapeados pelo nome (busca parcial)</p>
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
              <p className="text-2xl font-bold text-slate-500">{result.skipped}</p>
              <p className="text-xs text-slate-500">Ignorados</p>
            </div>
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
