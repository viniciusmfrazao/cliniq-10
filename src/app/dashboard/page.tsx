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
    { label: 'Consultas hoje', value: appointmentsToday || 0, icon: 'calendar', href: '/dashboard/agenda' },
    { label: 'Pacientes', value: totalPatients || 0, icon: 'users', href: '/dashboard/pacientes' },
    { label: 'Lista de espera', value: waitingList || 0, icon: 'clock', href: '#' },
    { label: 'Estoque', value: 0, icon: 'box', href: '/dashboard/estoque' },
  ]

  const QuickActions = [
    { label: 'Novo agendamento', href: '/dashboard/agenda/novo', icon: 'calendar' },
    { label: 'Novo paciente', href: '/dashboard/pacientes/novo', icon: 'userPlus' },
    { label: 'Procedimentos', href: '/dashboard/procedimentos', icon: 'clipboard' },
    { label: 'Eva IA', href: '/dashboard/eva', icon: 'sparkles' },
  ]

  return (
    <div className="max-w-2xl mx-auto md:max-w-none">
      {searchParams.welcome === '1' && (
        <div className="mb-8 p-6 gradient-bg rounded-3xl text-white relative overflow-hidden animate-slide-up">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center animate-float">
                <Icon name="sparkles" className="w-6 h-6" />
              </div>
              <div>
                <p className="font-black text-xl">Bem-vinda ao Cliniq!</p>
                <p className="text-white/70 text-sm">{trialDaysLeft} dias de trial gratuito</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8 animate-slide-up" style={{ animationDelay: '100ms' }}>
        <h1 className="text-3xl font-black text-slate-900">
          {greeting}, <span className="gradient-text">{firstName}</span> 👋
        </h1>
        <p className="text-slate-500 mt-2 font-medium">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {trialDaysLeft <= 7 && trialDaysLeft > 0 && !searchParams.welcome && (
        <div className="mb-8 p-5 rounded-3xl bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 border-2 border-amber-200 flex items-center justify-between animate-slide-up" style={{ animationDelay: '150ms' }}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg animate-float">
              <Icon name="zap" className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-bold text-amber-900">Trial expira em {trialDaysLeft} {trialDaysLeft === 1 ? 'dia' : 'dias'}</p>
              <p className="text-sm text-amber-700">Escolha um plano para continuar</p>
            </div>
          </div>
          <Link href="/planos" className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm px-6 py-3 rounded-2xl font-bold shadow-lg hover:opacity-90 transition-all">
            Ver planos
          </Link>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 mb-8 md:grid-cols-4">
        {KPIs.map((kpi, idx) => (
          <Link 
            key={kpi.label} 
            href={kpi.href} 
            className="card card-shine p-5 group animate-slide-up"
            style={{ animationDelay: `${200 + idx * 50}ms` }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl gradient-bg flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                <Icon name={kpi.icon} className="w-6 h-6 text-white" />
              </div>
              <Icon name="arrowRight" className="w-5 h-5 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-1 transition-all" />
            </div>
            <p className="text-3xl font-black text-slate-900">{kpi.value}</p>
            <p className="text-sm text-slate-500 font-medium mt-1">{kpi.label}</p>
          </Link>
        ))}
      </div>

      {/* Acoes rapidas */}
      <div className="mb-8 animate-slide-up" style={{ animationDelay: '400ms' }}>
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Acoes rapidas</p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {QuickActions.map((action, idx) => (
            <Link 
              key={action.label}
              href={action.href} 
              className="group card card-shine p-5 relative overflow-hidden"
            >
              <div className="absolute inset-0 gradient-bg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl gradient-bg flex items-center justify-center shadow-lg mb-4 group-hover:bg-white/20 group-hover:shadow-none transition-all duration-300">
                  <Icon name={action.icon} className="w-6 h-6 text-white" />
                </div>
                <p className="font-bold text-slate-900 group-hover:text-white transition-colors duration-300">{action.label}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Proximas consultas */}
      <div className="card overflow-hidden animate-slide-up" style={{ animationDelay: '500ms' }}>
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl gradient-bg flex items-center justify-center shadow-lg">
              <Icon name="calendar" className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-bold text-slate-900">Proximas consultas</p>
              <p className="text-sm text-slate-500">Agenda de hoje</p>
            </div>
          </div>
          <Link href="/dashboard/agenda" className="gradient-text font-bold text-sm flex items-center gap-1 hover:opacity-80">
            Ver todas <Icon name="arrowRight" className="w-4 h-4" />
          </Link>
        </div>
        
        {!nextAppointments || nextAppointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-3xl gradient-bg flex items-center justify-center mb-6 animate-float opacity-50">
              <Icon name="calendar" className="w-10 h-10 text-white" />
            </div>
            <p className="font-bold text-slate-600 text-lg">Nenhuma consulta restante</p>
            <p className="text-sm text-slate-400 mt-2">Que tal agendar uma nova?</p>
            <Link href="/dashboard/agenda/novo" className="btn-primary w-auto px-8 mt-6 inline-flex items-center gap-2">
              <Icon name="plus" className="w-5 h-5" />
              Agendar consulta
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {nextAppointments.map((apt, idx) => (
              <Link 
                key={apt.id} 
                href={`/dashboard/atendimento/${apt.id}`}
                className="flex items-center gap-5 p-5 hover:bg-slate-50 transition-colors group"
              >
                <div className="w-14 text-center">
                  <p className="text-xl font-black text-slate-900">
                    {new Date(apt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className={`w-1.5 h-12 rounded-full transition-all duration-300 ${
                  idx === 0 ? 'gradient-bg shadow-lg' : 'bg-slate-200 group-hover:bg-slate-300'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 truncate">{apt.patients?.name}</p>
                  <p className="text-sm text-slate-500 truncate">{apt.procedures?.name || 'Consulta'}</p>
                </div>
                <span className={`text-xs px-4 py-2 rounded-xl font-bold ${
                  apt.status === 'confirmed' 
                    ? 'bg-emerald-100 text-emerald-700' 
                    : apt.status === 'scheduled'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {apt.status === 'confirmed' ? 'Confirmado' : apt.status === 'scheduled' ? 'Agendado' : apt.status}
                </span>
                <Icon name="chevronRight" className="w-5 h-5 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-1 transition-all" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
