import { createClient } from '@/lib/supabase/server'

export type ClinicRole = 'admin' | 'manager' | 'professional' | 'receptionist' | 'viewer'

export type CurrentUserClinic = {
  userId: string
  clinicId: string
  role: ClinicRole
}

/**
 * Resolve usuário autenticado + clínica + role.
 * Retorna null quando não autenticado ou usuário sem clínica.
 */
export async function getCurrentUserClinic(): Promise<CurrentUserClinic | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: userRow } = await supabase
    .from('users')
    .select('clinic_id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (!userRow?.clinic_id || !userRow?.role) return null

  return {
    userId: user.id,
    clinicId: userRow.clinic_id,
    role: userRow.role as ClinicRole,
  }
}

/**
 * Checa se a role é admin ou manager (pode mexer em integrações sensíveis).
 */
export function canManageIntegrations(role: ClinicRole | null | undefined): boolean {
  return role === 'admin' || role === 'manager'
}
