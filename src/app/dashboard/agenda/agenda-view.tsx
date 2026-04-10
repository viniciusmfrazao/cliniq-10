'use client'

import Link from 'next/link'
import Icon from '@/components/ui/Icon'

type Appointment = {
  id: string
  start_time: string
  end_time: string | null
  status: string
  notes: string | null
  patients: { id: string; name: string; phone: string | null; photo_url: string | null } | null
  procedures: { name: string; duration_minutes: number; price: number } | null
  users: { id: string; name: string } | null
}

type Professional = {
  id: string
  name: string
}

type Props = {
  appointments: Appointment[]
  viewMode: string
  selectedDate: string
  professionals: Professional[]
  selectedProfessional: string
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7) // 7h - 19h

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  scheduled: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Agendado' },
  confirmed: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Confirmado' },
  in_progress: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Em atendimento' },
  completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Realizado' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelado' },
  no_show: { bg: 'bg-red-100', text: 'text-red-700', label: 'Nao compareceu' },
}

export default function AgendaView({ appointments, viewMode, selectedDate, professionals, selectedProfessional }: Props) {
  // Visao Dia
  if (viewMode === 'day') {
    const displayProfessionals = selectedProfessional === 'all' 
      ? professionals 
      : professionals.filter(p => p.id === selectedProfessional)

    return (
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Header com profissionais */}
            <div className="flex border-b border-slate-100">
              <div className="w-16 flex-shrink-0 p-3 bg-slate-50" />
              {displayProfessionals.map(prof => (
                <div 
                  key={prof.id} 
                  className="flex-1 p-3 text-center border-l border-slate-100 bg-slate-50"
                >
                  <div className="w-8 h-8 mx-auto rounded-full gradient-bg flex items-center justify-center mb-1">
                    <span className="text-white text-xs font-bold">{prof.name.charAt(0)}</span>
                  </div>
                  <p className="text-xs font-medium text-slate-700 truncate">{prof.name}</p>
                </div>
              ))}
            </div>

            {/* Grid de horarios */}
            {HOURS.map(hour => (
              <div key={hour} className="flex border-b border-slate-50 min-h-[60px]">
                <div className="w-16 flex-shrink-0 p-2 text-xs text-slate-400 font-medium text-right pr-3 bg-slate-50/50">
                  {hour}:00
                </div>
                {displayProfessionals.map(prof => {
                  const hourAppointments = appointments.filter(apt => {
                    const aptHour = new Date(apt.start_time).getHours()
                    return aptHour === hour && apt.users?.id === prof.id
                  })

                  return (
                    <div 
                      key={prof.id} 
                      className="flex-1 p-1 border-l border-slate-50 relative"
                    >
                      {hourAppointments.map(apt => {
                        const status = STATUS_CONFIG[apt.status] || STATUS_CONFIG.scheduled
                        return (
                          <Link
                            key={apt.id}
                            href={`/dashboard/atendimento/${apt.id}`}
                            className={`block p-2 rounded-lg ${status.bg} hover:opacity-80 transition-opacity mb-1`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-slate-600">
                                {new Date(apt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${status.bg} ${status.text}`}>
                                {status.label}
                              </span>
                            </div>
                            <p className={`text-sm font-semibold ${status.text} truncate mt-1`}>
                              {apt.patients?.name}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              {apt.procedures?.name || 'Consulta'}
                            </p>
                          </Link>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Visao Semana
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
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            {/* Header com dias da semana */}
            <div className="grid grid-cols-7 border-b border-slate-100">
              {weekDays.map((day, idx) => {
                const isToday = day.toDateString() === new Date().toDateString()
                return (
                  <div 
                    key={idx} 
                    className={`p-3 text-center border-l first:border-l-0 border-slate-100 ${isToday ? 'bg-purple-50' : 'bg-slate-50'}`}
                  >
                    <p className="text-xs text-slate-500 uppercase">
                      {day.toLocaleDateString('pt-BR', { weekday: 'short' })}
                    </p>
                    <p className={`text-lg font-bold ${isToday ? 'gradient-text' : 'text-slate-900'}`}>
                      {day.getDate()}
                    </p>
                  </div>
                )
              })}
            </div>

            {/* Agendamentos por dia */}
            <div className="grid grid-cols-7 min-h-[400px]">
              {weekDays.map((day, idx) => {
                const dayStr = day.toISOString().split('T')[0]
                const dayAppointments = appointments.filter(apt => 
                  apt.start_time.startsWith(dayStr)
                )
                const isToday = day.toDateString() === new Date().toDateString()

                return (
                  <div 
                    key={idx} 
                    className={`p-2 border-l first:border-l-0 border-slate-100 ${isToday ? 'bg-purple-50/30' : ''}`}
                  >
                    {dayAppointments.length === 0 ? (
                      <p className="text-xs text-slate-300 text-center py-4">-</p>
                    ) : (
                      <div className="space-y-1">
                        {dayAppointments.slice(0, 5).map(apt => {
                          const status = STATUS_CONFIG[apt.status] || STATUS_CONFIG.scheduled
                          return (
                            <Link
                              key={apt.id}
                              href={`/dashboard/atendimento/${apt.id}`}
                              className={`block p-2 rounded-lg ${status.bg} hover:opacity-80 transition-opacity`}
                            >
                              <p className="text-xs font-medium text-slate-600">
                                {new Date(apt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                              <p className={`text-xs font-semibold ${status.text} truncate`}>
                                {apt.patients?.name}
                              </p>
                            </Link>
                          )
                        })}
                        {dayAppointments.length > 5 && (
                          <p className="text-xs text-slate-400 text-center">
                            +{dayAppointments.length - 5} mais
                          </p>
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

  // Visao Mes
  const date = new Date(selectedDate + 'T12:00:00')
  const year = date.getFullYear()
  const month = date.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startPadding = firstDay.getDay()
  const totalDays = lastDay.getDate()

  const calendarDays = [
    ...Array(startPadding).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1)
  ]

  while (calendarDays.length % 7 !== 0) {
    calendarDays.push(null)
  }

  return (
    <div className="card overflow-hidden">
      {/* Header dias da semana */}
      <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map(day => (
          <div key={day} className="p-3 text-center text-xs font-semibold text-slate-500 uppercase">
            {day}
          </div>
        ))}
      </div>

      {/* Dias do mes */}
      <div className="grid grid-cols-7">
        {calendarDays.map((day, idx) => {
          if (day === null) {
            return <div key={idx} className="p-2 min-h-[100px] bg-slate-50/50 border-b border-r border-slate-100" />
          }

          const dayDate = new Date(year, month, day)
          const dayStr = dayDate.toISOString().split('T')[0]
          const dayAppointments = appointments.filter(apt => apt.start_time.startsWith(dayStr))
          const isToday = dayDate.toDateString() === new Date().toDateString()

          return (
            <div 
              key={idx} 
              className={`p-2 min-h-[100px] border-b border-r border-slate-100 ${isToday ? 'bg-purple-50' : ''}`}
            >
              <p className={`text-sm font-semibold mb-1 ${isToday ? 'gradient-text' : 'text-slate-700'}`}>
                {day}
              </p>
              <div className="space-y-1">
                {dayAppointments.slice(0, 3).map(apt => {
                  const status = STATUS_CONFIG[apt.status] || STATUS_CONFIG.scheduled
                  return (
                    <Link
                      key={apt.id}
                      href={`/dashboard/atendimento/${apt.id}`}
                      className={`block px-1.5 py-0.5 rounded text-xs truncate ${status.bg} ${status.text} hover:opacity-80`}
                    >
                      {new Date(apt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} {apt.patients?.name?.split(' ')[0]}
                    </Link>
                  )
                })}
                {dayAppointments.length > 3 && (
                  <p className="text-xs text-slate-400">+{dayAppointments.length - 3}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
