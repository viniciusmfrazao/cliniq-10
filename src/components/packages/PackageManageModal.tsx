'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'

export type ManagedSession = {
  id: string
  performed_at: string
  notes: string | null
  appointment_id: string | null
}

export type ManagedPackage = {
  id: string
  name: string
  total_sessions: number
  used_sessions: number
  patient_package_sessions: ManagedSession[]
}

export type PastAppointmentOption = {
  id: string
  start_time: string
  procedure_name: string | null
}

// Linhas pendentes de sessões a adicionar (antes de salvar em lote)
type PendingRow = {
  key: string
  mode: 'date' | 'appointment'
  date: string
  appointment_id: string
  notes: string
}

function newPendingRow(): PendingRow {
  return {
    key: Math.random().toString(36).slice(2),
    mode: 'date',
    date: new Date().toISOString().split('T')[0],
    appointment_id: '',
    notes: '',
  }
}

export default function PackageManageModal({
  pkg,
  clinicId,
  pastAppointments,
  onClose,
  onUpdated,
}: {
  pkg: ManagedPackage
  clinicId: string
  pastAppointments: PastAppointmentOption[]
  onClose: () => void
  onUpdated: (updated: ManagedPackage) => void
}) {
  const toast = useToast()
  const [sessions, setSessions] = useState<ManagedSession[]>(pkg.patient_package_sessions)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [pendingRows, setPendingRows] = useState<PendingRow[]>([])
  const [saving, startSaving] = useTransition()
  const [error, setError] = useState('')

  // Atendimentos já vinculados a alguma sessão deste pacote não entram na lista de opções
  const linkedAppointmentIds = new Set(sessions.map(s => s.appointment_id).filter(Boolean))
  const availableAppointments = pastAppointments.filter(a => !linkedAppointmentIds.has(a.id))

  async function refetchPackage() {
    const supabase = createClient()
    const { data } = await supabase
      .from('patient_packages')
      .select('id, name, total_sessions, used_sessions, patient_package_sessions(*)')
      .eq('id', pkg.id)
      .single()
    if (data) {
      const updated = data as unknown as ManagedPackage
      setSessions(updated.patient_package_sessions)
      onUpdated(updated)
    }
  }

  function startEdit(s: ManagedSession) {
    setEditingId(s.id)
    setEditDate(s.performed_at)
    setEditNotes(s.notes || '')
  }

  async function saveEdit(sessionId: string) {
    if (!editDate) return
    startSaving(async () => {
      const supabase = createClient()
      const { error: err } = await supabase
        .from('patient_package_sessions')
        .update({ performed_at: editDate, notes: editNotes.trim() || null })
        .eq('id', sessionId)
      if (err) { setError(err.message); return }
      setEditingId(null)
      await refetchPackage()
      toast.success('Sessão atualizada.')
    })
  }

  async function handleDelete(sessionId: string) {
    if (!confirm('Remover esta sessão? Isso libera uma vaga no contador do pacote.')) return
    startSaving(async () => {
      const supabase = createClient()
      const { error: err } = await supabase.from('patient_package_sessions').delete().eq('id', sessionId)
      if (err) { setError(err.message); return }
      await refetchPackage()
      toast.success('Sessão removida.')
    })
  }

  function addPendingRow() {
    setPendingRows(prev => [...prev, newPendingRow()])
  }

  function updatePendingRow(key: string, patch: Partial<PendingRow>) {
    setPendingRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)))
  }

  function removePendingRow(key: string) {
    setPendingRows(prev => prev.filter(r => r.key !== key))
  }

  const remaining = pkg.total_sessions - sessions.length
  const wouldExceed = pendingRows.length > 0 && pendingRows.length > remaining

  async function savePendingRows() {
    if (pendingRows.length === 0) return
    setError('')
    startSaving(async () => {
      const supabase = createClient()
      const rows = pendingRows.map(r => {
        const linkedAppt = r.mode === 'appointment'
          ? pastAppointments.find(a => a.id === r.appointment_id)
          : null
        return {
          clinic_id: clinicId,
          package_id: pkg.id,
          appointment_id: r.mode === 'appointment' ? r.appointment_id || null : null,
          performed_at: r.mode === 'appointment' && linkedAppt
            ? linkedAppt.start_time.split('T')[0]
            : r.date,
          notes: r.notes.trim() || null,
        }
      })
      const invalid = r => r.mode === 'appointment' ? !r.appointment_id : !r.date
      if (rows.some((r, i) => invalid(pendingRows[i]))) {
        setError('Preencha data ou selecione um atendimento em todas as linhas.')
        return
      }
      const { error: err } = await supabase.from('patient_package_sessions').insert(rows)
      if (err) { setError(err.message); return }
      setPendingRows([])
      await refetchPackage()
      toast.success(rows.length > 1 ? `${rows.length} sessões registradas.` : 'Sessão registrada.')
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-bold text-slate-900">Gerenciar sessões</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-4">{pkg.name} · {sessions.length}/{pkg.total_sessions} sessões</p>

        {/* Sessões já registradas */}
        <div className="space-y-1.5 mb-4">
          {sessions.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-3">Nenhuma sessão registrada ainda.</p>
          )}
          {[...sessions]
            .sort((a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime())
            .map((s, i) => (
              <div key={s.id} className="bg-slate-50 rounded-xl px-3 py-2">
                {editingId === s.id ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="date"
                        className="input py-1.5 text-xs"
                        value={editDate}
                        onChange={e => setEditDate(e.target.value)}
                      />
                      {s.appointment_id && (
                        <span className="text-[10px] text-violet-500 flex items-center gap-1 flex-shrink-0">
                          <Icon name="link" className="w-3 h-3" /> vinculada
                        </span>
                      )}
                    </div>
                    <input
                      className="input py-1.5 text-xs"
                      placeholder="Observação"
                      value={editNotes}
                      onChange={e => setEditNotes(e.target.value)}
                    />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditingId(null)} className="text-xs text-slate-400 px-2 py-1">Cancelar</button>
                      <button
                        onClick={() => saveEdit(s.id)}
                        disabled={saving}
                        className="text-xs font-semibold text-white px-3 py-1 rounded-lg"
                        style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-violet-500 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                        {sessions.length - i}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                          {new Date(s.performed_at + 'T00:00:00').toLocaleDateString('pt-BR')}
                          {s.appointment_id && <Icon name="link" className="w-3 h-3 text-violet-400" />}
                        </p>
                        {s.notes && <p className="text-[10px] text-slate-400 truncate">{s.notes}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => startEdit(s)} className="text-slate-300 hover:text-violet-500 transition-colors" title="Editar sessão">
                        <Icon name="edit" className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(s.id)} className="text-slate-300 hover:text-red-400 transition-colors" title="Remover sessão">
                        <Icon name="trash" className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
        </div>

        {/* Adicionar sessão(ões) */}
        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-slate-700">Adicionar sessão</h3>
            <button
              onClick={addPendingRow}
              disabled={remaining <= 0}
              className="text-xs font-semibold text-violet-600 flex items-center gap-1 disabled:opacity-40"
            >
              <Icon name="plus" className="w-3.5 h-3.5" /> nova linha
            </button>
          </div>

          {remaining <= 0 && pendingRows.length === 0 && (
            <p className="text-xs text-slate-400">Pacote já com todas as sessões marcadas.</p>
          )}

          <div className="space-y-2">
            {pendingRows.map(row => (
              <div key={row.key} className="bg-violet-50/60 rounded-xl p-2.5 space-y-2">
                <div className="flex gap-1.5">
                  <button
                    onClick={() => updatePendingRow(row.key, { mode: 'date' })}
                    className={`text-[11px] px-2 py-1 rounded-lg font-medium ${row.mode === 'date' ? 'bg-violet-600 text-white' : 'bg-white text-slate-500'}`}
                  >
                    Data avulsa
                  </button>
                  <button
                    onClick={() => updatePendingRow(row.key, { mode: 'appointment' })}
                    disabled={availableAppointments.length === 0}
                    className={`text-[11px] px-2 py-1 rounded-lg font-medium disabled:opacity-40 ${row.mode === 'appointment' ? 'bg-violet-600 text-white' : 'bg-white text-slate-500'}`}
                  >
                    Vincular atendimento
                  </button>
                  <button onClick={() => removePendingRow(row.key)} className="ml-auto text-slate-300 hover:text-red-400">
                    <Icon name="x" className="w-3.5 h-3.5" />
                  </button>
                </div>

                {row.mode === 'date' ? (
                  <input
                    type="date"
                    className="input py-1.5 text-xs"
                    value={row.date}
                    onChange={e => updatePendingRow(row.key, { date: e.target.value })}
                  />
                ) : (
                  <select
                    className="input py-1.5 text-xs"
                    value={row.appointment_id}
                    onChange={e => updatePendingRow(row.key, { appointment_id: e.target.value })}
                  >
                    <option value="">Selecionar atendimento passado...</option>
                    {availableAppointments.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.procedure_name ? `${a.procedure_name} — ` : ''}
                        {new Date(a.start_time).toLocaleDateString('pt-BR')}
                      </option>
                    ))}
                  </select>
                )}

                <input
                  className="input py-1.5 text-xs"
                  placeholder="Observação (opcional)"
                  value={row.notes}
                  onChange={e => updatePendingRow(row.key, { notes: e.target.value })}
                />
              </div>
            ))}
          </div>

          {wouldExceed && (
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-xl mt-2">
              Isso ultrapassa o total de sessões do pacote ({remaining} restante{remaining !== 1 ? 's' : ''}).
            </p>
          )}
          {error && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl mt-2">{error}</p>
          )}

          {pendingRows.length > 0 && (
            <button
              onClick={savePendingRows}
              disabled={saving}
              className="btn-primary w-full mt-3 py-2.5 text-sm"
            >
              {saving ? 'Salvando...' : `Salvar ${pendingRows.length} sessão${pendingRows.length !== 1 ? 'ões' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
