import { isSuperAdmin } from '@/lib/super-admin'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import AdminConfigClient from './admin-config-client'

export const dynamic = 'force-dynamic'

export default async function AdminConfigPage() {
  const ok = await isSuperAdmin()
  if (!ok) redirect('/dashboard')

  const svc = createServiceClient()

  const { data: settings } = await svc
    .from('app_settings')
    .select('key, value')
    .in('key', [
      'clinike_billing_instance',
      'clinike_billing_from_number',
      'clinike_pix_key',
      'clinike_pix_name',
      'clinike_pix_city',
      'evolution_url',
      'evolution_master_key',
    ])

  const cfg: Record<string, string> = {}
  for (const s of (settings || [])) cfg[s.key] = s.value

  // Buscar todas as instâncias (conectadas e desconectadas)
  const { data: instancesRaw } = await svc
    .from('clinic_whatsapp')
    .select('instance_name, status, clinic_id, phone_number')
    .order('instance_name')

  const clinicIds = [...new Set((instancesRaw || []).map((i: any) => i.clinic_id))]
  const { data: clinicNames } = await svc
    .from('clinics').select('id, name').in('id', clinicIds)
  const clinicNameMap: Record<string, string> = {}
  for (const c of (clinicNames || [])) clinicNameMap[c.id] = c.name

  const instances = (instancesRaw || []).map((i: any) => ({
    ...i,
    clinic_name: clinicNameMap[i.clinic_id] || i.clinic_id,
  }))

  return <AdminConfigClient config={cfg} instances={instances} />
}
