'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import QuickPatientModal from '@/components/ui/QuickPatientModal'

type Patient = { id: string; name: string }
type Procedure = { id: string; name: string; duration_minutes: number; price: number }
type Professional = { id: string; name: string }
type Room = { id: string; name: string }

type Props = {
  clinicId: string
  patients: Patient[]
  procedures: Procedure[]
  professionals: Professional[]
  rooms: Room[]
  defaultPatientId?: string
  defaultDate?: string
  defaultTime?: string
  appointment?: {
    id: string
    patient_id: string
    procedure_id: string | null
    professional_id: string | null
    room_id: string | null
    start_time: string
    end_time: string
    notes: string | null
    status: string
  }
}

export default function AppointmentForm({ 
  clinicId, 
  patients: initialPatients, 
  procedures, 
  professionals, 
  rooms,
  defaultPatientId,
  defaultDate,
  defaultTime,
  appointment
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const isEditing = !!appointment

  const defaultStartDate = defaultDate || new Date().toISOString().split('T')[0]
  const defaultStartTime = defaultTime || '09:00'

  const [patients, setPatients] = useState(initialPatients)
  const [showNewPatient, setShowNewPatient] = useState(false)
  
  // Auto-seleciona profissional se só tem um
  const defaultProfessionalId = appointment?.professional_id || 
    (professionals.length === 1 ? professionals[0].id : '')
  
  const [form, setForm] = useState({
    patient_id: appointment?.patient_id || defaultPatientId || '',
    procedure_id: appointment?.procedure_id || '',
    professional_id: defaultProfessionalId,
    room_id: appointment?.room_id || '',
    date: appointment ? appointment.start_time.split('T')[0] : defaultStartDate,
    start_time: appointment ? appointment.start_time.split('T')[1].slice(0, 5) : defaultStartTime,
    duration: '30',
    notes: appointment?.notes || '',
    status: appointment?.status || 'scheduled',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleNewPatient = (patient: { id: string; name: string }) => {
    setPatients(prev => [...prev, patient].sort((a, b) => a.name.localeCompare(b.name)))
    setForm(prev => ({ ...prev, patient_id: patient.id }))
  }

  const update = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    
    // Auto-preencher duracao quando selecionar procedimento
    if (field === 'procedure_id' && value) {
      const proc = procedures.find(p => p.id === value)
      if (proc) {
        setForm(prev => ({ ...prev, duration: proc.duration_minutes.toString() }))
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Validação obrigatória
    if (!form.patient_id) {
      setError('Selecione um paciente')
      setLoading(false)
      return
    }
    if (!form.professional_id) {
      setError('Selecione um profissional responsável')
      setLoading(false)
      return
    }

    const startTime = new Date(`${form.date}T${form.start_time}:00`)
    const endTime = new Date(startTime.getTime() + parseInt(form.duration) * 60000)

    const appointmentData = {
      clinic_id: clinicId,
      patient_id: form.patient_id,
      professional_id: form.professional_id,
      procedure_id: form.procedure_id || null,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      notes: form.notes || null,
      status: form.status,
    }

    let result
    if (isEditing) {
      result = await supabase
        .from('appointments')
        .update(appointmentData)
        .eq('id', appointment.id)
    } else {
      result = await supabase
        .from('appointments')
        .insert(appointmentData)
    }

    if (result.error) {
      setError(result.error.message)
      setLoading(false)
      return
    }

    router.push(`/dashboard/agenda?date=${form.date}`)
    router.refresh()
  }

  return (
    <>
    {showNewPatient && (
      <QuickPatientModal
        clinicId={clinicId}
        onPatientCreated={handleNewPatient}
        onClose={() => setShowNewPatient(false)}
      />
    )}
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="label mb-0">Paciente *</label>
          <button
            type="button"
            onClick={() => setShowNewPatient(true)}
            className="text-xs text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1"
          >
            <Icon name="plus" className="w-3 h-3" />
            Novo paciente
          </button>
        </div>
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

      <div>
        <label className="label">Profissional responsável *</label>
        <select
          className={`input ${!form.professional_id ? 'border-amber-300 bg-amber-50 focus:ring-amber-500' : ''}`}
          value={form.professional_id}
          onChange={e => update('professional_id', e.target.value)}
          required
        >
          <option value="">⚠️ Selecione quem vai atender</option>
          {professionals.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        {!form.professional_id && (
          <p className="text-xs text-amber-600 mt-1">Obrigatório: selecione o profissional responsável</p>
        )}
      </div>

      <div>
        <label className="label">Procedimento</label>
        <select
          className="input"
          value={form.procedure_id}
          onChange={e => update('procedure_id', e.target.value)}
        >
          <option value="">Selecione (opcional)</option>
          {procedures.map(p => (
            <option key={p.id} value={p.id}>{p.name} ({p.duration_minutes} min)</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Data *</label>
          <input
            type="date"
            className="input"
            value={form.date}
            onChange={e => update('date', e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Horario *</label>
          <input
            type="time"
            className="input"
            value={form.start_time}
            onChange={e => update('start_time', e.target.value)}
            required
          />
        </div>
      </div>

      <div>
        <label className="label">Duracao (minutos)</label>
        <select
          className="input"
          value={form.duration}
          onChange={e => update('duration', e.target.value)}
        >
          <option value="15">15 min</option>
          <option value="30">30 min</option>
          <option value="45">45 min</option>
          <option value="60">1 hora</option>
          <option value="90">1h 30min</option>
          <option value="120">2 horas</option>
        </select>
      </div>


      {isEditing && (
        <div>
          <label className="label">Status</label>
          <select
            className="input"
            value={form.status}
            onChange={e => update('status', e.target.value)}
          >
            <option value="scheduled">Agendado</option>
            <option value="confirmed">Confirmado</option>
            <option value="in_progress">Em atendimento</option>
            <option value="completed">Realizado</option>
            <option value="cancelled">Cancelado</option>
            <option value="no_show">Faltou</option>
          </select>
        </div>
      )}

      <div>
        <label className="label">Observacoes</label>
        <textarea
          className="input min-h-[80px]"
          placeholder="Anotacoes sobre o agendamento..."
          value={form.notes}
          onChange={e => update('notes', e.target.value)}
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Salvando...' : isEditing ? 'Salvar alteracoes' : 'Agendar'}
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
    </>
  )
}
