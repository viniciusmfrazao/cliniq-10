'use client'

import { useState, useEffect } from 'react'
import Icon from '@/components/ui/Icon'
import { createClient } from '@/lib/supabase/client'

type Entrada = {
  data_venda: string
  valor_bruto: number
  valor_liquido: number
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
  year: number
  scope?: 'all' | 'own'
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

export default function FluxoView({ entradas: initialEntradas, saidas: initialSaidas, clinicId, year: initialYear, scope = 'all' }: Props) {
  const [year, setYear] = useState(initialYear)
  const [entradas, setEntradas] = useState(initialEntradas)
  const [saidas, setSaidas] = useState(initialSaidas)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (year !== initialYear) loadData()
  }, [year])

  async function loadData() {
    setLoading(true)
    const [{ data: e }, { data: s }] = await Promise.all([
      supabase
        .from('entradas')
        .select('data_venda, valor_bruto, valor_liquido')
        .eq('clinic_id', clinicId)
        .gte('data_venda', `${year}-01-01`)
        .lte('data_venda', `${year}-12-31`),
      supabase
        .from('saidas')
        .select('data, valor, categoria_dre')
        .eq('clinic_id', clinicId)
        .eq('pago', true)
        .gte('data', `${year}-01-01`)
        .lte('data', `${year}-12-31`)
    ])
    setEntradas(e || [])
    setSaidas(s || [])
    setLoading(false)
  }

  const mesesData = MESES.map((label, idx) => {
    const mes = String(idx + 1).padStart(2, '0')
    const prefix = `${year}-${mes}`

    const entradasMes = entradas.filter(e => e.data_venda?.startsWith(prefix))
    const saidasMes = saidas.filter(s => s.data?.startsWith(prefix))

    const receitaBruta = entradasMes.reduce((s, e) => s + Number(e.valor_bruto || 0), 0)
    const receitaLiquida = entradasMes.reduce((s, e) => s + Number(e.valor_liquido || 0), 0)
    const despesas = saidasMes.reduce((s, e) => s + Number(e.valor || 0), 0)
    const resultado = receitaLiquida - despesas

    return { label, mes: prefix, receitaBruta, receitaLiquida, despesas, resultado, atendimentos: entradasMes.length }
  })

  const totalReceitaBruta = mesesData.reduce((s, m) => s + m.receitaBruta, 0)
  const totalReceitaLiquida = mesesData.reduce((s, m) => s + m.receitaLiquida, 0)
  const totalDespesas = mesesData.reduce((s, m) => s + m.despesas, 0)
  const totalResultado = mesesData.reduce((s, m) => s + m.resultado, 0)
  const totalAtendimentos = mesesData.reduce((s, m) => s + m.atendimentos, 0)

  const maxValue = Math.max(...mesesData.map(m => Math.max(m.receitaBruta, m.despesas))) || 1

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => setYear(year - 1)}
          className="p-2 hover:bg-slate-100 rounded-lg transition"
        >
          <Icon name="chevronLeft" className="w-5 h-5 text-slate-600" />
        </button>
        <span className="text-xl font-bold text-slate-900">{year}</span>
        <button
          onClick={() => setYear(year + 1)}
          className="p-2 hover:bg-slate-100 rounded-lg transition"
        >
          <Icon name="chevronRight" className="w-5 h-5 text-slate-600" />
        </button>
        {loading && <Icon name="loader" className="w-5 h-5 animate-spin text-violet-600" />}
      </div>

      {scope === 'own' && (
        <div className="p-3 bg-violet-50 border border-violet-200 rounded-xl text-xs text-violet-700">
          Mostrando apenas a sua receita. Despesas da clínica não aparecem no seu modo de acesso.
        </div>
      )}

      <div className={`grid grid-cols-2 ${scope === 'own' ? 'md:grid-cols-3' : 'md:grid-cols-5'} gap-4`}>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <p className="text-sm text-slate-500">Receita Bruta</p>
          <p className="text-2xl font-black text-slate-900">{fmt(totalReceitaBruta)}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <p className="text-sm text-slate-500">Receita Líquida</p>
          <p className="text-2xl font-black text-emerald-600">{fmt(totalReceitaLiquida)}</p>
        </div>
        {scope === 'all' && (
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <p className="text-sm text-slate-500">Despesas</p>
          <p className="text-2xl font-black text-rose-600">{fmt(totalDespesas)}</p>
        </div>
        )}
        {scope === 'all' && (
        <div className={`rounded-2xl p-5 border shadow-sm ${totalResultado >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
          <p className={`text-sm ${totalResultado >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>Resultado</p>
          <p className={`text-2xl font-black ${totalResultado >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{fmt(totalResultado)}</p>
        </div>
        )}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <p className="text-sm text-slate-500">Atendimentos</p>
          <p className="text-2xl font-black text-slate-900">{totalAtendimentos}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="font-bold text-slate-900 mb-4">Gráfico de Fluxo</h3>
        <div className="flex items-end gap-2 h-48">
          {mesesData.map((m, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex flex-col gap-0.5" style={{ height: '180px' }}>
                <div 
                  className="w-full bg-emerald-400 rounded-t transition-all"
                  style={{ height: `${(m.receitaBruta / maxValue) * 100}%` }}
                  title={`Receita: ${fmt(m.receitaBruta)}`}
                />
                <div 
                  className="w-full bg-rose-400 rounded-b transition-all"
                  style={{ height: `${(m.despesas / maxValue) * 100}%` }}
                  title={`Despesas: ${fmt(m.despesas)}`}
                />
              </div>
              <span className="text-xs text-slate-500">{m.label}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-4 text-sm justify-center">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-emerald-400 rounded" />
            <span className="text-slate-600">Receita</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-rose-400 rounded" />
            <span className="text-slate-600">Despesas</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Mês</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Receita Bruta</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Receita Líquida</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Despesas</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Resultado</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Atendimentos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {mesesData.map((m, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{m.label}/{year}</td>
                  <td className="px-4 py-3 text-sm text-right">{fmt(m.receitaBruta)}</td>
                  <td className="px-4 py-3 text-sm text-right text-emerald-600 font-medium">{fmt(m.receitaLiquida)}</td>
                  <td className="px-4 py-3 text-sm text-right text-rose-600">{fmt(m.despesas)}</td>
                  <td className={`px-4 py-3 text-sm text-right font-bold ${m.resultado >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {fmt(m.resultado)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-slate-600">{m.atendimentos}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-100 border-t border-slate-200">
              <tr>
                <td className="px-4 py-3 text-sm font-bold text-slate-900">TOTAL</td>
                <td className="px-4 py-3 text-sm text-right font-bold">{fmt(totalReceitaBruta)}</td>
                <td className="px-4 py-3 text-sm text-right font-bold text-emerald-600">{fmt(totalReceitaLiquida)}</td>
                <td className="px-4 py-3 text-sm text-right font-bold text-rose-600">{fmt(totalDespesas)}</td>
                <td className={`px-4 py-3 text-sm text-right font-black ${totalResultado >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {fmt(totalResultado)}
                </td>
                <td className="px-4 py-3 text-sm text-right font-bold">{totalAtendimentos}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
