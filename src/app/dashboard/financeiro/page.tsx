import { redirect } from 'next/navigation'
import { createClient, getCachedUser } from '@/lib/supabase/server'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { formatBRL, formatBRLCompact } from '@/lib/format'
import { todayBR, startOfMonthBR, endOfMonthBR, parseDateBR } from '@/lib/datetime'
import { getFinancialAccess } from '@/lib/financial-access'
import RentabilidadeFiltro from './RentabilidadeFiltro'
import RentabilidadeTendenciaChart from './RentabilidadeTendenciaChart'
import KpiCard from './KpiCard'
import RentCard from './RentCard'

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
    .select('id, valor_bruto, valor_liquido, forma_pagamento')
    .eq('clinic_id', clinicId)
    .gte('data_venda', startOfMonth)
    .lte('data_venda', endOfMonth)

  // "Resultado (caixa)" precisa ser dinheiro de verdade, não venda registrada.
  // Cartão/pix/dinheiro continuam contados no dia da venda (como sempre foi —
  // repasse do cartão é praticamente garantido). Boleto é diferente: o
  // paciente pode não pagar, então só entra aqui quando a parcela é
  // confirmada via boleto_parcelas — no mês em que a baixa foi dada, não no
  // mês da venda.
  const { data: boletosPagosNoMes } = isOwnScope
    ? { data: [] as { valor_liquido: number }[] }
    : await supabase
        .from('boleto_parcelas')
        .select('valor_liquido')
        .eq('clinic_id', clinicId)
        .eq('status', 'pago')
        .gte('data_pagamento', startOfMonth)
        .lte('data_pagamento', endOfMonth)

  // Quanto dos boletos vendidos este mês ainda falta confirmar — mostrado
  // como nota no card, pra não parecer que o valor "sumiu" do resultado.
  // Precisa olhar as parcelas reais (não o valor da venda): parte já pode
  // ter sido paga mesmo dentro do mesmo mês da venda.
  const entradaIdsBoletoMes = (entradasMes || [])
    .filter(e => (e.forma_pagamento || '').toLowerCase().startsWith('boleto'))
    .map(e => e.id)
  const { data: parcelasPendentesDesteMes } = (isOwnScope || entradaIdsBoletoMes.length === 0)
    ? { data: [] as { valor_liquido: number }[] }
    : await supabase
        .from('boleto_parcelas')
        .select('valor_liquido')
        .eq('status', 'pendente')
        .in('entrada_id', entradaIdsBoletoMes)
  const boletoPendenteMes = (parcelasPendentesDesteMes || []).reduce((s, p) => s + Number(p.valor_liquido || 0), 0)

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
  const liquidoMesNaoBoleto = (entradasMes || [])
    .filter(e => !(e.forma_pagamento || '').toLowerCase().startsWith('boleto'))
    .reduce((s, e) => s + Number(e.valor_liquido || 0), 0)
  const boletoRecebidoMes = (boletosPagosNoMes || []).reduce((s, b) => s + Number(b.valor_liquido || 0), 0)
  const liquidoMesCaixa = liquidoMesNaoBoleto + boletoRecebidoMes
  const resultadoMes  = liquidoMesCaixa - despesasMes
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
      <p className="text-xs text-slate-400">Toque em um card para ver como o número é calculado.</p>
      <div className={`grid grid-cols-2 md:grid-cols-3 ${isOwnScope ? 'lg:grid-cols-4' : 'lg:grid-cols-6'} gap-3 md:gap-4`}>
        <KpiCard
          icon="trendingUp" iconBg="bg-emerald-100" iconColor="text-emerald-600"
          valueCompact={fmtCompact(receitaHoje)} valueFull={fmt(receitaHoje)} valueTitle={fmt(receitaHoje)}
          label="Receita bruta hoje"
          explanation={<>
            <p>Soma do <strong>valor bruto</strong> (antes de taxas) de todas as vendas lançadas com data de hoje.</p>
            <p>Conta no dia da venda, não no dia em que o dinheiro efetivamente cai na conta (regime de competência) — inclusive vendas parceladas no cartão ou em boleto entram aqui pelo valor total, de uma vez.</p>
          </>}
        />

        <KpiCard
          icon="dollarSign" iconBg="bg-blue-100" iconColor="text-blue-600"
          valueCompact={fmtCompact(receitaMes)} valueFull={fmt(receitaMes)} valueTitle={fmt(receitaMes)}
          label="Receita bruta do mês"
          explanation={<>
            <p>Soma do <strong>valor bruto</strong> (antes de taxas) de todas as vendas do mês atual, pela data da venda.</p>
            <p>Mesma lógica da Receita bruta hoje, só que olhando o mês inteiro. É "quanto a clínica vendeu", não "quanto já recebeu" — pra isso, veja o Resultado (caixa).</p>
          </>}
        />

        <KpiCard
          icon="activity" iconBg="bg-violet-100" iconColor="text-violet-600"
          valueCompact={fmtCompact(liquidoMes)} valueFull={fmt(liquidoMes)} valueTitle={fmt(liquidoMes)}
          label="Líquido do mês"
          explanation={<>
            <p>Soma do <strong>valor líquido</strong> das vendas do mês — o bruto já descontando taxa de cartão/boleto configurada em cada venda.</p>
            <p>Assim como a Receita bruta, conta pela data da venda (competência), não pela data em que o dinheiro cai.</p>
          </>}
        />

        <KpiCard
          icon="receipt" iconBg="bg-amber-100" iconColor="text-amber-600"
          valueCompact={fmtCompact(ticketMedio)} valueFull={fmt(ticketMedio)} valueTitle={fmt(ticketMedio)}
          label="Ticket médio"
          explanation={<p><strong>Líquido do mês ÷ número de vendas do mês.</strong> Se a clínica fez {entradasMes?.length || 0} venda(s) este mês somando {fmt(liquidoMes)} líquido, o ticket médio é {fmt(ticketMedio)}.</p>}
        />

        {!isOwnScope && (
          <KpiCard
            icon="trendingDown" iconBg="bg-rose-100" iconColor="text-rose-600"
            valueCompact={fmtCompact(despesasMes)} valueFull={fmt(despesasMes)} valueTitle={fmt(despesasMes)}
            label="Saídas do mês"
            explanation={<>
              <p>Soma das despesas <strong>já pagas</strong> (aluguel, salários, insumos, etc.) com data até hoje, dentro do mês atual.</p>
              <p>Despesas agendadas pra depois de hoje, ou ainda marcadas como não pagas, não entram nessa conta.</p>
            </>}
          />
        )}

        {!isOwnScope && (
          <KpiCard
            icon={resultadoMes >= 0 ? 'trendingUp' : 'trendingDown'}
            iconBg={resultadoMes >= 0 ? 'bg-emerald-200' : 'bg-rose-200'}
            iconColor={resultadoMes >= 0 ? 'text-emerald-700' : 'text-rose-700'}
            cardClassName={resultadoMes >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}
            valueClassName={resultadoMes >= 0 ? 'text-emerald-700' : 'text-rose-700'}
            labelClassName={resultadoMes >= 0 ? 'text-emerald-600' : 'text-rose-600'}
            valueCompact={fmtCompact(resultadoMes)} valueFull={fmt(resultadoMes)} valueTitle={fmt(resultadoMes)}
            label="Resultado (caixa)"
            note={boletoPendenteMes > 0 && (
              <p className="text-[11px] text-slate-500 mt-1 truncate" title={`${fmt(boletoPendenteMes)} em boletos deste mês ainda sem confirmação de pagamento`}>
                + {fmt(boletoPendenteMes)} em boleto ainda não confirmado
              </p>
            )}
            explanation={<>
              <p>Esse é o único card em <strong>regime de caixa</strong> (dinheiro que realmente entrou), diferente dos outros que contam pela data da venda.</p>
              <p>Pix, débito, crédito e dinheiro contam no dia da venda — o repasse da maquininha é praticamente garantido. <strong>Boleto é diferente</strong>: só entra aqui quando a parcela é confirmada como paga (em Previsão de Recebimento), no mês em que a baixa foi dada.</p>
              <p><strong>Fórmula:</strong> (Líquido do mês em pix/débito/crédito/dinheiro + boletos confirmados no mês) − Saídas pagas do mês.</p>
              {boletoPendenteMes > 0 && (
                <p>Ainda há <strong>{fmt(boletoPendenteMes)}</strong> em parcelas de boleto vendidas este mês que não foram confirmadas — por isso não entram nesse resultado.</p>
              )}
            </>}
          />
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
        <p className="text-xs text-slate-400 mb-2">Toque em um card para ver como o número é calculado.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <RentCard
            label="Receita"
            valueDisplay={fmt(rent.receita)}
            valueFull={fmt(rent.receita)}
            cardClassName="bg-emerald-50"
            valueClassName="text-emerald-700"
            explanation={<p>Soma do valor bruto das vendas no período selecionado acima ({rent.atendimentos} atendimento{rent.atendimentos === 1 ? '' : 's'}). Mesmo cálculo da Receita bruta do mês, só que respeitando o filtro de período desta seção.</p>}
          />
          <RentCard
            label="CMV consumido"
            valueDisplay={fmt(rent.cmv)}
            valueFull={fmt(rent.cmv)}
            explanation={<>
              <p>Custo dos produtos e insumos <strong>efetivamente baixados do estoque</strong> nos atendimentos do período — não é o que foi comprado, é o que foi de fato usado.</p>
              {rent.receita > 0 && rent.cmv === 0 && (
                <p>Está zerado porque não há baixa de estoque registrada nesse período. Isso não significa custo zero — só que a clínica ainda não deu baixa dos produtos usados nos atendimentos, então a Margem abaixo aparece maior do que a real.</p>
              )}
            </>}
          />
          <RentCard
            label="Lucro bruto"
            valueDisplay={fmt(rent.lucro_bruto)}
            valueFull={fmt(rent.lucro_bruto)}
            valueClassName={rent.lucro_bruto >= 0 ? 'text-emerald-700' : 'text-red-600'}
            explanation={<p><strong>Receita − CMV consumido.</strong> Ainda não desconta os custos fixos (aluguel, salários) — isso vem no Lucro operacional, mais à frente.</p>}
          />
          <RentCard
            label="Margem"
            valueDisplay={`${rent.margem_pct.toFixed(0)}%`}
            valueFull={`${rent.margem_pct.toFixed(0)}%`}
            cardClassName={`border ${rentMargemBg}`}
            valueClassName={rentMargemColor}
            explanation={<>
              <p><strong>Lucro bruto ÷ Receita</strong>, em porcentagem.</p>
              <p>Cor por faixa: verde acima de 50%, amarelo entre 20% e 50%, vermelho abaixo de 20%.</p>
            </>}
          />
          <RentCard
            label="Fixos (ref./atend.)"
            valueDisplay={<>
              <p className="text-slate-400">{fmt(rent.fixos_por_atendimento)}</p>
              <p className="text-xs text-slate-400 font-normal">total: {fmtCompact(rent.fixos)}</p>
            </>}
            valueFull={fmt(rent.fixos)}
            explanation={<>
              <p>Todas as saídas <strong>pagas</strong> no período (aluguel, salários, etc.), <strong>exceto</strong> compras de estoque/insumos — essas já entram no CMV pelo que foi consumido, não pelo que foi comprado (evita contar o mesmo custo duas vezes).</p>
              <p>O valor grande no card é a <strong>média por atendimento</strong> ({fmt(rent.fixos_por_atendimento)}); "total" é a soma de todos os fixos pagos no período ({fmt(rent.fixos)}).</p>
            </>}
          />
          <RentCard
            label="Lucro operacional"
            valueDisplay={fmt(rent.lucro_operacional)}
            valueFull={fmt(rent.lucro_operacional)}
            cardClassName={`border ${rent.lucro_operacional >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}
            valueClassName={rent.lucro_operacional >= 0 ? 'text-emerald-700' : 'text-red-600'}
            explanation={<p><strong>Lucro bruto − Fixos totais do período</strong> (usa o total, não a média por atendimento).</p>}
          />
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
      <div className={`grid grid-cols-2 ${isOwnScope ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-3`}>
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

        <Link href="/dashboard/financeiro/metas" className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm hover:border-pink-200 hover:shadow-md transition group flex items-center gap-3">
          <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center group-hover:bg-pink-200 transition">
            <Icon name="target" className="w-5 h-5 text-pink-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">Metas</p>
            <p className="text-xs text-slate-500">Mensal</p>
          </div>
        </Link>

        <Link href="/dashboard/financeiro/relatorios" className="col-span-2 md:col-span-1 bg-white rounded-xl p-4 border border-slate-100 shadow-sm hover:border-violet-200 hover:shadow-md transition group flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center group-hover:bg-violet-200 transition flex-shrink-0">
            <Icon name="pieChart" className="w-5 h-5 text-violet-600" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 text-sm">Relatórios</p>
            <p className="text-xs text-slate-500 truncate">
              {isOwnScope ? 'Rankings e status de agenda' : 'DRE, fluxo, rankings, previsão e mais'}
            </p>
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

