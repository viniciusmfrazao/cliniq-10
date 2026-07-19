import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import ComissoesForm from './comissoes-form'

export const dynamic = 'force-dynamic'

export default async function ComissoesPage() {
  const supabase = await createClient()
  const user = await getCachedUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users').select('clinic_id, role').eq('id', user.id).single()

  if (!['admin', 'super_admin'].includes(userData?.role || '')) redirect('/dashboard')

  const { data: clinic } = await supabase
    .from('clinics')
    .select('id, settings')
    .eq('id', userData!.clinic_id)
    .single()

  const { data: profissionais } = await supabase
    .from('users')
    .select('id, name, role, professional_role, recebe_comissao, comissao_percentual')
    .eq('clinic_id', userData!.clinic_id)
    .eq('active', true)
    .not('professional_role', 'is', null)
    .order('name')

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
        <h1 className="text-2xl font-bold text-slate-900">Comissões</h1>
        <p className="text-slate-500 mt-1">
          Defina se a clínica trabalha com comissão e o percentual de cada profissional.
        </p>
      </div>
      <ComissoesForm
        clinicId={userData!.clinic_id}
        initialAtiva={!!clinic?.settings?.comissao_ativa}
        profissionais={profissionais || []}
      />
    </div>
  )
}
