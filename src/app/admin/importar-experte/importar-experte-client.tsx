'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useToast } from '@/components/ui/Toast'

type Clinic = { id: string; name: string }

type Analysis = {
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

type Target = {
  users: { id: string; name: string; role: string; active: boolean }[]
  procedures: { id: string; name: string; price: number | null }[]
  existingPatients: number
  existingAppointments: number
  batches: { id: string; label: string; status: string; source: string; stats: Record<string, { created: number }> | null; created_at: string }[]
}

type ExecResult = {
  ok: boolean
  batchId: string
  stats: Record<string, { entity: string; read: number; created: number; skipped: number; reasons: Record<string, number> }>
  errors: string[]
}

const money = (n: number | null) =>
  n === null ? 'sem preço' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function ImportarExperteClient({ clinics }: { clinics: Clinic[] }) {
  const toast = useToast()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [clinicId, setClinicId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [target, setTarget] = useState<Target | null>(null)
  const [result, setResult] = useState<ExecResult | null>(null)

  const [profMap, setProfMap] = useState<Record<string, string>>({})
  const [importProcedures, setImportProcedures] = useState(true)
  const [importPatients, setImportPatients] = useState(true)
  const [importAppointments, setImportAppointments] = useState(true)
  const [defaultPrice, setDefaultPrice] = useState(0)
  const [label, setLabel] = useState('')

  async function handleAnalyze() {
    if (!clinicId || !file) {
      toast.error('Selecione a clínica e o arquivo .zip exportado da Experte')
      return
    }
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('clinicId', clinicId)
      fd.append('file', file)

      const res = await fetch('/api/admin/import/experte/analyze', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha na análise')

      setAnalysis(data.analysis)
      setTarget(data.target)

      const a = data.analysis as Analysis
      const t = data.target as Target
      setProfMap(Object.fromEntries(a.professionals.map(p => {
        const hit = t.users.find(u => u.name.toLowerCase().trim() === p.name.toLowerCase().trim())
        return [p.name, hit ? hit.id : '']
      })))
      setLabel(`Experte — ${new Date().toLocaleDateString('pt-BR')}`)
      setStep(2)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    } finally {
      setLoading(false)
    }
  }

  async function handleExecute() {
    if (!file) return
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('options', JSON.stringify({
        clinicId,
        label,
        importProcedures,
        importPatients,
        importAppointments,
        professionalMap: profMap,
        defaultProcedurePrice: defaultPrice,
      }))

      const res = await fetch('/api/admin/import/experte/execute', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha na importação')

      setResult(data)
      setStep(3)
      toast.success('Importação concluída')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    } finally {
      setLoading(false)
    }
  }

  async function handleRollback(batchId: string) {
    if (!confirm('Desfazer este lote? Todos os registros criados por ele serão apagados.')) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/import/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao desfazer')
      toast.success('Lote desfeito', {
        description: Object.entries(data.removed).map(([k, v]) => `${k}: ${v}`).join(', '),
      })
      setResult(null)
      setStep(1)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Icon name="upload" className="w-5 h-5" />
          Importar dados da Experte
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Sobe o .zip exportado do sistema concorrente (patients, professionals, consultation_types,
          consultations) e grava direto no Clinike — sem precisar rodar query nenhuma. Dá pra desfazer o
          lote inteiro depois se algo sair errado.
        </p>
      </div>

      <div className="flex items-center gap-2 text-xs">
        {['Arquivo', 'Revisão', 'Resultado'].map((s, i) => (
          <div key={s} className={`px-3 py-1 rounded-full ${step === i + 1 ? 'bg-violet-600 text-white' : step > i + 1 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {i + 1}. {s}
          </div>
        ))}
      </div>

      {/* ============ PASSO 1 ============ */}
      {step === 1 && (
        <div className="card p-4 space-y-4">
          <div>
            <label className="label">Clínica de destino</label>
            <select className="input w-full" value={clinicId} onChange={e => setClinicId(e.target.value)}>
              <option value="">Selecione…</option>
              {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Arquivo .zip da Experte *</label>
            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                file ? 'border-violet-400 bg-violet-50' : 'border-slate-200 hover:border-violet-300 hover:bg-slate-50'
              }`}
              onClick={() => document.getElementById('experte-file-input')?.click()}
            >
              <input
                id="experte-file-input"
                type="file"
                accept=".zip"
                className="hidden"
                onChange={e => setFile(e.target.files?.[0] || null)}
              />
              {file ? (
                <div className="flex items-center justify-center gap-2 text-violet-700">
                  <Icon name="file" className="w-5 h-5" />
                  <span className="text-sm font-medium">{file.name}</span>
                  <span className="text-xs text-violet-500">({(file.size / 1024).toFixed(0)} KB)</span>
                </div>
              ) : (
                <div className="text-slate-400">
                  <Icon name="upload" className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm">Clique para selecionar o .zip</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={handleAnalyze} disabled={loading}>
              {loading ? <LoadingSpinner size="sm" inline /> : 'Analisar arquivo'}
            </button>
          </div>
        </div>
      )}

      {/* ============ PASSO 2 ============ */}
      {step === 2 && analysis && target && (
        <div className="space-y-4">
          {analysis.warnings.length > 0 && (
            <div className="card p-4 bg-amber-50 border-amber-200">
              <h2 className="font-medium text-amber-800 mb-2">Avisos</h2>
              <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside">
                {analysis.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          <div className="card p-4">
            <h2 className="font-medium mb-3">Resumo</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="p-2 bg-gray-50 rounded">
                <div className="text-gray-500 text-xs">Pacientes</div>
                <div className="font-medium">{analysis.counts.patients}
                  <span className="text-xs font-normal text-gray-500"> ({analysis.counts.patientsInactive} inativos)</span>
                </div>
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <div className="text-gray-500 text-xs">Agendamentos</div>
                <div className="font-medium">{analysis.counts.consultations}</div>
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <div className="text-gray-500 text-xs">Procedimentos</div>
                <div className="font-medium">{analysis.counts.procedureTypes}</div>
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <div className="text-gray-500 text-xs">Período</div>
                <div className="font-medium text-xs">
                  {analysis.counts.dateFrom || '?'} → {analysis.counts.dateTo || '?'}
                </div>
              </div>
              <div className="p-2 bg-gray-50 rounded md:col-span-4">
                <div className="text-gray-500 text-xs">Agendamentos por status</div>
                <div className="text-xs mt-1">
                  {Object.entries(analysis.counts.consultationsByStatus).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={importPatients} onChange={e => setImportPatients(e.target.checked)} />
                Importar pacientes ({target.existingPatients} já existem na clínica)
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={importProcedures} onChange={e => setImportProcedures(e.target.checked)} />
                Importar procedimentos
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={importAppointments} onChange={e => setImportAppointments(e.target.checked)} />
                Importar agendamentos ({target.existingAppointments} já existem)
              </label>
            </div>
            <div className="flex items-center gap-2 mt-3 text-sm">
              <span>Preço padrão p/ procedimento sem valor:</span>
              <input type="number" className="input w-24" value={defaultPrice} onChange={e => setDefaultPrice(Number(e.target.value))} />
            </div>
          </div>

          <div className="card p-4">
            <h2 className="font-medium mb-1">Profissionais</h2>
            <p className="text-xs text-gray-500 mb-3">
              Contas de usuário não são criadas automaticamente (isso passa pelo convite normal da Equipe).
              Vincule cada profissional da Experte a um usuário já existente na clínica, ou deixe sem vincular —
              o agendamento entra do mesmo jeito, só sem profissional atribuído (nome fica salvo nas observações).
            </p>
            <div className="space-y-2">
              {analysis.professionals.map(p => (
                <div key={p.name} className="flex flex-col md:flex-row md:items-center gap-2">
                  <div className="flex-1 text-sm">
                    {p.name}
                    <span className="text-xs text-gray-500 ml-2">{p.consultations} agend.</span>
                  </div>
                  <select
                    className="input md:w-72"
                    value={profMap[p.name] || ''}
                    onChange={e => setProfMap({ ...profMap, [p.name]: e.target.value })}
                  >
                    <option value="">Não vincular</option>
                    {target.users.map(u => <option key={u.id} value={u.id}>{u.name}{!u.active ? ' (inativo)' : ''}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <h2 className="font-medium mb-1">Procedimentos ({analysis.procedures.length})</h2>
            <p className="text-xs text-gray-500 mb-3">
              Vêm de consultation_types.csv (nome, preço, duração). Os que já existem na clínica (por nome) não
              são duplicados.
            </p>
            <div className="max-h-72 overflow-y-auto space-y-1 pr-1 text-sm">
              {analysis.procedures.map(p => (
                <div key={p.name} className="flex items-center justify-between gap-2 py-1 border-b border-gray-50 last:border-0">
                  <span className="truncate">{p.name}{!p.fromConsultationTypes && <span className="text-amber-600 text-xs ml-1">(sem preço na origem)</span>}</span>
                  <span className="text-xs text-gray-500 whitespace-nowrap">{money(p.price)} · {p.consultations}×</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <label className="label">Nome do lote</label>
            <input className="input" value={label} onChange={e => setLabel(e.target.value)} />
          </div>

          <div className="flex gap-2">
            <button className="btn" onClick={() => setStep(1)} disabled={loading}>Voltar</button>
            <button className="btn btn-primary" onClick={handleExecute} disabled={loading}>
              {loading ? <LoadingSpinner size="sm" inline /> : 'Importar'}
            </button>
          </div>
        </div>
      )}

      {/* ============ PASSO 3 ============ */}
      {step === 3 && result && (
        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="font-medium mb-3 flex items-center gap-2">
              <Icon name="check" className="w-4 h-4 text-green-600" />
              Resultado
            </h2>
            <div className="space-y-3">
              {Object.values(result.stats).map(s => (
                <div key={s.entity} className="border-b border-gray-100 pb-2 last:border-0">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium capitalize">{s.entity}</span>
                    <span>
                      <span className="text-green-600">{s.created} criados</span>
                      {s.skipped > 0 && <span className="text-gray-500"> · {s.skipped} pulados</span>}
                      <span className="text-gray-400"> · {s.read} lidos</span>
                    </span>
                  </div>
                  {Object.keys(s.reasons).length > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      {Object.entries(s.reasons).map(([r, n]) => `${r}: ${n}`).join(' · ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="card p-4 bg-red-50 border-red-200">
              <h2 className="font-medium text-red-800 mb-2">Erros</h2>
              <ul className="text-xs text-red-800 space-y-1 list-disc list-inside">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          <div className="flex gap-2">
            <button className="btn" onClick={() => { setStep(1); setResult(null); setFile(null) }}>Nova importação</button>
            <button className="btn btn-danger" onClick={() => handleRollback(result.batchId)} disabled={loading}>
              Desfazer este lote
            </button>
          </div>
        </div>
      )}

      {step === 2 && target && target.batches.length > 0 && (
        <div className="card p-4">
          <h2 className="font-medium mb-3">Importações anteriores desta clínica</h2>
          <div className="space-y-2 text-sm">
            {target.batches.map(b => (
              <div key={b.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate">{b.label} <span className="text-xs text-gray-400">({b.source})</span></div>
                  <div className="text-xs text-gray-500">
                    {new Date(b.created_at).toLocaleString('pt-BR')} · {b.status}
                  </div>
                </div>
                {b.status === 'completed' && (
                  <button className="btn btn-sm" onClick={() => handleRollback(b.id)} disabled={loading}>
                    Desfazer
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
