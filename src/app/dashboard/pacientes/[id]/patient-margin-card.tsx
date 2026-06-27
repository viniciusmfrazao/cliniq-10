import { createClient } from '@/lib/supabase/server'
import Icon from '@/components/ui/Icon'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default async function PatientMarginCard({
  patientId,
  clinicId,
}: {
  patientId: string
  clinicId: string
}) {
  const supabase = await createClient()

  // 1. Atendimentos concluídos do paciente
  const { data: appointments } = await supabase
    .from('appointments')
    .select('id, start_time')
    .eq('patient_id', patientId)
    .in('status', ['completed', 'realizado'])
    .order('start_time', { ascending: false })

  if (!appointments || appointments.length === 0) return null

  const appointmentIds = appointments.map((a) => a.id)

  // 2. Receitas dos atendimentos (entradas pagas vinculadas)
  const { data: entradas } = await supabase
    .from('entradas')
    .select('valor, appointment_id')
    .in('appointment_id', appointmentIds)
    .eq('pago', true)

  // 3. Produtos usados com custo
  const { data: usedProducts } = await supabase
    .from('appointment_products')
    .select('appointment_id, quantity, products(cost_price)')
    .in('appointment_id', appointmentIds)

  // 4. Saídas da clínica com subcategoria para rateio
  const now = new Date()
  const mesInicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const mesFim = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  const { data: saidasMes } = await supabase
    .from('saidas')
    .select('valor, data, subcategoria, categoria_dre')
    .eq('clinic_id', clinicId)
    .gte('data', mesInicio)
    .lte('data', mesFim)

  // 5. Atendimentos do mês (para rateio mensal)
  const { count: atendimentosMes } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .eq('status', 'completed')
    .gte('start_time', mesInicio)
    .lte('start_time', mesFim + 'T23:59:59')

  // Separar saídas por tipo de rateio
  const saidasAluguelSala = (saidasMes || []).filter(s => s.subcategoria === 'aluguel_sala')
  const saidasFixasMes = (saidasMes || []).filter(s => s.subcategoria !== 'aluguel_sala')

  // Total fixo mensal (aluguel_mensal + demais despesas) ÷ atendimentos do mês
  const totalFixoMes = saidasFixasMes.reduce((s, r) => s + Number(r.valor), 0)
  const custoFixoPorAtendimento = atendimentosMes && atendimentosMes > 0
    ? totalFixoMes / atendimentosMes
    : 0

  // Agrupar aluguel de sala por dia → valor ÷ atendimentos do dia
  const aluguelPorDia: Record<string, number> = {}
  for (const s of saidasAluguelSala) {
    aluguelPorDia[s.data] = (aluguelPorDia[s.data] || 0) + Number(s.valor)
  }

  // Atendimentos por dia (para rateio da sala)
  const diasComSala = Object.keys(aluguelPorDia)
  const atendsPorDia: Record<string, number> = {}
  for (const dia of diasComSala) {
    const { count } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .eq('status', 'completed')
      .gte('start_time', dia + 'T00:00:00')
      .lte('start_time', dia + 'T23:59:59')
    atendsPorDia[dia] = count || 1
  }

  // Custo de sala rateado por dia
  const custSalaPorDia: Record<string, number> = {}
  for (const dia of diasComSala) {
    custSalaPorDia[dia] = aluguelPorDia[dia] / atendsPorDia[dia]
  }

  // ── Cálculo por atendimento ──────────────────────────────────────────
  type AptSummary = {
    id: string
    date: string
    receita: number
    custoEstoque: number
    custoSala: number
    custoFixo: number
    margem: number
    margemPct: number
  }

  const aptMap: Record<string, AptSummary> = {}
  for (const apt of appointments) {
    const dia = apt.start_time.split('T')[0]
    aptMap[apt.id] = {
      id: apt.id,
      date: apt.start_time,
      receita: 0,
      custoEstoque: 0,
      custoSala: custSalaPorDia[dia] || 0,
      custoFixo: custoFixoPorAtendimento,
      margem: 0,
      margemPct: 0,
    }
  }

  for (const e of entradas || []) {
    if (e.appointment_id && aptMap[e.appointment_id]) {
      aptMap[e.appointment_id].receita += Number(e.valor)
    }
  }

  for (const up of usedProducts || []) {
    if (up.appointment_id && aptMap[up.appointment_id]) {
      const cost = Number((Array.isArray(up.products) ? (up.products[0] as { cost_price: number } | null)?.cost_price : (up.products as { cost_price: number } | null)?.cost_price) || 0)
      aptMap[up.appointment_id].custoEstoque += cost * up.quantity
    }
  }

  const apts = Object.values(aptMap).map((a) => {
    const totalCusto = a.custoEstoque + a.custoSala + a.custoFixo
    const margem = a.receita - totalCusto
    const margemPct = a.receita > 0 ? (margem / a.receita) * 100 : 0
    return { ...a, margem, margemPct }
  })

  // ── Totais ────────────────────────────────────────────────────────────
  const totReceita = apts.reduce((s, a) => s + a.receita, 0)
  const totEstoque = apts.reduce((s, a) => s + a.custoEstoque, 0)
  const totSala = apts.reduce((s, a) => s + a.custoSala, 0)
  const totFixo = apts.reduce((s, a) => s + a.custoFixo, 0)
  const totMargem = totReceita - totEstoque - totSala - totFixo
  const totMargemPct = totReceita > 0 ? (totMargem / totReceita) * 100 : 0

  const margemColor = totMargemPct >= 50 ? 'text-emerald-600' : totMargemPct >= 20 ? 'text-amber-600' : 'text-red-600'
  const margemBg = totMargemPct >= 50 ? 'bg-emerald-50 border-emerald-200' : totMargemPct >= 20 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'

  const temSala = totSala > 0
  const temFixo = totFixo > 0

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
          <Icon name="trendingUp" className="w-4 h-4 text-violet-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Rentabilidade do paciente</h2>
          <p className="text-xs text-slate-500">{apts.length} atendimentos concluídos</p>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="p-3 bg-emerald-50 rounded-xl">
          <p className="text-xs text-slate-500 mb-1">Receita total</p>
          <p className="text-sm font-bold text-emerald-700">{fmt(totReceita)}</p>
        </div>
        <div className="p-3 bg-slate-50 rounded-xl">
          <p className="text-xs text-slate-500 mb-1">Custo estoque</p>
          <p className="text-sm font-bold text-slate-700">{fmt(totEstoque)}</p>
        </div>
        <div className="p-3 bg-slate-50 rounded-xl">
          <p className="text-xs text-slate-500 mb-1">
            {temSala && !temFixo ? 'Aluguel sala' : temFixo && !temSala ? 'Custos fixos' : 'Sala + fixos'}
          </p>
          <p className="text-sm font-bold text-slate-700">{fmt(totSala + totFixo)}</p>
        </div>
        <div className={`p-3 rounded-xl border ${margemBg}`}>
          <p className="text-xs text-slate-500 mb-1">Margem estimada</p>
          <p className={`text-sm font-bold ${margemColor}`}>
            {fmt(totMargem)}{' '}
            <span className="text-xs font-medium">({totMargemPct.toFixed(0)}%)</span>
          </p>
        </div>
      </div>

      {/* Detalhe por atendimento */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-500 uppercase">Por atendimento</p>
        {apts.slice(0, 5).map((a) => {
          const pct = a.margemPct
          const color = pct >= 50 ? 'text-emerald-600' : pct >= 20 ? 'text-amber-600' : 'text-red-600'
          return (
            <div key={a.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl gap-2">
              <div className="min-w-0">
                <p className="text-xs text-slate-500">
                  {new Date(a.date).toLocaleDateString('pt-BR', {
                    day: '2-digit', month: 'short', year: 'numeric',
                    timeZone: 'America/Sao_Paulo',
                  })}
                </p>
                <p className="text-xs text-slate-400">
                  Receita {fmt(a.receita)} · Custos {fmt(a.custoEstoque + a.custoSala + a.custoFixo)}
                </p>
              </div>
              <p className={`text-sm font-bold whitespace-nowrap ${color}`}>
                {fmt(a.margem)} <span className="text-xs">({pct.toFixed(0)}%)</span>
              </p>
            </div>
          )
        })}
        {apts.length > 5 && (
          <p className="text-xs text-slate-400 text-center pt-1">
            + {apts.length - 5} atendimentos anteriores
          </p>
        )}
      </div>

      {/* Legenda do rateio */}
      <div className="mt-4 p-3 bg-slate-50 rounded-xl space-y-1">
        {temSala && (
          <p className="text-xs text-slate-400">
            🏠 Aluguel de sala rateado por dia de atendimento
          </p>
        )}
        {temFixo && (
          <p className="text-xs text-slate-400">
            📊 Fixos: {fmt(custoFixoPorAtendimento)}/atend. ({atendimentosMes} atend. no mês · {fmt(totalFixoMes)} em saídas)
          </p>
        )}
        {!temSala && !temFixo && (
          <p className="text-xs text-slate-400">
            Nenhum custo fixo lançado este mês. Lance em Financeiro → Saídas.
          </p>
        )}
      </div>
    </div>
  )
}
