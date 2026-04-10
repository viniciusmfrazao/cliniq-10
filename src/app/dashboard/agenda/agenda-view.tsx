'use client'

import Link from 'next/link'
import Icon from '@/components/ui/Icon'

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

type Props = {
  appointments: Appointment[]
  viewMode: string
  selectedDate: string
}

// Horários disponíveis (7h às 20h, intervalos de 30min)
const TIME_SLOTS = Array.from({ length: 27 }, (_, i) => {
  const hour = Math.floor(i / 2) + 7
  const minute = (i % 2) * 30
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
})

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string; label: string }> = {
  scheduled: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', label: 'Agendado' },
  confirmed: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', label: 'Confirmado' },
  in_progress: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300', label: 'Em atendimento' },
  completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', label: 'Realizado' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', label: 'Cancelado' },
  no_show: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', label: 'Nao compareceu' },
}

export default function AgendaView({ appointments, viewMode, selectedDate }: Props) {
  // Criar mapa de horários ocupados
  const occupiedSlots = new Map<string, Appointment>()
  appointments.forEach(apt => {
    const time = new Date(apt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    occupiedSlots.set(time, apt)
  })

  // Visao Dia - Grade de horários
  if (viewMode === 'day') {
    return (
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-600">
              {appointments.length} agendamento{appointments.length !== 1 ? 's' : ''} neste dia
            </p>
            <Link 
              href={`/dashboard/agenda/novo?date=${selectedDate}`}
              className="text-sm text-violet-600 font-medium hover:underline flex items-center gap-1"
            >
              <Icon name="plus" className="w-4 h-4" />
              Novo
            </Link>
          </div>
        </div>
        
        <div className="divide-y divide-slate-100">
          {TIME_SLOTS.map(time => {
            const apt = occupiedSlots.get(time)
            const [hour] = time.split(':').map(Number)
            const isLunchTime = hour === 12
            
            if (apt) {
              const status = STATUS_CONFIG[apt.status] || STATUS_CONFIG.scheduled
              const isPatientIncomplete = apt.patients && (!apt.patients.cpf || !apt.patients.birth_date)
              
              return (
                <Link
                  key={time}
                  href={`/dashboard/atendimento/${apt.id}`}
                  className={`flex items-center gap-4 p-3 hover:bg-slate-50 transition-colors border-l-4 ${status.border}`}
                >
                  <div className="w-14 text-center flex-shrink-0">
                    <p className="text-sm font-bold text-slate-900">{time}</p>
                  </div>
                  <div className={`flex-1 p-3 rounded-xl ${status.bg}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">{apt.patients?.name || 'Paciente'}</p>
                        {isPatientIncomplete && (
                          <span className="w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center" title="Cadastro pendente">
                            <Icon name="bell" className="w-3 h-3 text-white" />
                          </span>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-lg font-medium ${status.text} bg-white/50`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">{apt.procedures?.name || 'Consulta'}</p>
                  </div>
                  <Icon name="chevronRight" className="w-5 h-5 text-slate-300 flex-shrink-0" />
                </Link>
              )
            }
            
            // Slot vazio - clicável para criar agendamento
            return (
              <Link
                key={time}
                href={`/dashboard/agenda/novo?date=${selectedDate}&time=${time}`}
                className={`flex items-center gap-4 p-3 hover:bg-violet-50 transition-colors group ${isLunchTime ? 'bg-amber-50/50' : ''}`}
              >
                <div className="w-14 text-center flex-shrink-0">
                  <p className={`text-sm font-medium ${isLunchTime ? 'text-amber-600' : 'text-slate-400'}`}>{time}</p>
                </div>
                <div className="flex-1 p-3 border-2 border-dashed border-slate-200 rounded-xl group-hover:border-violet-300 group-hover:bg-violet-50 transition-colors">
                  <p className="text-sm text-slate-400 group-hover:text-violet-600">
                    {isLunchTime ? '🍽️ Horário de almoço' : 'Clique para agendar'}
                  </p>
                </div>
                <Icon name="plus" className="w-5 h-5 text-slate-300 group-hover:text-violet-500 flex-shrink-0" />
              </Link>
            )
          })}
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
