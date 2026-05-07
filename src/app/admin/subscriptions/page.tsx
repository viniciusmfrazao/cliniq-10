import { isSuperAdmin } from '@/lib/super-admin'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type ClinicRow = {
  id: string
  name: string
  slug: string | null
  plan: string | null
  trial_ends_at: string | null
  created_at: string
  active: boolean | null
}

export default async function AdminSubscriptionsPage() {
  const ok = await isSuperAdmin()
  if (!ok) redirect('/dashboard')

  const svc = createServiceClient()
  const { data } = await svc
    .from('clinics')
    .select('id, name, slug, plan, trial_ends_at, created_at, active')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const clinics = (data as ClinicRow[] | null) ?? []

  const now = Date.now()
  const buckets = {
    trial: clinics.filter(
      (c) => c.trial_ends_at && new Date(c.trial_ends_at).getTime() > now,
    ),
    paying: clinics.filter(
      (c) =>
        c.plan &&
        c.plan !== 'starter' &&
        (!c.trial_ends_at || new Date(c.trial_ends_at).getTime() <= now),
    ),
    expired: clinics.filter(
      (c) =>
        c.trial_ends_at &&
        new Date(c.trial_ends_at).getTime() <= now &&
        (!c.plan || c.plan === 'starter'),
    ),
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Assinaturas</h1>
        <p className="text-slate-500 dark:text-slate-400">
          Status comercial das clínicas (trial, plano ativo, expirado)
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl p-5">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Em Trial</p>
          <p className="text-3xl font-bold text-amber-900 dark:text-amber-200 mt-1">
            {buckets.trial.length}
          </p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl p-5">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Pagantes</p>
          <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-200 mt-1">
            {buckets.paying.length}
          </p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl p-5">
          <p className="text-sm font-medium text-red-700 dark:text-red-400">Trial expirado</p>
          <p className="text-3xl font-bold text-red-900 dark:text-red-200 mt-1">
            {buckets.expired.length}
          </p>
        </div>
      </div>

      <Section
        title="Em Trial"
        description="Clínicas dentro do período de avaliação"
        clinics={buckets.trial}
        showDaysLeft
      />
      <Section
        title="Pagantes"
        description="Clínicas com plano ativo (professional, enterprise...)"
        clinics={buckets.paying}
      />
      <Section
        title="Trial expirado"
        description="Trial venceu sem upgrade — risco de churn"
        clinics={buckets.expired}
      />
    </div>
  )
}

function Section({
  title,
  description,
  clinics,
  showDaysLeft,
}: {
  title: string
  description: string
  clinics: ClinicRow[]
  showDaysLeft?: boolean
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
        <p className="text-sm text-slate-500">{description}</p>
      </div>

      {clinics.length === 0 ? (
        <p className="text-slate-500 text-center py-4 text-sm">Nenhuma clínica nesta categoria</p>
      ) : (
        <div className="space-y-2">
          {clinics.map((c) => {
            const daysLeft = c.trial_ends_at
              ? Math.ceil(
                  (new Date(c.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
                )
              : 0

            return (
              <Link
                key={c.id}
                href={`/admin/clinics/${c.id}`}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition"
              >
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">{c.name}</p>
                  <p className="text-xs text-slate-500">
                    Plano: <strong>{c.plan || 'starter'}</strong> • Cadastro:{' '}
                    {new Date(c.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="text-right">
                  {showDaysLeft && c.trial_ends_at && (
                    <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-1 rounded-full">
                      {daysLeft > 0 ? `${daysLeft}d restantes` : 'Expirado'}
                    </span>
                  )}
                  {!showDaysLeft && c.plan && c.plan !== 'starter' && (
                    <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-1 rounded-full uppercase">
                      {c.plan}
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
