import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, getCachedUser } from '@/lib/supabase/server'
import Icon from '@/components/ui/Icon'
import BackButton from '@/components/ui/BackButton'
import { getFinancialAccess } from '@/lib/financial-access'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Relatórios | Clinike' }

type ReportCard = {
  href: string
  icon: string
  iconBg: string
  iconColor: string
  title: string
  description: string
  ownScope?: boolean // se true, aparece também pra quem tem escopo 'own'
}

const REPORTS: ReportCard[] = [
  {
    href: '/dashboard/financeiro/dre',
    icon: 'pieChart',
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-600',
    title: 'DRE',
    description: 'Resultado mensal detalhado',
  },
  {
    href: '/dashboard/financeiro/fluxo',
    icon: 'activity',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    title: 'Faturamento x Despesas',
    description: 'Visão anual por competência (data da venda)',
  },
  {
    href: '/dashboard/financeiro/rankings',
    icon: 'barChart',
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-600',
    title: 'Rankings',
    description: 'Pacientes e procedimentos por faturamento',
    ownScope: true,
  },
  {
    href: '/dashboard/financeiro/previsao',
    icon: 'trendingUp',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    title: 'Previsão de Faturamento',
    description: 'Baseada nos agendamentos futuros',
  },
  {
    href: '/dashboard/financeiro/previsao-recebimento',
    icon: 'dollarSign',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    title: 'Recebíveis Futuros',
    description: 'Parcelas a cair no caixa',
  },
  {
    href: '/dashboard/financeiro/status-agenda',
    icon: 'calendar',
    iconBg: 'bg-pink-100',
    iconColor: 'text-pink-600',
    title: 'Status de Agenda',
    description: 'Confirmados, cancelados, faltas e reagendamentos do mês',
    ownScope: true,
  },
]

export default async function RelatoriosPage() {
  const supabase = await createClient()
  const user = await getCachedUser()
  if (!user) redirect('/login')
  const { scope } = await getFinancialAccess(supabase, user.id)
  if (scope === 'none') redirect('/dashboard')
  const isOwnScope = scope === 'own'

  const visibleReports = REPORTS.filter((r) => !isOwnScope || r.ownScope)

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <BackButton href="/dashboard/financeiro" label="Financeiro" />
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-black text-slate-900">Relatórios</h1>
        <p className="text-slate-500">
          {isOwnScope ? 'Seus atendimentos e agenda' : 'Análises e histórico financeiro da clínica'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleReports.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:border-violet-200 hover:shadow-md transition group flex items-start gap-4"
          >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${r.iconBg} group-hover:scale-105 transition`}>
              <Icon name={r.icon as any} className={`w-5 h-5 ${r.iconColor}`} />
            </div>
            <div>
              <p className="font-bold text-slate-900">{r.title}</p>
              <p className="text-sm text-slate-500 mt-0.5">{r.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
