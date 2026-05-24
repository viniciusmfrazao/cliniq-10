import { isSuperAdmin } from '@/lib/super-admin'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import ClinicsAdminClient from './clinics-admin-client'

export const dynamic = 'force-dynamic'

export default async function ClinicsPage() {
  const ok = await isSuperAdmin()
  if (!ok) redirect('/dashboard')

  const svc = createServiceClient()

  const { data: clinics } = await svc
    .from('clinics')
    .select(`
      id, name, slug, plan, plan_price, plan_expires_at, trial_ends_at,
      billing_whatsapp, billing_notes, last_charge_sent_at,
      created_at, active, settings,
      users:users(count),
      patients:patients(count),
      appointments:appointments(count)
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  // Buscar admin de cada clínica
  const clinicIds = (clinics || []).map((c: any) => c.id)
  const { data: admins } = await svc
    .from('users')
    .select('clinic_id, name, email')
    .in('clinic_id', clinicIds)
    .eq('role', 'admin')

  // Buscar status WhatsApp
  const { data: waList } = await svc
    .from('clinic_whatsapp')
    .select('clinic_id, status, instance_name, is_default')
    .in('clinic_id', clinicIds)

  // Montar mapa de admins e WhatsApp por clínica
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

  const enriched = (clinics || []).map((c: any) => ({
    ...c,
    admin: adminMap[c.id] || null,
    whatsapp: waMap[c.id] || null,
    users_count: c.users?.[0]?.count || 0,
    patients_count: c.patients?.[0]?.count || 0,
    appointments_count: c.appointments?.[0]?.count || 0,
    active_modules: c.settings?.active_modules || [],
  }))

  return <ClinicsAdminClient clinics={enriched} />
}
