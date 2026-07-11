import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PrevisaoRecebimentoView from './previsao-recebimento-view'
import BackButton from '@/components/ui/BackButton'
import { getFinancialAccess } from '@/lib/financial-access'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Recebíveis Futuros | Clinike' }

export default async function PrevisaoRecebimentoPage() {
  const supabase = await createClient()
  const user = await getCachedUser()
  if (!user) redirect('/login')
  const { scope, clinicId } = await getFinancialAccess(supabase, user.id)
  if (scope === 'none') redirect('/dashboard')

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <BackButton href="/dashboard/financeiro" label="Financeiro" />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Recebíveis Futuros</h1>
        <p className="text-sm text-slate-500 mt-1">
          Parcelas de vendas já realizadas que ainda vão cair no caixa, líquidas de taxa
        </p>
      </div>
      <PrevisaoRecebimentoView clinicId={clinicId ?? ''} />
    </div>
  )
}
