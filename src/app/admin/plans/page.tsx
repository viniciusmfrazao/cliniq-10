import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/super-admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PlansList from './plans-list'


export const dynamic = 'force-dynamic'

export default async function PlansPage() {
  const isAdmin = await isSuperAdmin()
  if (!isAdmin) redirect('/dashboard')

  const supabase = await createClient()
  
  const { data: plans } = await supabase
    .from('admin_plans')
    .select('*')
    .order('price_monthly', { ascending: true })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Planos</h1>
          <p className="text-slate-500 dark:text-slate-400">
            Gerencie os planos disponíveis para as clínicas
          </p>
        </div>
        <Link
          href="/admin/plans/new"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition flex items-center gap-2"
        >
          <span>+</span>
          <span>Novo Plano</span>
        </Link>
      </div>

      <PlansList plans={plans || []} />
    </div>
  )
}
