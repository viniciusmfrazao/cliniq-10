import { isSuperAdmin } from '@/lib/super-admin'
import { createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ImportarClient from './importar-client'

export const dynamic = 'force-dynamic'

export default async function ImportarPage() {
  const ok = await isSuperAdmin()
  if (!ok) redirect('/dashboard')

  const admin = createServiceClient()
  const { data: clinics } = await admin
    .from('clinics')
    .select('id, name')
    .is('deleted_at', null)
    .order('name')

  return <ImportarClient clinics={clinics || []} />
}
