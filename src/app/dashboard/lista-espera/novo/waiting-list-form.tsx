'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Props = {
  clinicId: string
  patients: { id: string; name: string }[]
  procedures: { id: string; name: string }[]
  professionals: { id: string; name: string }[]
}

const DAYS = [
  { value: 'segunda', label: 'Segunda' },
  { value: 'terca', label: 'Terça' },
  { value: 'quarta', label: 'Quarta' },
  { value: 'quinta', label: 'Quinta' },
  { value: 'sexta', label: 'Sexta' },
  { value: 'sabado', label: 'Sábado' },
]

export default function WaitingListForm({ clinicId, patients, procedures, professionals }: Props) {
  const router = useRouter()
  const supabase = createClient()
  
  const [form, setForm] = useState({
    patient_id: '',
    procedure_id: '',
    professional_id: '',
    preferred_period: 'qualquer',
    preferred_days: [] as string[],
    priority: 'normal',
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const update = (field: string, value: string | string[]) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const toggleDay = (day: string) => {
    setForm(prev => ({
      ...prev,
      preferred_days: prev.preferred_days.includes(day)
        ? prev.preferred_days.filter(d => d !== day)
        : [...prev.preferred_days, day]
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.patient_id) {
      setError('Selecione um paciente')
      return
    }

    setLoading(true)
    setError('')

    const { error: insertError } = await supabase
      .from('waiting_list')
      .insert({
        clinic_id: clinicId,
        patient_id: form.patient_id,
        procedure_id: form.procedure_id || null,
        professional_id: form.professional_id || null,
        preferred_period: form.preferred_period,
        preferred_days: form.preferred_days.length > 0 ? form.preferred_days : null,
        priority: form.priority,
        notes: form.notes || null,
      })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard/lista-espera')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Paciente */}
      <div>
        <label className="label">Paciente *</label>
        <select
          className="input"
          value={form.patient_id}
          onChange={e => update('patient_id', e.target.value)}
          required
        >
          <option value="">Selecione o paciente</option>
          {patients.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Procedimento desejado */}
      <div>
        <label className="label">Procedimento desejado</label>
        <select
          className="input"
          value={form.procedure_id}
          onChange={e => update('procedure_id', e.target.value)}
        >
          <option value="">Qualquer / Não definido</option>
          {procedures.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Profissional preferido */}
      <div>
        <label className="label">Profissional preferido</label>
        <select
          className="input"
          value={form.professional_id}
          onChange={e => update('professional_id', e.target.value)}
        >
          <option value="">Sem preferência</option>
          {professionals.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Período preferido */}
      <div>
        <label className="label">Período preferido</label>
        <select
          className="input"
          value={form.preferred_period}
          onChange={e => update('preferred_period', e.target.value)}
        >
          <option value="qualquer">Qualquer horário</option>
          <option value="manha">Manhã</option>
          <option value="tarde">Tarde</option>
          <option value="noite">Noite</option>
        </select>
      </div>

      {/* Dias preferidos */}
      <div>
        <label className="label">Dias preferidos</label>
        <div className="flex flex-wrap gap-2">
          {DAYS.map(day => (
            <button
              key={day.value}
              type="button"
              onClick={() => toggleDay(day.value)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                form.preferred_days.includes(day.value)
                  ? 'bg-violet-100 text-violet-700 ring-2 ring-violet-500'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-1">Deixe vazio para qualquer dia</p>
      </div>

      {/* Prioridade */}
      <div>
        <label className="label">Prioridade</label>
        <div className="grid grid-cols-4 gap-2">
          {[
            { value: 'baixa', label: 'Baixa', color: 'bg-slate-100 text-slate-600' },
            { value: 'normal', label: 'Normal', color: 'bg-blue-100 text-blue-700' },
            { value: 'alta', label: 'Alta', color: 'bg-amber-100 text-amber-700' },
            { value: 'urgente', label: 'Urgente', color: 'bg-red-100 text-red-700' },
          ].map(p => (
            <button
              key={p.value}
              type="button"
              onClick={() => update('priority', p.value)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                form.priority === p.value
                  ? `${p.color} ring-2 ring-offset-1 ring-current`
                  : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Observações */}
      <div>
        <label className="label">Observações</label>
        <textarea
          className="input min-h-[80px]"
          placeholder="Ex: Paciente prefere horários após 18h devido ao trabalho"
          value={form.notes}
          onChange={e => update('notes', e.target.value)}
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Salvando...' : 'Adicionar à lista'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="btn-secondary"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
