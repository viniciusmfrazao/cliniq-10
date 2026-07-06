'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'
import { formatBRL } from '@/lib/format'
import { todayBR, addDaysBR, startOfMonthBR, endOfMonthBR, startOfDayBR, endOfDayBR, parseDateBR } from '@/lib/datetime'
import { PROFESSIONAL_ROLES, APPOINTMENT_STATUS_LABELS } from '@/lib/constants'

// Status que ainda podem virar receita — 'completed' já é receita realizada
// (entra em Entradas/Fluxo de Caixa) e nunca deve entrar numa previsão.
// 'cancelled' e 'no_show' nunca viram receita.
const FORECASTABLE_STATUSES = ['scheduled', 'pending_confirmation', 'confirmed', 'in_progress'] as const

const PERIODOS = [
  { value: 'amanha', label: 'Amanhã' },
  { value: 'restante_mes', label: 'Até fim do mês' },
  { value: 'proximo_mes', label: 'Próximo mês' },
  { value: 'proximos_30', label: 'Próximos 30 dias' },
  { value: 'custom', label: 'Personalizado' },
]

function getRange(periodo: string): { from: string; to: string } {
  const tomorrow = addDaysBR(todayBR(), 1)
  if (periodo === 'amanha') return { from: tomorrow, to: tomorrow }
  if (periodo === 'restante_mes') return { from: tomorrow, to: endOfMonthBR().slice(0, 10) }
  if (periodo === 'proximo_mes') {
    const nextMonthRef = new Date(`${todayBR()}T12:00:00-03:00`)
    nextMonthRef.setMonth(nextMonthRef.getMonth() + 1)
    return { from: startOfMonthBR(nextMonthRef).slice(0, 10), to: endOfMonthBR(nextMonthRef).slice(0, 10) }
  }
  if (periodo === 'proximos_30') return { from: tomorrow, to: addDaysBR(todayBR(), 30) }
  return { from: tomorrow, to: endOfMonthBR().slice(0, 10) }
}

type Row = {
  id: string
  start_time: string
  status: string
  professional_id: string | null
  professional_nome: string
  procedimento_nome: string | null
  categoria: string | null
  price: number | null
}

type Professional = { id: string; name: string }

export default function PrevisaoFaturamentoView({ clinicId }: { clinicId: string }) {
  const supabase = createClient()

  const [periodo, setPeriodo] = useState('restante_mes')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([...FORECASTABLE_STATUSES])
  const [selectedProfIds, setSelectedProfIds] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [groupBy, setGroupBy] = useState<'procedimento' | 'profissional' | 'dia'>('procedimento')

  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [semValorCount, setSemValorCount] = useState(0)
  const [jaLancadoCount, setJaLancadoCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)

  // Carrega profissionais e categorias uma vez
  useEffect(() => {
    (async () => {
      const [{ data: users }, { data: procs }] = await Promise.all([
        supabase.from('users').select('id, name, role, professional_role, active').eq('clinic_id', clinicId),
        supabase.from('procedures').select('category').eq('clinic_id', clinicId).eq('active', true),
      ])
      const profs = (users || []).filter((u: any) =>
        (PROFESSIONAL_ROLES.includes(u.role) || PROFESSIONAL_ROLES.includes(u.professional_role || '')) && u.active !== false
      )
      setProfessionals(profs.map((p: any) => ({ id: p.id, name: p.name })))
      const cats = Array.from(new Set((procs || []).map((p: any) => p.category).filter(Boolean))) as string[]
      setCategories(cats.sort())
    })()
  }, [clinicId])

  const load = useCallback(async (from: string, to: string) => {
    setLoading(true)
    try {
      const statuses = selectedStatuses.length > 0 ? selectedStatuses : [...FORECASTABLE_STATUSES]

      let query = supabase
        .from('appointments')
        .select(`
          id, start_time, status, professional_id, valor_cobrado,
          professional:users!appointments_professional_id_fkey(name),
          procedures(name, price, category),
          appointment_procedures(procedure_name, price)
        `)
        .eq('clinic_id', clinicId)
        .gte('start_time', startOfDayBR(from))
        .lte('start_time', endOfDayBR(to))
        .in('status', statuses)

      if (selectedProfIds.length > 0) query = query.in('professional_id', selectedProfIds)

      const { data: appointments, error } = await query
      if (error) throw error

      const apptIds = (appointments || []).map((a: any) => a.id)

      // Dedup: agendamentos que já têm entrada lançada não entram na previsão
      // (já viraram receita real, aparecem em Fluxo de Caixa/DRE)
      let lancados = new Set<string>()
      if (apptIds.length > 0) {
        const { data: entradasVinculadas } = await supabase
          .from('entradas')
          .select('appointment_id')
          .eq('clinic_id', clinicId)
          .in('appointment_id', apptIds)
        lancados = new Set((entradasVinculadas || []).map((e: any) => e.appointment_id))
      }

      let semValor = 0
      const parsed: Row[] = []
      for (const a of (appointments || []) as any[]) {
        if (lancados.has(a.id)) continue
        const proc = a.procedures
        const apProcs: { procedure_name: string; price: number }[] = a.appointment_procedures || []
        const somaProcs = apProcs.reduce((s, p) => s + (Number(p.price) || 0), 0)

        // Prioridade: valor_cobrado (definido manualmente ou com desconto) > soma de múltiplos procedimentos > preço do procedimento único
        const price = a.valor_cobrado != null
          ? Number(a.valor_cobrado)
          : (apProcs.length > 0 ? somaProcs : (proc?.price != null ? Number(proc.price) : null))

        if (price === null) { semValor++; continue }
        if (selectedCategories.length > 0 && !selectedCategories.includes(proc?.category || '')) continue
        parsed.push({
          id: a.id,
          start_time: a.start_time,
          status: a.status,
          professional_id: a.professional_id,
          professional_nome: a.professional?.name || 'Sem profissional',
          procedimento_nome: apProcs.length > 0 ? apProcs.map(p => p.procedure_name).join(' + ') : (proc?.name || 'Sem procedimento'),
          categoria: proc?.category || null,
          price,
        })
      }

      setRows(parsed)
      setSemValorCount(semValor)
      setJaLancadoCount(lancados.size)
    } finally {
      setLoading(false)
    }
  }, [clinicId, selectedStatuses, selectedProfIds, selectedCategories])

  useEffect(() => {
    if (periodo !== 'custom') {
      const { from, to } = getRange(periodo)
      setDateFrom(from)
      setDateTo(to)
      load(from, to)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo, selectedStatuses, selectedProfIds, selectedCategories])

  const totalPrevisto = useMemo(() => rows.reduce((s, r) => s + (r.price || 0), 0), [rows])
  const ticketMedio = rows.length > 0 ? totalPrevisto / rows.length : 0

  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; qtd: number; total: number }>()
    for (const r of rows) {
      let key: string
      if (groupBy === 'procedimento') key = r.procedimento_nome || 'Sem procedimento'
      else if (groupBy === 'profissional') key = r.professional_nome
      else key = parseDateBR(r.start_time)

      const cur = map.get(key) || { label: key, qtd: 0, total: 0 }
      cur.qtd++
      cur.total += r.price || 0
      map.set(key, cur)
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [rows, groupBy])

  function toggleStatus(s: string) {
    setSelectedStatuses(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }
  function toggleProf(id: string) {
    setSelectedProfIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  function toggleCategory(c: string) {
    setSelectedCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }

  return (
    <div className="space-y-4">
      {/* Período */}
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

        {periodo === 'custom' && (
          <>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input text-sm" />
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input text-sm" />
            <button onClick={() => load(dateFrom, dateTo)} className="btn-secondary text-sm px-4 h-10">
              Filtrar
            </button>
          </>
        )}

        <select value={groupBy} onChange={e => setGroupBy(e.target.value as any)}
          className="input text-sm h-10 !w-auto min-w-[210px] flex-shrink-0 py-0">
          <option value="procedimento">Agrupar por procedimento</option>
          <option value="profissional">Agrupar por profissional</option>
          <option value="dia">Agrupar por dia</option>
        </select>

        <button onClick={() => setShowFilters(v => !v)}
          className="ml-auto flex items-center gap-2 px-4 h-10 border border-slate-200 hover:border-slate-300 text-sm font-semibold rounded-xl transition-colors text-slate-700">
          <Icon name="filter" className="w-4 h-4" />
          Filtros
          {(selectedProfIds.length > 0 || selectedCategories.length > 0 || selectedStatuses.length < FORECASTABLE_STATUSES.length) && (
            <span className="w-2 h-2 rounded-full bg-violet-500" />
          )}
        </button>
      </div>

      {/* Painel de filtros avançados */}
      {showFilters && (
        <div className="card p-4 space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">Status considerados na previsão</p>
            <div className="flex flex-wrap gap-2">
              {FORECASTABLE_STATUSES.map(s => (
                <button key={s} onClick={() => toggleStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    selectedStatuses.includes(s)
                      ? 'bg-violet-100 border-violet-300 text-violet-700'
                      : 'bg-white border-slate-200 text-slate-400'
                  }`}>
                  {APPOINTMENT_STATUS_LABELS[s] || s}
                </button>
              ))}
            </div>
          </div>

          {professionals.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">Profissional</p>
              <div className="flex flex-wrap gap-2">
                {professionals.map(p => (
                  <button key={p.id} onClick={() => toggleProf(p.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      selectedProfIds.includes(p.id)
                        ? 'bg-blue-100 border-blue-300 text-blue-700'
                        : 'bg-white border-slate-200 text-slate-500'
                    }`}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {categories.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">Categoria de procedimento</p>
              <div className="flex flex-wrap gap-2">
                {categories.map(c => (
                  <button key={c} onClick={() => toggleCategory(c)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      selectedCategories.includes(c)
                        ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                        : 'bg-white border-slate-200 text-slate-500'
                    }`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{formatBRL(totalPrevisto)}</p>
          <p className="text-xs text-slate-500 mt-0.5">Receita prevista</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{rows.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Agendamentos considerados</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-violet-600">{formatBRL(ticketMedio)}</p>
          <p className="text-xs text-slate-500 mt-0.5">Ticket médio previsto</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-amber-500">{semValorCount}</p>
          <p className="text-xs text-slate-500 mt-0.5">Sem valor definido</p>
        </div>
      </div>

      {jaLancadoCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
          <Icon name="alertCircle" className="w-4 h-4 flex-shrink-0" />
          {jaLancadoCount} agendamento(s) do período já têm entrada financeira lançada e foram excluídos da previsão para evitar contar a receita duas vezes.
        </div>
      )}

      {/* Tabela agrupada */}
      {loading ? (
        <div className="card p-8 text-center text-slate-400">Carregando...</div>
      ) : rows.length === 0 ? (
        <div className="card p-8 text-center text-slate-400">Nenhum agendamento futuro no período/filtros selecionados</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400">
                  {groupBy === 'procedimento' ? 'Procedimento' : groupBy === 'profissional' ? 'Profissional' : 'Dia'}
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400">Qtd</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400">Total previsto</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-400">%</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map(g => {
                const pct = totalPrevisto > 0 ? (g.total / totalPrevisto) * 100 : 0
                return (
                  <tr key={g.label} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900">{g.label}</td>
                    <td className="py-3 px-4 text-right text-slate-600">{g.qtd}</td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-900">{formatBRL(g.total)}</td>
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
                <td className="py-3 px-4"><span className="text-sm font-bold text-slate-900">Total</span></td>
                <td className="py-3 px-4 text-right font-bold text-slate-900">{rows.length}</td>
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
