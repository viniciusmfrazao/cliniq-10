'use client'

import { useState, useEffect, useTransition } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Icon from '@/components/ui/Icon'

type Props = {
  clinicId: string
  patient: { id: string; name: string; phone: string } | null
  onClose: () => void
  onScheduled: () => void
}

type Professional = { id: string; name: string }
type Procedure = { id: string; name: string; duration_minutes: number | null }
type Slot = { time: string; available: boolean }

export default function ScheduleModal({ clinicId, patient, onClose, onScheduled }: Props) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [procedures, setProcedures] = useState<Procedure[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [saving, startSaving] = useTransition()
  const [error, setError] = useState('')

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })

  const [form, setForm] = useState({
    patient_id: patient?.id || '',
    professional_id: '',
    procedure_id: '',
    date: today,
    time: '',
    notes: '',
  })

  // Carregar profissionais e procedimentos
  useEffect(() => {
    async function load() {
      const [profRes, procRes] = await Promise.all([
        supabase.from('users').select('id, name').eq('clinic_id', clinicId).in('role', ['doctor', 'esthetician', 'biomedic', 'nurse', 'physiotherapist', 'nutritionist', 'psychologist', 'professional', 'admin']).eq('active', true).order('name'),
        supabase.from('procedures').select('id, name, duration_minutes').eq('clinic_id', clinicId).eq('active', true).order('name'),
      ])
      setProfessionals(profRes.data || [])
      setProcedures(procRes.data || [])
      if (profRes.data?.length === 1) {
        setForm(f => ({ ...f, professional_id: profRes.data![0].id }))
      }
    }
    load()
  }, [clinicId])

  // Carregar horários disponíveis quando muda profissional ou data
  useEffect(() => {
    if (!form.professional_id || !form.date) { setSlots([]); return }
    setLoadingSlots(true)
    setForm(f => ({ ...f, time: '' }))

    async function loadSlots() {
      const startOfDay = `${form.date}T00:00:00-03:00`
      const endOfDay = `${form.date}T23:59:59-03:00`

      const { data: existing } = await supabase
        .from('appointments')
        .select('start_time, end_time')
        .eq('clinic_id', clinicId)
        .eq('professional_id', form.professional_id)
        .gte('start_time', startOfDay)
        .lte('start_time', endOfDay)
        .not('status', 'in', '(cancelled,no_show)')

      const occupied = new Set<string>()
      for (const appt of existing || []) {
        const start = new Date(appt.start_time)
        const end = new Date(appt.end_time || appt.start_time)
        let cur = new Date(start)
        while (cur < end) {
          occupied.add(cur.toTimeString().slice(0, 5))
          cur = new Date(cur.getTime() + 30 * 60000)
        }
      }

      const generatedSlots: Slot[] = []
      const now = new Date()
      const isToday = form.date === today

      for (let h = 7; h < 20; h++) {
        for (const m of [0, 30]) {
          const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
          const slotDate = new Date(`${form.date}T${time}:00`)
          if (isToday && slotDate <= now) continue
          generatedSlots.push({ time, available: !occupied.has(time) })
        }
      }
      setSlots(generatedSlots)
      setLoadingSlots(false)
    }
    loadSlots()
  }, [form.professional_id, form.date, clinicId, today])

  async function handleSubmit() {
    if (!form.patient_id) { setError('Selecione um paciente.'); return }
    if (!form.professional_id) { setError('Selecione um profissional.'); return }
    if (!form.date) { setError('Selecione uma data.'); return }
    if (!form.time) { setError('Selecione um horário.'); return }
    setError('')

    startSaving(async () => {
      const proc = procedures.find(p => p.id === form.procedure_id)
      const duration = proc?.duration_minutes || 30
      const startISO = `${form.date}T${form.time}:00-03:00`
      const endDate = new Date(`${form.date}T${form.time}:00-03:00`)
      endDate.setMinutes(endDate.getMinutes() + duration)
      const endISO = endDate.toISOString()

      const { error: err } = await supabase.from('appointments').insert({
        clinic_id: clinicId,
        patient_id: form.patient_id,
        professional_id: form.professional_id,
        procedure_id: form.procedure_id || null,
        start_time: startISO,
        end_time: endISO,
        status: 'confirmed',
        notes: form.notes.trim() || null,
      })

      if (err) { setError(err.message); return }
      onScheduled()
      onClose()
    })
  }

  const availableSlots = slots.filter(s => s.available)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Novo agendamento</h2>
            {patient && <p className="text-xs text-slate-500 mt-0.5">{patient.name}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Profissional */}
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Profissional *</label>
            <select
              className="input"
              value={form.professional_id}
              onChange={e => setForm(f => ({ ...f, professional_id: e.target.value }))}
            >
              <option value="">Selecionar...</option>
              {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Procedimento */}
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Procedimento</label>
            <select
              className="input"
              value={form.procedure_id}
              onChange={e => setForm(f => ({ ...f, procedure_id: e.target.value }))}
            >
              <option value="">Selecionar (opcional)</option>
              {procedures.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Data */}
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Data *</label>
            <input
              type="date"
              className="input"
              value={form.date}
              min={today}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            />
          </div>

          {/* Horários disponíveis */}
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2 block">
              Horário *
              {loadingSlots && <span className="ml-2 text-slate-400">carregando...</span>}
              {!loadingSlots && form.professional_id && (
                <span className="ml-2 text-emerald-600">{availableSlots.length} disponíveis</span>
              )}
            </label>
            {!form.professional_id ? (
              <p className="text-xs text-slate-400">Selecione um profissional primeiro</p>
            ) : loadingSlots ? (
              <div className="grid grid-cols-4 gap-1.5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-9 bg-slate-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : availableSlots.length === 0 ? (
              <p className="text-xs text-slate-400 bg-slate-50 rounded-xl px-3 py-3 text-center">
                Nenhum horário disponível nesta data
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto">
                {availableSlots.map(slot => (
                  <button
                    key={slot.time}
                    onClick={() => setForm(f => ({ ...f, time: slot.time }))}
                    className={`py-2 rounded-xl text-xs font-semibold transition-all ${
                      form.time === slot.time
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'bg-slate-50 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
                    }`}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Observações */}
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Observações</label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Informações adicionais..."
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
            disabled={saving || !form.time}
          >
            {saving ? 'Agendando...' : 'Confirmar agendamento'}
          </button>
        </div>
      </div>
    </div>
  )
}
