import { createClient } from '@/lib/supabase/server'

export async function isSuperAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return false
  
  const { data } = await supabase
    .from('super_admins')
    .select('id')
    .eq('id', user.id)
    .single()
  
  return !!data
}

export async function getSuperAdminData() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null
  
  const { data } = await supabase
    .from('super_admins')
    .select('*')
    .eq('id', user.id)
    .single()
  
  return data
}

export async function getAdminMetrics() {
  const supabase = await createClient()
  
  const { data } = await supabase
    .from('admin_metrics')
    .select('*')
    .single()
  
  return data
}

export async function getAllClinics() {
  const supabase = await createClient()
  
  const { data } = await supabase
    .from('clinics')
    .select(`
      *,
      users:users(count),
      patients:patients(count),
      appointments:appointments(count)
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  
  return data
}

export async function getClinicDetails(clinicId: string) {
  const supabase = await createClient()
  
  const { data: clinic } = await supabase
    .from('clinics')
    .select('*')
    .eq('id', clinicId)
    .single()
  
  const { data: users } = await supabase
    .from('users')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('active', true)
  
  const { count: patientsCount } = await supabase
    .from('patients')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
  
  const { count: appointmentsCount } = await supabase
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
  
  return {
    clinic,
    users,
    stats: {
      patients: patientsCount || 0,
      appointments: appointmentsCount || 0,
      users: users?.length || 0
    }
  }
}

export async function createClinic(data: {
  name: string
  cnpj?: string
  slug: string
  plan?: 'starter' | 'professional' | 'enterprise'
  adminEmail: string
  adminName: string
  adminPassword: string
}) {
  const supabase = await createClient()
  
  // 1. Create the clinic
  const { data: clinic, error: clinicError } = await supabase
    .from('clinics')
    .insert({
      name: data.name,
      cnpj: data.cnpj,
      slug: data.slug,
      plan: data.plan || 'starter',
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    })
    .select()
    .single()
  
  if (clinicError) throw clinicError
  
  // 2. Create auth user for admin
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: data.adminEmail,
    password: data.adminPassword,
    email_confirm: true
  })
  
  if (authError) {
    // Rollback clinic creation
    await supabase.from('clinics').delete().eq('id', clinic.id)
    throw authError
  }
  
  // 3. Create user record
  const { error: userError } = await supabase
    .from('users')
    .insert({
      id: authData.user.id,
      clinic_id: clinic.id,
      name: data.adminName,
      email: data.adminEmail,
      role: 'admin'
    })
  
  if (userError) {
    await supabase.from('clinics').delete().eq('id', clinic.id)
    throw userError
  }
  
  return clinic
}
