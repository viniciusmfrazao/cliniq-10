'use client'

import Link from 'next/link'
import Icon from '@/components/ui/Icon'

type Appointment = {
  id: string
  start_time: string
  end_time: string | null
  status: string
  notes: string | null
  patients: { id: string; name: string; phone: string | null; photo_url: string | null; cpf: string | null; birth_date: string | null } | null
  procedures: { name: string; duration_minutes: number; price: number } | null
}

type Props = {
  appointments: Appointment[]
  viewMode: string
  selectedDate: string
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7)

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  scheduled: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Agendado' },
  confirmed: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Confirmado' },
  in_progress: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Em atendimento' },
  completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Realizado' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelado' },
  no_show: { bg: 'bg-red-100', text: 'text-red-700', label: 'Nao compareceu' },
}

export default function AgendaView({ appointments, viewMode, selectedDate }: Props) {
  // Visao Dia - Lista simples
  if (viewMode === 'day') {
    return (
      <div className="card overflow-hidden">
        {appointments.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Icon name="calendar" className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-600 font-medium">Nenhum agendamento neste dia</p>
            <Link href="/dashboard/agenda/novo" className="btn-primary w-auto px-6 inline-flex items-center gap-2 mt-4">
              <Icon name="plus" className="w-4 h-4" />
              Novo agendamento
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {appointments.map((apt, idx) => {
              const status = STATUS_CONFIG[apt.status] || STATUS_CONFIG.scheduled
              const isPatientIncomplete = apt.patients && (!apt.patients.cpf || !apt.patients.birth_date)
              return (
                <Link
                  key={apt.id}
                  href={`/dashboard/atendimento/${apt.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="w-16 text-center">
                    <p className="text-lg font-bold text-slate-900">
                      {new Date(apt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-xs text-slate-400">
                      {apt.end_time && new Date(apt.end_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className={`w-1.5 h-12 rounded-full ${idx === 0 ? 'gradient-bg' : 'bg-slate-200'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900 truncate">{apt.patients?.name || 'Paciente'}</p>
                      {isPatientIncomplete && (
                        <span className="flex-shrink-0 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center" title="Cadastro pendente">
                          <Icon name="bell" className="w-3 h-3 text-white" />
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 truncate">{apt.procedures?.name || 'Consulta'}</p>
                  </div>
                  <span className={`text-xs px-3 py-1.5 rounded-xl font-medium ${status.bg} ${status.text}`}>
                    {status.label}
                  </span>
                  <Icon name="chevronRight" className="w-5 h-5 text-slate-300" />
                </Link>
              )
            })}
          </div>
        )}
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

  const calendarDays: (number | null)[] = [
    ...Array(startPadding).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1)
  ]

  while (calendarDays.length % 7 !== 0) {
    calendarDays.push(null)
  }

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map(day => (
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
