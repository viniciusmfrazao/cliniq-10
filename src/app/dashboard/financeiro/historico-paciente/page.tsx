import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import HistoricoPacienteView from './historico-view'

export default async function HistoricoPacientePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: userData } = await supabase.from('users').select('clinic_id').eq('id', user!.id).single()
  const clinicId = userData?.clinic_id

  const { data: entradas } = await supabase
    .from('entradas')
    .select('paciente_id, paciente_nome, valor_bruto, valor_liquido, data_venda, procedimento_nome')
    .eq('clinic_id', clinicId)
    .order('data_venda', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/financeiro" className="p-2 hover:bg-slate-100 rounded-xl transition">
          <Icon name="arrowLeft" className="w-5 h-5 text-slate-500" />
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900">Histórico do Paciente</h1>
          <p className="text-slate-500">Ranking de pacientes por faturamento</p>
        </div>
      </div>

      <HistoricoPacienteView entradas={entradas || []} />
    </div>
  )
}
