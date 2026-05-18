'use client'

import { useState, useMemo } from 'react'
import Icon from '@/components/ui/Icon'

type Entrada = {
  paciente_id: string | null
  paciente_nome: string | null
  procedimento_nome: string | null
  valor_bruto: number
  valor_liquido: number
  data_venda: string
  forma_pagamento: string | null
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// ─── Ranking de Pacientes ─────────────────────────────────────────────────────
function RankingPacientes({ entradas }: { entradas: Entrada[] }) {
  const [search, setSearch] = useState('')
  const [ordenar, setOrdenar] = useState<'gasto' | 'visitas' | 'ticket'>('gasto')

  const ranking = useMemo(() => {
    const mapa: Record<string, { nome: string; total: number; visitas: number; ticket: number; ultima: string; procs: Record<string, number> }> = {}
    entradas.forEach(e => {
      const k = e.paciente_nome?.toLowerCase().trim() || 'sem_nome'
      if (!mapa[k]) mapa[k] = { nome: e.paciente_nome || '—', total: 0, visitas: 0, ticket: 0, ultima: '', procs: {} }
      mapa[k].total += Number(e.valor_bruto || 0)
      mapa[k].visitas++
      if (!mapa[k].ultima || e.data_venda > mapa[k].ultima) mapa[k].ultima = e.data_venda
      if (e.procedimento_nome) mapa[k].procs[e.procedimento_nome] = (mapa[k].procs[e.procedimento_nome] || 0) + 1
    })
    return Object.values(mapa).map(p => ({ ...p, ticket: p.visitas > 0 ? p.total / p.visitas : 0 }))
  }, [entradas])

  const lista = useMemo(() => {
    let l = ranking.filter(p => p.nome !== '—' && (!search || p.nome.toLowerCase().includes(search.toLowerCase())))
    if (ordenar === 'gasto') l.sort((a, b) => b.total - a.total)
    else if (ordenar === 'visitas') l.sort((a, b) => b.visitas - a.visitas)
    else l.sort((a, b) => b.ticket - a.ticket)
    return l
  }, [ranking, search, ordenar])

  const top3 = lista.slice(0, 3)

  return (
    <div className="space-y-4">
      {/* Top 3 */}
      {top3.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {top3.map((p, i) => (
            <div key={p.nome} className={`card p-4 text-center border-2 ${i === 0 ? 'border-amber-300 bg-amber-50' : i === 1 ? 'border-slate-300 bg-slate-50' : 'border-orange-200 bg-orange-50'}`}>
              <div className="text-2xl mb-1">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</div>
              <p className="font-bold text-slate-900 text-sm truncate">{p.nome}</p>
              <p className="text-lg font-bold text-violet-600 mt-1">{fmt(p.total)}</p>
              <p className="text-xs text-slate-400">{p.visitas} visita{p.visitas !== 1 ? 's' : ''}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar paciente..." className="input w-full pl-9 text-sm" />
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {([['gasto','Maior gasto'],['visitas','Mais visitas'],['ticket','Ticket médio']] as const).map(([v,l]) => (
            <button key={v} onClick={() => setOrdenar(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${ordenar === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              {['#','Paciente','Visitas','Total gasto','Ticket médio','Última visita','Proc. favorito'].map(h => (
                <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-slate-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lista.map((p, i) => {
              const favProc = Object.entries(p.procs).sort(([,a],[,b]) => b-a)[0]
              return (
                <tr key={p.nome} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-2.5 px-3 text-slate-400 font-medium">{i+1}</td>
                  <td className="py-2.5 px-3 font-medium text-slate-900">{p.nome}</td>
                  <td className="py-2.5 px-3 text-slate-600">{p.visitas}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">{fmt(p.total)}</td>
                  <td className="py-2.5 px-3 text-slate-500">{fmt(p.ticket)}</td>
                  <td className="py-2.5 px-3 text-slate-400">{p.ultima ? new Date(p.ultima+'T12:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="py-2.5 px-3 text-slate-500 text-xs">{favProc ? `${favProc[0]} (${favProc[1]}x)` : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {lista.length === 0 && <p className="text-center py-8 text-slate-400">Nenhum paciente encontrado</p>}
      </div>
    </div>
  )
}

// ─── Ranking de Procedimentos ─────────────────────────────────────────────────
function RankingProcedimentos({ entradas }: { entradas: Entrada[] }) {
  const data = useMemo(() => {
    const mapa: Record<string, { nome: string; qtd: number; fat: number; liquido: number }> = {}
    entradas.forEach(e => {
      const k = e.procedimento_nome || 'Sem nome'
      if (!mapa[k]) mapa[k] = { nome: k, qtd: 0, fat: 0, liquido: 0 }
      mapa[k].qtd++
      mapa[k].fat += Number(e.valor_bruto || 0)
      mapa[k].liquido += Number(e.valor_liquido || 0)
    })
    return Object.values(mapa).sort((a, b) => b.fat - a.fat)
  }, [entradas])

  const totalFat = data.reduce((s, r) => s + r.fat, 0)
  const totalQtd = data.reduce((s, r) => s + r.qtd, 0)

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            {['#','Procedimento','Qtd','Faturamento','Líquido','Ticket médio','%'].map(h => (
              <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-slate-400">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((r, i) => {
            const pct = totalFat > 0 ? (r.fat / totalFat) * 100 : 0
            return (
              <tr key={r.nome} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="py-2.5 px-3 text-slate-400">{i+1}</td>
                <td className="py-2.5 px-3 font-medium text-slate-900">{r.nome}</td>
                <td className="py-2.5 px-3 text-slate-600">{r.qtd}</td>
                <td className="py-2.5 px-3 font-semibold text-slate-900">{fmt(r.fat)}</td>
                <td className="py-2.5 px-3 text-emerald-600">{fmt(r.liquido)}</td>
                <td className="py-2.5 px-3 text-slate-500">{fmt(r.qtd > 0 ? r.fat/r.qtd : 0)}</td>
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-100 rounded-full h-1.5 min-w-12">
                      <div className="bg-violet-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-slate-400 w-8">{pct.toFixed(0)}%</span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-200 bg-slate-50">
            <td className="py-3 px-3" colSpan={2}><span className="text-sm font-bold text-slate-900">Total</span></td>
            <td className="py-3 px-3 font-bold text-slate-900">{totalQtd}</td>
            <td className="py-3 px-3 font-bold text-slate-900">{fmt(totalFat)}</td>
            <td className="py-3 px-3 font-bold text-emerald-600">{fmt(data.reduce((s,r)=>s+r.liquido,0))}</td>
            <td colSpan={2}/>
          </tr>
        </tfoot>
      </table>
      {data.length === 0 && <p className="text-center py-8 text-slate-400">Nenhum dado encontrado</p>}
    </div>
  )
}

// ─── View Principal ───────────────────────────────────────────────────────────
export default function RankingsView({ entradas }: { entradas: Entrada[] }) {
  const [aba, setAba] = useState<'pacientes' | 'procedimentos'>('pacientes')
  const [periodo, setPeriodo] = useState('mes')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0])
  const [appliedFrom, setAppliedFrom] = useState('')
  const [appliedTo, setAppliedTo] = useState('')

  // Filtrar por período
  const filtered = useMemo(() => {
    const now = new Date()
    let from = ''
    if (periodo === 'semana') {
      const d = new Date(now); d.setDate(d.getDate() - d.getDay())
      from = d.toISOString().split('T')[0]
    } else if (periodo === 'mes') {
      from = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
    } else if (periodo === 'ano') {
      from = `${now.getFullYear()}-01-01`
    } else {
      from = appliedFrom
    }
    const to = periodo === 'custom' ? appliedTo : now.toISOString().split('T')[0]
    return entradas.filter(e => (!from || e.data_venda >= from) && (!to || e.data_venda <= to))
  }, [entradas, periodo, appliedFrom, appliedTo])

  return (
    <div className="space-y-4">
      {/* Período */}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {([['semana','Esta semana'],['mes','Este mês'],['ano','Este ano'],['todos','Todos'],['custom','Personalizado']] as const).map(([v,l]) => (
            <button key={v} onClick={() => setPeriodo(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${periodo === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
              {l}
            </button>
          ))}
        </div>
        {periodo === 'custom' && (
          <>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input text-sm" />
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input text-sm" />
            <button onClick={() => { setAppliedFrom(dateFrom); setAppliedTo(dateTo) }} className="btn-secondary text-sm px-4 h-10">Filtrar</button>
          </>
        )}
        <span className="text-xs text-slate-400 ml-auto">{filtered.length} registros</span>
      </div>

      {/* Abas */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        <button onClick={() => setAba('pacientes')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${aba === 'pacientes' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          👥 Ranking de Pacientes
        </button>
        <button onClick={() => setAba('procedimentos')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${aba === 'procedimentos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          📊 Ranking de Procedimentos
        </button>
      </div>

      {aba === 'pacientes' ? <RankingPacientes entradas={filtered} /> : <RankingProcedimentos entradas={filtered} />}
    </div>
  )
}
