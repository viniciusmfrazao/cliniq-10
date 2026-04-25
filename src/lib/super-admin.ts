import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function isSuperAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData?.user) {
    console.warn('[isSuperAdmin] no auth user', userErr?.message)
    return false
  }
  const userId = userData.user.id

  // Caminho 1: RPC via cliente autenticado (a função SQL is_super_admin tem SECURITY DEFINER)
  const { data: rpcData, error: rpcErr } = await supabase.rpc('is_super_admin', { user_id: userId })
  if (!rpcErr && typeof rpcData === 'boolean') {
    return rpcData
  }
  if (rpcErr) console.warn('[isSuperAdmin] rpc error, falling back', rpcErr.message)

  // Caminho 2: fallback service role
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[isSuperAdmin] SUPABASE_SERVICE_ROLE_KEY ausente em runtime')
    return false
  }

  try {
    const svc = createServiceClient()
    const { data, error } = await svc
      .from('super_admins')
      .select('id')
      .eq('id', userId)
      .maybeSingle()
    if (error) {
      console.error('[isSuperAdmin] service select error', error.message)
      return false
    }
    return !!data
  } catch (e) {
    console.error('[isSuperAdmin] service client failed', e instanceof Error ? e.message : e)
    return false
  }
}

export async function getSuperAdminData() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Tenta via cliente autenticado primeiro (precisa de policy ou de ser o próprio super_admin)
  const { data: own } = await supabase
    .from('super_admins')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()
  if (own) return own

  // Fallback service role
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  try {
    const svc = createServiceClient()
    const { data } = await svc
      .from('super_admins')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
    return data
  } catch {
    return null
  }
}

export async function getAdminMetrics() {
  const serviceSupabase = createServiceClient()
  
  // Get metrics directly since admin_metrics view might not exist
  const [clinicsResult, usersResult, patientsResult, appointmentsResult, leadsResult] = await Promise.all([
    serviceSupabase.from('clinics').select('id, trial_ends_at', { count: 'exact', head: true }).is('deleted_at', null),
    serviceSupabase.from('users').select('id', { count: 'exact', head: true }).eq('active', true),
    serviceSupabase.from('patients').select('id', { count: 'exact', head: true }),
    serviceSupabase.from('appointments').select('id', { count: 'exact', head: true }).gte('start_time', new Date().toISOString().split('T')[0]),
    serviceSupabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
  ])

  // Count clinics on trial
  const { data: trialClinics } = await serviceSupabase
    .from('clinics')
    .select('id')
    .is('deleted_at', null)
    .gt('trial_ends_at', new Date().toISOString())

  return {
    total_clinics: clinicsResult.count || 0,
    clinics_on_trial: trialClinics?.length || 0,
    total_users: usersResult.count || 0,
    total_patients: patientsResult.count || 0,
    appointments_today: appointmentsResult.count || 0,
    leads_this_month: leadsResult.count || 0
  }
}

export async function getAllClinics() {
  const serviceSupabase = createServiceClient()
  
  const { data } = await serviceSupabase
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
  const serviceSupabase = createServiceClient()
  
  const { data: clinic } = await serviceSupabase
    .from('clinics')
    .select('*')
    .eq('id', clinicId)
    .single()
  
  const { data: users } = await serviceSupabase
    .from('users')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('active', true)
  
  const { count: patientsCount } = await serviceSupabase
    .from('patients')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
  
  const { count: appointmentsCount } = await serviceSupabase
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
