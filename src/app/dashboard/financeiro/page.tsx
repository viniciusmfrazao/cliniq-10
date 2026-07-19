import { redirect } from 'next/navigation'
import { createClient, getCachedUser } from '@/lib/supabase/server'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { formatBRL, formatBRLCompact } from '@/lib/format'
import { todayBR, startOfMonthBR, endOfMonthBR, parseDateBR } from '@/lib/datetime'
import { getFinancialAccess } from '@/lib/financial-access'
import RentabilidadeFiltro from './RentabilidadeFiltro'
import RentabilidadeTendenciaChart from './RentabilidadeTendenciaChart'

function fmt(v: number) { return formatBRL(v || 0) }
function fmtCompact(v: number) { return formatBRLCompact(v || 0) }

type RentabilidadeRow = {
  receita: number
  cmv: number
  lucro_bruto: number
  margem_pct: number
  fixos: number
  fixos_por_atendimento: number
  lucro_operacional: number
  atendimentos: number
}

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; ini?: string; fim?: string }>
}) {
  const sp = await searchParams
  const supabase = await createClient()
  const user = await getCachedUser()
  if (!user) redirect('/login')
  const { scope, clinicId } = await getFinancialAccess(supabase, user.id)
  if (scope === 'none') redirect('/dashboard')
  const isOwnScope = scope === 'own'

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
  // (escopo 'own' não vê saídas — RLS já bloqueia, então nem consultamos)
  const { data: saidasMes } = isOwnScope
    ? { data: [] as { valor: number }[] }
    : await supabase
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
  const { data: ultimasSaidas } = isOwnScope
    ? { data: [] as any[] }
    : await supabase
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

  // --- Rentabilidade (receita − estoque consumido, sem depender de vínculo com atendimento) ---
  const mesAtualStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const mesFiltro = sp.ini && sp.fim ? '' : (sp.mes || mesAtualStr)
  let rentIni: string
  let rentFim: string
  if (sp.ini && sp.fim) {
    rentIni = sp.ini
    rentFim = sp.fim
  } else {
    const [ry, rm] = mesFiltro.split('-').map(Number)
    rentIni = `${mesFiltro}-01`
    rentFim = `${mesFiltro}-${new Date(ry, rm, 0).getDate()}`
  }

  const { data: rentData } = isOwnScope
    ? { data: null }
    : await supabase
        .rpc('rentabilidade_periodo', { p_clinic_id: clinicId, p_data_ini: rentIni, p_data_fim: rentFim })
        .single()
  const rent = (rentData || {
    receita: 0, cmv: 0, lucro_bruto: 0, margem_pct: 0, fixos: 0, fixos_por_atendimento: 0, lucro_operacional: 0, atendimentos: 0,
  }) as RentabilidadeRow

  const { data: tendenciaData } = isOwnScope
    ? { data: [] }
    : await supabase.rpc('rentabilidade_tendencia_mensal', { p_clinic_id: clinicId, p_meses: 6 })
  const tendencia = (tendenciaData || []) as (RentabilidadeRow & { mes: string })[]

  const rentMargemColor = rent.margem_pct >= 50 ? 'text-emerald-600' : rent.margem_pct >= 20 ? 'text-amber-600' : 'text-red-600'
  const rentMargemBg = rent.margem_pct >= 50 ? 'bg-emerald-50 border-emerald-200' : rent.margem_pct >= 20 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900">Financeiro</h1>
          <p className="text-slate-500 capitalize">{mesLabel}</p>
          {isOwnScope && (
            <p className="text-xs text-violet-600 font-medium mt-1">Mostrando apenas os seus atendimentos</p>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/financeiro/entradas/nova"
            className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-emerald-700 transition"
          >
            <Icon name="plus" className="w-5 h-5" />
            Nova Entrada
          </Link>
          {!isOwnScope && (
            <Link
              href="/dashboard/financeiro/saidas/nova"
              className="inline-flex items-center gap-2 bg-rose-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-rose-700 transition"
            >
              <Icon name="minus" className="w-5 h-5" />
              Nova Saída
            </Link>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className={`grid grid-cols-2 md:grid-cols-3 ${isOwnScope ? 'lg:grid-cols-4' : 'lg:grid-cols-6'} gap-3 md:gap-4`}>
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

        {!isOwnScope && (
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
        )}

        {!isOwnScope && (
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
            <p className={`text-xs md:text-sm truncate ${resultadoMes >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>Resultado (caixa)</p>
          </div>
        )}
      </div>

      {/* Rentabilidade — cruza receita com estoque/custos da clínica, não faz sentido por profissional */}
      {!isOwnScope && (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
              <Icon name="trendingUp" className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Rentabilidade</h2>
              <p className="text-xs text-slate-500">
                Receita − estoque efetivamente consumido no período ({rent.atendimentos} atendimentos)
              </p>
            </div>
          </div>
          <RentabilidadeFiltro mesAtual={mesFiltro || mesAtualStr} iniAtual={sp.ini} fimAtual={sp.fim} />
        </div>

        {rent.receita > 0 && rent.cmv === 0 && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
            ⚠️ Nenhuma baixa de estoque registrada nesse período — a margem de 100% abaixo não reflete custo real,
            só que a clínica não está dando baixa dos produtos usados nos atendimentos.
          </div>
        )}

        {/* Cards do período selecionado */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <div className="p-3 bg-emerald-50 rounded-xl">
            <p className="text-xs text-slate-500 mb-1">Receita</p>
            <p className="text-sm font-bold text-emerald-700">{fmt(rent.receita)}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <p className="text-xs text-slate-500 mb-1">CMV consumido</p>
            <p className="text-sm font-bold text-slate-700">{fmt(rent.cmv)}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <p className="text-xs text-slate-500 mb-1">Lucro bruto</p>
            <p className={`text-sm font-bold ${rent.lucro_bruto >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{fmt(rent.lucro_bruto)}</p>
          </div>
          <div className={`p-3 rounded-xl border ${rentMargemBg}`}>
            <p className="text-xs text-slate-500 mb-1">Margem</p>
            <p className={`text-sm font-bold ${rentMargemColor}`}>{rent.margem_pct.toFixed(0)}%</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <p className="text-xs text-slate-500 mb-1">Fixos (ref./atend.)</p>
            <p className="text-sm font-bold text-slate-400">{fmt(rent.fixos_por_atendimento)}</p>
            <p className="text-xs text-slate-400">total: {fmtCompact(rent.fixos)}</p>
          </div>
          <div className={`p-3 rounded-xl border ${rent.lucro_operacional >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            <p className="text-xs text-slate-500 mb-1">Lucro operacional</p>
            <p className={`text-sm font-bold ${rent.lucro_operacional >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{fmt(rent.lucro_operacional)}</p>
          </div>
        </div>

        <p className="text-xs text-slate-400 -mt-3 mb-6">
          📊 Fixos = todas as saídas pagas do período (aluguel, salários, etc.), exceto compras de estoque/insumos —
          essas já entram no CMV pelo que foi efetivamente consumido, não pelo que foi comprado. &quot;Ref./atend.&quot; é a
          média por atendimento; o &quot;Lucro operacional&quot; usa o total, não a média.
        </p>

        {/* Tendência últimos 6 meses */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Últimos 6 meses</p>
          <RentabilidadeTendenciaChart tendencia={tendencia} />
          <p className="mt-2 text-xs text-slate-400">
            📊 Barra = receita do mês · linha = lucro operacional (receita − estoque consumido − custos fixos pagos)
          </p>
        </div>
      </div>
      )}

      {/* Atalhos */}
      <div className={`grid grid-cols-2 ${isOwnScope ? 'md:grid-cols-4' : 'md:grid-cols-7'} gap-3`}>
        {!isOwnScope && (
        <Link href="/dashboard/financeiro/previsao-recebimento" className="bg-white rounded-xl p-4 border border-blue-200 shadow-sm hover:border-blue-300 hover:shadow-md transition group flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition">
            <Icon name="dollarSign" className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">Recebíveis Futuros</p>
            <p className="text-xs text-slate-500">Parcelas a cair no caixa</p>
          </div>
        </Link>
        )}

        {!isOwnScope && (
        <Link href="/dashboard/financeiro/previsao" className="bg-white rounded-xl p-4 border border-emerald-200 shadow-sm hover:border-emerald-300 hover:shadow-md transition group flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-200 transition">
            <Icon name="trendingUp" className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">Previsão de Faturamento</p>
            <p className="text-xs text-slate-500">Agendamentos futuros</p>
          </div>
        </Link>
        )}

        {!isOwnScope && (
        <Link href="/dashboard/financeiro/devedores" className="bg-white rounded-xl p-4 border border-rose-200 shadow-sm hover:border-rose-300 hover:shadow-md transition group flex items-center gap-3">
          <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center group-hover:bg-rose-200 transition">
            <Icon name="dollarSign" className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">Devedores</p>
            <p className="text-xs text-slate-500">Em aberto</p>
          </div>
        </Link>
        )}

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
      <div className={`grid ${isOwnScope ? '' : 'lg:grid-cols-2'} gap-6`}>
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

        {!isOwnScope && (
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
        )}
      </div>
    </div>
  )
}

