import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import AuditList from './audit-list'

export default async function AuditoriaPage() {
  const supabase = await createClient()
  const user = await getCachedUser()
  if (!user) redirect('/login')

  const { data: currentUser } = await supabase
    .from('users')
    .select('role, clinic_id')
    .eq('id', user.id)
    .single()

  // Apenas admin/super_admin pode ver auditoria
  if (currentUser?.role !== 'admin' && currentUser?.role !== 'super_admin') {
    redirect('/dashboard')
  }

  // Buscar logs de auditoria
  const { data: logs } = await supabase
    .from('audit_logs')
    .select(`
      *,
      user:users(name, email)
    `)
    .eq('clinic_id', currentUser.clinic_id)
    .order('created_at', { ascending: false })
    .limit(500)

  // Buscar usuários para filtro
  const { data: users } = await supabase
    .from('users')
    .select('id, name')
    .eq('clinic_id', currentUser.clinic_id)

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-sm text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
        >
          <Icon name="chevronLeft" className="w-4 h-4" />
          Voltar
        </Link>
      </div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Auditoria</h1>
        <p className="text-sm text-slate-500 mt-0.5">Histórico de ações no sistema</p>
      </div>

      <AuditList logs={logs || []} users={users || []} />
    </div>
  )
}
