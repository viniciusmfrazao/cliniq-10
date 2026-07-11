import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import CopyLinkButton from './copy-button'

export default async function AnamnesesPage() {
  const supabase = await createClient()
  const user = await getCachedUser()
  
  if (!user) redirect('/login')
  
  const { data: userData } = await supabase
    .from('users')
    .select('clinic_id')
    .eq('id', user.id)
    .single()
  
  if (!userData?.clinic_id) redirect('/login')
  
  let anamneses: any[] = []
  try {
    const { data } = await supabase
      .from('anamneses')
      .select('*, patients(name, phone)')
      .eq('clinic_id', userData.clinic_id)
      .order('created_at', { ascending: false })
      .limit(50)
    anamneses = data || []
  } catch {
    anamneses = []
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 text-xs rounded-full bg-amber-100 text-amber-700">Pendente</span>
      case 'viewed':
        return <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">Visualizado</span>
      case 'completed':
        return <span className="px-2 py-1 text-xs rounded-full bg-emerald-100 text-emerald-700">Preenchido</span>
      case 'expired':
        return <span className="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-500">Expirado</span>
      default:
        return <span className="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-500">{status}</span>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Fichas de Anamnese</h1>
          <p className="text-slate-500 dark:text-slate-400">Gerencie as fichas de anamnese dos pacientes</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/anamnese/configurar"
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <Icon name="settings" className="w-4 h-4" />
            Configurar
          </Link>
          <Link
            href="/dashboard/anamnese/enviar"
            className="btn-primary flex items-center gap-2"
          >
            <Icon name="plus" className="w-4 h-4" />
            Enviar Anamnese
          </Link>
        </div>
      </div>

      <div className="card overflow-hidden">
        {!anamneses || anamneses.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
              <Icon name="file" className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Nenhuma ficha enviada</h3>
            <p className="text-sm text-slate-500 mb-4">Envie sua primeira ficha de anamnese para um paciente</p>
            <Link href="/dashboard/anamnese/enviar" className="btn-primary inline-flex items-center gap-2">
              <Icon name="plus" className="w-4 h-4" />
              Enviar Anamnese
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700">
                <th className="text-left py-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-sm">Paciente</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-sm">Status</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-sm">Enviado em</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-sm">Preenchido em</th>
                <th className="text-right py-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-sm">Ações</th>
              </tr>
            </thead>
            <tbody>
              {anamneses.map((a: any) => (
                <tr key={a.id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="py-3 px-4">
                    <p className="font-medium text-slate-900 dark:text-white">{a.patients?.name || '-'}</p>
                    <p className="text-xs text-slate-500">{a.patients?.phone || '-'}</p>
                  </td>
                  <td className="py-3 px-4">{getStatusBadge(a.status)}</td>
                  <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">
                    {new Date(a.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">
                    {a.completed_at ? new Date(a.completed_at).toLocaleDateString('pt-BR') : '-'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {a.status === 'completed' ? (
                      <Link
                        href={`/dashboard/anamnese/${a.id}?return=${encodeURIComponent('/dashboard/anamnese')}`}
                        className="text-[var(--color-primary)] hover:underline text-sm font-medium"
                      >
                        Ver respostas
                      </Link>
                    ) : (
                      <CopyLinkButton token={a.token} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
