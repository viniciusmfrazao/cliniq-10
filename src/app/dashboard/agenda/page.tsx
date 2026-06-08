import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import AgendaView from './agenda-view'
import AgendaFilters from './agenda-filters'
import { todayBR, startOfDayBR, endOfDayBR, addDaysBR, BR_OFFSET } from '@/lib/datetime'

export const revalidate = 30

export default async function AgendaPage({ 
  searchParams 
}: { 
  searchParams: { date?: string; view?: string; professional?: string; status?: string }
}) {
  const sp = searchParams
  const supabase = await createClient()
  
  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Data selecionada ou hoje (sempre no fuso de Brasilia)
  const selectedDate = sp.date || todayBR()
  const viewMode = sp.view || 'day'
  const selectedProfessional = sp.professional || 'all'
  const selectedStatus = sp.status || 'all'
  const today = todayBR()

  // Calcular range de datas baseado na view (timestamps com offset BR explicito)
  let startDate: string
  let endDate: string

  if (viewMode === 'day') {
    startDate = startOfDayBR(selectedDate)
    endDate = endOfDayBR(selectedDate)
  } else if (viewMode === 'week') {
    // Dia da semana baseado no horario do meio-dia BR pra evitar borda
    const refDate = new Date(`${selectedDate}T12:00:00${BR_OFFSET}`)
    const dayOfWeek = refDate.getDay()
    const startStr = addDaysBR(selectedDate, -dayOfWeek)
    const endStr = addDaysBR(startStr, 6)
    startDate = startOfDayBR(startStr)
    endDate = endOfDayBR(endStr)
  } else {
    // Mes do `selectedDate`
    const [yStr, mStr] = selectedDate.split('-')
    const y = Number(yStr)
    const m = Number(mStr)
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const startStr = `${yStr}-${mStr}-01`
    const endStr = `${yStr}-${mStr}-${String(lastDay).padStart(2, '0')}`
    startDate = startOfDayBR(startStr)
    endDate = endOfDayBR(endStr)
  }

  // Buscar clinic_id do usuário
  const { data: userData } = await supabase
    .from('users')
    .select('clinic_id')
    .eq('id', user.id)
    .maybeSingle()

  const clinicId = userData?.clinic_id

  // Roles que podem atender pacientes (admin NÃO é profissional)
  const PROFESSIONAL_ROLES = ['doctor', 'esthetician', 'biomedic', 'nurse', 'physiotherapist', 'nutritionist', 'psychologist']

  // EXECUTAR QUERIES EM PARALELO (muito mais rápido!)
  const [allUsersResult, appointmentsResult, todayAppointmentsResult, blocksResult] = await Promise.all([
    // Query 1: TODOS os usuários da clínica (filtraremos no código)
    supabase
      .from('users')
      .select('id, name, role, professional_role, active')
      .eq('clinic_id', clinicId)
      .order('name'),
    
    // Query 2: Agendamentos do período selecionado
    supabase
      .from('appointments')
      .select(`
        *,
        patients(id, name, phone, photo_url, cpf, birth_date),
        procedures(name, duration_minutes, price),
        professional:users!appointments_professional_id_fkey(id, name),
        appointment_procedures(id, procedure_id, procedure_name, duration_minutes, price)
      `)
      .eq('clinic_id', clinicId)
      .gte('start_time', startDate)
      .lte('start_time', endDate)
      .order('start_time'),
    
    // Query 3: Agendamentos de hoje (para estatísticas) — inclui cancelados para relatório
    supabase
      .from('appointments')
      .select('status')
      .eq('clinic_id', clinicId)
      .gte('start_time', startOfDayBR(today))
      .lte('start_time', endOfDayBR(today)),

    // Query 4: Bloqueios do período
    supabase
      .from('professional_blocks')
      .select('id, title, start_time, end_time, notes, color, professional_id')
      .eq('clinic_id', clinicId)
      .gte('start_time', startDate)
      .lte('start_time', endDate)
      .order('start_time'),
  ])

  // Filtrar profissionais no código (evita problemas com enum)
  const allUsers = allUsersResult.data || []
  const professionalsFiltered = allUsers.filter(u => 
    (PROFESSIONAL_ROLES.includes(u.role) || PROFESSIONAL_ROLES.includes(u.professional_role || '')) && u.active !== false
  )
  // Se não houver profissionais com role específico, usar admins como fallback
  const professionals = professionalsFiltered.length > 0 
    ? professionalsFiltered 
    : allUsers.filter(u => u.role === 'admin' && u.active !== false
  )
  const appointments = appointmentsResult.data || []
  const todayAppointments = todayAppointmentsResult.data || []
  const blocks = blocksResult.data || []

  // Calcular estatísticas do array (sem queries extras!)
  const todayTotal = todayAppointments.filter(a => !['cancelled','no_show'].includes(a.status)).length
  const todayConfirmed = todayAppointments.filter(a => a.status === 'confirmed').length
  const todayCompleted = todayAppointments.filter(a => a.status === 'completed').length
  const todayCancelled = todayAppointments.filter(a => a.status === 'cancelled' || a.status === 'no_show').length
  const todayGrandTotal = todayAppointments.length
  const cancellationRate = todayGrandTotal > 0 ? Math.round((todayCancelled / todayGrandTotal) * 100) : 0

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Agenda</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gerencie seus agendamentos</p>
        </div>
        <Link href="/dashboard/agenda/novo" className="btn-primary w-auto px-4 flex items-center gap-2">
          <Icon name="plus" className="w-4 h-4" />
          Novo Agendamento
        </Link>
      </div>

      {/* Stats do dia */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
            <Icon name="calendar" className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{todayTotal || 0}</p>
            <p className="text-xs text-slate-500">Hoje</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0">
            <Icon name="check" className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{todayConfirmed || 0}</p>
            <p className="text-xs text-slate-500">Confirmados</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
            <Icon name="award" className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{todayCompleted || 0}</p>
            <p className="text-xs text-slate-500">Realizados</p>
          </div>
        </div>
        <div className={`card p-4 flex items-center gap-3 ${todayCancelled > 0 ? 'border-l-4 border-red-300' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-400 to-rose-500 flex items-center justify-center flex-shrink-0">
            <Icon name="x" className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <p className="text-2xl font-bold text-slate-900">{todayCancelled || 0}</p>
              {cancellationRate > 0 && (
                <span className="text-xs font-semibold text-red-500">{cancellationRate}%</span>
              )}
            </div>
            <p className="text-xs text-slate-500">Cancelamentos</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      {/* Suspense é obrigatório no Next 15 pq AgendaFilters usa useSearchParams */}
      <Suspense fallback={<div className="card p-4 mb-6 h-16 animate-pulse bg-slate-50" />}>
        <AgendaFilters 
          currentDate={selectedDate}
          currentView={viewMode}
          currentProfessional={selectedProfessional}
          currentStatus={selectedStatus}
          professionals={professionals || []}
        />
      </Suspense>

      {/* Agenda */}
      <AgendaView 
        appointments={selectedStatus === 'all' 
          ? (appointments || [])
          : (appointments || []).filter(a => a.status === selectedStatus)
        }
        blocks={blocks}
        viewMode={viewMode}
        selectedDate={selectedDate}
        professionals={professionals || []}
        selectedProfessional={selectedProfessional}
        clinicId={clinicId}
      />
    </div>
  )
}

