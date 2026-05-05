import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import {
  EDITABLE_ROLES,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  FACTORY_DEFAULTS,
  ALL_PERMISSION_IDS,
} from '@/lib/permissions'

export const dynamic = 'force-dynamic'

type DefaultRow = { role: string; permissions: string[] }

const ROLE_ICON: Record<string, string> = {
  doctor: '🩺',
  biomedic: '💉',
  nurse: '💊',
  esthetician: '✨',
  physiotherapist: '🤸',
  nutritionist: '🥗',
  psychologist: '🧠',
  receptionist: '📞',
  financial: '💰',
  manager: '👔',
  assistant: '🙋',
  viewer: '👀',
}

export default async function RolePermissionsPage() {
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

  const { data: defaults } = await supabase
    .from('clinic_role_defaults')
    .select('role, permissions')
    .eq('clinic_id', me.clinic_id)

  const defaultsMap = new Map<string, string[]>()
  for (const d of (defaults as DefaultRow[] | null) ?? []) {
    defaultsMap.set(d.role, d.permissions || [])
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href="/dashboard/config"
          className="text-sm text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
        >
          <Icon name="chevronLeft" className="w-4 h-4" />
          Voltar
        </Link>
        <h1 className="text-xl font-bold text-slate-900 mt-2">Permissões por papel</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Defina o que cada papel pode acessar por padrão. Membros novos cadastrados na equipe
          herdam essas permissões automaticamente.
        </p>
      </div>

      <div className="card p-4 bg-violet-50 border border-violet-100">
        <p className="text-xs text-violet-900">
          💡 <strong>Dica:</strong> permissões individuais editadas em
          <Link href="/dashboard/equipe" className="underline ml-1">Equipe</Link> sobrescrevem
          esses padrões. Use esta tela só pra definir o "ponto de partida" de cada cargo.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {EDITABLE_ROLES.map((role) => {
          const stored = defaultsMap.get(role)
          const usingFactory = stored === undefined
          const perms = stored ?? FACTORY_DEFAULTS[role] ?? []
          const hasAll = perms.includes('all')
          const count = hasAll ? ALL_PERMISSION_IDS.length : perms.length

          return (
            <Link
              key={role}
              href={`/dashboard/config/permissoes/${role}`}
              className="card p-5 hover:border-violet-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="text-3xl flex-shrink-0">{ROLE_ICON[role] || '👤'}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 group-hover:text-violet-700 transition-colors">
                    {ROLE_LABELS[role] || role}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                    {ROLE_DESCRIPTIONS[role] || ''}
                  </p>
                </div>
                <Icon
                  name="chevronRight"
                  className="w-4 h-4 text-slate-300 group-hover:text-violet-500 transition-colors flex-shrink-0"
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <span
                  className={`px-2 py-1 rounded-md font-medium ${
                    hasAll
                      ? 'bg-violet-100 text-violet-700'
                      : count > 0
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {hasAll ? 'Acesso total' : `${count} permissões`}
                </span>
                {usingFactory ? (
                  <span className="text-slate-400">Padrão de fábrica</span>
                ) : (
                  <span className="text-violet-600 font-medium">Customizado</span>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
