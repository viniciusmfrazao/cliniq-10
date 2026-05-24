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
    .in('key', ['clinike_billing_instance', 'clinike_billing_from_number'])

  const cfg: Record<string, string> = {}
  for (const s of (settings || [])) cfg[s.key] = s.value

  // Buscar instâncias conectadas disponíveis
  const { data: instances } = await svc
    .from('clinic_whatsapp')
    .select('instance_name, status, clinic_id')
    .eq('status', 'connected')
    .order('instance_name')

  return <AdminConfigClient config={cfg} instances={instances || []} />
}
