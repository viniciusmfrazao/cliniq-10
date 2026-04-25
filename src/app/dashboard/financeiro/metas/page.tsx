import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import MetasView from './metas-view'
import { startOfMonthBR, endOfMonthBR } from '@/lib/datetime'

export default async function MetasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: userData } = await supabase.from('users').select('clinic_id').eq('id', user!.id).single()
  const clinicId = userData?.clinic_id

  // Mes corrente no fuso de Brasilia
  const startOfMonth = startOfMonthBR().slice(0, 10)
  const endOfMonth = endOfMonthBR().slice(0, 10)
  const currentMonth = startOfMonth.slice(0, 7)

  const { data: metas } = await supabase
    .from('metas_financeiras')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('mes', { ascending: false })
    .limit(12)

  const { data: entradas } = await supabase
    .from('entradas')
    .select('data_venda, valor_liquido, procedimento_nome')
    .eq('clinic_id', clinicId)
    .gte('data_venda', startOfMonth)
    .lte('data_venda', endOfMonth)

  const receitaMesAtual = entradas?.reduce((s, e) => s + Number(e.valor_liquido || 0), 0) || 0
  const atendimentosMesAtual = entradas?.length || 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/financeiro" className="p-2 hover:bg-slate-100 rounded-xl transition">
          <Icon name="arrowLeft" className="w-5 h-5 text-slate-500" />
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900">Metas</h1>
          <p className="text-slate-500">Defina e acompanhe suas metas mensais</p>
        </div>
      </div>

      <MetasView 
        metas={metas || []} 
        receitaMesAtual={receitaMesAtual}
        atendimentosMesAtual={atendimentosMesAtual}
        clinicId={clinicId}
        currentMonth={currentMonth}
      />
    </div>
  )
}
