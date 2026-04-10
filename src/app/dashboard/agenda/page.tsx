import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import AgendaView from './agenda-view'
import AgendaFilters from './agenda-filters'

export default async function AgendaPage({ 
  searchParams 
}: { 
  searchParams: { date?: string; professional?: string; room?: string } 
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: userData } = await supabase.from('users').select('clinic_id').eq('id', user!.id).single()

  const selectedDate = searchParams.date || new Date().toISOString().split('T')[0]
  const startOfDay = `${selectedDate}T00:00:00`
  const endOfDay = `${selectedDate}T23:59:59`

  // Buscar agendamentos do dia
  let query = supabase
    .from('appointments')
    .select(`
      *,
      patients(id, name, phone),
      procedures(id, name, duration_minutes),
      users(id, name),
      rooms(id, name, color)
    `)
    .eq('clinic_id', userData?.clinic_id)
    .gte('start_time', startOfDay)
    .lte('start_time', endOfDay)
    .order('start_time')

  if (searchParams.professional) {
    query = query.eq('professional_id', searchParams.professional)
  }
  if (searchParams.room) {
    query = query.eq('room_id', searchParams.room)
  }

  const { data: appointments } = await query

  // Buscar profissionais e salas para filtros
  const { data: professionals } = await supabase
    .from('users')
    .select('id, name, role')
    .eq('clinic_id', userData?.clinic_id)
    .in('role', ['admin', 'doctor', 'esthetician'])

  const { data: rooms } = await supabase
    .from('rooms')
    .select('*')
    .eq('clinic_id', userData?.clinic_id)
    .eq('active', true)

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Agenda</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { 
              weekday: 'long', 
              day: 'numeric', 
              month: 'long' 
            })}
          </p>
        </div>
        <Link href="/dashboard/agenda/novo" className="btn-primary w-auto px-4">
          + Novo agendamento
        </Link>
      </div>

      <div className="card p-4 mb-4">
        <AgendaFilters 
          selectedDate={selectedDate}
          professionals={professionals || []}
          rooms={rooms || []}
          currentProfessional={searchParams.professional}
          currentRoom={searchParams.room}
        />
      </div>

      <div className="card">
        <AgendaView 
          appointments={appointments || []} 
          selectedDate={selectedDate}
        />
      </div>
    </div>
  )
}
