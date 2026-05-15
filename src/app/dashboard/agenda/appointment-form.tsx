'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import PatientSearch from '@/components/ui/PatientSearch'
import QuickPatientModal from '@/components/ui/QuickPatientModal'
import { todayBR } from '@/lib/datetime'

type Patient = { id: string; name: string }
type Procedure = { id: string; name: string; duration_minutes: number; price: number; professional_ids?: string[] | null }
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
  defaultProfessionalId?: string
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
  defaultProfessionalId: propDefaultProfessionalId,
  appointment
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const isEditing = !!appointment

  const defaultStartDate = defaultDate || todayBR()
  const defaultStartTime = defaultTime || '09:00'

  const [patients, setPatients] = useState(initialPatients)
  const [showNewPatient, setShowNewPatient] = useState(false)
  
  // Auto-seleciona profissional: prop > editando > único profissional
  const defaultProfessionalId = propDefaultProfessionalId || 
    appointment?.professional_id || 
    (professionals.length === 1 ? professionals[0].id : '')
  
  // Múltiplos procedimentos
  const [selectedProcedures, setSelectedProcedures] = useState<string[]>(
    appointment?.procedure_id ? [appointment.procedure_id] : []
  )
  
  const [form, setForm] = useState({
    patient_id: appointment?.patient_id || defaultPatientId || '',
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

  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [hasScheduleConfigured, setHasScheduleConfigured] = useState<boolean | null>(null)
  const [allowOverlap, setAllowOverlap] = useState(false)
  const [manualTime, setManualTime] = useState('')

  // Calcula duração total baseado nos procedimentos selecionados
  useEffect(() => {
    if (selectedProcedures.length > 0) {
      const totalDuration = selectedProcedures.reduce((sum, procId) => {
        const proc = procedures.find(p => p.id === procId)
        return sum + (proc?.duration_minutes || 0)
      }, 0)
      setForm(prev => ({ ...prev, duration: totalDuration.toString() }))
    }
  }, [selectedProcedures, procedures])

  // No agendamento manual, todos os profissionais ficam disponíveis sempre.
  // O vínculo procedimento → profissional é usado APENAS pela Eva (agendamento automático).
  // Aqui a secretaria tem liberdade total de escolha.
  const eligibleProfessionals = professionals

  // Se o profissional atual deixou de ser elegível, limpar
  useEffect(() => {
    if (
      form.professional_id &&
      eligibleProfessionals.length > 0 &&
      !eligibleProfessionals.some(p => p.id === form.professional_id)
    ) {
      setForm(prev => ({ ...prev, professional_id: '' }))
    }
  }, [selectedProcedures]) // eslint-disable-line react-hooks/exhaustive-deps

  // Busca slots disponíveis quando profissional + data + duração mudarem
  useEffect(() => {
    async function loadSlots() {
      if (!form.professional_id || !form.date) {
        setAvailableSlots([])
        setHasScheduleConfigured(null)
        return
      }
      setLoadingSlots(true)

      const { data, error: rpcErr } = await supabase.rpc('get_available_slots', {
        p_clinic_id: clinicId,
        p_date: form.date,
        p_professional_id: form.professional_id,
        p_duration_min: parseInt(form.duration) || 30,
      })

      if (rpcErr) {
        console.error('Erro ao buscar slots:', rpcErr)
        setAvailableSlots([])
        setLoadingSlots(false)
        return
      }

      const { count } = await supabase
        .from('professional_schedules')
        .select('*', { count: 'exact', head: true })
        .eq('professional_id', form.professional_id)
        .eq('is_active', true)

      setHasScheduleConfigured((count ?? 0) > 0)

      const slots: string[] = (data || []).map((s: any) => String(s.slot_time).slice(0, 5))
      setAvailableSlots(slots)
      setLoadingSlots(false)
    }
    loadSlots()
  }, [form.professional_id, form.date, form.duration, clinicId, supabase])

  const handleNewPatient = (patient: { id: string; name: string }) => {
    setPatients(prev => [...prev, patient].sort((a, b) => a.name.localeCompare(b.name)))
    setForm(prev => ({ ...prev, patient_id: patient.id }))
  }

  const update = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const toggleProcedure = (procId: string) => {
    setSelectedProcedures(prev => 
      prev.includes(procId) 
        ? prev.filter(id => id !== procId)
        : [...prev, procId]
    )
  }

  // Calcula preço total
  const totalPrice = selectedProcedures.reduce((sum, procId) => {
    const proc = procedures.find(p => p.id === procId)
    return sum + (proc?.price || 0)
  }, 0)

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

    // Monta lista de procedimentos para as notas
    const procedureNames = selectedProcedures.map(id => {
      const proc = procedures.find(p => p.id === id)
      return proc?.name
    }).filter(Boolean).join(', ')

    const notesWithProcedures = selectedProcedures.length > 1 
      ? `Procedimentos: ${procedureNames}${form.notes ? '\n' + form.notes : ''}`
      : form.notes

    const appointmentData = {
      clinic_id: clinicId,
      patient_id: form.patient_id,
      professional_id: form.professional_id,
      procedure_id: selectedProcedures[0] || null, // Primeiro procedimento como principal
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      notes: notesWithProcedures || null,
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
        <PatientSearch
          patients={patients}
          value={form.patient_id}
          onChange={(id) => update('patient_id', id)}
          placeholder="Digite o nome do paciente..."
          required
        />
      </div>

      <div>
        <label className="label">Profissional responsável *</label>
        <select
          className={`input ${!form.professional_id ? 'border-amber-300 bg-amber-50 focus:ring-amber-500' : ''}`}
          value={form.professional_id}
          onChange={e => update('professional_id', e.target.value)}
          required
          disabled={eligibleProfessionals.length === 0}
        >
          <option value="">⚠️ Selecione quem vai atender</option>
          {eligibleProfessionals.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        {!form.professional_id && eligibleProfessionals.length > 0 && (
          <p className="text-xs text-amber-600 mt-1">Obrigatório: selecione o profissional responsável</p>
        )}
      </div>

      {/* Múltiplos procedimentos */}
      <div>
        <label className="label">Procedimentos</label>
        <div className="border border-slate-200 rounded-xl max-h-48 overflow-y-auto">
          {procedures.length === 0 ? (
            <p className="p-3 text-sm text-slate-500">Nenhum procedimento cadastrado</p>
          ) : (
            procedures.map(proc => (
              <label
                key={proc.id}
                className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors ${
                  selectedProcedures.includes(proc.id) ? 'bg-violet-50' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedProcedures.includes(proc.id)}
                  onChange={() => toggleProcedure(proc.id)}
                  className="w-4 h-4 text-violet-600 rounded border-slate-300 focus:ring-violet-500"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900" title={proc.name}>{proc.name}</p>
                  <p className="text-xs text-slate-500">{proc.duration_minutes} min</p>
                </div>
                <span className="text-sm font-medium text-slate-600">
                  R$ {proc.price.toFixed(2)}
                </span>
              </label>
            ))
          )}
        </div>
        {selectedProcedures.length > 0 && (
          <div className="mt-2 p-2 bg-violet-50 rounded-lg flex justify-between text-sm">
            <span className="text-violet-700">
              {selectedProcedures.length} procedimento{selectedProcedures.length > 1 ? 's' : ''} • {form.duration} min
            </span>
            <span className="font-semibold text-violet-900">
              Total: R$ {totalPrice.toFixed(2)}
            </span>
          </div>
        )}
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
          <label className="label">Horário *</label>
          <input
            type="time"
            className="input"
            value={form.start_time}
            onChange={e => update('start_time', e.target.value)}
            step="300"
            required
          />
        </div>
      </div>

      {form.professional_id && form.date && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="label mb-0">Horários disponíveis</label>
            {loadingSlots && <span className="text-xs text-slate-400">carregando...</span>}
          </div>
          {hasScheduleConfigured === false ? (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              Este profissional ainda não tem horários cadastrados.
              {' '}
              <a href="/dashboard/equipe" className="underline font-medium">
                Configurar em Equipe
              </a>
            </div>
          ) : availableSlots.length === 0 && !loadingSlots ? (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                Sem horários livres nesta data. Tente outro dia ou ajuste a duração.
              </p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowOverlap}
                  onChange={e => setAllowOverlap(e.target.checked)}
                  className="w-4 h-4 text-violet-600 rounded border-slate-300"
                />
                <span className="text-xs text-slate-600 font-medium">Agendar mesmo assim (sobrepor horário)</span>
              </label>
              {allowOverlap && (
                <input
                  type="time"
                  value={manualTime}
                  onChange={e => { setManualTime(e.target.value); update('start_time', e.target.value) }}
                  className="input w-36 text-sm"
                />
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {availableSlots.map(slot => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => update('start_time', slot)}
                    className={`px-2.5 py-1 rounded-lg text-sm border transition-colors ${
                      form.start_time === slot
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-violet-400 hover:bg-violet-50'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
              {/* Opção de sobrepor — mesmo quando há slots livres */}
              <div className="pt-1 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowOverlap}
                    onChange={e => { setAllowOverlap(e.target.checked); if (!e.target.checked) setManualTime('') }}
                    className="w-4 h-4 text-violet-600 rounded border-slate-300"
                  />
                  <span className="text-xs text-slate-500">Marcar em horário já ocupado (dois pacientes)</span>
                </label>
                {allowOverlap && (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="time"
                      value={manualTime}
                      onChange={e => { setManualTime(e.target.value); update('start_time', e.target.value) }}
                      className="input w-36 text-sm"
                    />
                    <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                      Será sobreposto ao agendamento existente
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <label className="label">Duração (minutos)</label>
        <select
          className="input"
          value={form.duration}
          onChange={e => update('duration', e.target.value)}
        >
          <option value="15">15 min</option>
          <option value="20">20 min</option>
          <option value="25">25 min</option>
          <option value="30">30 min</option>
          <option value="35">35 min</option>
          <option value="40">40 min</option>
          <option value="45">45 min</option>
          <option value="50">50 min</option>
          <option value="55">55 min</option>
          <option value="60">1 hora</option>
          <option value="75">1h 15min</option>
          <option value="90">1h 30min</option>
          <option value="105">1h 45min</option>
          <option value="120">2 horas</option>
          <option value="150">2h 30min</option>
          <option value="180">3 horas</option>
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
