'use client'

import Link from 'next/link'

type Appointment = {
  id: string
  start_time: string
  end_time: string
  status: string
  notes: string | null
  patients: { id: string; name: string; phone: string | null } | null
  procedures: { id: string; name: string; duration_minutes: number } | null
  users: { id: string; name: string } | null
  rooms: { id: string; name: string; color: string } | null
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7) // 7h - 19h

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-slate-100 border-slate-200 text-slate-700',
  confirmed: 'bg-blue-50 border-blue-200 text-blue-700',
  in_progress: 'bg-amber-50 border-amber-200 text-amber-700',
  completed: 'bg-green-50 border-green-200 text-green-700',
  cancelled: 'bg-red-50 border-red-200 text-red-700 line-through',
  no_show: 'bg-red-50 border-red-200 text-red-700',
}

export default function AgendaView({ 
  appointments, 
  selectedDate 
}: { 
  appointments: Appointment[]
  selectedDate: string 
}) {
  function getAppointmentPosition(apt: Appointment) {
    const start = new Date(apt.start_time)
    const end = new Date(apt.end_time)
    const startHour = start.getHours() + start.getMinutes() / 60
    const endHour = end.getHours() + end.getMinutes() / 60
    const top = (startHour - 7) * 60 // 60px por hora
    const height = (endHour - startHour) * 60
    return { top, height: Math.max(height, 30) }
  }

  if (appointments.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl">📅</span>
        </div>
        <p className="text-sm text-slate-500">Nenhum agendamento para este dia</p>
        <Link href="/dashboard/agenda/novo" className="text-sm text-brand-600 font-medium mt-2 inline-block">
          Criar agendamento
        </Link>
      </div>
    )
  }

  return (
    <div className="relative overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Header de horas */}
        <div className="flex border-b border-slate-100">
          <div className="w-16 flex-shrink-0" />
          {HOURS.map(hour => (
            <div key={hour} className="flex-1 text-center py-2 text-xs text-slate-400 border-l border-slate-50">
              {hour}:00
            </div>
          ))}
        </div>

        {/* Grid de agendamentos */}
        <div className="relative" style={{ height: `${HOURS.length * 60}px` }}>
          {/* Linhas de hora */}
          {HOURS.map((hour, i) => (
            <div 
              key={hour} 
              className="absolute left-0 right-0 border-t border-slate-50"
              style={{ top: `${i * 60}px` }}
            >
              <span className="absolute left-2 -top-2 text-xs text-slate-300 bg-white px-1">
                {hour}:00
              </span>
            </div>
          ))}

          {/* Agendamentos */}
          {appointments.map(apt => {
            const pos = getAppointmentPosition(apt)
            const colorClass = STATUS_COLORS[apt.status] || STATUS_COLORS.scheduled

            return (
              <Link
                key={apt.id}
                href={`/dashboard/agenda/${apt.id}`}
                className={`absolute left-20 right-4 rounded-lg border p-2 transition-all hover:shadow-md ${colorClass}`}
                style={{ top: `${pos.top}px`, height: `${pos.height}px` }}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {apt.patients?.name || 'Paciente'}
                    </p>
                    <p className="text-xs truncate opacity-75">
                      {apt.procedures?.name || 'Consulta'}
                      {apt.users?.name ? ` • ${apt.users.name}` : ''}
                    </p>
                  </div>
                  {apt.rooms && (
                    <span 
                      className="text-xs px-1.5 py-0.5 rounded text-white flex-shrink-0"
                      style={{ backgroundColor: apt.rooms.color }}
                    >
                      {apt.rooms.name}
                    </span>
                  )}
                </div>
                <p className="text-xs mt-1 opacity-60">
                  {new Date(apt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  {' - '}
                  {new Date(apt.end_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
