import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import BancosForm from './bancos-form'

export default async function BancosPage() {
  const supabase = await createClient()
  const user = await getCachedUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users').select('clinic_id, role').eq('id', user.id).single()

  if (!['admin', 'super_admin', 'manager', 'financial'].includes(userData?.role || ''))
    redirect('/dashboard')

  const { data: bancos } = await supabase
    .from('contas_bancarias')
    .select('*')
    .eq('clinic_id', userData!.clinic_id)
    .order('nome')

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-6">
        <Link
          href="/dashboard/config"
          className="text-sm text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
        >
          <Icon name="chevronLeft" className="w-4 h-4" />
          Voltar
        </Link>
      </div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Bancos / Contas</h1>
        <p className="text-slate-500 mt-1">
          Cadastre os bancos e contas usados pela clínica, pra manter o lançamento de saídas padronizado.
        </p>
      </div>
      <BancosForm clinicId={userData!.clinic_id} initialBancos={bancos || []} />
    </div>
  )
}
