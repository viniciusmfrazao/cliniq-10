import { createClient } from '@/lib/supabase/server'

export type ClinicRole =
  | 'admin'
  | 'super_admin'
  | 'manager'
  | 'professional'
  | 'receptionist'
  | 'viewer'

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
 * Checa se a role pode mexer em integrações sensíveis (WhatsApp, Evolution, etc).
 * super_admin tem acesso a tudo, sempre.
 */
export function canManageIntegrations(role: ClinicRole | string | null | undefined): boolean {
  return role === 'admin' || role === 'manager' || role === 'super_admin'
}

/**
 * Checa se a role pode gerenciar equipe e configuracoes da clinica.
 */
export function canManageClinic(role: ClinicRole | string | null | undefined): boolean {
  return role === 'admin' || role === 'super_admin'
}

/**
 * Checa se a role tem acesso amplo (admin/super_admin) — pra UI tipo
 * banners, paineis financeiros etc.
 */
export function isClinicAdmin(role: ClinicRole | string | null | undefined): boolean {
  return role === 'admin' || role === 'super_admin'
}
