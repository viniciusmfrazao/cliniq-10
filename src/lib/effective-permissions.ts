import type { SupabaseClient } from '@supabase/supabase-js'
import { FACTORY_DEFAULTS, type PermissionId } from './permissions'

export type EffectiveAccess = {
  permissions: string[]
  hasAll: boolean
  clinicId: string | undefined
  role: string
  userId: string
}

/**
 * Resolve a lista efetiva de permissoes do usuario logado:
 *  1. Override individual (users.permissions), se existir
 *  2. Default do papel na clinica (clinic_role_defaults), se existir
 *  3. FACTORY_DEFAULTS do papel, como ultimo fallback
 *
 * admin/super_admin sempre tem acesso total (hasAll=true).
 */
export async function getEffectiveAccess(
  supabase: SupabaseClient,
  userId: string,
): Promise<EffectiveAccess> {
  const { data: me } = await supabase
    .from('users')
    .select('clinic_id, role, permissions')
    .eq('id', userId)
    .maybeSingle()

  const clinicId = me?.clinic_id ?? undefined
  const role = me?.role ?? ''

  if (role === 'admin' || role === 'super_admin') {
    return { permissions: ['all'], hasAll: true, clinicId, role, userId }
  }

  let effective: string[] | null = Array.isArray(me?.permissions)
    ? (me!.permissions as string[])
    : null

  if (!effective && clinicId) {
    const { data: roleDefault } = await supabase
      .from('clinic_role_defaults')
      .select('permissions')
      .eq('clinic_id', clinicId)
      .eq('role', role)
      .maybeSingle()

    effective = Array.isArray(roleDefault?.permissions)
      ? (roleDefault!.permissions as string[])
      : FACTORY_DEFAULTS[role] ?? []
  }

  effective = effective ?? []
  const hasAll = effective.includes('all')

  return { permissions: effective, hasAll, clinicId, role, userId }
}

export function can(access: EffectiveAccess, permission: PermissionId): boolean {
  return access.hasAll || access.permissions.includes(permission)
}
