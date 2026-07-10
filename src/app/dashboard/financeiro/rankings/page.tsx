import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BackButton from '@/components/ui/BackButton'
import RankingsView from './rankings-view'
import { getFinancialAccess } from '@/lib/financial-access'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Rankings | Clinike' }

export default async function RankingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { scope, clinicId } = await getFinancialAccess(supabase, user.id)
  if (scope === 'none') redirect('/dashboard')

  const { data: entradas } = await supabase
    .from('entradas')
    .select('paciente_id, paciente_nome, procedimento_nome, valor_bruto, valor_liquido, data_venda, forma_pagamento')
    .eq('clinic_id', clinicId)
    .order('data_venda', { ascending: false })

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <BackButton href="/dashboard/financeiro" label="Financeiro" />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Rankings</h1>
        <p className="text-sm text-slate-500 mt-1">Pacientes e procedimentos por faturamento</p>
      </div>
      <RankingsView entradas={entradas || []} />
    </div>
  )
}
