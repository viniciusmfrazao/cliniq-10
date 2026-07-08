import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PrevisaoRecebimentoView from './previsao-recebimento-view'
import BackButton from '@/components/ui/BackButton'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Previsão de Recebimento | Clinike' }

export default async function PrevisaoRecebimentoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: userData } = await supabase.from('users').select('clinic_id, role').eq('id', user.id).single()
  if (!userData?.clinic_id) redirect('/dashboard')
  if (!['admin', 'super_admin', 'manager', 'financial'].includes(userData.role || '')) redirect('/dashboard')

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <BackButton href="/dashboard/financeiro" label="Financeiro" />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Previsão de Recebimento</h1>
        <p className="text-sm text-slate-500 mt-1">
          Parcelas de vendas já realizadas que ainda vão cair no caixa, líquidas de taxa
        </p>
      </div>
      <PrevisaoRecebimentoView clinicId={userData.clinic_id} />
    </div>
  )
}
