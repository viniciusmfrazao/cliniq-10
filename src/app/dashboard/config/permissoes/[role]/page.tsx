import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { EDITABLE_ROLES, ROLE_LABELS, FACTORY_DEFAULTS } from '@/lib/permissions'
import RoleDefaultsForm from './role-defaults-form'

export const dynamic = 'force-dynamic'

type Params = { role: string }

export default async function RoleDefaultsPage({ params }: { params: Promise<Params> }) {
  const { role } = await params

  if (!EDITABLE_ROLES.includes(role)) {
    notFound()
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase
    .from('users')
    .select('clinic_id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (!me?.clinic_id) redirect('/dashboard')
  if (!['admin', 'super_admin'].includes(me.role)) {
    redirect('/dashboard/config')
  }

  const { data: existing } = await supabase
    .from('clinic_role_defaults')
    .select('permissions')
    .eq('clinic_id', me.clinic_id)
    .eq('role', role)
    .maybeSingle()

  const isCustom = existing !== null
  const initialPermissions =
    (existing?.permissions as string[] | undefined) ??
    FACTORY_DEFAULTS[role] ??
    []

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-24">
      <div>
        <Link
          href="/dashboard/config/permissoes"
          className="text-sm text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
        >
          <Icon name="chevronLeft" className="w-4 h-4" />
          Voltar
        </Link>
        <h1 className="text-xl font-bold text-slate-900 mt-2">
          Permissões padrão · {ROLE_LABELS[role] || role}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Define o que esse papel acessa quando um membro novo é cadastrado. Edições individuais em Equipe sobrescrevem isso.
        </p>
      </div>

      <RoleDefaultsForm
        role={role}
        initialPermissions={initialPermissions}
        isCustom={isCustom}
      />
    </div>
  )
}
