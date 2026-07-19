'use client'

import { useState, useEffect } from 'react'
import Icon from '@/components/ui/Icon'
import { createClient } from '@/lib/supabase/client'
import { todayBR, addDaysBR } from '@/lib/datetime'
import { gerarParcelas, type TaxaPag } from '@/lib/recebiveis'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts'

type Entrada = {
  data_venda: string
  valor_bruto: number
  valor_liquido: number
  valor_taxa: number
  forma_pagamento: string
}

type Saida = {
  data: string
  valor: number
  categoria_dre: string | null
}

type Props = {
  entradas: Entrada[]
  saidas: Saida[]
  clinicId: string
  scope?: 'all' | 'own'
}

const CATEGORIAS_DRE = [
  'CMV / Insumos',
  'Despesas com Pessoal',
  'Despesas Administrativas',
  'Despesas com Vendas',
  'Impostos e Obrigações',
  'Despesas Financeiras',
  'Outros'
]

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

function fmtPct(v: number) {
  return (v * 100).toFixed(1) + '%'
}

const CAT_SHADES = ['#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe', '#f3f0ff']

function CategoriaTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row) return null
  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-lg px-3 py-2 text-xs">
      <p className="font-bold text-slate-900 mb-1">{row.categoria}</p>
      <p className="text-slate-600">{fmt(row.valor)}</p>
    </div>
  )
}

export default function DreView({ entradas: initialEntradas, saidas: initialSaidas, clinicId, scope = 'all' }: Props) {
  const [mes, setMes] = useState(todayBR().slice(0, 7))
  const [entradas, setEntradas] = useState(initialEntradas)
  const [saidas, setSaidas] = useState(initialSaidas)
  const [caixaRealMes, setCaixaRealMes] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [mes])

  async function loadData() {
    setLoading(true)
    const startOfMonth = `${mes}-01`
    const [y, m] = mes.split('-').map(Number)
    const endOfMonth = new Date(y, m, 0).toISOString().split('T')[0]

    const [{ data: e }, { data: s }] = await Promise.all([
      supabase
        .from('entradas')
        .select('data_venda, valor_bruto, valor_liquido, valor_taxa, forma_pagamento')
        .eq('clinic_id', clinicId)
        .gte('data_venda', startOfMonth)
        .lte('data_venda', endOfMonth),
      supabase
        .from('saidas')
        .select('data, valor, categoria_dre')
        .eq('clinic_id', clinicId)
        .eq('pago', true)
        .gte('data', startOfMonth)
        .lte('data', endOfMonth)
    ])

    setEntradas(e || [])
    setSaidas(s || [])

    // Caixa real do mês: parcelas (próprias ou de vendas de meses anteriores)
    // cujo repasse efetivamente cai dentro do mês selecionado. Só calculamos
    // se scope='all' — visão de caixa é nível clínica, não por profissional.
    if (scope === 'all') {
      // Vendas parceladas podem levar até 12 parcelas de ~30 dias pra quitar —
      // olhamos 12 meses pra trás pra pegar toda entrada que pode ter parcela
      // caindo no mês selecionado.
      const dataMin = addDaysBR(startOfMonth, -365)
      const [{ data: entradasAmplo }, { data: taxas }] = await Promise.all([
        supabase
          .from('entradas')
          .select('id, data_venda, paciente_nome, procedimento_nome, forma_pagamento, bandeira, valor_liquido, n_parcelas')
          .eq('clinic_id', clinicId)
          .gte('data_venda', dataMin)
          .lte('data_venda', endOfMonth),
        supabase
          .from('taxas_pagamento')
          .select('forma, bandeira, dias_repasse, modo_repasse, intervalo_dias_parcelas')
          .eq('clinic_id', clinicId)
      ])

      const parcelas = gerarParcelas((entradasAmplo || []) as any[], (taxas || []) as TaxaPag[])
      const doMes = parcelas.filter(p => p.data >= startOfMonth && p.data <= endOfMonth)
      setCaixaRealMes(doMes.reduce((sum, p) => sum + p.valorLiquido, 0))
    } else {
      setCaixaRealMes(null)
    }

    setLoading(false)
  }

  const receitaBruta = entradas.reduce((s, e) => s + Number(e.valor_bruto || 0), 0)
  const taxas = entradas.reduce((s, e) => s + Number(e.valor_taxa || 0), 0)
  const receitaLiquida = entradas.reduce((s, e) => s + Number(e.valor_liquido || 0), 0)

  // Só exibe a linha de caixa real quando ela diverge de forma relevante da
  // receita por competência — ou seja, quando existem recebimentos futuros
  // (parcelas/prazos) puxando dinheiro de um mês pra outro. Se a clínica só
  // recebe à vista (pix/dinheiro), os dois valores coincidem e a linha extra
  // só atrapalharia.
  const mostrarCaixaReal = caixaRealMes !== null && Math.abs(caixaRealMes - receitaLiquida) > 0.01

  const despesasPorCategoria = saidas.reduce((acc, s) => {
    const cat = s.categoria_dre || 'Outros'
    acc[cat] = (acc[cat] || 0) + Number(s.valor || 0)
    return acc
  }, {} as Record<string, number>)

  const cmv = despesasPorCategoria['CMV / Insumos'] || 0
  const lucroBruto = receitaLiquida - cmv

  const despesasOperacionais = CATEGORIAS_DRE
    .filter(c => c !== 'CMV / Insumos' && c !== 'Despesas Financeiras')
    .reduce((s, c) => s + (despesasPorCategoria[c] || 0), 0)
  
  const ebitda = lucroBruto - despesasOperacionais

  const despesasFinanceiras = despesasPorCategoria['Despesas Financeiras'] || 0
  const lucroLiquido = ebitda - despesasFinanceiras

  const totalDespesas = saidas.reduce((s, e) => s + Number(e.valor || 0), 0)

  const mesLabel = new Date(mes + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <input
          type="month"
          value={mes}
          onChange={e => setMes(e.target.value)}
          className="px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
        />
        <span className="text-slate-500 capitalize">{mesLabel}</span>
        {loading && <Icon name="loader" className="w-5 h-5 animate-spin text-violet-600" />}
      </div>

      {scope === 'own' && (
        <div className="p-3 bg-violet-50 border border-violet-200 rounded-xl text-xs text-violet-700">
          Mostrando apenas a sua receita. Despesas, CMV e lucro são calculados no nível da clínica e não aparecem no seu modo de acesso.
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-purple-50">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <Icon name="pieChart" className="w-5 h-5 text-violet-600" />
            Demonstração do Resultado - {mesLabel}
          </h3>
        </div>

        <div className="divide-y divide-slate-100">
          <div className="flex justify-between items-center p-4 bg-slate-50">
            <span className="font-semibold text-slate-900">RECEITA BRUTA</span>
            <span className="font-bold text-lg text-slate-900">{fmt(receitaBruta)}</span>
          </div>

          <div className="flex justify-between items-center p-4 pl-8">
            <span className="text-slate-600">(-) Taxas de cartão/pagamento</span>
            <span className="text-rose-600">-{fmt(taxas)}</span>
          </div>

          <div className="flex justify-between items-center p-4 bg-emerald-50">
            <div>
              <span className="font-semibold text-emerald-800">= RECEITA LÍQUIDA</span>
              {mostrarCaixaReal && <span className="text-xs text-emerald-600 ml-2 block sm:inline">(vendas do mês, competência)</span>}
            </div>
            <div className="text-right">
              <span className="font-bold text-lg text-emerald-700">{fmt(receitaLiquida)}</span>
              <span className="text-xs text-emerald-600 ml-2">(100%)</span>
            </div>
          </div>

          {mostrarCaixaReal && (
            <div className="flex justify-between items-center p-4 bg-cyan-50">
              <div>
                <span className="font-semibold text-cyan-800">CAIXA REAL DO MÊS</span>
                <span className="text-xs text-cyan-600 ml-2 block sm:inline">(o que efetivamente cai na conta este mês)</span>
              </div>
              <div className="text-right">
                <span className={`font-bold text-lg ${(caixaRealMes ?? 0) >= 0 ? 'text-cyan-700' : 'text-rose-700'}`}>
                  {fmt(caixaRealMes ?? 0)}
                </span>
              </div>
            </div>
          )}

          {scope === 'all' && (
          <>
          <div className="flex justify-between items-center p-4 pl-8">
            <span className="text-slate-600">(-) CMV / Insumos</span>
            <div className="text-right">
              <span className="text-rose-600">-{fmt(cmv)}</span>
              {receitaLiquida > 0 && (
                <span className="text-xs text-slate-500 ml-2">({fmtPct(cmv / receitaLiquida)})</span>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center p-4 bg-blue-50">
            <span className="font-semibold text-blue-800">= LUCRO BRUTO</span>
            <div className="text-right">
              <span className="font-bold text-lg text-blue-700">{fmt(lucroBruto)}</span>
              {receitaLiquida > 0 && (
                <span className="text-xs text-blue-600 ml-2">({fmtPct(lucroBruto / receitaLiquida)})</span>
              )}
            </div>
          </div>

          <div className="p-4 pl-8 space-y-2">
            <div className="flex justify-between items-center text-slate-600">
              <span>(-) Despesas Operacionais:</span>
            </div>
            {CATEGORIAS_DRE.filter(c => c !== 'CMV / Insumos' && c !== 'Despesas Financeiras').map(cat => (
              <div key={cat} className="flex justify-between items-center pl-4 text-sm">
                <span className="text-slate-500">{cat}</span>
                <span className="text-rose-500">-{fmt(despesasPorCategoria[cat] || 0)}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center p-4 bg-amber-50">
            <div>
              <span className="font-semibold text-amber-800">= EBITDA</span>
              <span className="text-xs text-amber-600 ml-2">(Lucro Operacional)</span>
            </div>
            <div className="text-right">
              <span className={`font-bold text-lg ${ebitda >= 0 ? 'text-amber-700' : 'text-rose-700'}`}>{fmt(ebitda)}</span>
              {receitaLiquida > 0 && (
                <span className="text-xs text-amber-600 ml-2">({fmtPct(ebitda / receitaLiquida)})</span>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center p-4 pl-8">
            <span className="text-slate-600">(-) Despesas Financeiras</span>
            <span className="text-rose-600">-{fmt(despesasFinanceiras)}</span>
          </div>

          <div className={`flex justify-between items-center p-4 ${lucroLiquido >= 0 ? 'bg-emerald-100' : 'bg-rose-100'}`}>
            <span className={`font-bold ${lucroLiquido >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
              = LUCRO LÍQUIDO
            </span>
            <div className="text-right">
              <span className={`font-black text-xl ${lucroLiquido >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {fmt(lucroLiquido)}
              </span>
              {receitaLiquida > 0 && (
                <span className={`text-xs ml-2 ${lucroLiquido >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  ({fmtPct(lucroLiquido / receitaLiquida)})
                </span>
              )}
            </div>
          </div>
          </>
          )}
        </div>
      </div>

      {scope === 'all' && (
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Icon name="barChart" className="w-5 h-5 text-violet-600" />
            Resumo por Categoria
          </h4>
          <div className="space-y-1">
            {(() => {
              const chartData = CATEGORIAS_DRE
                .map(cat => ({ categoria: cat, valor: despesasPorCategoria[cat] || 0 }))
                .filter(d => d.valor > 0)
              if (chartData.length === 0) {
                return <p className="text-sm text-slate-400 text-center py-6">Nenhuma despesa no período</p>
              }
              return (
                <div style={{ width: '100%', height: chartData.length * 34 + 10 }}>
                  <ResponsiveContainer>
                    <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="categoria"
                        width={140}
                        tick={{ fill: '#475569', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<CategoriaTooltip />} cursor={{ fill: '#f8fafc' }} />
                      <Bar dataKey="valor" radius={[0, 6, 6, 0]} barSize={16}>
                        {chartData.map((_, i) => (
                          <Cell key={i} fill={CAT_SHADES[i % CAT_SHADES.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )
            })()}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Icon name="activity" className="w-5 h-5 text-emerald-600" />
            Indicadores
          </h4>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-600">Margem Bruta</span>
              <span className={`font-bold ${lucroBruto >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {receitaLiquida > 0 ? fmtPct(lucroBruto / receitaLiquida) : '0%'}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-600">Margem EBITDA</span>
              <span className={`font-bold ${ebitda >= 0 ? 'text-amber-600' : 'text-rose-600'}`}>
                {receitaLiquida > 0 ? fmtPct(ebitda / receitaLiquida) : '0%'}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-600">Margem Líquida</span>
              <span className={`font-bold ${lucroLiquido >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {receitaLiquida > 0 ? fmtPct(lucroLiquido / receitaLiquida) : '0%'}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-600">Total de Despesas</span>
              <span className="font-bold text-rose-600">{fmt(totalDespesas)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-600">Atendimentos</span>
              <span className="font-bold text-slate-900">{entradas.length}</span>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  )
}
