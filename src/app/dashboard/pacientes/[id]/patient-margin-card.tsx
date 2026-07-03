import { createClient } from '@/lib/supabase/server'
import Icon from '@/components/ui/Icon'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`

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
    .select('id, start_time, procedures(name, custo_fixo_rateavel)')
    .eq('patient_id', patientId)
    .in('status', ['completed', 'realizado'])
    .order('start_time', { ascending: false })

  if (!appointments || appointments.length === 0) return null

  const appointmentIds = appointments.map((a) => a.id)

  // 2. Receitas dos atendimentos
  const { data: entradas } = await supabase
    .from('entradas')
    .select('valor_liquido, appointment_id')
    .in('appointment_id', appointmentIds)

  // 3a. Custo via appointment_products
  const { data: usedProducts } = await supabase
    .from('appointment_products')
    .select('appointment_id, quantity, products(cost_price)')
    .in('appointment_id', appointmentIds)

  // 3b. Custo via stock_movements (injetáveis pelo mapa)
  const { data: stockMovements } = await supabase
    .from('stock_movements')
    .select('appointment_id, quantity, products(cost_price)')
    .in('appointment_id', appointmentIds)
    .eq('type', 'saida')

  // 4. Meses distintos dos atendimentos
  const months = [...new Set(appointments.map((a) => a.start_time.substring(0, 7)))]

  // 5. Para cada mês: saídas fixas + total atendimentos da clínica
  type MonthData = {
    custoFixoPorAtendimento: number
    aluguelPorDia: Record<string, number>
  }
  const monthDataMap: Record<string, MonthData> = {}

  for (const month of months) {
    const [year, mon] = month.split('-').map(Number)
    const mesInicio = `${month}-01`
    const mesFim = `${month}-${new Date(year, mon, 0).getDate()}`

    const { data: saidasMes } = await supabase
      .from('saidas')
      .select('valor, data, subcategoria, categoria_dre')
      .eq('clinic_id', clinicId)
      .gte('data', mesInicio)
      .lte('data', mesFim)

    const { count: atendimentosMes } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .in('status', ['completed', 'realizado'])
      .gte('start_time', mesInicio + 'T00:00:00')
      .lte('start_time', mesFim + 'T23:59:59')

    const sala = (saidasMes || []).filter((s) => s.subcategoria === 'aluguel_sala')
    // Exclui CMV/Insumos do rateio — já contabilizado no custo de estoque
    const fixas = (saidasMes || []).filter((s) =>
      s.subcategoria !== 'aluguel_sala' &&
      s.categoria_dre !== 'CMV / Insumos'
    )
    const totalFixo = fixas.reduce((s, r) => s + Number(r.valor), 0)
    const n = atendimentosMes || 1

    const aluguelPorDia: Record<string, number> = {}
    for (const s of sala) {
      aluguelPorDia[s.data] = (aluguelPorDia[s.data] || 0) + Number(s.valor)
    }

    monthDataMap[month] = {
      custoFixoPorAtendimento: totalFixo / n,
      aluguelPorDia,
    }
  }

  // 6. Dias com aluguel de sala: buscar atendimentos do dia
  const allDaysWithSala = [...new Set(
    Object.values(monthDataMap).flatMap((m) => Object.keys(m.aluguelPorDia))
  )]
  const atendsPorDia: Record<string, number> = {}
  for (const dia of allDaysWithSala) {
    const { count } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .in('status', ['completed', 'realizado'])
      .gte('start_time', dia + 'T00:00:00')
      .lte('start_time', dia + 'T23:59:59')
    atendsPorDia[dia] = count || 1
  }

  // 7. Montar mapa por atendimento
  type AptRow = {
    id: string
    date: string
    procedureName: string
    receita: number
    custoEstoque: number
    custoFixo: number
  }

  const aptMap: Record<string, AptRow> = {}
  for (const apt of appointments) {
    const dia = apt.start_time.substring(0, 10)
    const month = apt.start_time.substring(0, 7)
    const md = monthDataMap[month]
    const custoSala = md ? (md.aluguelPorDia[dia] || 0) / (atendsPorDia[dia] || 1) : 0
    const custoFixo = md ? md.custoFixoPorAtendimento + custoSala : 0
    const proc = apt.procedures as unknown as { name: string; custo_fixo_rateavel: number | null } | null
    const procName = proc?.name || 'Atendimento'
    // Custo de insumo estimado do procedimento (algodão, cola, etc — não rastreado no estoque).
    // Entra na margem junto com custoEstoque, diferente do custoFixo (overhead, só informativo).
    const custoInsumoEstimado = Number(proc?.custo_fixo_rateavel || 0)

    aptMap[apt.id] = { id: apt.id, date: apt.start_time, procedureName: procName, receita: 0, custoEstoque: custoInsumoEstimado, custoFixo }
  }

  for (const e of entradas || []) {
    if (e.appointment_id && aptMap[e.appointment_id])
      aptMap[e.appointment_id].receita += Number(e.valor_liquido)
  }

  const getCost = (products: unknown) =>
    Number((Array.isArray(products)
      ? (products[0] as { cost_price: number } | null)?.cost_price
      : (products as { cost_price: number } | null)?.cost_price) || 0)

  for (const up of usedProducts || []) {
    if (up.appointment_id && aptMap[up.appointment_id])
      aptMap[up.appointment_id].custoEstoque += getCost(up.products) * up.quantity
  }
  for (const sm of stockMovements || []) {
    if (sm.appointment_id && aptMap[sm.appointment_id])
      aptMap[sm.appointment_id].custoEstoque += getCost(sm.products) * sm.quantity
  }

  const apts = Object.values(aptMap)

  // 8. Totais (custo fixo excluído dos cards de resumo)
  const totReceita = apts.reduce((s, a) => s + a.receita, 0)
  const totEstoque = apts.reduce((s, a) => s + a.custoEstoque, 0)
  const lucro = totReceita - totEstoque
  const margemPct = totReceita > 0 ? (lucro / totReceita) * 100 : 0

  const margemColor = margemPct >= 50 ? 'text-emerald-600' : margemPct >= 20 ? 'text-amber-600' : 'text-red-600'
  const margemBg = margemPct >= 50 ? 'bg-emerald-50 border-emerald-200' : margemPct >= 20 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'

  return (
    <div className="card p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
          <Icon name="trendingUp" className="w-4 h-4 text-violet-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Rentabilidade do paciente</h2>
          <p className="text-xs text-slate-500">{apts.length} atendimentos concluídos</p>
        </div>
      </div>

      {/* Cards de resumo — sem custo fixo */}
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
          <p className="text-xs text-slate-500 mb-1">Lucro bruto</p>
          <p className={`text-sm font-bold ${lucro >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{fmt(lucro)}</p>
        </div>
        <div className={`p-3 rounded-xl border ${margemBg}`}>
          <p className="text-xs text-slate-500 mb-1">Margem</p>
          <p className={`text-sm font-bold ${margemColor}`}>{margemPct.toFixed(0)}%</p>
          <p className="text-xs text-slate-400">receita − estoque</p>
        </div>
      </div>

      {/* Por atendimento */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Por atendimento</p>
        {apts.map((a) => {
          const lucroApt = a.receita - a.custoEstoque
          const pct = a.receita > 0 ? (lucroApt / a.receita) * 100 : 0
          const color = pct >= 50 ? 'text-emerald-600' : pct >= 20 ? 'text-amber-600' : 'text-red-600'

          return (
            <div key={a.id} className="p-3 bg-slate-50 rounded-xl space-y-2">
              {/* Linha 1: data + procedimento */}
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-700">
                    {new Date(a.date).toLocaleDateString('pt-BR', {
                      day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Sao_Paulo'
                    })}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{a.procedureName}</p>
                </div>
                <p className={`text-sm font-bold whitespace-nowrap ${color}`}>
                  {fmt(lucroApt)} <span className="text-xs">({fmtPct(pct)})</span>
                </p>
              </div>

              {/* Linha 2: receita | estoque | fixo */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-slate-400">Receita</p>
                  <p className="font-semibold text-slate-700">{fmt(a.receita)}</p>
                </div>
                <div>
                  <p className="text-slate-400">Estoque</p>
                  <p className="font-semibold text-slate-700">{fmt(a.custoEstoque)}</p>
                </div>
                <div>
                  <p className="text-slate-400">Fixos (ref.)</p>
                  <p className="font-semibold text-slate-400">{fmt(a.custoFixo)}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Legenda */}
      <p className="mt-3 text-xs text-slate-400">
        📊 Fixos são informativos — rateados pelo mês e total de atendimentos da clínica naquele mês
      </p>
    </div>
  )
}
