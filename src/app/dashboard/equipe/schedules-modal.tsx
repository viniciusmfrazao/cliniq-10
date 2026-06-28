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

type TimeRange = {
  id?: string
  start_time: string
  end_time: string
}

type DaySchedule = {
  day_of_week: number
  is_active: boolean
  ranges: TimeRange[]
}

const DAYS = [
  { dow: 1, label: 'Segunda' },
  { dow: 2, label: 'Terça' },
  { dow: 3, label: 'Quarta' },
  { dow: 4, label: 'Quinta' },
  { dow: 5, label: 'Sexta' },
  { dow: 6, label: 'Sábado' },
  { dow: 0, label: 'Domingo' },
]

function emptyWeek(): DaySchedule[] {
  return DAYS.map(d => ({
    day_of_week: d.dow,
    is_active: false,
    ranges: [],
  }))
}

function defaultRange(): TimeRange {
  return { start_time: '09:00', end_time: '12:00' }
}

export default function SchedulesModal({ member, clinicId, onClose, onSave }: Props) {
  const supabase = createClient()
  const [schedule, setSchedule] = useState<DaySchedule[]>(emptyWeek())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadSchedule() {
      setLoading(true)
      const { data, error: fetchErr } = await supabase
        .from('professional_schedules')
        .select('id, day_of_week, start_time, end_time, is_active')
        .eq('professional_id', member.id)
        .eq('clinic_id', clinicId)
        .order('day_of_week')
        .order('start_time')

      if (fetchErr) {
        setError('Erro ao carregar horários: ' + fetchErr.message)
        setLoading(false)
        return
      }

      const week = emptyWeek()
      for (const row of data || []) {
        const day = week.find(w => w.day_of_week === row.day_of_week)
        if (!day) continue
        if (row.is_active) day.is_active = true
        day.ranges.push({
          id: row.id,
          start_time: String(row.start_time).slice(0, 5),
          end_time: String(row.end_time).slice(0, 5),
        })
      }
      setSchedule(week)
      setLoading(false)
    }
    loadSchedule()
  }, [member.id, clinicId])

  function toggleDay(dow: number) {
    setSchedule(prev =>
      prev.map(d => {
        if (d.day_of_week !== dow) return d
        if (!d.is_active && d.ranges.length === 0) {
          return { ...d, is_active: true, ranges: [defaultRange()] }
        }
        return { ...d, is_active: !d.is_active }
      })
    )
  }

  function addRange(dow: number) {
    setSchedule(prev =>
      prev.map(d => {
        if (d.day_of_week !== dow) return d
        const lastEnd = d.ranges[d.ranges.length - 1]?.end_time || '13:30'
        return {
          ...d,
          is_active: true,
          ranges: [...d.ranges, { start_time: lastEnd, end_time: '18:00' }],
        }
      })
    )
  }

  function removeRange(dow: number, idx: number) {
    setSchedule(prev =>
      prev.map(d => {
        if (d.day_of_week !== dow) return d
        const newRanges = d.ranges.filter((_, i) => i !== idx)
        return {
          ...d,
          ranges: newRanges,
          is_active: newRanges.length > 0 ? d.is_active : false,
        }
      })
    )
  }

  function updateRange(dow: number, idx: number, field: 'start_time' | 'end_time', value: string) {
    setSchedule(prev =>
      prev.map(d => {
        if (d.day_of_week !== dow) return d
        const newRanges = [...d.ranges]
        newRanges[idx] = { ...newRanges[idx], [field]: value }
        return { ...d, ranges: newRanges }
      })
    )
  }

  function copyMondayToWeekdays() {
    const monday = schedule.find(d => d.day_of_week === 1)
    if (!monday || !monday.is_active || monday.ranges.length === 0) {
      alert('Configure a segunda-feira primeiro.')
      return
    }
    setSchedule(prev =>
      prev.map(d => {
        if (d.day_of_week >= 2 && d.day_of_week <= 5) {
          return {
            ...d,
            is_active: true,
            ranges: monday.ranges.map(r => ({ start_time: r.start_time, end_time: r.end_time })),
          }
        }
        return d
      })
    )
  }

  function validate(): string | null {
    for (const day of schedule) {
      if (!day.is_active) continue
      if (day.ranges.length === 0) continue
      for (const r of day.ranges) {
        if (!r.start_time || !r.end_time) return 'Preencha início e fim de todos os intervalos.'
        if (r.start_time >= r.end_time) {
          const label = DAYS.find(d => d.dow === day.day_of_week)?.label
          return `${label}: o horário final deve ser maior que o inicial.`
        }
      }
      const sorted = [...day.ranges].sort((a, b) => a.start_time.localeCompare(b.start_time))
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].start_time < sorted[i - 1].end_time) {
          const label = DAYS.find(d => d.dow === day.day_of_week)?.label
          return `${label}: intervalos se sobrepõem.`
        }
      }
    }
    return null
  }

  async function handleSave() {
    const err = validate()
    if (err) {
      setError(err)
      return
    }
    setError('')
    setSaving(true)

    // Guard: evita double-submit
    const { error: delErr } = await supabase
      .from('professional_schedules')
      .delete()
      .eq('professional_id', member.id)
      .eq('clinic_id', clinicId)

    if (delErr) {
      setError('Erro ao limpar horários antigos: ' + delErr.message)
      setSaving(false)
      return
    }

    const rows: any[] = []
    for (const day of schedule) {
      if (!day.is_active) continue
      for (const r of day.ranges) {
        rows.push({
          clinic_id: clinicId,
          professional_id: member.id,
          day_of_week: day.day_of_week,
          start_time: r.start_time + ':00',
          end_time: r.end_time + ':00',
          is_active: true,
        })
      }
    }

    if (rows.length > 0) {
      const { error: insErr } = await supabase.from('professional_schedules').insert(rows)
      if (insErr) {
        setError('Erro ao salvar horários: ' + insErr.message)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    onSave?.()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Horários de atendimento</h2>
            <p className="text-sm text-slate-500">{member.name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <p className="text-sm text-slate-500 text-center py-8">Carregando...</p>
          ) : (
            <>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={copyMondayToWeekdays}
                  className="text-xs text-violet-600 hover:text-violet-700 font-medium"
                >
                  Copiar segunda → ter/qua/qui/sex
                </button>
              </div>

              {DAYS.map(({ dow, label }) => {
                const day = schedule.find(d => d.day_of_week === dow)!
                return (
                  <div
                    key={dow}
                    className={`rounded-xl border p-3 transition-colors ${
                      day.is_active ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100'
                    }`}
                  >
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={day.is_active}
                        onChange={() => toggleDay(dow)}
                        className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                      />
                      <span className={`text-sm font-medium ${day.is_active ? 'text-slate-900' : 'text-slate-500'}`}>
                        {label}
                      </span>
                    </label>

                    {day.is_active && (
                      <div className="mt-3 space-y-2">
                        {day.ranges.map((range, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input
                              type="time"
                              value={range.start_time}
                              onChange={e => updateRange(dow, idx, 'start_time', e.target.value)}
                              className="input !py-1.5 !px-2 text-sm w-28"
                            />
                            <span className="text-xs text-slate-400">até</span>
                            <input
                              type="time"
                              value={range.end_time}
                              onChange={e => updateRange(dow, idx, 'end_time', e.target.value)}
                              className="input !py-1.5 !px-2 text-sm w-28"
                            />
                            <button
                              type="button"
                              onClick={() => removeRange(dow, idx)}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Remover intervalo"
                            >
                              <Icon name="trash" className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addRange(dow)}
                          className="text-xs text-violet-600 hover:text-violet-700 font-medium"
                        >
                          + Adicionar intervalo
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 px-4 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex-1 py-2 px-4 bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
