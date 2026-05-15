import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EvaConfigForm from './eva-config-form'
import EvaCostPanel from './eva-cost-panel'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function EvaConfigPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('clinic_id, role')
    .eq('id', user.id)
    .single()

  if (!userData?.clinic_id) redirect('/dashboard/config')
  if (userData.role !== 'admin' && userData.role !== 'super_admin') {
    redirect('/dashboard/config')
  }

  const { data: clinic } = await supabase
    .from('clinics')
    .select('id, name, settings')
    .eq('id', userData.clinic_id)
    .single()

  if (!clinic) redirect('/dashboard/config')

  return (
    <div className="space-y-6">
      {/* Painel de custo */}
      <div className="card p-6">
        <EvaCostPanel clinicId={clinic.id} />
      </div>

      {/* Configurações da Eva */}
      <EvaConfigForm
        clinicId={clinic.id}
        clinicName={clinic.name}
        settings={(clinic.settings ?? {}) as Record<string, unknown>}
      />
    </div>
  )
}
