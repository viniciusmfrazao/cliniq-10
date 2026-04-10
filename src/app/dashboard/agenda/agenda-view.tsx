'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import { createClient } from '@/lib/supabase/client'

type Appointment = {
  id: string
  start_time: string
  end_time: string | null
  status: string
  notes: string | null
  professional_id: string | null
  patients: { id: string; name: string; phone: string | null; photo_url: string | null; cpf: string | null; birth_date: string | null } | null
  procedures: { name: string; duration_minutes: number; price: number } | null
}

type Professional = {
  id: string
  name: string
  role: string
}

type Props = {
  appointments: Appointment[]
  viewMode: string
  selectedDate: string
  professionals: Professional[]
  selectedProfessional: string
}

const HOUR_SLOTS = Array.from({ length: 14 }, (_, i) => i + 7)

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string; label: string }> = {
  scheduled: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', label: 'Agendado' },
  confirmed: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', label: 'Confirmado' },
  in_progress: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300', label: 'Em atendimento' },
  completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', label: 'Realizado' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', label: 'Cancelado' },
  no_show: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', label: 'Não compareceu' },
}

const PROFESSIONAL_COLORS = [
  'from-violet-500 to-purple-500',
  'from-blue-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-rose-500 to-pink-500',
  'from-amber-500 to-orange-500',
]

// Componente de Card de Agendamento com preview e ações rápidas
function AppointmentCard({ 
  apt, 
  onStatusChange,
  onDragStart,
  compact = false
}: { 
  apt: Appointment
  onStatusChange: (id: string, status: string) => void
  onDragStart?: (e: React.DragEvent, apt: Appointment) => void
  compact?: boolean
}) {
  const [showPreview, setShowPreview] = useState(false)
  const status = STATUS_CONFIG[apt.status] || STATUS_CONFIG.scheduled
  const aptTime = new Date(apt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const isPatientIncomplete = apt.patients && (!apt.patients.cpf || !apt.patients.birth_date)
  const canConfirm = apt.status === 'scheduled'
  const canCancel = ['scheduled', 'confirmed'].includes(apt.status)

  return (
    <div 
      className="relative group"
      onMouseEnter={() => setShowPreview(true)}
      onMouseLeave={() => setShowPreview(false)}
    >
      <Link
        href={`/dashboard/atendimento/${apt.id}`}
        draggable={!!onDragStart}
        onDragStart={onDragStart ? (e) => onDragStart(e, apt) : undefined}
        className={`block p-2 rounded-lg ${status.bg} hover:ring-2 hover:ring-violet-300 transition-all border-l-4 ${status.border} ${onDragStart ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs font-bold text-slate-700">{aptTime}</span>
          <div className="flex items-center gap-1">
            {isPatientIncomplete && (
              <span className="w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center" title="Cadastro pendente">
                <Icon name="bell" className="w-2 h-2 text-white" />
              </span>
            )}
            {onDragStart && (
              <Icon name="menu" className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100" />
            )}
          </div>
        </div>
        <p className={`${compact ? 'text-xs' : 'text-sm'} font-semibold text-slate-900 truncate`}>
          {apt.patients?.name || 'Paciente'}
        </p>
        {!compact && (
          <p className="text-xs text-slate-500 truncate">{apt.procedures?.name || 'Consulta'}</p>
        )}
      </Link>

      {/* Preview ao passar o mouse */}
      {showPreview && (
        <div className="absolute z-50 left-full ml-2 top-0 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-4 animate-in fade-in slide-in-from-left-2 duration-200">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center text-white font-bold">
              {apt.patients?.name?.charAt(0) || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 truncate">{apt.patients?.name}</p>
              <p className="text-xs text-slate-500">{apt.patients?.phone || 'Sem telefone'}</p>
            </div>
          </div>
          
          <div className="space-y-2 text-xs mb-3">
            <div className="flex justify-between">
              <span className="text-slate-500">Procedimento:</span>
              <span className="font-medium text-slate-700">{apt.procedures?.name || 'Consulta'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Duração:</span>
              <span className="font-medium text-slate-700">{apt.procedures?.duration_minutes || 30} min</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Status:</span>
              <span className={`font-medium ${status.text}`}>{status.label}</span>
            </div>
            {apt.notes && (
              <div className="pt-2 border-t border-slate-100">
                <p className="text-slate-500 mb-1">Observações:</p>
                <p className="text-slate-700 line-clamp-2">{apt.notes}</p>
              </div>
            )}
          </div>

          {/* Ações rápidas */}
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            {canConfirm && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onStatusChange(apt.id, 'confirmed') }}
                className="flex-1 py-1.5 px-2 bg-blue-500 text-white text-xs font-medium rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-1"
              >
                <Icon name="check" className="w-3 h-3" />
                Confirmar
              </button>
            )}
            {canCancel && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onStatusChange(apt.id, 'cancelled') }}
                className="flex-1 py-1.5 px-2 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-1"
              >
                <Icon name="x" className="w-3 h-3" />
                Cancelar
              </button>
            )}
            <Link
              href={`/dashboard/atendimento/${apt.id}`}
              className="flex-1 py-1.5 px-2 bg-slate-100 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <Icon name="eye" className="w-3 h-3" />
              Abrir
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AgendaView({ appointments, viewMode, selectedDate, professionals, selectedProfessional }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [draggedAppointment, setDraggedAppointment] = useState<Appointment | null>(null)

  const displayProfessionals = selectedProfessional === 'all' 
    ? professionals 
    : professionals.filter(p => p.id === selectedProfessional)

  // Atualizar status do agendamento
  async function handleStatusChange(appointmentId: string, newStatus: string) {
    const { error } = await supabase
      .from('appointments')
      .update({ status: newStatus })
      .eq('id', appointmentId)
    
    if (!error) {
      router.refresh()
    }
  }

  // Drag and drop handlers
  function handleDragStart(e: React.DragEvent, apt: Appointment) {
    setDraggedAppointment(apt)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  async function handleDrop(e: React.DragEvent, targetDate: string, targetHour: number, targetProfessionalId?: string) {
    e.preventDefault()
    if (!draggedAppointment) return

    const oldStartTime = new Date(draggedAppointment.start_time)
    const newStartTime = new Date(`${targetDate}T${targetHour.toString().padStart(2, '0')}:${oldStartTime.getMinutes().toString().padStart(2, '0')}:00`)
    
    const duration = draggedAppointment.end_time 
      ? new Date(draggedAppointment.end_time).getTime() - oldStartTime.getTime()
      : 30 * 60 * 1000
    const newEndTime = new Date(newStartTime.getTime() + duration)

    const updateData: Record<string, string> = {
      start_time: newStartTime.toISOString(),
      end_time: newEndTime.toISOString(),
    }
    
    if (targetProfessionalId) {
      updateData.professional_id = targetProfessionalId
    }

    const { error } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', draggedAppointment.id)

    if (!error) {
      router.refresh()
    }
    setDraggedAppointment(null)
  }

  // Encontrar próximo horário livre
  function findNextAvailableSlot(): { date: string; time: string; professionalId: string } | null {
    const now = new Date()
    const checkDate = new Date(selectedDate + 'T00:00:00')
    
    for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
      const currentDate = new Date(checkDate)
      currentDate.setDate(checkDate.getDate() + dayOffset)
      const dateStr = currentDate.toISOString().split('T')[0]
      
      for (const prof of displayProfessionals) {
        for (let hour = 7; hour <= 19; hour++) {
          for (const minute of [0, 30]) {
            const slotTime = new Date(`${dateStr}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`)
            
            if (slotTime <= now) continue
            
            const hasAppointment = appointments.some(apt => {
              const aptStart = new Date(apt.start_time)
              const aptEnd = apt.end_time ? new Date(apt.end_time) : new Date(aptStart.getTime() + 30 * 60 * 1000)
              return apt.professional_id === prof.id && 
                     slotTime >= aptStart && slotTime < aptEnd
            })
            
            if (!hasAppointment) {
              return {
                date: dateStr,
                time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
                professionalId: prof.id
              }
            }
          }
        }
      }
    }
    return null
  }

  function handleFindNextSlot() {
    const slot = findNextAvailableSlot()
    if (slot) {
      router.push(`/dashboard/agenda/novo?date=${slot.date}&time=${slot.time}&professional=${slot.professionalId}`)
    } else {
      alert('Não encontramos horários disponíveis nos próximos 30 dias')
    }
  }

  // Visão Dia - Colunas por profissional
  if (viewMode === 'day') {
    return (
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-medium text-slate-600">
              {appointments.length} agendamento{appointments.length !== 1 ? 's' : ''} • {displayProfessionals.length} profissional{displayProfessionals.length !== 1 ? 'is' : ''}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleFindNextSlot}
                className="text-sm text-emerald-600 font-medium hover:bg-emerald-50 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
              >
                <Icon name="search" className="w-4 h-4" />
                Próximo livre
              </button>
              <Link 
                href={`/dashboard/agenda/novo?date=${selectedDate}`}
                className="text-sm text-violet-600 font-medium hover:bg-violet-50 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
              >
                <Icon name="plus" className="w-4 h-4" />
                Novo
              </Link>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <div style={{ minWidth: displayProfessionals.length > 1 ? `${displayProfessionals.length * 200 + 80}px` : '100%' }}>
            {/* Header com profissionais */}
            <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
              <div className="w-20 flex-shrink-0 p-3 text-center border-r border-slate-200">
                <p className="text-xs font-semibold text-slate-500 uppercase">Hora</p>
              </div>
              {displayProfessionals.map((prof, idx) => (
                <div 
                  key={prof.id}
                  className="flex-1 min-w-[180px] p-3 text-center border-r border-slate-200 last:border-r-0"
                >
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r ${PROFESSIONAL_COLORS[idx % PROFESSIONAL_COLORS.length]} text-white text-sm font-medium`}>
                    <Icon name="user" className="w-3 h-3" />
                    {prof.name.split(' ')[0]}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Grade de horários */}
            {HOUR_SLOTS.map(hour => {
              const timeStr = `${hour.toString().padStart(2, '0')}:00`
              const isLunchTime = hour === 12
              
              return (
                <div key={hour} className={`flex border-b border-slate-100 ${isLunchTime ? 'bg-amber-50/30' : ''}`}>
                  <div className="w-20 flex-shrink-0 p-2 text-center border-r border-slate-100 bg-slate-50">
                    <p className={`text-sm font-semibold ${isLunchTime ? 'text-amber-600' : 'text-slate-600'}`}>
                      {timeStr}
                    </p>
                    {isLunchTime && <p className="text-xs text-amber-500">🍽️</p>}
                  </div>
                  
                  {displayProfessionals.map((prof) => {
                    const hourAppointments = appointments.filter(apt => {
                      const aptHour = new Date(apt.start_time).getHours()
                      return apt.professional_id === prof.id && aptHour === hour
                    })
                    
                    return (
                      <div 
                        key={prof.id}
                        className={`flex-1 min-w-[180px] p-1.5 border-r border-slate-100 last:border-r-0 min-h-[70px] transition-colors ${
                          draggedAppointment ? 'hover:bg-violet-100' : ''
                        }`}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, selectedDate, hour, prof.id)}
                      >
                        {hourAppointments.length > 0 ? (
                          <div className="space-y-1">
                            {hourAppointments.map(apt => (
                              <AppointmentCard
                                key={apt.id}
                                apt={apt}
                                onStatusChange={handleStatusChange}
                                onDragStart={handleDragStart}
                              />
                            ))}
                          </div>
                        ) : (
                          <Link
                            href={`/dashboard/agenda/novo?date=${selectedDate}&time=${timeStr}&professional=${prof.id}`}
                            className="h-full min-h-[60px] flex items-center justify-center border-2 border-dashed border-slate-200 rounded-lg hover:border-violet-300 hover:bg-violet-50 transition-colors group"
                          >
                            <Icon name="plus" className="w-4 h-4 text-slate-300 group-hover:text-violet-500" />
                          </Link>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // Visão Semana - Com clique no dia e preview
  if (viewMode === 'week') {
    const date = new Date(selectedDate + 'T12:00:00')
    const dayOfWeek = date.getDay()
    const weekStart = new Date(date)
    weekStart.setDate(date.getDate() - dayOfWeek)

    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + i)
      return d
    })

    return (
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-600">
              Semana de {weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            </p>
            <button
              onClick={handleFindNextSlot}
              className="text-sm text-emerald-600 font-medium hover:bg-emerald-50 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
            >
              <Icon name="search" className="w-4 h-4" />
              Próximo livre
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            <div className="grid grid-cols-7 border-b border-slate-100">
              {weekDays.map((day, idx) => {
                const isToday = day.toDateString() === new Date().toDateString()
                const dayStr = day.toISOString().split('T')[0]
                const dayAppointments = appointments.filter(apt => apt.start_time.startsWith(dayStr))
                
                return (
                  <Link
                    key={idx}
                    href={`/dashboard/agenda?date=${dayStr}&view=day`}
                    className={`p-3 text-center border-l first:border-l-0 border-slate-100 hover:bg-slate-100 transition-colors ${isToday ? 'bg-purple-50' : 'bg-slate-50'}`}
                  >
                    <p className="text-xs text-slate-500 uppercase">
                      {day.toLocaleDateString('pt-BR', { weekday: 'short' })}
                    </p>
                    <p className={`text-lg font-bold ${isToday ? 'gradient-text' : 'text-slate-900'}`}>
                      {day.getDate()}
                    </p>
                    {dayAppointments.length > 0 && (
                      <span className="inline-flex items-center justify-center w-5 h-5 bg-violet-500 text-white text-xs font-bold rounded-full">
                        {dayAppointments.length}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>

            <div 
              className="grid grid-cols-7 min-h-[400px]"
              onDragOver={handleDragOver}
            >
              {weekDays.map((day, idx) => {
                const dayStr = day.toISOString().split('T')[0]
                const dayAppointments = appointments.filter(apt => 
                  apt.start_time.startsWith(dayStr)
                ).sort((a, b) => a.start_time.localeCompare(b.start_time))
                const isToday = day.toDateString() === new Date().toDateString()

                return (
                  <div 
                    key={idx} 
                    className={`p-2 border-l first:border-l-0 border-slate-100 ${isToday ? 'bg-purple-50/30' : ''}`}
                    onDrop={(e) => handleDrop(e, dayStr, 9)}
                  >
                    {dayAppointments.length === 0 ? (
                      <Link
                        href={`/dashboard/agenda/novo?date=${dayStr}`}
                        className="h-full min-h-[100px] flex flex-col items-center justify-center text-slate-400 hover:text-violet-500 hover:bg-violet-50 rounded-lg transition-colors"
                      >
                        <Icon name="plus" className="w-5 h-5" />
                        <span className="text-xs mt-1">Agendar</span>
                      </Link>
                    ) : (
                      <div className="space-y-1">
                        {dayAppointments.slice(0, 6).map(apt => (
                          <AppointmentCard
                            key={apt.id}
                            apt={apt}
                            onStatusChange={handleStatusChange}
                            onDragStart={handleDragStart}
                            compact
                          />
                        ))}
                        {dayAppointments.length > 6 && (
                          <Link
                            href={`/dashboard/agenda?date=${dayStr}&view=day`}
                            className="block text-center text-xs text-violet-600 font-medium hover:underline py-1"
                          >
                            +{dayAppointments.length - 6} mais
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Visão Mês - Com resumo e clique para dia
  const monthDate = new Date(selectedDate + 'T12:00:00')
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startPadding = firstDay.getDay()
  const totalDays = lastDay.getDate()

  const calendarDays: (number | null)[] = [
    ...Array(startPadding).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1)
  ]

  while (calendarDays.length % 7 !== 0) {
    calendarDays.push(null)
  }

  // Calcular estatísticas do mês
  const monthStats = {
    total: appointments.length,
    confirmed: appointments.filter(a => a.status === 'confirmed').length,
    completed: appointments.filter(a => a.status === 'completed').length,
  }

  return (
    <div className="card overflow-hidden">
      {/* Estatísticas do mês */}
      <div className="p-4 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <p className="text-sm font-medium text-slate-600">
              {monthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </p>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                {monthStats.total} total
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                {monthStats.confirmed} confirmados
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                {monthStats.completed} realizados
              </span>
            </div>
          </div>
          <button
            onClick={handleFindNextSlot}
            className="text-sm text-emerald-600 font-medium hover:bg-emerald-50 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
          >
            <Icon name="search" className="w-4 h-4" />
            Próximo livre
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
          <div key={day} className="p-3 text-center text-xs font-semibold text-slate-500 uppercase">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {calendarDays.map((day, idx) => {
          if (day === null) {
            return <div key={idx} className="p-2 min-h-[100px] bg-slate-50/50 border-b border-r border-slate-100" />
          }

          const dayDate = new Date(year, month, day)
          const dayStr = dayDate.toISOString().split('T')[0]
          const dayAppointments = appointments.filter(apt => apt.start_time.startsWith(dayStr))
          const isToday = dayDate.toDateString() === new Date().toDateString()
          const isPast = dayDate < new Date(new Date().setHours(0, 0, 0, 0))

          const confirmed = dayAppointments.filter(a => a.status === 'confirmed').length
          const scheduled = dayAppointments.filter(a => a.status === 'scheduled').length

          return (
            <Link
              key={idx}
              href={`/dashboard/agenda?date=${dayStr}&view=day`}
              className={`p-2 min-h-[100px] border-b border-r border-slate-100 hover:bg-slate-50 transition-colors group ${
                isToday ? 'bg-purple-50 ring-2 ring-inset ring-violet-300' : ''
              } ${isPast ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-semibold ${isToday ? 'gradient-text' : 'text-slate-700'}`}>
                  {day}
                </span>
                {dayAppointments.length > 0 && (
                  <span className="text-xs font-bold text-violet-600 bg-violet-100 px-1.5 py-0.5 rounded">
                    {dayAppointments.length}
                  </span>
                )}
              </div>
              
              {dayAppointments.length > 0 ? (
                <div className="space-y-0.5">
                  {dayAppointments.slice(0, 3).map(apt => {
                    const status = STATUS_CONFIG[apt.status] || STATUS_CONFIG.scheduled
                    return (
                      <div
                        key={apt.id}
                        className={`px-1.5 py-0.5 rounded text-xs truncate ${status.bg} ${status.text}`}
                      >
                        {new Date(apt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} {apt.patients?.name?.split(' ')[0]}
                      </div>
                    )
                  })}
                  {dayAppointments.length > 3 && (
                    <p className="text-xs text-slate-400 pl-1">+{dayAppointments.length - 3} mais</p>
                  )}
                </div>
              ) : !isPast ? (
                <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Icon name="plus" className="w-4 h-4 text-violet-400" />
                </div>
              ) : null}
              
              {/* Mini indicadores */}
              {dayAppointments.length > 0 && (
                <div className="flex gap-1 mt-1">
                  {confirmed > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" title={`${confirmed} confirmado(s)`}></span>
                  )}
                  {scheduled > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" title={`${scheduled} pendente(s)`}></span>
                  )}
                </div>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
