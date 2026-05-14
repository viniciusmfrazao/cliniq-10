import BackButton from '@/components/ui/BackButton'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import SaidaForm from './saida-form'

export default async function NovaSaidaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: userData } = await supabase.from('users').select('clinic_id').eq('id', user!.id).single()
  const clinicId = userData?.clinic_id

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/financeiro/saidas" className="p-2 hover:bg-slate-100 rounded-xl transition">
          <Icon name="arrowLeft" className="w-5 h-5 text-slate-500" />
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900">Nova Saída</h1>
          <p className="text-slate-500">Registre uma nova despesa</p>
        </div>
      </div>

      <SaidaForm clinicId={clinicId} userId={user!.id} />
    </div>
  )
}
