'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'

type Member = {
  id: string
  name: string
}

type Props = {
  member: Member
  clinicId: string
  onClose: () => void
  onSave?: () => void
}

type Unavailability = {
  id: string
  start_date: string
  end_date: string
  start_time: string | null
  end_time: string | null
  reason: string | null
}

function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function UnavailabilityModal({ member, clinicId, onClose, onSave }: Props) {
  const supabase = createClient()
  const [items, setItems] = useState<Unavailability[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    start_date: todayIso(),
    end_date: todayIso(),
    start_time: '',
    end_time: '',
    reason: '',
    allDay: true,
  })

  async function loadItems() {
    setLoading(true)
    const { data, error: fetchErr } = await supabase
      .from('professional_unavailability')
      .select('id, start_date, end_date, start_time, end_time, reason')
      .eq('professional_id', member.id)
      .eq('clinic_id', clinicId)
      .gte('end_date', todayIso())
      .order('start_date')

    if (fetchErr) {
      setError('Erro ao carregar: ' + fetchErr.message)
    } else {
      setItems(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadItems()
  }, [member.id])

  async function handleAdd() {
    setError('')

    if (!form.start_date || !form.end_date) {
      setError('Preencha data início e data fim.')
      return
    }
    if (form.end_date < form.start_date) {
      setError('Data fim deve ser maior ou igual à data início.')
      return
    }
    if (!form.allDay && (!form.start_time || !form.end_time)) {
      setError('Preencha horário início e fim.')
      return
    }
    if (!form.allDay && form.start_time >= form.end_time) {
      setError('Horário fim deve ser maior que o início.')
      return
    }

    setSaving(true)

    const { error: insErr } = await supabase.from('professional_unavailability').insert({
      clinic_id: clinicId,
      professional_id: member.id,
      start_date: form.start_date,
      end_date: form.end_date,
      start_time: form.allDay ? null : form.start_time + ':00',
      end_time: form.allDay ? null : form.end_time + ':00',
      reason: form.reason.trim() || null,
    })

    if (insErr) {
      setError('Erro ao salvar: ' + insErr.message)
      setSaving(false)
      return
    }

    setForm({
      start_date: todayIso(),
      end_date: todayIso(),
      start_time: '',
      end_time: '',
      reason: '',
      allDay: true,
    })
    setSaving(false)
    await loadItems()
    onSave?.()
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover esta indisponibilidade?')) return
    const { error: delErr } = await supabase
      .from('professional_unavailability')
      .delete()
      .eq('id', id)

    if (delErr) {
      alert('Erro ao remover: ' + delErr.message)
      return
    }
    await loadItems()
    onSave?.()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Férias e folgas</h2>
            <p className="text-sm text-slate-500">{member.name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="bg-slate-50 rounded-xl p-3 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nova indisponibilidade</p>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-600 mb-1">De</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  className="input !py-1.5 text-sm w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Até</label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                  className="input !py-1.5 text-sm w-full"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.allDay}
                onChange={e => setForm(f => ({ ...f, allDay: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
              />
              Dia inteiro
            </label>

            {!form.allDay && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Início</label>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                    className="input !py-1.5 text-sm w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Fim</label>
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                    className="input !py-1.5 text-sm w-full"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs text-slate-600 mb-1">Motivo (opcional)</label>
              <input
                type="text"
                placeholder="Ex: Férias, congresso, folga..."
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                className="input !py-1.5 text-sm w-full"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              onClick={handleAdd}
              disabled={saving}
              className="w-full py-2 px-4 bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-50 text-sm font-medium"
            >
              {saving ? 'Salvando...' : 'Adicionar'}
            </button>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Próximas indisponibilidades
            </p>
            {loading ? (
              <p className="text-sm text-slate-500 text-center py-4">Carregando...</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Nenhuma indisponibilidade agendada.</p>
            ) : (
              <div className="space-y-2">
                {items.map(item => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between p-3 bg-white border border-slate-200 rounded-xl"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">
                        {item.start_date === item.end_date
                          ? formatDateBR(item.start_date)
                          : `${formatDateBR(item.start_date)} → ${formatDateBR(item.end_date)}`}
                      </p>
                      {item.start_time && item.end_time ? (
                        <p className="text-xs text-slate-500 mt-0.5">
                          {String(item.start_time).slice(0, 5)} às {String(item.end_time).slice(0, 5)}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500 mt-0.5">Dia inteiro</p>
                      )}
                      {item.reason && (
                        <p className="text-xs text-slate-600 mt-1">{item.reason}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remover"
                    >
                      <Icon name="trash" className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
