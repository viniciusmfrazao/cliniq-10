'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type Session = {
  id: string
  performed_at: string
  notes: string | null
  performed_by: string | null
  appointment_id: string | null
}

type Package = {
  id: string
  name: string
  total_sessions: number
  used_sessions: number
  price_total: number | null
  sold_at: string
  expires_at: string | null
  status: 'active' | 'completed' | 'cancelled' | 'expired'
  notes: string | null
  procedure_id: string | null
  patient_package_sessions: Session[]
}

type Procedure = { id: string; name: string }

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  active:    { label: 'Ativo',      cls: 'bg-emerald-100 text-emerald-700' },
  completed: { label: 'Concluído',  cls: 'bg-violet-100 text-violet-700' },
  cancelled: { label: 'Cancelado',  cls: 'bg-red-100 text-red-700' },
  expired:   { label: 'Expirado',   cls: 'bg-slate-100 text-slate-500' },
}

function ProgressBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0
  const done = used >= total
  return (
    <div className="flex items-center gap-3 mt-2">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${done ? 'bg-violet-500' : 'bg-emerald-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-slate-600 tabular-nums whitespace-nowrap">
        {used}/{total} sessões
      </span>
    </div>
  )
}

function SessionDots({ used, total }: { used: number; total: number }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-3">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
            i < used
              ? 'bg-violet-500 text-white shadow-sm'
              : 'bg-slate-100 text-slate-400'
          }`}
        >
          {i < used ? '✓' : i + 1}
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
// Modal de novo pacote
// ─────────────────────────────────────────────

function NewPackageModal({
  patientId,
  clinicId,
  procedures,
  onClose,
  onCreated,
}: {
  patientId: string
  clinicId: string
  procedures: Procedure[]
  onClose: () => void
  onCreated: (pkg: Package) => void
}) {
  const [form, setForm] = useState({
    name: '',
    total_sessions: 3,
    price_total: '',
    procedure_id: '',
    sold_at: new Date().toISOString().split('T')[0],
    expires_at: '',
    notes: '',
  })
  const [saving, startSaving] = useTransition()
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!form.name.trim()) { setError('Nome do pacote é obrigatório.'); return }
    if (form.total_sessions < 1) { setError('Mínimo 1 sessão.'); return }
    setError('')

    startSaving(async () => {
      const supabase = createClient()
      const { data, error: err } = await supabase
        .from('patient_packages')
        .insert({
          clinic_id: clinicId,
          patient_id: patientId,
          name: form.name.trim(),
          total_sessions: form.total_sessions,
          price_total: form.price_total ? parseFloat(form.price_total) : null,
          procedure_id: form.procedure_id || null,
          sold_at: form.sold_at,
          expires_at: form.expires_at || null,
          notes: form.notes.trim() || null,
        })
        .select('*, patient_package_sessions(*)')
        .single()

      if (err) { setError(err.message); return }
      onCreated(data as Package)
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-slate-900">Novo pacote</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Nome do pacote *</label>
            <input
              className="input"
              placeholder="Ex: Clube do Botox, Pacote Lavieen..."
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Nº de sessões *</label>
              <input
                type="number"
                min={1}
                max={100}
                className="input"
                value={form.total_sessions}
                onChange={e => setForm(f => ({ ...f, total_sessions: parseInt(e.target.value) || 1 }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Valor total (R$)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                className="input"
                placeholder="0,00"
                value={form.price_total}
                onChange={e => setForm(f => ({ ...f, price_total: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Procedimento vinculado</label>
            <select
              className="input"
              value={form.procedure_id}
              onChange={e => setForm(f => ({ ...f, procedure_id: e.target.value }))}
            >
              <option value="">Selecionar (opcional)</option>
              {procedures.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Data da venda</label>
              <input
                type="date"
                className="input"
                value={form.sold_at}
                onChange={e => setForm(f => ({ ...f, sold_at: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Validade</label>
              <input
                type="date"
                className="input"
                value={form.expires_at}
                onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Observações</label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Informações adicionais sobre o pacote..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>
          )}

          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? 'Salvando...' : 'Criar pacote'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Modal de usar sessão
// ─────────────────────────────────────────────

function UseSessionModal({
  pkg,
  clinicId,
  onClose,
  onUsed,
}: {
  pkg: Package
  clinicId: string
  onClose: () => void
  onUsed: (updatedPkg: Package) => void
}) {
  const [notes, setNotes] = useState('')
  const [saving, startSaving] = useTransition()
  const [error, setError] = useState('')

  async function handleConfirm() {
    startSaving(async () => {
      const supabase = createClient()
      const { error: err } = await supabase
        .from('patient_package_sessions')
        .insert({
          clinic_id: clinicId,
          package_id: pkg.id,
          performed_at: new Date().toISOString().split('T')[0],
          notes: notes.trim() || null,
        })

      if (err) { setError(err.message); return }

      // Buscar pacote atualizado
      const { data } = await supabase
        .from('patient_packages')
        .select('*, patient_package_sessions(*)')
        .eq('id', pkg.id)
        .single()

      if (data) onUsed(data as Package)
      onClose()
    })
  }

  const remaining = pkg.total_sessions - pkg.used_sessions

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900">Usar sessão</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-violet-50 rounded-2xl p-4 mb-4">
          <p className="text-sm font-semibold text-violet-900">{pkg.name}</p>
          <p className="text-xs text-violet-600 mt-0.5">
            Restam <strong>{remaining - 1}</strong> sessão{remaining - 1 !== 1 ? 'ões' : ''} após esta
          </p>
          <ProgressBar used={pkg.used_sessions + 1} total={pkg.total_sessions} />
        </div>

        <div className="mb-4">
          <label className="text-xs font-medium text-slate-600 mb-1 block">Observação (opcional)</label>
          <textarea
            className="input resize-none"
            rows={2}
            placeholder="Notas sobre esta sessão..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl mb-3">{error}</p>
        )}

        <div className="flex gap-2">
          <button
            className="btn-secondary flex-1 py-2.5"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            className="btn-primary flex-1 py-2.5"
            onClick={handleConfirm}
            disabled={saving}
          >
            {saving ? 'Registrando...' : 'Confirmar sessão'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Card de cada pacote
// ─────────────────────────────────────────────

function PackageCard({
  pkg,
  clinicId,
  onUpdate,
}: {
  pkg: Package
  clinicId: string
  onUpdate: (updatedPkg: Package) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [useModal, setUseModal] = useState(false)
  const [cancelling, startCancel] = useTransition()

  const remaining = pkg.total_sessions - pkg.used_sessions
  const statusInfo = STATUS_LABEL[pkg.status] || STATUS_LABEL.active

  async function handleCancel() {
    if (!confirm('Cancelar este pacote? Isso não apaga o histórico de sessões.')) return
    startCancel(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('patient_packages')
        .update({ status: 'cancelled' })
        .eq('id', pkg.id)
        .select('*, patient_package_sessions(*)')
        .single()
      if (data) onUpdate(data as Package)
    })
  }

  async function handleRemoveSession(sessionId: string) {
    if (!confirm('Desfazer esta sessão?')) return
    const supabase = createClient()
    await supabase.from('patient_package_sessions').delete().eq('id', sessionId)
    const { data } = await supabase
      .from('patient_packages')
      .select('*, patient_package_sessions(*)')
      .eq('id', pkg.id)
      .single()
    if (data) onUpdate(data as Package)
  }

  return (
    <>
      <div className={`card p-5 transition-all ${pkg.status === 'cancelled' ? 'opacity-60' : ''}`}>
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900 truncate">{pkg.name}</h3>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusInfo.cls}`}>
                {statusInfo.label}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Vendido em {new Date(pkg.sold_at).toLocaleDateString('pt-BR')}
              {pkg.price_total ? ` • R$ ${pkg.price_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}
              {pkg.expires_at ? ` • Válido até ${new Date(pkg.expires_at).toLocaleDateString('pt-BR')}` : ''}
            </p>
          </div>

          {/* Botão usar sessão */}
          {pkg.status === 'active' && remaining > 0 && (
            <button
              onClick={() => setUseModal(true)}
              className="flex-shrink-0 text-xs font-semibold text-white px-3 py-1.5 rounded-xl"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
            >
              + Sessão
            </button>
          )}
        </div>

        {/* Barra de progresso */}
        <ProgressBar used={pkg.used_sessions} total={pkg.total_sessions} />

        {/* Pontos visuais */}
        <SessionDots used={pkg.used_sessions} total={Math.min(pkg.total_sessions, 20)} />

        {/* Expandir histórico */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
        >
          <Icon name={expanded ? 'chevronUp' : 'chevronDown'} className="w-3.5 h-3.5" />
          {expanded ? 'Ocultar' : 'Ver histórico de sessões'}
        </button>

        {/* Histórico */}
        {expanded && (
          <div className="mt-3 space-y-1.5">
            {pkg.patient_package_sessions.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-3">Nenhuma sessão registrada ainda.</p>
            ) : (
              [...pkg.patient_package_sessions]
                .sort((a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime())
                .map((s, i) => (
                  <div key={s.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2 gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-violet-500 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                        {pkg.patient_package_sessions.length - i}
                      </span>
                      <div>
                        <p className="text-xs font-medium text-slate-700">
                          {new Date(s.performed_at).toLocaleDateString('pt-BR')}
                        </p>
                        {s.notes && <p className="text-[10px] text-slate-400">{s.notes}</p>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveSession(s.id)}
                      className="text-slate-300 hover:text-red-400 transition-colors"
                      title="Desfazer sessão"
                    >
                      <Icon name="trash" className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
            )}

            {/* Cancelar pacote */}
            {pkg.status === 'active' && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="mt-1 text-xs text-slate-400 hover:text-red-500 transition-colors"
              >
                {cancelling ? 'Cancelando...' : 'Cancelar pacote'}
              </button>
            )}
          </div>
        )}
      </div>

      {useModal && (
        <UseSessionModal
          pkg={pkg}
          clinicId={clinicId}
          onClose={() => setUseModal(false)}
          onUsed={onUpdate}
        />
      )}
    </>
  )
}

// ─────────────────────────────────────────────
// Tab principal (exportada)
// ─────────────────────────────────────────────

export default function PackagesTab({
  patientId,
  clinicId,
  initialPackages,
  procedures,
}: {
  patientId: string
  clinicId: string
  initialPackages: Package[]
  procedures: Procedure[]
}) {
  const [packages, setPackages] = useState<Package[]>(initialPackages)
  const [showNewModal, setShowNewModal] = useState(false)
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')

  const filtered = packages.filter(p =>
    filter === 'all' ? true :
    filter === 'active' ? p.status === 'active' :
    p.status === 'completed'
  )

  const activeCount = packages.filter(p => p.status === 'active').length
  const totalUsed = packages.reduce((acc, p) => acc + p.used_sessions, 0)
  const totalSessions = packages.reduce((acc, p) => acc + p.total_sessions, 0)

  function handleUpdate(updated: Package) {
    setPackages(prev => prev.map(p => p.id === updated.id ? updated : p))
  }

  function handleCreated(newPkg: Package) {
    setPackages(prev => [newPkg, ...prev])
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header com stats */}
        {packages.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-violet-600">{activeCount}</p>
              <p className="text-xs text-slate-500 mt-0.5">Pacote{activeCount !== 1 ? 's' : ''} ativo{activeCount !== 1 ? 's' : ''}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-slate-700">{totalUsed}</p>
              <p className="text-xs text-slate-500 mt-0.5">Sessões realizadas</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600">{totalSessions - totalUsed}</p>
              <p className="text-xs text-slate-500 mt-0.5">Sessões restantes</p>
            </div>
          </div>
        )}

        {/* Actions row */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            {(['all', 'active', 'completed'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filter === f
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {f === 'all' ? 'Todos' : f === 'active' ? 'Ativos' : 'Concluídos'}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            className="btn-primary w-auto px-4 py-2 text-sm flex items-center gap-1.5"
          >
            <Icon name="plus" className="w-4 h-4" />
            Novo pacote
          </button>
        </div>

        {/* Lista */}
        {filtered.length === 0 ? (
          <div className="card p-10 text-center">
            <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Icon name="box" className="w-7 h-7 text-violet-400" />
            </div>
            <p className="text-sm font-medium text-slate-700">Nenhum pacote ainda</p>
            <p className="text-xs text-slate-400 mt-1">
              Crie um pacote para controlar as sessões desta paciente.
            </p>
            <button
              onClick={() => setShowNewModal(true)}
              className="btn-primary w-auto px-5 py-2.5 text-sm mx-auto mt-4"
            >
              Criar primeiro pacote
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(pkg => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                clinicId={clinicId}
                onUpdate={handleUpdate}
              />
            ))}
          </div>
        )}
      </div>

      {showNewModal && (
        <NewPackageModal
          patientId={patientId}
          clinicId={clinicId}
          procedures={procedures}
          onClose={() => setShowNewModal(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  )
}
