import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import SaidasList from './saidas-list'

export default async function SaidasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: userData } = await supabase.from('users').select('clinic_id, role').eq('id', user!.id).single()
  if (!['admin','super_admin','manager','financial'].includes(userData?.role || '')) redirect('/dashboard')
  const clinicId = userData?.clinic_id

  const { data: saidas } = await supabase
    .from('saidas')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('data', { ascending: false })
    .limit(100)

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/financeiro" className="p-2 hover:bg-slate-100 rounded-xl transition">
            <Icon name="arrowLeft" className="w-5 h-5 text-slate-500" />
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900">Saídas</h1>
            <p className="text-slate-500">Gerencie as despesas da clínica</p>
          </div>
        </div>
        <Link
          href="/dashboard/financeiro/saidas/nova"
          className="inline-flex items-center gap-2 bg-rose-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-rose-700 transition"
        >
          <Icon name="plus" className="w-5 h-5" />
          Nova Saída
        </Link>
      </div>

      <SaidasList saidas={saidas || []} clinicId={clinicId} />
    </div>
  )
}
