import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import LgpdExport from './lgpd-export'

export default async function LgpdPage() {
  const supabase = await createClient()
  const user = await getCachedUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('clinic_id, role')
    .eq('id', user.id)
    .single()

  if (!['admin', 'super_admin'].includes(userData?.role || '')) redirect('/dashboard')

  const { data: clinic } = await supabase
    .from('clinics')
    .select('name')
    .eq('id', userData!.clinic_id)
    .single()

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
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Privacidade e LGPD</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Exporte os dados da sua clínica em conformidade com a Lei Geral de Proteção de Dados.
        </p>
      </div>
      <LgpdExport clinicId={userData!.clinic_id} clinicName={clinic?.name || 'clinika'} />
    </div>
  )
}
