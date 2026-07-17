'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'

type ProcRanking = {
  procedimento: string
  quantidade: number
  faturamento: number
  liquido: number
  ticket_medio: number
}

const PERIODOS = [
  { label: 'Esta semana', value: 'semana' },
  { label: 'Este mês', value: 'mes' },
  { label: 'Este ano', value: 'ano' },
  { label: 'Personalizado', value: 'custom' },
]

function getRange(periodo: string): { from: string; to: string } {
  const now = new Date()
  const to = now.toISOString().split('T')[0]

  if (periodo === 'semana') {
    const d = new Date(now)
    d.setDate(d.getDate() - d.getDay())
    return { from: d.toISOString().split('T')[0], to }
  }
  if (periodo === 'mes') {
    return { from: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`, to }
  }
  if (periodo === 'ano') {
    return { from: `${now.getFullYear()}-01-01`, to }
  }
  return { from: to, to }
}

export default function RankingProcedimentosView({ clinicId }: { clinicId: string }) {
  const supabase = createClient()
  const [periodo, setPeriodo] = useState('mes')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0])
  const [data, setData] = useState<ProcRanking[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  async function load(from: string, to: string) {
    setLoading(true)
    // Filtra as entradas do período e usa o detalhe por procedimento (entrada_procedimentos)
    // para não misturar pagamentos com múltiplos procedimentos numa única categoria combinada.
    const { data: entradas } = await supabase
      .from('entradas')
      .select('id, valor_bruto, valor_liquido')
      .eq('clinic_id', clinicId)
      .gte('data_venda', from)
      .lte('data_venda', to)

    const entradaIds = (entradas || []).map(e => e.id)
    const liquidoPorEntrada = new Map((entradas || []).map(e => [e.id, { bruto: e.valor_bruto || 0, liquido: e.valor_liquido || 0 }]))

    const { data: detalhes } = entradaIds.length > 0
      ? await supabase
          .from('entrada_procedimentos')
          .select('entrada_id, procedimento_nome, valor')
          .in('entrada_id', entradaIds)
      : { data: [] }

    // Agrupar por procedimento — usa o valor rateado do detalhe para faturamento,
    // e distribui o líquido proporcionalmente ao peso do detalhe dentro da entrada.
    const map = new Map<string, ProcRanking>()
    for (const d of detalhes || []) {
      const nome = d.procedimento_nome || 'Sem nome'
      const totais = liquidoPorEntrada.get(d.entrada_id)
      const proporcaoLiquido = totais && totais.bruto > 0 ? (d.valor || 0) / totais.bruto : 0
      const liquidoRateado = totais ? Math.round(totais.liquido * proporcaoLiquido * 100) / 100 : 0
      const cur = map.get(nome) || { procedimento: nome, quantidade: 0, faturamento: 0, liquido: 0, ticket_medio: 0 }
      cur.quantidade++
      cur.faturamento += d.valor || 0
      cur.liquido += liquidoRateado
      map.set(nome, cur)
    }

    const result = Array.from(map.values()).map(r => ({
      ...r,
      ticket_medio: r.quantidade > 0 ? r.faturamento / r.quantidade : 0
    })).sort((a, b) => b.faturamento - a.faturamento)

    setData(result)
    setLoading(false)
  }

  useEffect(() => {
    if (periodo !== 'custom') {
      const { from, to } = getRange(periodo)
      setDateFrom(from)
      setDateTo(to)
      load(from, to)
    }
  }, [periodo])

  async function exportXLS() {
    setExporting(true)
    try {
      const XLSX = await import('xlsx')
      const rows = data.map((r, i) => ({
        '#': i + 1,
        'Procedimento': r.procedimento,
        'Quantidade': r.quantidade,
        'Faturamento Bruto': r.faturamento.toFixed(2),
        'Faturamento Líquido': r.liquido.toFixed(2),
        'Ticket Médio': r.ticket_medio.toFixed(2),
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      ws['!cols'] = [{ wch: 4 }, { wch: 30 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 14 }]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Ranking Procedimentos')
      XLSX.writeFile(wb, `ranking_procedimentos_${dateFrom}_${dateTo}.xlsx`)
    } finally { setExporting(false) }
  }

  const totalFaturamento = data.reduce((s, r) => s + r.faturamento, 0)
  const totalQtd = data.reduce((s, r) => s + r.quantidade, 0)

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {PERIODOS.map(p => (
            <button key={p.value} onClick={() => setPeriodo(p.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                periodo === p.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {p.label}
            </button>
          ))}
        </div>

        {periodo === 'custom' && (
          <>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input text-sm" />
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input text-sm" />
            <button onClick={() => load(dateFrom, dateTo)} className="btn-secondary text-sm px-4 h-10">
              Filtrar
            </button>
          </>
        )}

        <button onClick={exportXLS} disabled={exporting || data.length === 0}
          className="ml-auto flex items-center gap-2 px-4 h-10 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
          <Icon name="download" className="w-4 h-4" />
          {exporting ? 'Exportando...' : 'Exportar XLS'}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{totalQtd}</p>
          <p className="text-xs text-slate-500 mt-0.5">Atendimentos</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{fmt(totalFaturamento)}</p>
          <p className="text-xs text-slate-500 mt-0.5">Faturamento total</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-violet-600">{data.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Procedimentos distintos</p>
        </div>
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="card p-8 text-center text-slate-400">Carregando...</div>
      ) : data.length === 0 ? (
        <div className="card p-8 text-center text-slate-400">Nenhum dado no período selecionado</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400">#</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400">Procedimento</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400">Qtd</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400">Faturamento</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400">Líquido</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400">Ticket Médio</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-400">%</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => {
                const pct = totalFaturamento > 0 ? (r.faturamento / totalFaturamento) * 100 : 0
                return (
                  <tr key={r.procedimento} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 text-slate-400 font-medium">{i + 1}</td>
                    <td className="py-3 px-4 font-medium text-slate-900">{r.procedimento}</td>
                    <td className="py-3 px-4 text-right text-slate-600">{r.quantidade}</td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-900">{fmt(r.faturamento)}</td>
                    <td className="py-3 px-4 text-right text-emerald-600">{fmt(r.liquido)}</td>
                    <td className="py-3 px-4 text-right text-slate-500">{fmt(r.ticket_medio)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                          <div className="bg-violet-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-slate-400 w-8 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td className="py-3 px-4" colSpan={2}>
                  <span className="text-sm font-bold text-slate-900">Total</span>
                </td>
                <td className="py-3 px-4 text-right font-bold text-slate-900">{totalQtd}</td>
                <td className="py-3 px-4 text-right font-bold text-slate-900">{fmt(totalFaturamento)}</td>
                <td className="py-3 px-4 text-right font-bold text-emerald-600">
                  {fmt(data.reduce((s, r) => s + r.liquido, 0))}
                </td>
                <td className="py-3 px-4" colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
