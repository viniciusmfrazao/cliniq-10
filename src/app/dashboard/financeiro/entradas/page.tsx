import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import EntradasList from './entradas-list'

export default async function EntradasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: userData } = await supabase.from('users').select('clinic_id').eq('id', user!.id).single()
  const clinicId = userData?.clinic_id

  const { data: entradas } = await supabase
    .from('entradas')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('data_venda', { ascending: false })
    .limit(100)

  const { data: pacientes } = await supabase
    .from('patients')
    .select('id, name')
    .eq('clinic_id', clinicId)
    .order('name')

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/financeiro" className="p-2 hover:bg-slate-100 rounded-xl transition">
            <Icon name="arrowLeft" className="w-5 h-5 text-slate-500" />
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900">Entradas</h1>
            <p className="text-slate-500">Gerencie as receitas da clínica</p>
          </div>
        </div>
        <Link
          href="/dashboard/financeiro/entradas/nova"
          className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-emerald-700 transition"
        >
          <Icon name="plus" className="w-5 h-5" />
          Nova Entrada
        </Link>
      </div>

      <EntradasList 
        entradas={entradas || []}
        pacientes={pacientes || []}
        procedimentos={procedimentos || []}
        profissionais={profissionais || []}
        clinicId={clinicId}
      />
    </div>
  )
}
