import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PrevisaoFaturamentoView from './previsao-view'
import BackButton from '@/components/ui/BackButton'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Previsão de Faturamento | Clinike' }

export default async function PrevisaoFaturamentoPage() {
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
        <h1 className="text-2xl font-bold text-slate-900">Previsão de Faturamento</h1>
        <p className="text-sm text-slate-500 mt-1">
          Receita esperada dos agendamentos futuros, caso sejam concluídos
        </p>
      </div>
      <PrevisaoFaturamentoView clinicId={userData.clinic_id} />
    </div>
  )
}
