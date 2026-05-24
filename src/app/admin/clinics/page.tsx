import { isSuperAdmin } from '@/lib/super-admin'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import ClinicsAdminClient from './clinics-admin-client'

export const dynamic = 'force-dynamic'

export default async function ClinicsPage() {
  const ok = await isSuperAdmin()
  if (!ok) redirect('/dashboard')

  const svc = createServiceClient()

  const { data: rawClinics, error: clinicsError } = await svc
    .from('clinics')
    .select('id, name, slug, plan, plan_price, plan_expires_at, trial_ends_at, billing_whatsapp, billing_notes, last_charge_sent_at, created_at, settings')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (clinicsError) {
    console.error('[admin/clinics] erro:', clinicsError.message, clinicsError.code)
  }

  const clinicIds = (rawClinics || []).map((c: any) => c.id)

  if (clinicIds.length === 0) {
    return <ClinicsAdminClient clinics={[]} />
  }

  const [
    { data: admins },
    { data: waList },
    { data: allUsers },
    { data: allPatients },
  ] = await Promise.all([
    svc.from('users').select('clinic_id, name, email').in('clinic_id', clinicIds).eq('role', 'admin'),
    svc.from('clinic_whatsapp').select('clinic_id, status, instance_name, is_default').in('clinic_id', clinicIds),
    svc.from('users').select('clinic_id, id').in('clinic_id', clinicIds).eq('active', true),
    svc.from('patients').select('clinic_id, id').in('clinic_id', clinicIds),
  ])

  // Contar por clínica
  const userCountMap: Record<string, number> = {}
  const patientCountMap: Record<string, number> = {}
  for (const u of (allUsers || [])) userCountMap[u.clinic_id] = (userCountMap[u.clinic_id] || 0) + 1
  for (const p of (allPatients || [])) patientCountMap[p.clinic_id] = (patientCountMap[p.clinic_id] || 0) + 1

  const adminMap: Record<string, { name: string; email: string }> = {}
  for (const a of (admins || [])) {
    if (!adminMap[a.clinic_id]) adminMap[a.clinic_id] = { name: a.name, email: a.email }
  }

  const waMap: Record<string, { status: string; instance: string }> = {}
  for (const w of (waList || [])) {
    if (!waMap[w.clinic_id] || w.is_default) {
      waMap[w.clinic_id] = { status: w.status, instance: w.instance_name }
    }
  }

  const enriched = (rawClinics || []).map((c: any) => ({
    ...c,
    admin: adminMap[c.id] || null,
    whatsapp: waMap[c.id] || null,
    users_count: userCountMap[c.id] || 0,
    patients_count: patientCountMap[c.id] || 0,
    appointments_count: 0,
    active_modules: c.settings?.active_modules || [],
  }))

  return <ClinicsAdminClient clinics={enriched} />
}
