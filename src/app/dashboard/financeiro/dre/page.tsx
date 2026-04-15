import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import DreView from './dre-view'

export default async function DrePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: userData } = await supabase.from('users').select('clinic_id').eq('id', user!.id).single()
  const clinicId = userData?.clinic_id

  const today = new Date()
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]

  const { data: entradas } = await supabase
    .from('entradas')
    .select('data_venda, valor_bruto, valor_liquido, valor_taxa, forma_pagamento')
    .eq('clinic_id', clinicId)
    .gte('data_venda', startOfMonth)
    .lte('data_venda', endOfMonth)

  const { data: saidas } = await supabase
    .from('saidas')
    .select('data, valor, categoria_dre')
    .eq('clinic_id', clinicId)
    .gte('data', startOfMonth)
    .lte('data', endOfMonth)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/financeiro" className="p-2 hover:bg-slate-100 rounded-xl transition">
          <Icon name="arrowLeft" className="w-5 h-5 text-slate-500" />
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900">DRE</h1>
          <p className="text-slate-500">Demonstração do Resultado do Exercício</p>
        </div>
      </div>

      <DreView 
        entradas={entradas || []} 
        saidas={saidas || []} 
        clinicId={clinicId} 
      />
    </div>
  )
}
