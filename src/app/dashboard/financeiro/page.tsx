import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { formatBRL, formatBRLCompact } from '@/lib/format'
import { todayBR, startOfMonthBR, endOfMonthBR, parseDateBR } from '@/lib/datetime'

function fmt(v: number) { return formatBRL(v || 0) }
function fmtCompact(v: number) { return formatBRLCompact(v || 0) }

export default async function FinanceiroPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: userData } = await supabase.from('users').select('clinic_id, role').eq('id', user!.id).single()
  const clinicId = userData?.clinic_id
  if (!['admin','super_admin','manager','financial'].includes(userData?.role || '')) redirect('/dashboard')

  const todayStr = todayBR()
  const startOfMonth = startOfMonthBR().slice(0, 10)
  const endOfMonth = endOfMonthBR().slice(0, 10)

  const { data: entradasHoje } = await supabase
    .from('entradas')
    .select('valor_bruto, valor_liquido')
    .eq('clinic_id', clinicId)
    .eq('data_venda', todayStr)

  const { data: entradasMes } = await supabase
    .from('entradas')
    .select('valor_bruto, valor_liquido')
    .eq('clinic_id', clinicId)
    .gte('data_venda', startOfMonth)
    .lte('data_venda', endOfMonth)

  // Saídas do mês: apenas pagas (pago=true) até hoje — exclui futuros agendados
  const { data: saidasMes } = await supabase
    .from('saidas')
    .select('valor')
    .eq('clinic_id', clinicId)
    .eq('pago', true)
    .gte('data', startOfMonth)
    .lte('data', todayStr)

  const { data: ultimasEntradas } = await supabase
    .from('entradas')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('data_venda', { ascending: false })
    .limit(5)

  // Últimas saídas: apenas pagas e até hoje — sem futuros agendados
  const { data: ultimasSaidas } = await supabase
    .from('saidas')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('pago', true)
    .lte('data', todayStr)
    .order('data', { ascending: false })
    .limit(5)

  const receitaHoje   = entradasHoje?.reduce((s, e) => s + Number(e.valor_bruto  || 0), 0) || 0
  const receitaMes    = entradasMes?.reduce((s, e)  => s + Number(e.valor_bruto  || 0), 0) || 0
  const liquidoMes    = entradasMes?.reduce((s, e)  => s + Number(e.valor_liquido|| 0), 0) || 0
  const despesasMes   = saidasMes?.reduce((s, d)    => s + Number(d.valor        || 0), 0) || 0
  const resultadoMes  = liquidoMes - despesasMes
  const ticketMedio   = entradasMes?.length ? liquidoMes / entradasMes.length : 0

  const mesLabel = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900">Financeiro</h1>
          <p className="text-slate-500 capitalize">{mesLabel}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/financeiro/entradas/nova"
            className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-emerald-700 transition"
          >
            <Icon name="plus" className="w-5 h-5" />
            Nova Entrada
          </Link>
          <Link
            href="/dashboard/financeiro/saidas/nova"
            className="inline-flex items-center gap-2 bg-rose-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-rose-700 transition"
          >
            <Icon name="minus" className="w-5 h-5" />
            Nova Saída
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-100 shadow-sm min-w-0">
          <div className="flex items-center gap-3 mb-2 md:mb-3">
            <div className="w-9 h-9 md:w-10 md:h-10 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Icon name="trendingUp" className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <p className="text-lg md:text-2xl font-black text-slate-900 truncate" title={fmt(receitaHoje)}>
            <span className="md:hidden">{fmtCompact(receitaHoje)}</span>
            <span className="hidden md:inline">{fmt(receitaHoje)}</span>
          </p>
          <p className="text-xs md:text-sm text-slate-500 truncate">Receita bruta hoje</p>
        </div>

        <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-100 shadow-sm min-w-0">
          <div className="flex items-center gap-3 mb-2 md:mb-3">
            <div className="w-9 h-9 md:w-10 md:h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Icon name="dollarSign" className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <p className="text-lg md:text-2xl font-black text-slate-900 truncate" title={fmt(receitaMes)}>
            <span className="md:hidden">{fmtCompact(receitaMes)}</span>
            <span className="hidden md:inline">{fmt(receitaMes)}</span>
          </p>
          <p className="text-xs md:text-sm text-slate-500 truncate">Receita bruta do mês</p>
        </div>

        <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-100 shadow-sm min-w-0">
          <div className="flex items-center gap-3 mb-2 md:mb-3">
            <div className="w-9 h-9 md:w-10 md:h-10 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Icon name="activity" className="w-5 h-5 text-violet-600" />
            </div>
          </div>
          <p className="text-lg md:text-2xl font-black text-slate-900 truncate" title={fmt(liquidoMes)}>
            <span className="md:hidden">{fmtCompact(liquidoMes)}</span>
            <span className="hidden md:inline">{fmt(liquidoMes)}</span>
          </p>
          <p className="text-xs md:text-sm text-slate-500 truncate">Líquido do mês</p>
        </div>

        <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-100 shadow-sm min-w-0">
          <div className="flex items-center gap-3 mb-2 md:mb-3">
            <div className="w-9 h-9 md:w-10 md:h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Icon name="receipt" className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <p className="text-lg md:text-2xl font-black text-slate-900 truncate" title={fmt(ticketMedio)}>
            <span className="md:hidden">{fmtCompact(ticketMedio)}</span>
            <span className="hidden md:inline">{fmt(ticketMedio)}</span>
          </p>
          <p className="text-xs md:text-sm text-slate-500 truncate">Ticket médio</p>
        </div>

        <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-100 shadow-sm min-w-0">
          <div className="flex items-center gap-3 mb-2 md:mb-3">
            <div className="w-9 h-9 md:w-10 md:h-10 bg-rose-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Icon name="trendingDown" className="w-5 h-5 text-rose-600" />
            </div>
          </div>
          <p className="text-lg md:text-2xl font-black text-slate-900 truncate" title={fmt(despesasMes)}>
            <span className="md:hidden">{fmtCompact(despesasMes)}</span>
            <span className="hidden md:inline">{fmt(despesasMes)}</span>
          </p>
          <p className="text-xs md:text-sm text-slate-500 truncate">Saídas do mês</p>
        </div>

        <div className={`rounded-2xl p-4 md:p-5 border shadow-sm min-w-0 ${resultadoMes >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
          <div className="flex items-center gap-3 mb-2 md:mb-3">
            <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${resultadoMes >= 0 ? 'bg-emerald-200' : 'bg-rose-200'}`}>
              <Icon name={resultadoMes >= 0 ? 'trendingUp' : 'trendingDown'} className={`w-5 h-5 ${resultadoMes >= 0 ? 'text-emerald-700' : 'text-rose-700'}`} />
            </div>
          </div>
          <p className={`text-lg md:text-2xl font-black truncate ${resultadoMes >= 0 ? 'text-emerald-700' : 'text-rose-700'}`} title={fmt(resultadoMes)}>
            <span className="md:hidden">{fmtCompact(resultadoMes)}</span>
            <span className="hidden md:inline">{fmt(resultadoMes)}</span>
          </p>
          <p className={`text-xs md:text-sm truncate ${resultadoMes >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>Lucro operacional</p>
        </div>
      </div>

      {/* Atalhos */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Link href="/dashboard/financeiro/devedores" className="bg-white rounded-xl p-4 border border-rose-200 shadow-sm hover:border-rose-300 hover:shadow-md transition group flex items-center gap-3">
          <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center group-hover:bg-rose-200 transition">
            <Icon name="dollarSign" className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">Devedores</p>
            <p className="text-xs text-slate-500">Em aberto</p>
          </div>
        </Link>

        <Link href="/dashboard/financeiro/fluxo" className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm hover:border-blue-200 hover:shadow-md transition group flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition">
            <Icon name="activity" className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">Fluxo de Caixa</p>
            <p className="text-xs text-slate-500">Visão anual</p>
          </div>
        </Link>

        <Link href="/dashboard/financeiro/rankings" className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm hover:border-violet-200 hover:shadow-md transition group flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center group-hover:bg-violet-200 transition">
            <Icon name="barChart" className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">Rankings</p>
            <p className="text-xs text-slate-500">Pacientes e procedimentos</p>
          </div>
        </Link>

        <Link href="/dashboard/financeiro/metas" className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm hover:border-pink-200 hover:shadow-md transition group flex items-center gap-3">
          <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center group-hover:bg-pink-200 transition">
            <Icon name="target" className="w-5 h-5 text-pink-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">Metas</p>
            <p className="text-xs text-slate-500">Mensal</p>
          </div>
        </Link>

        <Link href="/dashboard/financeiro/dre" className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm hover:border-violet-200 hover:shadow-md transition group flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center group-hover:bg-violet-200 transition">
            <Icon name="pieChart" className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">DRE</p>
            <p className="text-xs text-slate-500">Resultado mensal</p>
          </div>
        </Link>
      </div>

      {/* Últimas movimentações */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <Icon name="trendingUp" className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Últimas entradas</h3>
                <p className="text-xs text-slate-500">Receitas recentes</p>
              </div>
            </div>
            <Link href="/dashboard/financeiro/entradas" className="text-sm text-emerald-600 font-semibold">
              Ver todas
            </Link>
          </div>
          {!ultimasEntradas?.length ? (
            <div className="p-8 text-center">
              <p className="text-slate-500">Nenhuma entrada registrada</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {ultimasEntradas.map((e: any) => (
                <div key={e.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium text-slate-900">{e.paciente_nome || 'Paciente'}</p>
                    <p className="text-sm text-slate-500">
                      {e.procedimento_nome || 'Procedimento'} • {parseDateBR(e.data_venda)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-600">{fmt(e.valor_bruto)}</p>
                    <p className="text-xs text-slate-500">{e.forma_pagamento}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
                <Icon name="trendingDown" className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Últimas saídas</h3>
                <p className="text-xs text-slate-500">Despesas pagas até hoje</p>
              </div>
            </div>
            <Link href="/dashboard/financeiro/saidas" className="text-sm text-rose-600 font-semibold">
              Ver todas
            </Link>
          </div>
          {!ultimasSaidas?.length ? (
            <div className="p-8 text-center">
              <p className="text-slate-500">Nenhuma saída registrada</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {ultimasSaidas.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium text-slate-900">{s.descricao}</p>
                    <p className="text-sm text-slate-500">
                      {s.categoria_dre || 'Sem categoria'} • {parseDateBR(s.data)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-rose-600">-{fmt(s.valor)}</p>
                    <p className="text-xs text-slate-500">{s.forma_pagamento || 'N/A'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
