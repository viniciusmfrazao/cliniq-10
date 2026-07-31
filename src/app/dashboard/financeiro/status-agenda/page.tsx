import { redirect } from 'next/navigation'
import { createClient, getCachedUser } from '@/lib/supabase/server'
import BackButton from '@/components/ui/BackButton'
import { getFinancialAccess } from '@/lib/financial-access'
import StatusAgendaView from './status-agenda-view'
import RentabilidadeFiltro from '../RentabilidadeFiltro'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Status de Agenda | Clinike' }

export default async function StatusAgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; ini?: string; fim?: string }>
}) {
  const sp = await searchParams
  const supabase = await createClient()
  const user = await getCachedUser()
  if (!user) redirect('/login')
  const { scope, clinicId, userId } = await getFinancialAccess(supabase, user.id)
  if (scope === 'none') redirect('/dashboard')
  const isOwnScope = scope === 'own'

  const mesAtualStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  let ini: string
  let fim: string
  if (sp.ini && sp.fim) {
    ini = sp.ini
    fim = sp.fim
  } else {
    const mes = sp.mes || mesAtualStr
    const [y, m] = mes.split('-').map(Number)
    ini = `${mes}-01`
    fim = `${mes}-${new Date(y, m, 0).getDate()}`
  }

  let query = supabase
    .from('appointments')
    .select(`
      id,
      start_time,
      status,
      patients(name),
      professional:users!appointments_professional_id_fkey(id, name),
      procedures(name)
    `)
    .eq('clinic_id', clinicId)
    .gte('start_time', `${ini}T00:00:00`)
    .lte('start_time', `${fim}T23:59:59`)
    .order('start_time', { ascending: false })

  if (isOwnScope) {
    query = query.eq('professional_id', userId)
  }

  const { data: appointments } = await query

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <BackButton href="/dashboard/financeiro/relatorios" label="Relatórios" />
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Status de Agenda</h1>
          <p className="text-sm text-slate-500 mt-1">
            {isOwnScope ? 'Seus agendamentos do período' : 'Confirmados, cancelados, faltas e reagendamentos'}
          </p>
        </div>
        <RentabilidadeFiltro mesAtual={sp.mes || mesAtualStr} iniAtual={sp.ini} fimAtual={sp.fim} />
      </div>
      <StatusAgendaView appointments={(appointments || []) as any} />
    </div>
  )
}
