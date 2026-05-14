import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { isRouteEnabled, type ModuleId } from '@/lib/modules'
import WeeklyChart from '@/components/dashboard/WeeklyChart'
import { formatBRL, formatBRLCompact } from '@/lib/format'
import WelcomeCard from '@/components/onboarding/WelcomeCard'
import {
  todayBR,
  yesterdayBR,
  startOfDayBR,
  endOfDayBR,
  startOfMonthBR,
  addDaysBR,
  BR_TZ,
} from '@/lib/datetime'

// Tradução de entity_type para português
const ENTITY_LABELS: Record<string, string> = {
  appointments: 'agendamento',
  patients: 'paciente',
  evolutions: 'evolução',
  leads: 'lead',
  procedures: 'procedimento',
  users: 'usuário',
  products: 'produto',
  entradas: 'entrada financeira',
  saidas: 'saída financeira',
  documents_sent: 'documento',
  anamneses: 'anamnese',
  waiting_list: 'lista de espera',
  rooms: 'sala',
  notifications: 'notificação',
}

// Tradução de ações
const ACTION_LABELS: Record<string, string> = {
  INSERT: 'Criado',
  UPDATE: 'Atualizado',
  DELETE: 'Removido',
}

export default async function DashboardPage({ searchParams }: { searchParams: { welcome?: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: userData } = await supabase.from('users').select('name, clinic_id, role').eq('id', user!.id).single()
  const { data: clinic } = await supabase.from('clinics').select('name, trial_ends_at, settings').eq('id', userData?.clinic_id).single()
  
  // Get active modules from clinic settings
  const activeModules: ModuleId[] = clinic?.settings?.active_modules || []
  const hasModule = (route: string) => activeModules.length === 0 || isRouteEnabled(route, activeModules)

  const nameParts = (userData?.name || '').trim().split(/\s+/)
  const firstName = nameParts.find((p: string) => !/^(dr|dra|dr\.|dra\.)$/i.test(p)) || nameParts[0] || ''
  const trialDaysLeft = clinic?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(clinic.trial_ends_at).getTime() - Date.now()) / 86400000))
    : 0
  // Saudacao: hora local do Brasil, nao UTC
  const hourBR = Number(
    new Date().toLocaleString('en-US', { timeZone: BR_TZ, hour: '2-digit', hour12: false }),
  )
  const greeting = hourBR < 12 ? 'Bom dia' : hourBR < 18 ? 'Boa tarde' : 'Boa noite'

  // Tudo abaixo usa fuso BR (America/Sao_Paulo) pra evitar conflito com servidor UTC
  const today = todayBR()
  const startOfDay = startOfDayBR(today)
  const endOfDay = endOfDayBR(today)

  const yesterday = yesterdayBR()
  const startOfYesterday = startOfDayBR(yesterday)
  const endOfYesterday = endOfDayBR(yesterday)

  // Buscar dados da semana para gráfico
  const weekData: { day: string; count: number }[] = []
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  
  for (let i = 6; i >= 0; i--) {
    const dateStr = addDaysBR(today, -i) // YYYY-MM-DD no fuso BR
    // Dia da semana baseado no proprio dia BR (12h pra evitar borda de fuso)
    const weekday = new Date(`${dateStr}T12:00:00-03:00`).getDay()

    const { count } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', userData?.clinic_id)
      .gte('start_time', startOfDayBR(dateStr))
      .lte('start_time', endOfDayBR(dateStr))
      .neq('status', 'cancelled')
    
    weekData.push({
      day: dayNames[weekday],
      count: count || 0
    })
  }

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

  const startOfMonth = startOfMonthBR()
  const startOfMonthDate = startOfMonth.slice(0, 10) // YYYY-MM-DD pra colunas tipo `date`

  // Alertas de cobrança: promessas vencidas ou para hoje
  const { count: alertasCobranca } = await supabase
    .from('debitos')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', userData?.clinic_id)
    .eq('status', 'pendente')
    .lte('data_promessa', today)
    .not('data_promessa', 'is', null)

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
    .in('status', ['new', 'contacted'])

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

  const { count: cancelledToday } = await supabase
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', userData?.clinic_id)
    .gte('start_time', startOfDay)
    .lte('start_time', endOfDay)
    .in('status', ['cancelled', 'no_show'])

  // Receita do mês (se módulo financeiro ativo)
  let monthlyRevenue = 0
  if (hasModule('/dashboard/financeiro')) {
    const { data: entradas } = await supabase
      .from('entradas')
      .select('valor_liquido')
      .eq('clinic_id', userData?.clinic_id)
      .gte('data_venda', startOfMonthDate)
    
    monthlyRevenue = entradas?.reduce((sum, e) => sum + (e.valor_liquido || 0), 0) || 0
  }

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
  const weekTotal = weekData.reduce((sum, d) => sum + d.count, 0)

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Card de boas-vindas com guia por papel (some quando o usuario dispensa) */}
      <WelcomeCard userRole={userData?.role} userName={firstName} />

      {/* Welcome Banner */}
      {searchParams.welcome === '1' && (
        <div className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 p-5 md:p-8 text-white">
          <div className="absolute top-0 right-0 w-48 md:w-64 h-48 md:h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
          <div className="relative flex items-center gap-4">
            <img 
              src="/logo.svg" 
              alt="Clinike" 
              className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl"
            />
            <div>
              <h2 className="text-lg md:text-2xl font-black">Bem-vindo ao Clinike!</h2>
              <p className="text-white/80 text-sm md:text-base mt-0.5">Simples como deve ser</p>
            </div>
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="space-y-3 md:space-y-0 md:flex md:items-end md:justify-between md:gap-4">
        <div>
          <div className="hidden md:flex items-center gap-3 mb-3">
            <div className="flex items-center gap-2">
              <img 
                src="/logo.svg" 
                alt="Clinike" 
                className="w-8 h-8 rounded-lg shadow-lg shadow-violet-500/25"
              />
              <span className="text-sm font-bold text-slate-700">Clinike</span>
              <span className="text-xs text-slate-400">• Simples como deve ser</span>
            </div>
          </div>
          <h1 className="text-2xl md:text-4xl font-black text-slate-900">
            {greeting}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-purple-600">{firstName}</span>
          </h1>
          <p className="text-slate-500 mt-1 text-sm md:text-lg">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        
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
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {/* Consultas Hoje */}
        <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-5 border border-slate-100 shadow-sm min-w-0">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20 flex-shrink-0">
              <Icon name="calendar" className="w-5 h-5 text-white" />
            </div>
            {appointmentsDiff !== 0 && (
              <span className={`text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0 ${
                appointmentsDiff > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
              }`}>
                {appointmentsDiff > 0 ? '+' : ''}{appointmentsDiff}
              </span>
            )}
          </div>
          <p className="text-2xl md:text-3xl font-black text-slate-900 truncate">{appointmentsToday || 0}</p>
          <p className="text-xs md:text-sm text-slate-500 mt-1 truncate">Consultas hoje</p>
          <div className="mt-2 flex flex-wrap gap-1">
            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{completedToday || 0} finalizados</span>
            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{checkedIn || 0} aguardando</span>
            {(cancelledToday || 0) > 0 && (
              <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{cancelledToday} cancelados</span>
            )}
          </div>
        </div>

        {/* Pacientes */}
        <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-5 border border-slate-100 shadow-sm min-w-0">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-500 rounded-lg flex items-center justify-center shadow-lg shadow-violet-500/20 flex-shrink-0">
              <Icon name="users" className="w-5 h-5 text-white" />
            </div>
            {(newPatientsMonth || 0) > 0 && (
              <span className="text-xs font-bold px-2 py-1 rounded-lg bg-violet-100 text-violet-700 flex-shrink-0 truncate max-w-[60%]">
                +{newPatientsMonth} mês
              </span>
            )}
          </div>
          <p className="text-2xl md:text-3xl font-black text-slate-900 truncate">{totalPatients || 0}</p>
          <p className="text-xs md:text-sm text-slate-500 mt-1">Pacientes cadastrados</p>
          <Link href="/dashboard/pacientes" className="mt-2 text-xs text-violet-600 font-semibold inline-flex items-center gap-1">
            Ver todos <Icon name="arrowRight" className="w-3 h-3" />
          </Link>
        </div>

        {/* Receita do Mês - só se módulo financeiro ativo */}
        {hasModule('/dashboard/financeiro') && (
          <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-5 border border-slate-100 shadow-sm min-w-0">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20 flex-shrink-0">
                <Icon name="dollarSign" className="w-5 h-5 text-white" />
              </div>
            </div>
            <p
              className="text-xl md:text-3xl font-black text-slate-900 truncate"
              title={formatBRL(monthlyRevenue, { maximumFractionDigits: 0 })}
            >
              <span className="md:hidden">{formatBRLCompact(monthlyRevenue)}</span>
              <span className="hidden md:inline">
                {formatBRL(monthlyRevenue, { maximumFractionDigits: 0 })}
              </span>
            </p>
            <p className="text-xs md:text-sm text-slate-500 mt-1 truncate">Receita do mês</p>
            <Link href="/dashboard/financeiro" className="mt-2 text-xs text-emerald-600 font-semibold inline-flex items-center gap-1">
              Ver financeiro <Icon name="arrowRight" className="w-3 h-3" />
            </Link>
          </div>
        )}

        {/* Leads CRM - só se módulo ativo */}
        {hasModule('/dashboard/crm') && (
          <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-5 border border-slate-100 shadow-sm min-w-0">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center shadow-lg shadow-amber-500/20 flex-shrink-0">
                <Icon name="target" className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-black text-slate-900 truncate">{leadsCount || 0}</p>
            <p className="text-xs md:text-sm text-slate-500 mt-1 truncate">Leads ativos</p>
            <Link href="/dashboard/crm" className="mt-2 text-xs text-amber-600 font-semibold inline-flex items-center gap-1">
              Ver CRM <Icon name="arrowRight" className="w-3 h-3" />
            </Link>
          </div>
        )}

        {/* Lista de Espera - só se CRM não ativo (para preencher) */}
        {!hasModule('/dashboard/crm') && hasModule('/dashboard/lista-espera') && (
          <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-5 border border-slate-100 shadow-sm min-w-0">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center shadow-lg shadow-amber-500/20 flex-shrink-0">
                <Icon name="clock" className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-black text-slate-900 truncate">{waitingList || 0}</p>
            <p className="text-xs md:text-sm text-slate-500 mt-1 truncate">Lista de espera</p>
            <Link href="/dashboard/lista-espera" className="mt-2 text-xs text-amber-600 font-semibold inline-flex items-center gap-1">
              Gerenciar <Icon name="arrowRight" className="w-3 h-3" />
            </Link>
          </div>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
        {/* Left Column - 2/3 */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          {/* Gráfico de Atendimentos */}
          <div className="bg-white rounded-xl md:rounded-2xl border border-slate-100 shadow-sm p-4 md:p-6">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <div>
                <h3 className="font-bold text-slate-900 text-base md:text-lg">Atendimentos da Semana</h3>
                <p className="text-xs md:text-sm text-slate-500 mt-0.5">
                  Total: <span className="font-semibold text-violet-600">{weekTotal} consultas</span>
                </p>
              </div>
              <Link href="/dashboard/agenda" className="text-xs md:text-sm text-violet-600 font-semibold flex items-center gap-1">
                Ver agenda <Icon name="arrowRight" className="w-4 h-4" />
              </Link>
            </div>
            <WeeklyChart data={weekData} color="#8B5CF6" />
          </div>

          {/* Próximas Consultas */}
          <div className="bg-white rounded-xl md:rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-4 md:p-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 md:w-10 md:h-10 bg-gradient-to-br from-violet-500 to-purple-500 rounded-lg md:rounded-xl flex items-center justify-center">
                  <Icon name="calendar" className="w-4 h-4 md:w-5 md:h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm md:text-base">Próximas Consultas</h3>
                  <p className="text-[10px] md:text-xs text-slate-500">Agenda de hoje</p>
                </div>
              </div>
              <Link href="/dashboard/agenda" className="text-xs md:text-sm text-violet-600 font-semibold flex items-center gap-1">
                Ver agenda <Icon name="arrowRight" className="w-4 h-4" />
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
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4 md:space-y-6">
          {/* Quick Actions */}
          {(() => {
            const allActions = [
              { label: 'Recepção', href: '/dashboard/recepcao', icon: 'userCheck', color: 'from-emerald-500 to-teal-500' },
              { label: 'Estoque', href: '/dashboard/estoque', icon: 'box', color: 'from-amber-500 to-orange-500' },
              { label: 'CRM', href: '/dashboard/crm', icon: 'target', color: 'from-blue-500 to-cyan-500' },
              { label: 'Financeiro', href: '/dashboard/financeiro', icon: 'dollarSign', color: 'from-emerald-500 to-green-500' },
            ]
            const filteredActions = allActions.filter(action => hasModule(action.href))
            
            if (filteredActions.length === 0) return null
            
            return (
              <div className="bg-white rounded-xl md:rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5">
                <h3 className="font-bold text-slate-900 mb-3 md:mb-4 text-sm md:text-base">Ações Rápidas</h3>
                <div className={`grid gap-2 md:gap-3 ${filteredActions.length <= 2 ? 'grid-cols-2' : 'grid-cols-4 md:grid-cols-2'}`}>
                  {filteredActions.map(action => (
                    <Link 
                      key={action.label}
                      href={action.href}
                      className="flex flex-col items-center gap-1.5 md:gap-2 p-2.5 md:p-4 rounded-lg md:rounded-xl bg-slate-50 active:bg-slate-100 transition-colors"
                    >
                      <div className="relative">
                        <div className={`w-9 h-9 md:w-10 md:h-10 bg-gradient-to-br ${action.color} rounded-lg md:rounded-xl flex items-center justify-center shadow-md`}>
                          <Icon name={action.icon} className="w-4 h-4 md:w-5 md:h-5 text-white" />
                        </div>
                        {action.label === 'Financeiro' && (alertasCobranca ?? 0) > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                            {(alertasCobranca ?? 0) > 9 ? '9+' : alertasCobranca}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] md:text-sm font-medium text-slate-700 text-center">{action.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )
          })()}

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

          {/* Recent Activity - TRADUZIDA */}
          {recentActivity && recentActivity.length > 0 && (
            <div className="bg-white rounded-xl md:rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5">
              <div className="flex items-center justify-between mb-3 md:mb-4">
                <h3 className="font-bold text-slate-900 text-sm md:text-base">Atividade Recente</h3>
                <Link href="/dashboard/auditoria" className="text-[10px] md:text-xs text-violet-600 font-semibold">
                  Ver tudo
                </Link>
              </div>
              <div className="space-y-2.5 md:space-y-3">
                {recentActivity.slice(0, 4).map((log: any) => {
                  const actionLabel = ACTION_LABELS[log.action] || log.action
                  const entityLabel = ENTITY_LABELS[log.entity_type] || log.entity_type
                  
                  return (
                    <div key={log.id} className="flex items-start gap-2.5 md:gap-3">
                      <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full mt-1.5 md:mt-2 flex-shrink-0 ${
                        log.action === 'INSERT' ? 'bg-emerald-500' :
                        log.action === 'UPDATE' ? 'bg-blue-500' : 'bg-rose-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs md:text-sm text-slate-700">
                          <span className="font-medium">{actionLabel}</span> {entityLabel}
                          {log.entity_name && (
                            <span className="text-slate-500"> • {log.entity_name}</span>
                          )}
                        </p>
                        <p className="text-[10px] md:text-xs text-slate-400">
                          {new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Lista de Espera - se não estiver nos cards */}
          {hasModule('/dashboard/crm') && hasModule('/dashboard/lista-espera') && (waitingList || 0) > 0 && (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl md:rounded-2xl border border-amber-100 p-4 md:p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center">
                    <Icon name="clock" className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-amber-900 text-sm">{waitingList} na espera</p>
                    <p className="text-xs text-amber-700">Lista de espera</p>
                  </div>
                </div>
                <Link href="/dashboard/lista-espera" className="text-xs text-amber-700 font-semibold flex items-center gap-1">
                  Ver <Icon name="arrowRight" className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
