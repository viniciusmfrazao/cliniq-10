import { redirect } from 'next/navigation'
import { createClient, getCachedUser } from '@/lib/supabase/server'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import MetasView from './metas-view'
import { startOfMonthBR, endOfMonthBR } from '@/lib/datetime'
import { getFinancialAccess } from '@/lib/financial-access'

// Segunda-feira da semana que contém `date`.
function mondayOf(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

export default async function MetasPage() {
  const supabase = await createClient()
  const user = await getCachedUser()
  if (!user) redirect('/login')
  const { scope, clinicId } = await getFinancialAccess(supabase, user.id)
  if (scope === 'none') redirect('/dashboard')

  const now = new Date()
  const startOfMonth = startOfMonthBR().slice(0, 10)
  const endOfMonth = endOfMonthBR().slice(0, 10)
  const currentMonth = startOfMonth.slice(0, 7)
  const currentWeekStart = mondayOf(now)

  const [{ data: metas }, { data: entradas }, { data: procedures }, { data: profissionais }, { data: novosPacientesMes }] = await Promise.all([
    supabase
      .from('metas_config')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('periodo_inicio', { ascending: false })
      .limit(60),
    supabase
      .from('entradas')
      .select('data_venda, valor_liquido, procedimento_id, profissional_id')
      .eq('clinic_id', clinicId)
      .gte('data_venda', startOfMonth)
      .lte('data_venda', endOfMonth),
    supabase
      .from('procedures')
      .select('id, name')
      .eq('clinic_id', clinicId)
      .eq('active', true)
      .order('name'),
    supabase
      .from('users')
      .select('id, name')
      .eq('clinic_id', clinicId)
      .order('name'),
    supabase
      .from('patients')
      .select('id, created_at')
      .eq('clinic_id', clinicId)
      .gte('created_at', startOfMonth)
      .lte('created_at', endOfMonth + 'T23:59:59'),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/financeiro" className="p-2 hover:bg-slate-100 rounded-xl transition">
          <Icon name="arrowLeft" className="w-5 h-5 text-slate-500" />
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900">Metas</h1>
          <p className="text-slate-500">
            {scope === 'own'
              ? 'Sua receita comparada à meta da clínica'
              : 'Defina e acompanhe metas mensais e semanais'}
          </p>
        </div>
      </div>

      <MetasView
        metas={metas || []}
        entradas={entradas || []}
        novosPacientesCount={novosPacientesMes?.length || 0}
        procedures={procedures || []}
        profissionais={profissionais || []}
        clinicId={clinicId ?? ''}
        currentMonth={currentMonth}
        currentWeekStart={currentWeekStart}
      />
    </div>
  )
}
