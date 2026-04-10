import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

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

  // KPIs reais
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

  // Proximas consultas do dia
  const { data: nextAppointments } = await supabase
    .from('appointments')
    .select(`
      *,
      patients(name),
      procedures(name)
    `)
    .eq('clinic_id', userData?.clinic_id)
    .gte('start_time', new Date().toISOString())
    .lte('start_time', endOfDay)
    .neq('status', 'cancelled')
    .neq('status', 'completed')
    .order('start_time')
    .limit(5)

  return (
    <div className="max-w-2xl mx-auto md:max-w-none">
      {searchParams.welcome === '1' && (
        <div className="mb-6 p-4 bg-brand-600 rounded-2xl text-white">
          <p className="font-semibold text-lg">Bem-vinda ao Cliniq!</p>
          <p className="text-brand-200 text-sm mt-1">{trialDaysLeft} dias de trial gratuito.</p>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">{greeting}, {firstName}</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {trialDaysLeft <= 7 && trialDaysLeft > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-amber-800">Trial expira em {trialDaysLeft} {trialDaysLeft === 1 ? 'dia' : 'dias'}</p>
            <p className="text-xs text-amber-600 mt-0.5">Escolha um plano para continuar</p>
          </div>
          <Link href="/planos" className="bg-amber-600 text-white text-xs px-3 py-2 rounded-lg font-medium whitespace-nowrap">Ver planos</Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-6 md:grid-cols-4">
        <Link href="/dashboard/agenda" className="card p-4 hover:shadow-md transition-shadow">
          <p className="text-xs text-slate-400 font-medium">Consultas hoje</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{appointmentsToday || 0}</p>
          <p className="text-xs text-slate-400 mt-0.5">agendadas</p>
        </Link>
        <Link href="/dashboard/pacientes" className="card p-4 hover:shadow-md transition-shadow">
          <p className="text-xs text-slate-400 font-medium">Pacientes</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalPatients || 0}</p>
          <p className="text-xs text-slate-400 mt-0.5">cadastrados</p>
        </Link>
        <div className="card p-4">
          <p className="text-xs text-slate-400 font-medium">Lista de espera</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{waitingList || 0}</p>
          <p className="text-xs text-slate-400 mt-0.5">aguardando</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-400 font-medium">Estoque</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">0</p>
          <p className="text-xs text-slate-400 mt-0.5">alertas</p>
        </div>
      </div>

      <div className="mb-6">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Acoes rapidas</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Link href="/dashboard/agenda/novo" className="border rounded-xl p-4 text-sm font-medium transition-all hover:opacity-80 active:scale-95 bg-brand-50 text-brand-700 border-brand-100">
            Novo agendamento
          </Link>
          <Link href="/dashboard/pacientes/novo" className="border rounded-xl p-4 text-sm font-medium transition-all hover:opacity-80 active:scale-95 bg-emerald-50 text-emerald-700 border-emerald-100">
            Novo paciente
          </Link>
          <Link href="/dashboard/procedimentos" className="border rounded-xl p-4 text-sm font-medium transition-all hover:opacity-80 active:scale-95 bg-cyan-50 text-cyan-700 border-cyan-100">
            Procedimentos
          </Link>
          <Link href="/dashboard/eva" className="border rounded-xl p-4 text-sm font-medium transition-all hover:opacity-80 active:scale-95 bg-violet-50 text-violet-700 border-violet-100">
            Falar com Eva
          </Link>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-slate-900">Proximas consultas</p>
          <Link href="/dashboard/agenda" className="text-xs text-brand-600 font-medium">Ver agenda</Link>
        </div>
        
        {!nextAppointments || nextAppointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mb-3">
              <span className="text-slate-400 text-xl">📅</span>
            </div>
            <p className="text-sm text-slate-500">Nenhuma consulta restante hoje</p>
            <Link href="/dashboard/agenda/novo" className="mt-3 text-xs text-brand-600 font-medium">Agendar consulta</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {nextAppointments.map(apt => (
              <Link 
                key={apt.id} 
                href={`/dashboard/agenda/${apt.id}`}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{apt.patients?.name}</p>
                  <p className="text-xs text-slate-500">{apt.procedures?.name || 'Consulta'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-900">
                    {new Date(apt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    apt.status === 'confirmed' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {apt.status === 'confirmed' ? 'Confirmado' : 'Agendado'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
