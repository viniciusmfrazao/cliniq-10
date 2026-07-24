import BackButton from '@/components/ui/BackButton'
import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAllPatients } from '@/lib/queries'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import EntradaForm from './entrada-form'

export default async function NovaEntradaPage() {
  const supabase = await createClient()
  const user = await getCachedUser()
  if (!user) redirect('/login')
  const { data: userData } = await supabase.from('users').select('clinic_id').eq('id', user.id).single()
  const clinicId = userData?.clinic_id

  const pacientes = await getAllPatients<{ id: string; name: string }>(
    supabase,
    clinicId,
    'id, name'
  )

  const { data: procedimentos } = await supabase
    .from('procedures')
    .select('id, name, price')
    .eq('clinic_id', clinicId)
    .eq('active', true)
    .order('name')

  const { data: profissionais } = await supabase
    .from('users')
    .select('id, name')
    .eq('clinic_id', clinicId)
    .in('role', ['doctor', 'esthetician', 'admin'])
    .order('name')

  const { data: taxasPagamento } = await supabase
    .from('taxas_pagamento')
    .select('forma, bandeira, taxa_percentual')
    .eq('clinic_id', clinicId)

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/financeiro/entradas" className="p-2 hover:bg-slate-100 rounded-xl transition">
          <Icon name="arrowLeft" className="w-5 h-5 text-slate-500" />
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900">Nova Entrada</h1>
          <p className="text-slate-500">Registre uma nova receita</p>
        </div>
      </div>

      <EntradaForm
        pacientes={pacientes || []}
        procedimentos={procedimentos || []}
        profissionais={profissionais || []}
        taxasPagamento={taxasPagamento || []}
        clinicId={clinicId}
        userId={user.id}
      />
    </div>
  )
}
