'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'
import { formatBRL } from '@/lib/format'
import { todayBR, addDaysBR, startOfMonthBR, endOfMonthBR, parseDateBR } from '@/lib/datetime'

// Mesmo mapeamento usado em entradas/nova/entrada-form.tsx — mantém consistência
// entre a taxa aplicada no lançamento e o prazo de repasse usado aqui.
const FORMA_PARA_KEY: Record<string, string> = {
  'Pix': 'pix', 'Dinheiro': 'dinheiro', 'Débito': 'debito',
  'Crédito 1x': 'credito_1x', 'Crédito 2x': 'credito_2x', 'Crédito 3x': 'credito_3x',
  'Crédito 4x': 'credito_4x', 'Crédito 5x': 'credito_5x', 'Crédito 6x': 'credito_6x',
  'Crédito 7x': 'credito_7x', 'Crédito 8x': 'credito_8x', 'Crédito 9x': 'credito_9x',
  'Crédito 10x': 'credito_10x', 'Crédito 11x': 'credito_11x', 'Crédito 12x': 'credito_12x',
}

const BANDEIRA_PARA_KEY: Record<string, string[]> = {
  'Visa': ['visa'],
  'Mastercard': ['master'],
  'Amex, Elo, outros': ['amex', 'elo'],
}

type TaxaPag = { forma: string; bandeira: string; dias_repasse: number; intervalo_dias_parcelas: number }

// Resolve prazo de repasse (D+X da 1ª parcela e intervalo entre parcelas) pela mesma
// lógica de fallback usada para taxa: bandeira específica > 'todas' > default 30/30
function getPrazo(taxas: TaxaPag[], forma: string, bandeira: string | null): { dias: number; intervalo: number } {
  const formaKey = FORMA_PARA_KEY[forma]
  if (!formaKey) return { dias: 30, intervalo: 30 }
  const bandeiraKeys = bandeira ? (BANDEIRA_PARA_KEY[bandeira] || []) : []
  for (const bKey of bandeiraKeys) {
    const t = taxas.find(t => t.forma === formaKey && t.bandeira === bKey)
    if (t) return { dias: t.dias_repasse, intervalo: t.intervalo_dias_parcelas }
  }
  const todas = taxas.find(t => t.forma === formaKey && t.bandeira === 'todas')
  if (todas) return { dias: todas.dias_repasse, intervalo: todas.intervalo_dias_parcelas }
  return { dias: 30, intervalo: 30 }
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

type Parcela = {
  key: string
  entradaId: string
  data: string
  parcelaNum: number
  totalParcelas: number
  valorLiquido: number
  pacienteNome: string
  procedimentoNome: string
  formaPagamento: string
}

export default function PrevisaoRecebimentoView({ clinicId }: { clinicId: string }) {
  const supabase = createClient()

  const [periodo, setPeriodo] = useState('proximos_30')
  const [groupBy, setGroupBy] = useState<'mes' | 'forma' | 'dia'>('mes')
  const [parcelas, setParcelas] = useState<Parcela[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const { data: taxas } = await supabase
          .from('taxas_pagamento')
          .select('forma, bandeira, dias_repasse, intervalo_dias_parcelas')
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

        const taxasList = (taxas || []) as TaxaPag[]
        const hoje = todayBR()
        const geradas: Parcela[] = []

        for (const e of (entradas || []) as any[]) {
          const nParcelas = e.n_parcelas || 1
          const valorLiquido = Number(e.valor_liquido) || 0
          const valorParcela = valorLiquido / nParcelas
          const { dias, intervalo } = getPrazo(taxasList, e.forma_pagamento, e.bandeira)

          for (let i = 1; i <= nParcelas; i++) {
            const data = addDaysBR(e.data_venda, dias + (i - 1) * intervalo)
            if (data < hoje) continue // já deveria ter caído — não é "previsão"
            geradas.push({
              key: `${e.id}-${i}`,
              entradaId: e.id,
              data,
              parcelaNum: i,
              totalParcelas: nParcelas,
              valorLiquido: valorParcela,
              pacienteNome: e.paciente_nome || 'Paciente',
              procedimentoNome: e.procedimento_nome || 'Procedimento',
              formaPagamento: e.forma_pagamento,
            })
          }
        }

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
