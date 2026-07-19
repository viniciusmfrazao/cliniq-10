'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'
import { formatBRL } from '@/lib/format'
import { todayBR, addDaysBR, startOfMonthBR, endOfMonthBR, parseDateBR } from '@/lib/datetime'
import { gerarParcelas, type TaxaPag } from '@/lib/recebiveis'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts'

const RECEB_SHADES = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe', '#eff6ff', '#f5f8ff']

function RecebimentoTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row) return null
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-lg px-3 py-2 text-xs">
      <p className="font-bold text-slate-900 mb-1 capitalize">{row.label}</p>
      <p className="text-slate-600">{formatBRL(row.total)}</p>
    </div>
  )
}

const PERIODOS = [
  { value: 'proximos_30', label: 'Próximos 30 dias' },
  { value: 'restante_mes', label: 'Até fim do mês' },
  { value: 'proximo_mes', label: 'Próximo mês' },
  { value: 'proximos_90', label: 'Próximos 90 dias' },
  { value: 'todas', label: 'Todas as futuras' },
]

function getRange(periodo: string): { from: string; to: string | null } {
  const hoje = todayBR()
  if (periodo === 'proximos_30') return { from: hoje, to: addDaysBR(hoje, 30) }
  if (periodo === 'restante_mes') return { from: hoje, to: endOfMonthBR().slice(0, 10) }
  if (periodo === 'proximo_mes') {
    const ref = new Date(`${hoje}T12:00:00-03:00`)
    ref.setMonth(ref.getMonth() + 1)
    return { from: startOfMonthBR(ref).slice(0, 10), to: endOfMonthBR(ref).slice(0, 10) }
  }
  if (periodo === 'proximos_90') return { from: hoje, to: addDaysBR(hoje, 90) }
  return { from: hoje, to: null }
}

export default function PrevisaoRecebimentoView({ clinicId }: { clinicId: string }) {
  const supabase = createClient()

  const [periodo, setPeriodo] = useState('proximos_30')
  const [groupBy, setGroupBy] = useState<'mes' | 'forma' | 'dia'>('mes')
  const [parcelas, setParcelas] = useState<ReturnType<typeof gerarParcelas>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const { data: taxas } = await supabase
          .from('taxas_pagamento')
          .select('forma, bandeira, dias_repasse, modo_repasse, intervalo_dias_parcelas')
          .eq('clinic_id', clinicId)

        // Vendas parceladas podem levar até 12 parcelas de ~30 dias para
        // quitar — olhamos 12 meses para trás pra pegar tudo que ainda pode
        // ter parcela futura em aberto.
        const dataMin = addDaysBR(todayBR(), -365)

        const { data: entradas } = await supabase
          .from('entradas')
          .select('id, data_venda, paciente_nome, procedimento_nome, forma_pagamento, bandeira, valor_liquido, n_parcelas')
          .eq('clinic_id', clinicId)
          .gte('data_venda', dataMin)

        const hoje = todayBR()
        const geradas = gerarParcelas((entradas || []) as any[], (taxas || []) as TaxaPag[])
          .filter(p => p.data >= hoje)
        geradas.sort((a, b) => a.data.localeCompare(b.data))
        setParcelas(geradas)
      } finally {
        setLoading(false)
      }
    })()
  }, [clinicId])

  const { from, to } = useMemo(() => getRange(periodo), [periodo])

  const filtradas = useMemo(() => {
    return parcelas.filter(p => p.data >= from && (to === null || p.data <= to))
  }, [parcelas, from, to])

  const totalPrevisto = useMemo(() => filtradas.reduce((s, p) => s + p.valorLiquido, 0), [filtradas])
  const proxima = filtradas[0]

  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; qtd: number; total: number; sortKey: string }>()
    for (const p of filtradas) {
      let key: string, label: string, sortKey: string
      if (groupBy === 'mes') {
        key = p.data.slice(0, 7)
        const [y, m] = key.split('-')
        label = new Date(`${key}-01T12:00:00-03:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
        label = label.charAt(0).toUpperCase() + label.slice(1)
        sortKey = key
      } else if (groupBy === 'forma') {
        key = p.formaPagamento
        label = p.formaPagamento
        sortKey = key
      } else {
        key = p.data
        label = parseDateBR(p.data)
        sortKey = key
      }
      const cur = map.get(key) || { label, qtd: 0, total: 0, sortKey }
      cur.qtd += 1
      cur.total += p.valorLiquido
      map.set(key, cur)
    }
    return Array.from(map.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  }, [filtradas, groupBy])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl flex-wrap">
          {PERIODOS.map(p => (
            <button key={p.value} onClick={() => setPeriodo(p.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                periodo === p.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {p.label}
            </button>
          ))}
        </div>

        <select value={groupBy} onChange={e => setGroupBy(e.target.value as any)}
          className="input text-sm h-10 !w-auto min-w-[180px] flex-shrink-0 py-0 ml-auto">
          <option value="mes">Agrupar por mês</option>
          <option value="forma">Agrupar por forma de pagamento</option>
          <option value="dia">Agrupar por dia</option>
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{formatBRL(totalPrevisto)}</p>
          <p className="text-xs text-slate-500 mt-0.5">Líquido a receber no período</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{filtradas.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Parcelas no período</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-violet-600">
            {proxima ? parseDateBR(proxima.data) : '—'}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Próximo recebimento</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">
            {proxima ? formatBRL(proxima.valorLiquido) : '—'}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Valor do próximo</p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
        <Icon name="alertCircle" className="w-4 h-4 flex-shrink-0" />
        Projeta apenas parcelas de vendas já lançadas em Entradas. Prazo de repasse por bandeira/parcela vem de Configurações → Taxas de Pagamento.
      </div>

      {/* Gráfico de recebíveis */}
      {!loading && grouped.length > 0 && (
        <div className="card p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Recebíveis por {groupBy === 'mes' ? 'mês' : groupBy === 'forma' ? 'forma de pagamento' : 'dia'}
          </p>
          <div style={{ width: '100%', height: Math.min(8, grouped.length) * 34 + 10 }}>
            <ResponsiveContainer>
              <BarChart data={grouped.slice(0, 8)} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="label" width={130} tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<RecebimentoTooltip />} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="total" radius={[0, 6, 6, 0]} barSize={16}>
                  {grouped.slice(0, 8).map((_, i) => <Cell key={i} fill={RECEB_SHADES[i % RECEB_SHADES.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card p-8 text-center text-slate-400">Carregando...</div>
      ) : filtradas.length === 0 ? (
        <div className="card p-8 text-center text-slate-400">Nenhum recebimento previsto no período selecionado</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400">
                  {groupBy === 'mes' ? 'Mês' : groupBy === 'forma' ? 'Forma de pagamento' : 'Dia'}
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400">Parcelas</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400">Total líquido</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-400">%</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map(g => {
                const pct = totalPrevisto > 0 ? (g.total / totalPrevisto) * 100 : 0
                return (
                  <tr key={g.label} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900 capitalize">{g.label}</td>
                    <td className="py-3 px-4 text-right text-slate-600">{g.qtd}</td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-900">{formatBRL(g.total)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                          <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
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
                <td className="py-3 px-4"><span className="text-sm font-bold text-slate-900">Total</span></td>
                <td className="py-3 px-4 text-right font-bold text-slate-900">{filtradas.length}</td>
                <td className="py-3 px-4 text-right font-bold text-emerald-600">{formatBRL(totalPrevisto)}</td>
                <td className="py-3 px-4" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
