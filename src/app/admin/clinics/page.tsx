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
    .select('id, name, slug, plan, plan_price, plan_expires_at, trial_ends_at, clinic_phone, billing_whatsapp, billing_notes, last_charge_sent_at, created_at, settings')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (clinicsError) {
    console.error('[admin/clinics] erro:', clinicsError.message, clinicsError.code)
  }

  const clinicIds = (rawClinics || []).map((c: any) => c.id)

  if (clinicIds.length === 0) {
    return <ClinicsAdminClient clinics={[]} />
  }

  // Buscar contagens por clínica individualmente (evitar truncamento do limite de 1000)
  const userCountMap: Record<string, number> = {}
  const patientCountMap: Record<string, number> = {}
  const appointmentCountMap: Record<string, number> = {}
  const atendimentoCountMap: Record<string, number> = {}

  const [adminsRes, waListRes, usersRes, lastActivityRes, ...countResults] = await Promise.all([
    svc.from('users').select('clinic_id, name, email').in('clinic_id', clinicIds).eq('role', 'admin'),
    svc.from('clinic_whatsapp').select('clinic_id, status, instance_name, is_default').in('clinic_id', clinicIds),
    svc.from('users').select('clinic_id, name, email, role').in('clinic_id', clinicIds).eq('active', true).order('name'),
    svc.rpc('admin_last_clinic_activity'),
    ...clinicIds.flatMap(id => [
      svc.from('users').select('id', { count: 'exact', head: true }).eq('clinic_id', id).eq('active', true),
      svc.from('patients').select('id', { count: 'exact', head: true }).eq('clinic_id', id),
      svc.from('appointments').select('id', { count: 'exact', head: true }).eq('clinic_id', id),
      svc.from('appointments').select('id', { count: 'exact', head: true }).eq('clinic_id', id).in('status', ['completed', 'realizado']),
    ])
  ])

  const admins = adminsRes.data
  const waList = waListRes.data
  const allClinicUsers = usersRes.data || []

  if (lastActivityRes.error) {
    console.error('[admin/clinics] erro last_activity:', lastActivityRes.error.message)
  }

  const lastActivityMap: Record<string, {
    last_activity_at: string
    action: string
    entity_type: string
    entity_name: string
    user_name: string
  }> = {}
  for (const row of (lastActivityRes.data || [] as any[])) {
    lastActivityMap[row.clinic_id] = row
  }

  clinicIds.forEach((id, i) => {
    userCountMap[id] = countResults[i * 4]?.count ?? 0
    patientCountMap[id] = countResults[i * 4 + 1]?.count ?? 0
    appointmentCountMap[id] = countResults[i * 4 + 2]?.count ?? 0
    atendimentoCountMap[id] = countResults[i * 4 + 3]?.count ?? 0
  })

  const adminMap: Record<string, { name: string; email: string }> = {}
  for (const a of (admins || [] as any[])) {
    if (!adminMap[a.clinic_id]) adminMap[a.clinic_id] = { name: a.name, email: a.email }
  }

  const usersMap: Record<string, Array<{ name: string; email: string; role: string }>> = {}
  for (const u of allClinicUsers) {
    if (!usersMap[u.clinic_id]) usersMap[u.clinic_id] = []
    usersMap[u.clinic_id].push({ name: u.name, email: u.email, role: u.role })
  }

  const waMap: Record<string, { status: string; instance: string }> = {}
  for (const w of (waList || [] as any[])) {
    if (!waMap[w.clinic_id] || w.is_default) {
      waMap[w.clinic_id] = { status: w.status, instance: w.instance_name }
    }
  }

  const enriched = (rawClinics || []).map((c: any) => ({
    ...c,
    admin: adminMap[c.id] || null,
    whatsapp: waMap[c.id] || null,
    users_count: userCountMap[c.id] || 0,
    users: usersMap[c.id] || [],
    patients_count: patientCountMap[c.id] || 0,
    appointments_count: appointmentCountMap[c.id] || 0,
    atendimentos_count: atendimentoCountMap[c.id] || 0,
    active_modules: c.settings?.active_modules || [],
    last_activity: lastActivityMap[c.id] || null,
  }))

  return <ClinicsAdminClient clinics={enriched} />
}
