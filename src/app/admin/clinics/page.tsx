import { isSuperAdmin } from '@/lib/super-admin'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import ClinicsAdminClient from './clinics-admin-client'

export const dynamic = 'force-dynamic'

export default async function ClinicsPage() {
  const ok = await isSuperAdmin()
  if (!ok) redirect('/dashboard')

  const svc = createServiceClient()
  // Diagnóstico: logar se service key estiver ausente
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) console.error('[ADMIN] SUPABASE_SERVICE_ROLE_KEY ausente!')

  // Buscar clínicas com contagens via SQL direto (evita ambiguidade do count do Supabase JS)
  const { data: clinics } = await svc.rpc('admin_get_clinics_overview') as any

  // Se RPC não existe, fallback manual
  let enriched: any[] = []
  
  if (!clinics) {
    const { data: rawClinics } = await svc
      .from('clinics')
      .select('id, name, slug, plan, plan_price, plan_expires_at, trial_ends_at, billing_whatsapp, billing_notes, last_charge_sent_at, created_at, active, settings')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    const clinicIds = (rawClinics || []).map((c: any) => c.id)

    const [{ data: admins }, { data: waList }, { data: userCounts }, { data: patientCounts }] = await Promise.all([
      svc.from('users').select('clinic_id, name, email').in('clinic_id', clinicIds).eq('role', 'admin'),
      svc.from('clinic_whatsapp').select('clinic_id, status, instance_name, is_default').in('clinic_id', clinicIds),
      svc.from('users').select('clinic_id').in('clinic_id', clinicIds).eq('active', true),
      svc.from('patients').select('clinic_id').in('clinic_id', clinicIds),
    ])

    // Contar manualmente
    const userCountMap: Record<string, number> = {}
    const patientCountMap: Record<string, number> = {}
    for (const u of (userCounts || [])) userCountMap[u.clinic_id] = (userCountMap[u.clinic_id] || 0) + 1
    for (const p of (patientCounts || [])) patientCountMap[p.clinic_id] = (patientCountMap[p.clinic_id] || 0) + 1

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

    enriched = (rawClinics || []).map((c: any) => ({
      ...c,
      admin: adminMap[c.id] || null,
      whatsapp: waMap[c.id] || null,
      users_count: userCountMap[c.id] || 0,
      patients_count: patientCountMap[c.id] || 0,
      appointments_count: 0,
      active_modules: c.settings?.active_modules || [],
    }))
  } else {
    enriched = clinics
  }

  return <ClinicsAdminClient clinics={enriched} />
}
