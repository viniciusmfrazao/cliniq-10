import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'

export default async function DashboardPage({ searchParams }: { searchParams: { welcome?: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: userData } = await supabase.from('users').select('name, clinic_id, role').eq('id', user!.id).single()
  const { data: clinic } = await supabase.from('clinics').select('name, trial_ends_at').eq('id', userData?.clinic_id).single()

  const firstName = userData?.name?.split(' ')[0] || ''
  const trialDaysLeft = clinic?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(clinic.trial_ends_at).getTime() - Date.now()) / 86400000))
    : 0
  const h = new Date().getHours()
  const greeting = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'

  const today = new Date().toISOString().split('T')[0]
  const startOfDay = `${today}T00:00:00`
  const endOfDay = `${today}T23:59:59`

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const startOfYesterday = `${yesterday}T00:00:00`
  const endOfYesterday = `${yesterday}T23:59:59`

  const { count: appointmentsToday } = await supabase
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', userData?.clinic_id)
    .gte('start_time', startOfDay)
    .lte('start_time', endOfDay)
    .neq('status', 'cancelled')

  const { count: appointmentsYesterday } = await supabase
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', userData?.clinic_id)
    .gte('start_time', startOfYesterday)
    .lte('start_time', endOfYesterday)
    .neq('status', 'cancelled')

  const { count: totalPatients } = await supabase
    .from('patients')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', userData?.clinic_id)

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const { count: newPatientsMonth } = await supabase
    .from('patients')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', userData?.clinic_id)
    .gte('created_at', startOfMonth)

  const { count: waitingList } = await supabase
    .from('waiting_list')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', userData?.clinic_id)
    .eq('status', 'waiting')

  const { count: leadsCount } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', userData?.clinic_id)
    .eq('stage', 'new')

  const { count: checkedIn } = await supabase
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', userData?.clinic_id)
    .gte('start_time', startOfDay)
    .lte('start_time', endOfDay)
    .eq('status', 'checked_in')

  const { count: completedToday } = await supabase
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', userData?.clinic_id)
    .gte('start_time', startOfDay)
    .lte('start_time', endOfDay)
    .eq('status', 'completed')

  const { data: nextAppointments } = await supabase
    .from('appointments')
    .select(`*, patients(name, phone), procedures(name)`)
    .eq('clinic_id', userData?.clinic_id)
    .gte('start_time', new Date().toISOString())
    .lte('start_time', endOfDay)
    .neq('status', 'cancelled')
    .neq('status', 'completed')
    .order('start_time')
    .limit(5)

  const { data: recentActivity } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('clinic_id', userData?.clinic_id)
    .order('created_at', { ascending: false })
    .limit(5)

  const { data: birthdays } = await supabase
    .from('patients')
    .select('id, name, birth_date')
    .eq('clinic_id', userData?.clinic_id)
    .not('birth_date', 'is', null)
    .limit(100)

  const todayDate = new Date()
  const birthdaysThisWeek = birthdays?.filter(p => {
    if (!p.birth_date) return false
    const bd = new Date(p.birth_date)
    const thisYearBd = new Date(todayDate.getFullYear(), bd.getMonth(), bd.getDate())
    const diff = (thisYearBd.getTime() - todayDate.getTime()) / 86400000
    return diff >= 0 && diff <= 7
  }) || []

  const appointmentsDiff = (appointmentsToday || 0) - (appointmentsYesterday || 0)

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Welcome Banner */}
      {searchParams.welcome === '1' && (
        <div className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 p-5 md:p-8 text-white">
          <div className="absolute top-0 right-0 w-48 md:w-64 h-48 md:h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
          <div className="relative flex items-center gap-4">
            <div className="w-12 h-12 md:w-16 md:h-16 bg-white/20 backdrop-blur rounded-xl md:rounded-2xl flex items-center justify-center">
              <Icon name="sparkles" className="w-6 h-6 md:w-8 md:h-8" />
            </div>
            <div>
              <h2 className="text-lg md:text-2xl font-black">Bem-vinda ao Cliniq Pro!</h2>
              <p className="text-white/80 text-sm md:text-base mt-0.5">{trialDaysLeft} dias de trial gratuito</p>
            </div>
          </div>
        </div>
      )}

      {/* Header Section - Mobile Optimized */}
      <div className="space-y-3 md:space-y-0 md:flex md:items-end md:justify-between md:gap-4">
        <div>
          {/* Clinic badge - hidden on mobile since TopBar shows it */}
          <div className="hidden md:flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
              {clinic?.name || 'Clínica'}
            </span>
          </div>
          <h1 className="text-2xl md:text-4xl font-black text-slate-900">
            {greeting}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-purple-600">{firstName}</span>
          </h1>
          <p className="text-slate-500 mt-1 text-sm md:text-lg">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        
        {/* Quick action buttons - Horizontal scroll on mobile */}
        <div className="flex gap-2 md:gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          <Link 
            href="/dashboard/agenda/novo" 
            className="flex-shrink-0 inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white px-4 md:px-5 py-2.5 md:py-3 rounded-xl font-semibold shadow-lg shadow-violet-500/25 active:scale-95 transition-transform text-sm md:text-base"
          >
            <Icon name="plus" className="w-4 h-4 md:w-5 md:h-5" />
            <span className="whitespace-nowrap">Agendar</span>
          </Link>
          <Link 
            href="/dashboard/pacientes/novo" 
            className="flex-shrink-0 inline-flex items-center gap-2 bg-white text-slate-700 px-4 md:px-5 py-2.5 md:py-3 rounded-xl font-semibold border border-slate-200 active:scale-95 transition-transform text-sm md:text-base"
          >
            <Icon name="userPlus" className="w-4 h-4 md:w-5 md:h-5" />
            <span className="whitespace-nowrap">Paciente</span>
          </Link>
          <Link 
            href="/dashboard/recepcao" 
            className="flex-shrink-0 inline-flex items-center gap-2 bg-white text-slate-700 px-4 md:px-5 py-2.5 md:py-3 rounded-xl font-semibold border border-slate-200 active:scale-95 transition-transform text-sm md:text-base md:hidden"
          >
            <Icon name="userCheck" className="w-4 h-4 md:w-5 md:h-5" />
            <span className="whitespace-nowrap">Check-in</span>
          </Link>
        </div>
      </div>

      {/* Trial Warning */}
      {trialDaysLeft <= 7 && trialDaysLeft > 0 && !searchParams.welcome && (
        <div className="p-4 md:p-5 rounded-xl md:rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <Icon name="zap" className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-amber-900 text-sm md:text-base">Trial expira em {trialDaysLeft} {trialDaysLeft === 1 ? 'dia' : 'dias'}</p>
              <p className="text-xs md:text-sm text-amber-700 hidden sm:block">Assine agora e não perca seus dados</p>
            </div>
          </div>
          <Link href="/planos" className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs md:text-sm px-4 md:px-6 py-2 md:py-3 rounded-lg md:rounded-xl font-bold shadow-lg flex-shrink-0">
            Assinar
          </Link>
        </div>
      )}

      {/* Stats Overview - Horizontal scroll on mobile */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-4 scrollbar-hide">
        {/* Appointments Today */}
        <div className="flex-shrink-0 w-[160px] md:w-auto bg-white rounded-xl md:rounded-2xl p-4 md:p-5 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Icon name="calendar" className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            {appointmentsDiff !== 0 && (
              <span className={`text-[10px] md:text-xs font-bold px-1.5 md:px-2 py-0.5 md:py-1 rounded-md md:rounded-lg ${
                appointmentsDiff > 0 
                  ? 'bg-emerald-100 text-emerald-700' 
                  : 'bg-rose-100 text-rose-700'
              }`}>
                {appointmentsDiff > 0 ? '+' : ''}{appointmentsDiff}
              </span>
            )}
          </div>
          <p className="text-2xl md:text-3xl font-black text-slate-900">{appointmentsToday || 0}</p>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5 md:mt-1">Consultas hoje</p>
          <div className="mt-2 md:mt-3 flex flex-wrap gap-1 md:gap-2">
            <span className="text-[10px] md:text-xs bg-emerald-100 text-emerald-700 px-1.5 md:px-2 py-0.5 rounded-full">{completedToday || 0} ok</span>
            <span className="text-[10px] md:text-xs bg-blue-100 text-blue-700 px-1.5 md:px-2 py-0.5 rounded-full">{checkedIn || 0} espera</span>
          </div>
        </div>

        {/* Patients */}
        <div className="flex-shrink-0 w-[160px] md:w-auto bg-white rounded-xl md:rounded-2xl p-4 md:p-5 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-violet-500 to-purple-500 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Icon name="users" className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            {(newPatientsMonth || 0) > 0 && (
              <span className="text-[10px] md:text-xs font-bold px-1.5 md:px-2 py-0.5 md:py-1 rounded-md md:rounded-lg bg-violet-100 text-violet-700">
                +{newPatientsMonth}
              </span>
            )}
          </div>
          <p className="text-2xl md:text-3xl font-black text-slate-900">{totalPatients || 0}</p>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5 md:mt-1">Pacientes</p>
          <Link href="/dashboard/pacientes" className="mt-2 md:mt-3 text-[10px] md:text-xs text-violet-600 font-semibold inline-flex items-center gap-1">
            Ver todos <Icon name="arrowRight" className="w-3 h-3" />
          </Link>
        </div>

        {/* Leads CRM */}
        <div className="flex-shrink-0 w-[160px] md:w-auto bg-white rounded-xl md:rounded-2xl p-4 md:p-5 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Icon name="target" className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
          </div>
          <p className="text-2xl md:text-3xl font-black text-slate-900">{leadsCount || 0}</p>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5 md:mt-1">Novos leads</p>
          <Link href="/dashboard/crm" className="mt-2 md:mt-3 text-[10px] md:text-xs text-emerald-600 font-semibold inline-flex items-center gap-1">
            Ver CRM <Icon name="arrowRight" className="w-3 h-3" />
          </Link>
        </div>

        {/* Waiting List */}
        <div className="flex-shrink-0 w-[160px] md:w-auto bg-white rounded-xl md:rounded-2xl p-4 md:p-5 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Icon name="clock" className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
          </div>
          <p className="text-2xl md:text-3xl font-black text-slate-900">{waitingList || 0}</p>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5 md:mt-1">Lista de espera</p>
          <Link href="/dashboard/lista-espera" className="mt-2 md:mt-3 text-[10px] md:text-xs text-amber-600 font-semibold inline-flex items-center gap-1">
            Gerenciar <Icon name="arrowRight" className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
        {/* Next Appointments */}
        <div className="lg:col-span-2 bg-white rounded-xl md:rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-4 md:p-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 md:w-10 md:h-10 bg-gradient-to-br from-violet-500 to-purple-500 rounded-lg md:rounded-xl flex items-center justify-center">
                <Icon name="calendar" className="w-4 h-4 md:w-5 md:h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm md:text-base">Próximas consultas</h3>
                <p className="text-[10px] md:text-xs text-slate-500">Agenda de hoje</p>
              </div>
            </div>
            <Link href="/dashboard/agenda" className="text-xs md:text-sm text-violet-600 font-semibold flex items-center gap-1">
              Ver <span className="hidden sm:inline">agenda</span> <Icon name="arrowRight" className="w-4 h-4" />
            </Link>
          </div>
          
          {!nextAppointments || nextAppointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 md:py-12 text-center px-4">
              <div className="w-14 h-14 md:w-16 md:h-16 bg-slate-100 rounded-xl md:rounded-2xl flex items-center justify-center mb-3 md:mb-4">
                <Icon name="calendar" className="w-7 h-7 md:w-8 md:h-8 text-slate-400" />
              </div>
              <p className="font-semibold text-slate-600 text-sm md:text-base">Nenhuma consulta restante</p>
              <p className="text-xs md:text-sm text-slate-400 mt-1">Aproveite para organizar amanhã</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {nextAppointments.map((apt, idx) => (
                <Link 
                  key={apt.id} 
                  href={`/dashboard/atendimento/${apt.id}`}
                  className="flex items-center gap-3 md:gap-4 p-3 md:p-4 active:bg-slate-50 transition-colors"
                >
                  <div className="w-12 md:w-16 text-center flex-shrink-0">
                    <p className="text-base md:text-lg font-black text-slate-900">
                      {new Date(apt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className={`w-1 h-10 md:h-12 rounded-full flex-shrink-0 ${
                    idx === 0 ? 'bg-gradient-to-b from-violet-500 to-purple-500' : 'bg-slate-200'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 truncate text-sm md:text-base">{apt.patients?.name}</p>
                    <p className="text-xs md:text-sm text-slate-500 truncate">{apt.procedures?.name || 'Consulta'}</p>
                  </div>
                  <span className={`text-[10px] md:text-xs px-2 md:px-3 py-1 md:py-1.5 rounded-lg font-semibold flex-shrink-0 ${
                    apt.status === 'confirmed' 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : apt.status === 'checked_in'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {apt.status === 'confirmed' ? 'Confirmado' : apt.status === 'checked_in' ? 'Aguardando' : apt.status === 'scheduled' ? 'Agendado' : apt.status}
                  </span>
                  <Icon name="chevronRight" className="w-4 h-4 md:w-5 md:h-5 text-slate-300 flex-shrink-0 hidden sm:block" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-4 md:space-y-6">
          {/* Quick Actions - Grid on mobile */}
          <div className="bg-white rounded-xl md:rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5">
            <h3 className="font-bold text-slate-900 mb-3 md:mb-4 text-sm md:text-base">Ações rápidas</h3>
            <div className="grid grid-cols-4 md:grid-cols-2 gap-2 md:gap-3">
              {[
                { label: 'Recepção', href: '/dashboard/recepcao', icon: 'userCheck', color: 'from-emerald-500 to-teal-500' },
                { label: 'Estoque', href: '/dashboard/estoque', icon: 'box', color: 'from-amber-500 to-orange-500' },
                { label: 'CRM', href: '/dashboard/crm', icon: 'target', color: 'from-blue-500 to-cyan-500' },
                { label: 'Eva IA', href: '/dashboard/eva', icon: 'sparkles', color: 'from-violet-500 to-purple-500' },
              ].map(action => (
                <Link 
                  key={action.label}
                  href={action.href}
                  className="flex flex-col items-center gap-1.5 md:gap-2 p-2.5 md:p-4 rounded-lg md:rounded-xl bg-slate-50 active:bg-slate-100 transition-colors"
                >
                  <div className={`w-9 h-9 md:w-10 md:h-10 bg-gradient-to-br ${action.color} rounded-lg md:rounded-xl flex items-center justify-center shadow-md`}>
                    <Icon name={action.icon} className="w-4 h-4 md:w-5 md:h-5 text-white" />
                  </div>
                  <span className="text-[10px] md:text-sm font-medium text-slate-700 text-center">{action.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Birthdays */}
          {birthdaysThisWeek.length > 0 && (
            <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-xl md:rounded-2xl border border-pink-100 p-4 md:p-5">
              <div className="flex items-center gap-2 mb-3 md:mb-4">
                <span className="text-xl md:text-2xl">🎂</span>
                <h3 className="font-bold text-slate-900 text-sm md:text-base">Aniversariantes</h3>
              </div>
              <div className="space-y-2">
                {birthdaysThisWeek.slice(0, 3).map(p => {
                  const bd = new Date(p.birth_date)
                  const thisYearBd = new Date(todayDate.getFullYear(), bd.getMonth(), bd.getDate())
                  const daysUntil = Math.round((thisYearBd.getTime() - todayDate.getTime()) / 86400000)
                  return (
                    <Link 
                      key={p.id}
                      href={`/dashboard/pacientes/${p.id}`}
                      className="flex items-center justify-between p-2 rounded-lg active:bg-white/50 transition-colors"
                    >
                      <span className="font-medium text-slate-700 truncate text-sm">{p.name}</span>
                      <span className="text-[10px] md:text-xs text-pink-600 font-semibold flex-shrink-0 ml-2">
                        {daysUntil === 0 ? 'Hoje!' : `em ${daysUntil}d`}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* Recent Activity */}
          {recentActivity && recentActivity.length > 0 && (
            <div className="bg-white rounded-xl md:rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5">
              <div className="flex items-center justify-between mb-3 md:mb-4">
                <h3 className="font-bold text-slate-900 text-sm md:text-base">Atividade recente</h3>
                <Link href="/dashboard/auditoria" className="text-[10px] md:text-xs text-violet-600 font-semibold">
                  Ver tudo
                </Link>
              </div>
              <div className="space-y-2.5 md:space-y-3">
                {recentActivity.slice(0, 4).map((log: any) => (
                  <div key={log.id} className="flex items-start gap-2.5 md:gap-3">
                    <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full mt-1.5 md:mt-2 flex-shrink-0 ${
                      log.action === 'INSERT' ? 'bg-emerald-500' :
                      log.action === 'UPDATE' ? 'bg-blue-500' : 'bg-rose-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs md:text-sm text-slate-700 truncate">
                        {log.action === 'INSERT' ? 'Novo' : log.action === 'UPDATE' ? 'Atualizado' : 'Removido'} {log.entity_type}
                      </p>
                      <p className="text-[10px] md:text-xs text-slate-400">
                        {new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
