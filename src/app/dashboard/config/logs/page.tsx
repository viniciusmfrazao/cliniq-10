import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import LogsViewer from './logs-viewer'

export default async function LogsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('clinic_id, role')
    .eq('id', user.id)
    .single()

  if (userData?.role !== 'admin' && userData?.role !== 'super_admin') {
    redirect('/dashboard')
  }

  // Buscar logs de auditoria (se existir a tabela)
  const { data: auditLogs } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('clinic_id', userData?.clinic_id)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/config" className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
          <Icon name="chevronLeft" className="w-5 h-5 text-slate-600" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Logs do Sistema</h1>
          <p className="text-sm text-slate-500 mt-0.5">Histórico de ações e erros</p>
        </div>
      </div>

      <LogsViewer initialLogs={auditLogs || []} />
    </div>
  )
}
