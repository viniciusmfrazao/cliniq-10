'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type DayStats = {
  dia: string
  respostas: number
  leads_ativos: number
  input_tokens: number
  cache_write_tokens: number
  cache_read_tokens: number
  output_tokens: number
  custo_usd: number
}

export default function EvaCostPanel({ clinicId }: { clinicId: string }) {
  const [stats, setStats] = useState<DayStats[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('eva_daily_cost')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('dia', { ascending: false })
        .limit(14)
      setStats(data || [])
      setLoading(false)
    }
    load()
  }, [clinicId])

  if (loading) return <div className="card p-4 animate-pulse h-40" />

  const total30d = stats.reduce((s, d) => s + Number(d.custo_usd), 0)
  const hoje = stats[0]
  const ontem = stats[1]
  const mediaUlt7 = stats.slice(0, 7).reduce((s, d) => s + Number(d.custo_usd), 0) / Math.min(7, stats.length)

  // Percentual de cache_write vs total tokens
  const cacheWritePct = hoje
    ? Math.round((hoje.cache_write_tokens / Math.max(hoje.input_tokens + hoje.cache_write_tokens + hoje.output_tokens, 1)) * 100)
    : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Custo da API Anthropic</h3>
        <span className="text-xs text-slate-400">Últimos 14 dias</span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-xs text-slate-500 mb-1">Hoje</p>
          <p className="text-xl font-bold text-slate-900">
            {hoje ? `$${Number(hoje.custo_usd).toFixed(3)}` : '$0.000'}
          </p>
          <p className="text-xs text-slate-400">{hoje?.respostas || 0} respostas</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-xs text-slate-500 mb-1">Ontem</p>
          <p className="text-xl font-bold text-slate-900">
            {ontem ? `$${Number(ontem.custo_usd).toFixed(3)}` : '$0.000'}
          </p>
          <p className="text-xs text-slate-400">{ontem?.respostas || 0} respostas</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-xs text-slate-500 mb-1">Média 7 dias</p>
          <p className="text-xl font-bold text-slate-900">${mediaUlt7.toFixed(3)}/dia</p>
          <p className="text-xs text-slate-400">~${(mediaUlt7 * 30).toFixed(0)}/mês</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-xs text-slate-500 mb-1">Total 14 dias</p>
          <p className="text-xl font-bold text-slate-900">${total30d.toFixed(2)}</p>
          <p className="text-xs text-slate-400">USD</p>
        </div>
      </div>

      {/* Cache efficiency */}
      {hoje && (hoje.cache_write_tokens + hoje.cache_read_tokens) > 0 && (
        <div className="bg-blue-50 rounded-xl p-3">
          <p className="text-xs font-medium text-blue-700 mb-2">Eficiência do cache hoje</p>
          <div className="flex gap-4 text-xs text-blue-600">
            <span>Cache write: {(hoje.cache_write_tokens / 1000).toFixed(0)}K tokens (${(hoje.cache_write_tokens * 3.75 / 1_000_000).toFixed(3)})</span>
            <span>Cache read: {(hoje.cache_read_tokens / 1000).toFixed(0)}K tokens (${(hoje.cache_read_tokens * 0.30 / 1_000_000).toFixed(3)})</span>
            <span>Output: {(hoje.output_tokens / 1000).toFixed(1)}K tokens</span>
          </div>
          <div className="mt-2 h-2 bg-blue-100 rounded-full overflow-hidden flex">
            <div className="bg-red-400 h-full" style={{ width: `${cacheWritePct}%` }} title={`Cache write: ${cacheWritePct}%`} />
            <div className="bg-green-400 h-full flex-1" title="Cache read + output" />
          </div>
          <div className="flex gap-3 mt-1 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-400 rounded-full inline-block" /> Cache write (caro)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-400 rounded-full inline-block" /> Cache read (barato)</span>
          </div>
        </div>
      )}

      {/* Tabela dos últimos dias */}
      {stats.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-slate-100">
                <th className="text-left py-2">Dia</th>
                <th className="text-right py-2">Respostas</th>
                <th className="text-right py-2">Leads</th>
                <th className="text-right py-2">Cache write</th>
                <th className="text-right py-2">Cache read</th>
                <th className="text-right py-2 font-semibold text-slate-600">Custo</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((d) => (
                <tr key={d.dia} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="py-2 text-slate-700">{new Date(d.dia + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}</td>
                  <td className="py-2 text-right text-slate-600">{d.respostas}</td>
                  <td className="py-2 text-right text-slate-600">{d.leads_ativos}</td>
                  <td className="py-2 text-right text-slate-500 text-xs">{d.cache_write_tokens > 0 ? `${(d.cache_write_tokens/1000).toFixed(0)}K` : '-'}</td>
                  <td className="py-2 text-right text-slate-500 text-xs">{d.cache_read_tokens > 0 ? `${(d.cache_read_tokens/1000).toFixed(0)}K` : '-'}</td>
                  <td className="py-2 text-right font-semibold text-slate-900">
                    {Number(d.custo_usd) > 0 ? `$${Number(d.custo_usd).toFixed(3)}` : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-slate-400 text-center py-4">
          Os dados de custo aparecem aqui após as primeiras respostas da Eva com o novo sistema.
        </p>
      )}

      <p className="text-xs text-slate-400">
        * Custo calculado com precos oficiais Anthropic: input $3/M, cache write $3.75/M, cache read $0.30/M, output $15/M tokens
      </p>
    </div>
  )
}
