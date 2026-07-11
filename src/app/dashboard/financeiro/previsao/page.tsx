import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PrevisaoFaturamentoView from './previsao-view'
import BackButton from '@/components/ui/BackButton'
import { getFinancialAccess } from '@/lib/financial-access'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Previsão de Faturamento | Clinike' }

export default async function PrevisaoFaturamentoPage() {
  const supabase = await createClient()
  const user = await getCachedUser()
  if (!user) redirect('/login')
  const { scope, clinicId } = await getFinancialAccess(supabase, user.id)
  // Cruza agendamentos futuros de todos os profissionais — só escopo 'all' por enquanto.
  if (scope !== 'all') redirect('/dashboard/financeiro')

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <BackButton href="/dashboard/financeiro" label="Financeiro" />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Previsão de Faturamento</h1>
        <p className="text-sm text-slate-500 mt-1">
          Receita esperada dos agendamentos futuros, caso sejam concluídos
        </p>
      </div>
      <PrevisaoFaturamentoView clinicId={clinicId ?? ''} />
    </div>
  )
}
