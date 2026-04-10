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

  return (
    <div className="max-w-2xl mx-auto md:max-w-none">

      {searchParams.welcome === '1' && (
        <div className="mb-6 p-4 bg-brand-600 rounded-2xl text-white">
          <p className="font-semibold text-lg">Bem-vinda ao Cliniq! 🎉</p>
          <p className="text-brand-200 text-sm mt-1">Sua clínica está configurada. {trialDaysLeft} dias de trial gratuito.</p>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">{greeting}, {firstName} 👋</h1>
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
        {[
          { label: 'Consultas hoje', value: '0', sub: 'agendadas' },
          { label: 'Pacientes', value: '0', sub: 'cadastrados' },
          { label: 'WhatsApp', value: '0', sub: 'conversas abertas' },
          { label: 'Estoque', value: '0', sub: 'alertas' },
        ].map(k => (
          <div key={k.label} className="card p-4">
            <p className="text-xs text-slate-400 font-medium">{k.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{k.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="mb-6">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Ações rápidas</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: 'Novo agendamento', href: '/dashboard/agenda', color: 'bg-brand-50 text-brand-700 border-brand-100' },
            { label: 'Novo paciente',    href: '/dashboard/pacientes', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
            { label: 'Abrir prontuário', href: '/dashboard/prontuario', color: 'bg-cyan-50 text-cyan-700 border-cyan-100' },
            { label: 'Falar com Eva',    href: '/dashboard/eva', color: 'bg-violet-50 text-violet-700 border-violet-100' },
          ].map(a => (
            <Link key={a.href} href={a.href} className={`border rounded-xl p-4 text-sm font-medium transition-all hover:opacity-80 active:scale-95 ${a.color}`}>
              {a.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-slate-900">Agenda de hoje</p>
          <Link href="/dashboard/agenda" className="text-xs text-brand-600 font-medium">Ver tudo</Link>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mb-3">
            <span className="text-slate-400 text-xl">📅</span>
          </div>
          <p className="text-sm text-slate-500">Nenhuma consulta hoje</p>
          <Link href="/dashboard/agenda" className="mt-3 text-xs text-brand-600 font-medium">Agendar consulta</Link>
        </div>
      </div>

    </div>
  )
}
