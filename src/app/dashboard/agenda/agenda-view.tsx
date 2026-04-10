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

// Horários de 7h às 20h em intervalos de 1 hora para a visualização (clique abre com horário exato)
const HOUR_SLOTS = Array.from({ length: 14 }, (_, i) => i + 7)

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string; label: string }> = {
  scheduled: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', label: 'Agendado' },
  confirmed: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', label: 'Confirmado' },
  in_progress: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300', label: 'Em atendimento' },
  completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', label: 'Realizado' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', label: 'Cancelado' },
  no_show: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', label: 'Não compareceu' },
}

// Cores para os profissionais
const PROFESSIONAL_COLORS = [
  'from-violet-500 to-purple-500',
  'from-blue-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-rose-500 to-pink-500',
  'from-amber-500 to-orange-500',
]

export default function AgendaView({ appointments, viewMode, selectedDate, professionals, selectedProfessional }: Props) {
  // Filtrar profissionais para exibição
  const displayProfessionals = selectedProfessional === 'all' 
    ? professionals 
    : professionals.filter(p => p.id === selectedProfessional)

  // Visao Dia - Colunas por profissional
  if (viewMode === 'day') {
    return (
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-600">
              {appointments.length} agendamento{appointments.length !== 1 ? 's' : ''} • {displayProfessionals.length} profissional{displayProfessionals.length !== 1 ? 'is' : ''}
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
                  {/* Coluna de hora */}
                  <div className="w-20 flex-shrink-0 p-2 text-center border-r border-slate-100 bg-slate-50">
                    <p className={`text-sm font-semibold ${isLunchTime ? 'text-amber-600' : 'text-slate-600'}`}>
                      {timeStr}
                    </p>
                    {isLunchTime && <p className="text-xs text-amber-500">🍽️</p>}
                  </div>
                  
                  {/* Colunas dos profissionais */}
                  {displayProfessionals.map((prof, profIdx) => {
                    // Encontrar agendamentos desse profissional nessa hora
                    const hourAppointments = appointments.filter(apt => {
                      const aptHour = new Date(apt.start_time).getHours()
                      return apt.professional_id === prof.id && aptHour === hour
                    })
                    
                    return (
                      <div 
                        key={prof.id}
                        className="flex-1 min-w-[180px] p-1.5 border-r border-slate-100 last:border-r-0 min-h-[70px]"
                      >
                        {hourAppointments.length > 0 ? (
                          <div className="space-y-1">
                            {hourAppointments.map(apt => {
                              const status = STATUS_CONFIG[apt.status] || STATUS_CONFIG.scheduled
                              const aptTime = new Date(apt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                              const isPatientIncomplete = apt.patients && (!apt.patients.cpf || !apt.patients.birth_date)
                              
                              return (
                                <Link
                                  key={apt.id}
                                  href={`/dashboard/atendimento/${apt.id}`}
                                  className={`block p-2 rounded-lg ${status.bg} hover:opacity-80 transition-opacity border-l-4 ${status.border}`}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-xs font-bold text-slate-700">{aptTime}</span>
                                    {isPatientIncomplete && (
                                      <span className="w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center" title="Cadastro pendente">
                                        <Icon name="bell" className="w-2 h-2 text-white" />
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm font-semibold text-slate-900 truncate">{apt.patients?.name || 'Paciente'}</p>
                                  <p className="text-xs text-slate-500 truncate">{apt.procedures?.name || 'Consulta'}</p>
                                </Link>
                              )
                            })}
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
