'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useToast } from '@/components/ui/Toast'

type Clinic = { id: string; name: string }

type Analysis = {
  files: { fileName: string; specKey: string | null; label: string; rows: number; columns: number; pending: boolean; pendingReason?: string; note?: string }[]
  duplicateFiles: string[]
  professionals: { key: string; name: string; appointments: number }[]
  procedures: { name: string; price: number | null; appointments: number; budgets: number }[]
  paymentForms: { raw: string; count: number; suggested: string }[]
  counts: {
    patients: number; appointments: number; appointmentsDeleted: number
    orcamentos: number; orcamentoItens: number; entradas: number; entradasTotal: number
  }
  warnings: string[]
}

type Target = {
  users: { id: string; name: string; role: string }[]
  procedures: { id: string; name: string; price: number | null }[]
  existingPatients: number
  existingAppointments: number
  batches: { id: string; label: string; status: string; stats: Record<string, { created: number }> | null; created_at: string }[]
}

type ExecResult = { ok: boolean; batchId: string; stats: Record<string, { entity: string; read: number; created: number; skipped: number; reasons: Record<string, number> }>; errors: string[] }

const ENTITIES = [
  { key: 'procedures', label: 'Procedimentos' },
  { key: 'patients', label: 'Pacientes' },
  { key: 'appointments', label: 'Agendamentos' },
  { key: 'orcamentos', label: 'Orçamentos' },
  { key: 'entradas', label: 'Financeiro (entradas)' },
] as const

const PAYMENT_OPTIONS = ['pix', 'credito', 'debito', 'dinheiro', 'boleto', 'outro']

const money = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function ImportarClient({ clinics }: { clinics: Clinic[] }) {
  const toast = useToast()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [clinicId, setClinicId] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)

  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [target, setTarget] = useState<Target | null>(null)
  const [result, setResult] = useState<ExecResult | null>(null)

  // de-para
  const [profMap, setProfMap] = useState<Record<string, string>>({})
  const [procMap, setProcMap] = useState<Record<string, string>>({})
  const [formMap, setFormMap] = useState<Record<string, string>>({})

  // opções
  const [entities, setEntities] = useState<string[]>(ENTITIES.map(e => e.key))
  const [skipDeleted, setSkipDeleted] = useState(true)
  const [defaultPrice, setDefaultPrice] = useState(0)
  const [label, setLabel] = useState('')

  async function handleAnalyze() {
    if (!clinicId || files.length === 0) {
      toast.error('Selecione a clínica e ao menos um arquivo')
      return
    }
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('clinicId', clinicId)
      fd.append('presetId', 'clinicorp')
      files.forEach(f => fd.append('files', f))

      const res = await fetch('/api/admin/import/analyze', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha na análise')

      setAnalysis(data.analysis)
      setTarget(data.target)

      // pré-preenche o de-para
      const a = data.analysis as Analysis
      const t = data.target as Target
      const soleProfessional = t.users.length === 1 ? t.users[0].id : ''
      setProfMap(Object.fromEntries(a.professionals.map(p => [p.key, soleProfessional])))
      setProcMap(Object.fromEntries(a.procedures.map(p => {
        const hit = t.procedures.find(x => x.name.toLowerCase().trim() === p.name.toLowerCase().trim())
        return [p.name, hit ? hit.id : 'new']
      })))
      setFormMap(Object.fromEntries(a.paymentForms.map(f => [f.raw, f.suggested])))
      setLabel(`Clinicorp — ${new Date().toLocaleDateString('pt-BR')}`)
      setStep(2)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    } finally {
      setLoading(false)
    }
  }

  async function handleExecute() {
    const unmapped = analysis?.professionals.filter(p => p.appointments > 0 && !profMap[p.key]) || []
    if (unmapped.length && entities.includes('appointments')) {
      toast.error(`Vincule os profissionais: ${unmapped.map(u => u.name).join(', ')}`)
      return
    }
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('options', JSON.stringify({
        clinicId,
        presetId: 'clinicorp',
        columnOverrides: {},
        reconciliation: { professionals: profMap, procedures: procMap, paymentForms: formMap },
        entities,
        skipDeleted,
        defaultProcedurePrice: defaultPrice,
        label,
      }))
      files.forEach(f => fd.append('files', f))

      const res = await fetch('/api/admin/import/execute', { method: 'POST', body: fd })
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

  const toggleEntity = (k: string) =>
    setEntities(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Icon name="upload" className="w-5 h-5" />
          Importar dados
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Migração de sistemas externos com mapeamento revisável e possibilidade de desfazer.
        </p>
      </div>

      {/* Passos */}
      <div className="flex items-center gap-2 text-xs">
        {['Arquivos', 'Revisão', 'Resultado'].map((s, i) => (
          <div key={s} className={`px-3 py-1 rounded-full ${step === i + 1 ? 'bg-blue-600 text-white' : step > i + 1 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {i + 1}. {s}
          </div>
        ))}
      </div>

      {/* ============ PASSO 1 ============ */}
      {step === 1 && (
        <div className="card p-4 space-y-4">
          <div>
            <label className="label">Clínica de destino</label>
            <select className="input" value={clinicId} onChange={e => setClinicId(e.target.value)}>
              <option value="">Selecione…</option>
              {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Sistema de origem</label>
            <select className="input" defaultValue="clinicorp">
              <option value="clinicorp">Clinicorp</option>
            </select>
          </div>

          <div>
            <label className="label">Planilhas (.xlsx)</label>
            <input
              type="file"
              multiple
              accept=".xlsx,.xls,.csv"
              className="input"
              onChange={e => setFiles(Array.from(e.target.files || []))}
            />
            {files.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">{files.length} arquivo(s) selecionado(s)</p>
            )}
          </div>

          <button className="btn btn-primary" onClick={handleAnalyze} disabled={loading}>
            {loading ? <LoadingSpinner size="sm" inline /> : 'Analisar'}
          </button>
        </div>
      )}

      {/* ============ PASSO 2 ============ */}
      {step === 2 && analysis && target && (
        <div className="space-y-5">
          {/* Arquivos detectados */}
          <div className="card p-4">
            <h2 className="font-medium mb-3">Arquivos detectados</h2>
            <div className="space-y-1 text-sm">
              {analysis.files.map(f => (
                <div key={f.fileName} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
                  <div className="min-w-0">
                    <span className="font-mono text-xs text-gray-500">{f.fileName}</span>
                    <span className="ml-2">{f.label}</span>
                    {f.pending && <span className="badge badge-warning ml-2">pendente</span>}
                    {f.note && <span className="text-xs text-gray-400 ml-2">{f.note}</span>}
                  </div>
                  <span className="text-xs text-gray-500 shrink-0">{f.rows} linhas · {f.columns} col.</span>
                </div>
              ))}
            </div>
            {analysis.duplicateFiles.map(d => (
              <p key={d} className="text-xs text-amber-600 mt-2">⚠ {d}</p>
            ))}
          </div>

          {/* Avisos */}
          {analysis.warnings.length > 0 && (
            <div className="card p-4 bg-amber-50 border-amber-200">
              <h2 className="font-medium mb-2 text-amber-800">Avisos</h2>
              <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
                {analysis.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          {/* Base de destino */}
          {(target.existingPatients > 0 || target.existingAppointments > 0) && (
            <div className="card p-4 bg-blue-50 border-blue-200 text-sm text-blue-900">
              Esta clínica já tem <strong>{target.existingPatients}</strong> pacientes e{' '}
              <strong>{target.existingAppointments}</strong> agendamentos. Pacientes com telefone
              coincidente serão reaproveitados, não duplicados.
            </div>
          )}

          {/* O que importar */}
          <div className="card p-4">
            <h2 className="font-medium mb-3">O que importar</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              {ENTITIES.map(e => (
                <label key={e.key} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={entities.includes(e.key)} onChange={() => toggleEntity(e.key)} />
                  {e.label}
                </label>
              ))}
            </div>

            <div className="grid md:grid-cols-3 gap-3 mt-4 text-sm">
              <div className="p-2 bg-gray-50 rounded">
                <div className="text-gray-500 text-xs">Pacientes</div>
                <div className="font-medium">{analysis.counts.patients}</div>
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <div className="text-gray-500 text-xs">Agendamentos</div>
                <div className="font-medium">
                  {analysis.counts.appointments}
                  {analysis.counts.appointmentsDeleted > 0 && (
                    <span className="text-xs text-gray-500 font-normal"> ({analysis.counts.appointmentsDeleted} excluídos)</span>
                  )}
                </div>
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <div className="text-gray-500 text-xs">Orçamentos</div>
                <div className="font-medium">{analysis.counts.orcamentos} <span className="text-xs font-normal text-gray-500">({analysis.counts.orcamentoItens} itens)</span></div>
              </div>
              <div className="p-2 bg-gray-50 rounded md:col-span-2">
                <div className="text-gray-500 text-xs">Entradas financeiras</div>
                <div className="font-medium">{analysis.counts.entradas} · {money(analysis.counts.entradasTotal)}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={skipDeleted} onChange={e => setSkipDeleted(e.target.checked)} />
                Pular agendamentos marcados como excluídos
              </label>
              <div className="flex items-center gap-2">
                <span>Preço padrão sem valor:</span>
                <input
                  type="number"
                  className="input w-24"
                  value={defaultPrice}
                  onChange={e => setDefaultPrice(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Profissionais */}
          <div className="card p-4">
            <h2 className="font-medium mb-1">Profissionais</h2>
            <p className="text-xs text-gray-500 mb-3">
              Contas de usuário não são criadas automaticamente. Vincule cada profissional da origem
              a um usuário existente da clínica.
            </p>
            <div className="space-y-2">
              {analysis.professionals.map(p => (
                <div key={p.key} className="flex flex-col md:flex-row md:items-center gap-2">
                  <div className="flex-1 text-sm">
                    {p.name}
                    <span className="text-xs text-gray-500 ml-2">{p.appointments} agend.</span>
                  </div>
                  <select
                    className="input md:w-72"
                    value={profMap[p.key] || ''}
                    onChange={e => setProfMap({ ...profMap, [p.key]: e.target.value })}
                  >
                    <option value="">Ignorar</option>
                    {target.users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Procedimentos */}
          <div className="card p-4">
            <h2 className="font-medium mb-1">Procedimentos ({analysis.procedures.length})</h2>
            <p className="text-xs text-gray-500 mb-3">
              Nomes compostos foram separados. Preço vem dos orçamentos quando disponível.
            </p>
            <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
              {analysis.procedures.map(p => (
                <div key={p.name} className="flex flex-col md:flex-row md:items-center gap-2">
                  <div className="flex-1 text-sm min-w-0">
                    <span className="truncate">{p.name}</span>
                    <span className="text-xs text-gray-500 ml-2">
                      {p.price !== null ? money(p.price) : 'sem preço'} · {p.appointments + p.budgets}×
                    </span>
                  </div>
                  <select
                    className="input md:w-72"
                    value={procMap[p.name] || 'new'}
                    onChange={e => setProcMap({ ...procMap, [p.name]: e.target.value })}
                  >
                    <option value="new">➕ Criar novo</option>
                    <option value="skip">Ignorar</option>
                    {target.procedures.map(tp => <option key={tp.id} value={tp.id}>{tp.name}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Formas de pagamento */}
          {analysis.paymentForms.length > 0 && (
            <div className="card p-4">
              <h2 className="font-medium mb-3">Formas de pagamento</h2>
              <div className="space-y-2">
                {analysis.paymentForms.map(f => (
                  <div key={f.raw} className="flex flex-col md:flex-row md:items-center gap-2">
                    <div className="flex-1 text-sm font-mono text-xs">
                      {f.raw} <span className="text-gray-500">({f.count})</span>
                    </div>
                    <select
                      className="input md:w-56"
                      value={formMap[f.raw] || 'outro'}
                      onChange={e => setFormMap({ ...formMap, [f.raw]: e.target.value })}
                    >
                      {PAYMENT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

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
            <h2 className="font-medium mb-3">Resultado</h2>
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
            <button className="btn" onClick={() => { setStep(1); setResult(null) }}>Nova importação</button>
            <button className="btn btn-danger" onClick={() => handleRollback(result.batchId)} disabled={loading}>
              Desfazer este lote
            </button>
          </div>
        </div>
      )}

      {/* Histórico */}
      {step === 2 && target && target.batches.length > 0 && (
        <div className="card p-4">
          <h2 className="font-medium mb-3">Importações anteriores desta clínica</h2>
          <div className="space-y-2 text-sm">
            {target.batches.map(b => (
              <div key={b.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate">{b.label}</div>
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
