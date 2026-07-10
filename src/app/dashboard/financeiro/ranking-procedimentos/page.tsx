import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RankingProcedimentosView from './ranking-view'
import BackButton from '@/components/ui/BackButton'
import { getFinancialAccess } from '@/lib/financial-access'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Ranking de Procedimentos | Clinike' }

export default async function RankingProcedimentosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { scope, clinicId } = await getFinancialAccess(supabase, user.id)
  if (scope === 'none') redirect('/dashboard')

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <BackButton href="/dashboard/financeiro" label="Financeiro" />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Ranking de Procedimentos</h1>
        <p className="text-sm text-slate-500 mt-1">Faturamento e quantidade por procedimento</p>
      </div>
      <RankingProcedimentosView clinicId={clinicId ?? ''} />
    </div>
  )
}
