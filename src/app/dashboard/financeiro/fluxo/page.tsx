import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import FluxoView from './fluxo-view'

export default async function FluxoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: userData } = await supabase.from('users').select('clinic_id').eq('id', user!.id).single()
  const clinicId = userData?.clinic_id

  const year = new Date().getFullYear()

  const { data: entradas } = await supabase
    .from('entradas')
    .select('data_venda, valor_bruto, valor_liquido')
    .eq('clinic_id', clinicId)
    .gte('data_venda', `${year}-01-01`)
    .lte('data_venda', `${year}-12-31`)

  const { data: saidas } = await supabase
    .from('saidas')
    .select('data, valor, categoria_dre')
    .eq('clinic_id', clinicId)
    .gte('data', `${year}-01-01`)
    .lte('data', `${year}-12-31`)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/financeiro" className="p-2 hover:bg-slate-100 rounded-xl transition">
          <Icon name="arrowLeft" className="w-5 h-5 text-slate-500" />
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900">Fluxo de Caixa</h1>
          <p className="text-slate-500">Visão anual de entradas e saídas</p>
        </div>
      </div>

      <FluxoView 
        entradas={entradas || []} 
        saidas={saidas || []} 
        clinicId={clinicId}
        year={year}
      />
    </div>
  )
}
