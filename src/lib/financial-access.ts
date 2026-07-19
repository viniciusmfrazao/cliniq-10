import type { SupabaseClient } from '@supabase/supabase-js'
import { FACTORY_DEFAULTS } from './permissions'

export type FinancialScope = 'all' | 'own' | 'none'

export type FinancialAccess = {
  scope: FinancialScope
  clinicId: string | undefined
  userId: string
}

/**
 * Resolve o escopo de acesso financeiro do usuario logado:
 *  - 'all'  -> ve financeiro completo da clinica
 *  - 'own'  -> ve apenas as entradas em que e o profissional (profissional_id)
 *  - 'none' -> sem acesso a area financeira
 *
 * A restricao "de verdade" (o que realmente filtra linhas de `entradas`/
 * `saidas`) vive no RLS do Supabase (fn_financial_scope). Este helper serve
 * pra decidir redirecionamentos e adaptar a UI nas paginas server-side —
 * ele espelha a mesma logica do banco.
 */
export async function getFinancialAccess(
  supabase: SupabaseClient,
  userId: string,
): Promise<FinancialAccess> {
  const { data: me } = await supabase
    .from('users')
    .select('clinic_id, role, permissions, recebe_comissao')
    .eq('id', userId)
    .maybeSingle()

  const clinicId = me?.clinic_id ?? undefined
  const role = me?.role ?? ''

  if (role === 'admin' || role === 'super_admin') {
    return { scope: 'all', clinicId, userId }
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

  // "Ver financeiro" pra papel clínico não é um default fixo — só faz sentido pra quem
  // realmente recebe comissão. Injeta com base no dado real do profissional (ver mesma
  // lógica em dashboard/layout.tsx e na função fn_financial_scope() do banco).
  if (me?.recebe_comissao && !effective.includes('financial_view_own')) {
    effective = [...effective, 'financial_view_own']
  }

  if (
    effective.includes('all') ||
    effective.includes('financial_view_all') ||
    effective.includes('financial_view') // legado, pre-migracao
  ) {
    return { scope: 'all', clinicId, userId }
  }

  if (effective.includes('financial_view_own')) {
    return { scope: 'own', clinicId, userId }
  }

  return { scope: 'none', clinicId, userId }
}
