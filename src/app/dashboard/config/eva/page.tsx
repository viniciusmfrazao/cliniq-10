import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import EvaConfigForm from './eva-config-form'
import EvaCostPanel from './eva-cost-panel'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function EvaConfigPage() {
  const supabase = await createClient()
  const user = await getCachedUser()
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

  // Verificar se módulo eva_ia está ativo
  const { data: clinicCheck } = await supabase.from('clinics').select('settings').eq('id', userData.clinic_id).single()
  const activeModules: string[] = clinicCheck?.settings?.active_modules || []
  if (activeModules.length > 0 && !activeModules.includes('eva_ia')) {
    redirect('/dashboard/config')
  }

  const [clinicRes, autoRes] = await Promise.all([
    supabase.from('clinics').select('id, name, settings').eq('id', userData.clinic_id).single(),
    supabase.from('clinic_automations').select('eva_send_result_images, eva_max_result_images').eq('clinic_id', userData.clinic_id).single(),
  ])

  const clinic = clinicRes.data
  if (!clinic) redirect('/dashboard/config')

  const automations = autoRes.data

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <Link
          href="/dashboard/config"
          className="text-sm text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
        >
          <Icon name="chevronLeft" className="w-4 h-4" />
          Voltar
        </Link>
      </div>

      {/* Painel de custo */}
      <div className="card p-6">
        <EvaCostPanel clinicId={clinic.id} />
      </div>

      {/* Configurações da Eva */}
      <EvaConfigForm
        clinicId={clinic.id}
        clinicName={clinic.name}
        settings={(clinic.settings ?? {}) as Record<string, unknown>}
        evaSendResultImages={automations?.eva_send_result_images ?? false}
        evaMaxResultImages={automations?.eva_max_result_images ?? 3}
      />
    </div>
  )
}
