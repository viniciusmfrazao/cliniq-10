import { isSuperAdmin } from '@/lib/super-admin'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import ContratosAdminClient from './contratos-client'

export const dynamic = 'force-dynamic'

export default async function ContratosPage() {
  const ok = await isSuperAdmin()
  if (!ok) redirect('/dashboard')

  const svc = createServiceClient()

  const { data: clinics } = await svc
    .from('clinics')
    .select('id, name, cnpj, clinic_phone, plan, plan_price, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const { data: contracts } = await svc
    .from('platform_contracts')
    .select('id, clinic_id, status, sign_token, sent_at, viewed_at, signed_at, signer_name, created_at')
    .order('created_at', { ascending: false })

  // Pega o contrato mais recente por clínica
  const latestByClinic = new Map<string, any>()
  for (const c of contracts || []) {
    if (!latestByClinic.has(c.clinic_id)) latestByClinic.set(c.clinic_id, c)
  }

  const rows = (clinics || []).map(clinic => ({
    clinic,
    contract: latestByClinic.get(clinic.id) || null,
  }))

  return <ContratosAdminClient rows={rows} />
}
