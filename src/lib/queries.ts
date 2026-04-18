/**
 * Queries reutilizáveis para o Supabase
 * Evita duplicação de código e mantém consistência
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { PROFESSIONAL_ROLES } from './constants'

type SupabaseClientType = SupabaseClient<any, 'public', any>

// ============================================
// PROFISSIONAIS
// ============================================

/**
 * Busca profissionais ativos de uma clínica
 * Retorna apenas usuários com roles que podem atender pacientes
 */
export async function getProfessionals(
  supabase: SupabaseClientType,
  clinicId: string,
  options?: {
    includeInactive?: boolean
    orderBy?: 'name' | 'role' | 'created_at'
  }
) {
  const { data: allUsers, error } = await supabase
    .from('users')
    .select('id, name, role, active')
    .eq('clinic_id', clinicId)
    .order(options?.orderBy || 'name')

  if (error) {
    console.error('Erro ao buscar profissionais:', error)
    return []
  }

  // Filtra no código para evitar problemas com enum do Postgres
  return (allUsers || []).filter(user => 
    PROFESSIONAL_ROLES.includes(user.role as any) && 
    (options?.includeInactive || user.active !== false)
  )
}

/**
 * Busca um profissional específico
 */
export async function getProfessionalById(
  supabase: SupabaseClientType,
  professionalId: string
) {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, role, email, avatar_url, active')
    .eq('id', professionalId)
    .single()

  if (error) {
    console.error('Erro ao buscar profissional:', error)
    return null
  }

  return data
}

// ============================================
// PACIENTES
// ============================================

/**
 * Busca pacientes de uma clínica
 */
export async function getPatients(
  supabase: SupabaseClientType,
  clinicId: string,
  options?: {
    search?: string
    limit?: number
    offset?: number
    orderBy?: 'name' | 'created_at'
  }
) {
  let query = supabase
    .from('patients')
    .select('id, name, phone, email, cpf, birth_date, photo_url')
    .eq('clinic_id', clinicId)
    .order(options?.orderBy || 'name')

  if (options?.search) {
    query = query.or(`name.ilike.%${options.search}%,phone.ilike.%${options.search}%,cpf.ilike.%${options.search}%`)
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1)
  }

  const { data, error } = await query

  if (error) {
    console.error('Erro ao buscar pacientes:', error)
    return []
  }

  return data || []
}

/**
 * Busca um paciente específico com todas as informações
 */
export async function getPatientById(
  supabase: SupabaseClientType,
  patientId: string
) {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', patientId)
    .single()

  if (error) {
    console.error('Erro ao buscar paciente:', error)
    return null
  }

  return data
}

// ============================================
// PROCEDIMENTOS
// ============================================

/**
 * Busca procedimentos ativos de uma clínica
 */
export async function getProcedures(
  supabase: SupabaseClientType,
  clinicId: string,
  options?: {
    includeInactive?: boolean
    category?: string
  }
) {
  let query = supabase
    .from('procedures')
    .select('id, name, duration_minutes, price, category, active')
    .eq('clinic_id', clinicId)
    .order('name')

  if (!options?.includeInactive) {
    query = query.eq('active', true)
  }

  if (options?.category) {
    query = query.eq('category', options.category)
  }

  const { data, error } = await query

  if (error) {
    console.error('Erro ao buscar procedimentos:', error)
    return []
  }

  return data || []
}

// ============================================
// SALAS
// ============================================

/**
 * Busca salas ativas de uma clínica
 */
export async function getRooms(
  supabase: SupabaseClientType,
  clinicId: string,
  options?: {
    includeInactive?: boolean
  }
) {
  let query = supabase
    .from('rooms')
    .select('id, name, color, active')
    .eq('clinic_id', clinicId)
    .order('name')

  if (!options?.includeInactive) {
    query = query.eq('active', true)
  }

  const { data, error } = await query

  if (error) {
    console.error('Erro ao buscar salas:', error)
    return []
  }

  return data || []
}

// ============================================
// AGENDAMENTOS
// ============================================

/**
 * Busca agendamentos de um período
 */
export async function getAppointments(
  supabase: SupabaseClientType,
  clinicId: string,
  options: {
    startDate: string
    endDate: string
    professionalId?: string
    status?: string
    patientId?: string
  }
) {
  let query = supabase
    .from('appointments')
    .select(`
      *,
      patients(id, name, phone, photo_url, cpf, birth_date),
      procedures(name, duration_minutes, price),
      professional:users!appointments_professional_id_fkey(id, name),
      rooms(id, name, color)
    `)
    .eq('clinic_id', clinicId)
    .gte('start_time', options.startDate)
    .lte('start_time', options.endDate)
    .order('start_time')

  if (options.professionalId && options.professionalId !== 'all') {
    query = query.eq('professional_id', options.professionalId)
  }

  if (options.status && options.status !== 'all') {
    query = query.eq('status', options.status)
  }

  if (options.patientId) {
    query = query.eq('patient_id', options.patientId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Erro ao buscar agendamentos:', error)
    return []
  }

  return data || []
}

// ============================================
// USUÁRIO ATUAL
// ============================================

/**
 * Busca dados do usuário logado (inclui clinic_id)
 */
export async function getCurrentUser(supabase: SupabaseClientType) {
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null

  const { data: userData, error } = await supabase
    .from('users')
    .select('id, name, email, role, clinic_id, active, permissions')
    .eq('id', user.id)
    .single()

  if (error) {
    console.error('Erro ao buscar usuário:', error)
    return null
  }

  return userData
}

/**
 * Verifica se o usuário atual é admin
 */
export async function isCurrentUserAdmin(supabase: SupabaseClientType) {
  const user = await getCurrentUser(supabase)
  return user?.role === 'admin'
}

// ============================================
// CLÍNICA
// ============================================

/**
 * Busca dados da clínica
 */
export async function getClinic(
  supabase: SupabaseClientType,
  clinicId: string
) {
  const { data, error } = await supabase
    .from('clinics')
    .select('*')
    .eq('id', clinicId)
    .single()

  if (error) {
    console.error('Erro ao buscar clínica:', error)
    return null
  }

  return data
}

/**
 * Busca módulos ativos da clínica
 */
export async function getClinicActiveModules(
  supabase: SupabaseClientType,
  clinicId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('clinics')
    .select('settings')
    .eq('id', clinicId)
    .single()

  if (error || !data) {
    return []
  }

  return data.settings?.active_modules || []
}
