import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'

export default async function DashboardPage({ searchParams }: { searchParams: { welcome?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: userData } = await supabase.from('users').select('name, clinic_id').eq('id', user!.id).single()
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

  const { count: appointmentsToday } = await supabase
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', userData?.clinic_id)
    .gte('start_time', startOfDay)
    .lte('start_time', endOfDay)
    .neq('status', 'cancelled')

  const { count: totalPatients } = await supabase
    .from('patients')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', userData?.clinic_id)

  const { count: waitingList } = await supabase
    .from('waiting_list')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', userData?.clinic_id)
    .eq('status', 'waiting')

  const { data: nextAppointments } = await supabase
    .from('appointments')
    .select(`*, patients(name), procedures(name)`)
    .eq('clinic_id', userData?.clinic_id)
    .gte('start_time', new Date().toISOString())
    .lte('start_time', endOfDay)
    .neq('status', 'cancelled')
    .neq('status', 'completed')
    .order('start_time')
    .limit(5)

  const KPIs = [
    { label: 'Consultas hoje', value: appointmentsToday || 0, sub: 'agendadas', icon: 'calendar', href: '/dashboard/agenda', color: 'from-violet-500 to-purple-600', shadow: 'shadow-purple-200' },
    { label: 'Pacientes', value: totalPatients || 0, sub: 'cadastrados', icon: 'users', href: '/dashboard/pacientes', color: 'from-emerald-500 to-teal-500', shadow: 'shadow-emerald-200' },
    { label: 'Lista de espera', value: waitingList || 0, sub: 'aguardando', icon: 'clock', href: '#', color: 'from-amber-500 to-orange-500', shadow: 'shadow-amber-200' },
    { label: 'Estoque', value: 0, sub: 'alertas', icon: 'box', href: '#', color: 'from-blue-500 to-cyan-500', shadow: 'shadow-blue-200' },
  ]

  const QuickActions = [
    { label: 'Novo agendamento', href: '/dashboard/agenda/novo', icon: 'calendar', gradient: 'from-violet-500 to-purple-600' },
    { label: 'Novo paciente', href: '/dashboard/pacientes/novo', icon: 'userPlus', gradient: 'from-emerald-500 to-teal-500' },
    { label: 'Procedimentos', href: '/dashboard/procedimentos', icon: 'clipboard', gradient: 'from-cyan-500 to-blue-500' },
    { label: 'Eva IA', href: '/dashboard/eva', icon: 'sparkles', gradient: 'from-pink-500 to-rose-500' },
  ]

  return (
    <div className="max-w-2xl mx-auto md:max-w-none">
      {searchParams.welcome === '1' && (
        <div className="mb-6 p-5 gradient-bg rounded-2xl text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <Icon name="sparkles" className="w-5 h-5" />
              <p className="font-bold text-lg">Bem-vinda ao Cliniq!</p>
            </div>
            <p className="text-white/80 text-sm">{trialDaysLeft} dias de trial gratuito para explorar todos os recursos.</p>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{greeting}, {firstName} 👋</h1>
        <p className="text-sm text-slate-500 mt-1">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {trialDaysLeft <= 7 && trialDaysLeft > 0 && !searchParams.welcome && (
        <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-200">
              <Icon name="zap" className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-900">Trial expira em {trialDaysLeft} {trialDaysLeft === 1 ? 'dia' : 'dias'}</p>
              <p className="text-xs text-amber-700">Escolha um plano para continuar usando</p>
            </div>
          </div>
          <Link href="/planos" className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs px-4 py-2.5 rounded-xl font-semibold whitespace-nowrap shadow-lg shadow-amber-200 hover:opacity-90 transition-all">
            Ver planos
          </Link>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 mb-6 md:grid-cols-4">
        {KPIs.map(kpi => (
          <Link 
            key={kpi.label} 
            href={kpi.href} 
            className="card p-4 hover:shadow-lg transition-all group"
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${kpi.color} flex items-center justify-center shadow-lg ${kpi.shadow} group-hover:scale-110 transition-transform`}>
                <Icon name={kpi.icon} className="w-5 h-5 text-white" />
              </div>
              <Icon name="chevronRight" className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-1 transition-all" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{kpi.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{kpi.label}</p>
          </Link>
        ))}
      </div>

      {/* Acoes rapidas */}
      <div className="mb-6">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Acoes rapidas</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {QuickActions.map(action => (
            <Link 
              key={action.label}
              href={action.href} 
              className="group relative overflow-hidden rounded-2xl p-4 bg-white border border-slate-100 hover:shadow-lg transition-all"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${action.gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />
              <div className="relative">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${action.gradient} flex items-center justify-center shadow-lg mb-3 group-hover:scale-110 group-hover:shadow-none group-hover:bg-white/20 transition-all`}>
                  <Icon name={action.icon} className="w-5 h-5 text-white" />
                </div>
                <p className="text-sm font-semibold text-slate-900 group-hover:text-white transition-colors">{action.label}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Proximas consultas */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center shadow-lg shadow-purple-200">
              <Icon name="calendar" className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Proximas consultas</p>
              <p className="text-xs text-slate-500">Agenda de hoje</p>
            </div>
          </div>
          <Link href="/dashboard/agenda" className="text-xs gradient-text font-semibold flex items-center gap-1 hover:opacity-80">
            Ver todas <Icon name="chevronRight" className="w-4 h-4" />
          </Link>
        </div>
        
        {!nextAppointments || nextAppointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mb-4">
              <Icon name="calendar" className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-600">Nenhuma consulta restante hoje</p>
            <p className="text-xs text-slate-400 mt-1">Que tal agendar uma nova?</p>
            <Link href="/dashboard/agenda/novo" className="mt-4 btn-primary inline-flex items-center gap-2 w-auto px-6">
              <Icon name="plus" className="w-4 h-4" />
              Agendar consulta
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {nextAppointments.map((apt, idx) => (
              <Link 
                key={apt.id} 
                href={`/dashboard/agenda/${apt.id}`}
                className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="w-12 text-center">
                  <p className="text-lg font-bold text-slate-900">
                    {new Date(apt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className={`w-1 h-10 rounded-full ${
                  idx === 0 ? 'gradient-bg' : 'bg-slate-200'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{apt.patients?.name}</p>
                  <p className="text-xs text-slate-500 truncate">{apt.procedures?.name || 'Consulta'}</p>
                </div>
                <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                  apt.status === 'confirmed' 
                    ? 'bg-emerald-100 text-emerald-700' 
                    : apt.status === 'scheduled'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {apt.status === 'confirmed' ? 'Confirmado' : apt.status === 'scheduled' ? 'Agendado' : apt.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
