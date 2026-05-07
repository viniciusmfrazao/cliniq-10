import { createClient } from '@/lib/supabase/server'
import { getAllPatients } from '@/lib/queries'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import DevedoresList from './devedores-list'

export default async function DevedoresPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: userData } = await supabase.from('users').select('clinic_id').eq('id', user!.id).single()
  const clinicId = userData?.clinic_id

  // Buscar débitos pendentes (entradas com status pendente)
  const { data: debitos } = await supabase
    .from('debitos')
    .select('*, patients(name, phone)')
    .eq('clinic_id', clinicId)
    .eq('status', 'pendente')
    .order('data_vencimento', { ascending: true })

  const pacientes = await getAllPatients<{ id: string; name: string; phone: string | null }>(
    supabase,
    clinicId,
    'id, name, phone'
  )

  // Calcular totais
  const totalPendente = debitos?.reduce((sum, d) => sum + Number(d.valor || 0), 0) || 0
  const totalVencido = debitos?.filter(d => new Date(d.data_vencimento) < new Date()).reduce((sum, d) => sum + Number(d.valor || 0), 0) || 0
  const qtdDevedores = new Set(debitos?.map(d => d.paciente_id)).size

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/financeiro" className="text-slate-400 hover:text-slate-600">
              <Icon name="arrowLeft" className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Devedores</h1>
          </div>
          <p className="text-slate-500 mt-1">Pacientes com débitos pendentes</p>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
              <Icon name="dollarSign" className="w-5 h-5 text-rose-600" />
            </div>
          </div>
          <p className="text-2xl font-black text-rose-600">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPendente)}
          </p>
          <p className="text-sm text-slate-500">Total em aberto</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <Icon name="clock" className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-600">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalVencido)}
          </p>
          <p className="text-sm text-slate-500">Vencidos</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
              <Icon name="users" className="w-5 h-5 text-slate-600" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900">{qtdDevedores}</p>
          <p className="text-sm text-slate-500">Pacientes devedores</p>
        </div>
      </div>

      {/* Lista de devedores */}
      <DevedoresList 
        debitos={debitos || []} 
        pacientes={pacientes || []}
        clinicId={clinicId || ''}
      />
    </div>
  )
}
