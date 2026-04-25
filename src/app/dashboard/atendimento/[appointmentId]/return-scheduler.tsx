'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Icon from '@/components/ui/Icon'

type Props = {
  patientId: string
  clinicId: string
  currentAppointmentId: string
}

export default function ReturnScheduler({ patientId, clinicId, currentAppointmentId }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [form, setForm] = useState({
    date: '',
    time: '09:00',
    notes: ''
  })

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Calcular data sugerida (15, 30, 60 dias)
  const suggestedDates = [
    { label: '15 dias', days: 15 },
    { label: '30 dias', days: 30 },
    { label: '60 dias', days: 60 },
    { label: '90 dias', days: 90 },
  ]

  const setSuggestedDate = (days: number) => {
    const date = new Date()
    date.setDate(date.getDate() + days)
    setForm({ ...form, date: date.toISOString().split('T')[0] })
  }

  const scheduleReturn = async () => {
    if (!form.date) {
      alert('Selecione uma data para o retorno')
      return
    }

    setSaving(true)

    try {
      const startTime = new Date(`${form.date}T${form.time}:00`)
      const endTime = new Date(startTime)
      endTime.setMinutes(endTime.getMinutes() + 30)

      await supabase.from('appointments').insert({
        clinic_id: clinicId,
        patient_id: patientId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: 'pending_confirmation',
        notes: form.notes || 'Retorno agendado pelo profissional'
      })

      setSaved(true)
      setForm({ date: '', time: '09:00', notes: '' })
      
      setTimeout(() => {
        setSaved(false)
        setIsOpen(false)
      }, 2000)
    } catch (error) {
      console.error(error)
      alert('Erro ao agendar retorno')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
            <Icon name="calendar" className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-slate-900">Agendar retorno</h3>
            <p className="text-xs text-slate-500">Sugerir data para a recepção confirmar</p>
          </div>
        </div>
        <Icon 
          name={isOpen ? 'chevronUp' : 'chevronDown'} 
          className="w-5 h-5 text-slate-400" 
        />
      </button>

      {isOpen && (
        <div className="p-4 pt-0 border-t border-slate-100">
          {saved ? (
            <div className="py-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
                <Icon name="check" className="w-8 h-8 text-emerald-600" />
              </div>
              <p className="font-semibold text-slate-900">Retorno agendado!</p>
              <p className="text-sm text-slate-500 mt-1">
                A recepção irá confirmar com a paciente
              </p>
            </div>
          ) : (
            <div className="space-y-4 pt-4">
              {/* Datas sugeridas */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Sugestões rápidas
                </label>
                <div className="flex flex-wrap gap-2">
                  {suggestedDates.map(sd => (
                    <button
                      key={sd.days}
                      type="button"
                      onClick={() => setSuggestedDate(sd.days)}
                      className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                    >
                      {sd.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Data */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Data do retorno
                </label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none transition-[border-color,box-shadow]"
                />
              </div>

              {/* Hora */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Horário sugerido
                </label>
                <select
                  value={form.time}
                  onChange={e => setForm({ ...form, time: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none transition-[border-color,box-shadow]"
                >
                  {Array.from({ length: 20 }, (_, i) => {
                    const hour = Math.floor(i / 2) + 8
                    const min = i % 2 === 0 ? '00' : '30'
                    const time = `${hour.toString().padStart(2, '0')}:${min}`
                    return (
                      <option key={time} value={time}>{time}</option>
                    )
                  })}
                </select>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Observações para a recepção
                </label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Ex: Retorno para avaliação do resultado..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none transition-[border-color,box-shadow] resize-none"
                  rows={2}
                />
              </div>

              {/* Info */}
              <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-xl">
                <Icon name="bell" className="w-4 h-4 text-blue-600 mt-0.5" />
                <p className="text-xs text-blue-700">
                  O agendamento será criado como "Aguardando confirmação". 
                  A recepção verá na agenda e ligará para a paciente confirmar.
                </p>
              </div>

              {/* Botão */}
              <button
                onClick={scheduleReturn}
                disabled={saving || !form.date}
                className="w-full btn-primary flex items-center justify-center gap-2"
              >
                {saving ? (
                  <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                ) : (
                  <>
                    <Icon name="calendar" className="w-4 h-4" />
                    Sugerir retorno
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
