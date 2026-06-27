'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import { createClient } from '@/lib/supabase/client'
import { todayBR, parseDateBR } from '@/lib/datetime'
import { useToast } from '@/components/ui/Toast'

type Saida = {
  id: string
  data: string
  data_vencimento: string | null
  pago: boolean
  descricao: string
  categoria_dre: string | null
  subcategoria: string | null
  fornecedor: string | null
  valor: number
  forma_pagamento: string | null
  is_recurring?: boolean
  recurrence_id?: string | null
}

type Props = {
  saidas: Saida[]
  clinicId: string
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

function diasParaVencer(dataVenc: string): number {
  const hoje = todayBR()
  const diff = new Date(dataVenc).getTime() - new Date(hoje).getTime()
  return Math.round(diff / 86400000)
}

function VencimentoBadge({ dataVenc }: { dataVenc: string }) {
  const dias = diasParaVencer(dataVenc)
  if (dias < 0) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
      ⚠️ {Math.abs(dias)}d atrasado
    </span>
  )
  if (dias === 0) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
      🔔 Vence hoje
    </span>
  )
  if (dias <= 7) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-600">
      ⏰ {dias}d para vencer
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
      📅 {parseDateBR(dataVenc)}
    </span>
  )
}

function RecorrenteBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700">
      🔁 Fixa
    </span>
  )
}

export default function SaidasList({ saidas: initial, clinicId }: Props) {
  const [list, setList] = useState(initial)
  const [search, setSearch] = useState('')
  const [mes, setMes] = useState(todayBR().slice(0, 7))
  const [categoria, setCategoria] = useState('')
  const [aba, setAba] = useState<'lancadas' | 'a_pagar'>('lancadas')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [marcando, setMarcando] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; recurrenceId: string | null } | null>(null)
  const supabase = createClient()
  const toast = useToast()
  const hoje = todayBR()

  const lancadas = list.filter(s => s.pago)
  const aPagar = list.filter(s => !s.pago).sort((a, b) =>
    (a.data_vencimento || '').localeCompare(b.data_vencimento || '')
  )
  const urgentes = aPagar.filter(s => s.data_vencimento && diasParaVencer(s.data_vencimento) <= 0)

  const filteredLancadas = lancadas.filter(s => {
    const matchSearch = !search ||
      s.descricao?.toLowerCase().includes(search.toLowerCase()) ||
      s.fornecedor?.toLowerCase().includes(search.toLowerCase())
    const matchMes = !mes || s.data?.startsWith(mes)
    const matchCat = !categoria || s.categoria_dre === categoria
    return matchSearch && matchMes && matchCat
  })

  const filteredAPagar = aPagar.filter(s => {
    const matchSearch = !search ||
      s.descricao?.toLowerCase().includes(search.toLowerCase()) ||
      s.fornecedor?.toLowerCase().includes(search.toLowerCase())
    const matchCat = !categoria || s.categoria_dre === categoria
    return matchSearch && matchCat
  })

  const total = filteredLancadas.reduce((acc, s) => acc + Number(s.valor || 0), 0)
  const totalAPagar = filteredAPagar.reduce((acc, s) => acc + Number(s.valor || 0), 0)

  const porCategoria = filteredLancadas.reduce((acc, s) => {
    const cat = s.categoria_dre || 'Outros'
    acc[cat] = (acc[cat] || 0) + Number(s.valor || 0)
    return acc
  }, {} as Record<string, number>)

  // Abre modal de confirmação se for recorrente, senão deleta direto
  function requestDelete(s: Saida) {
    if (s.is_recurring && s.recurrence_id) {
      setConfirmDelete({ id: s.id, recurrenceId: s.recurrence_id })
    } else {
      handleDeleteSingle(s.id)
    }
  }

  async function handleDeleteSingle(id: string) {
    setConfirmDelete(null)
    const removed = list.find(s => s.id === id)
    if (!removed) return
    setList(prev => prev.filter(s => s.id !== id))
    let undone = false
    toast.undo({
      title: 'Saída removida',
      description: 'Você tem 5s para desfazer',
      duration: 5000,
      onUndo: () => {
        undone = true
        setList(prev => [...prev, removed].sort((a, b) => (b.data || '').localeCompare(a.data || '')))
      },
    })
    setTimeout(async () => {
      if (undone) return
      setDeleting(id)
      const { error } = await supabase.from('saidas').delete().eq('id', id)
      setDeleting(null)
      if (error) {
        setList(prev => [...prev, removed].sort((a, b) => (b.data || '').localeCompare(a.data || '')))
        toast.error('Erro ao excluir', { description: error.message })
      }
    }, 5200)
  }

  async function handleDeleteSeries(recurrenceId: string) {
    setConfirmDelete(null)
    const removed = list.filter(s => s.recurrence_id === recurrenceId)
    setList(prev => prev.filter(s => s.recurrence_id !== recurrenceId))
    const { error } = await supabase
      .from('saidas')
      .delete()
      .eq('recurrence_id', recurrenceId)
      .eq('clinic_id', clinicId)
    if (error) {
      setList(prev => [...prev, ...removed].sort((a, b) => (b.data || '').localeCompare(a.data || '')))
      toast.error('Erro ao excluir série', { description: error.message })
    } else {
      toast.success(`Série removida (${removed.length} lançamentos)`)
    }
  }

  async function handleMarcarPago(s: Saida) {
    setMarcando(s.id)
    const { error } = await supabase
      .from('saidas')
      .update({ pago: true })
      .eq('id', s.id)
    setMarcando(null)
    if (error) {
      toast.error('Erro ao marcar como pago', { description: error.message })
    } else {
      setList(prev => prev.map(item =>
        item.id === s.id ? { ...item, pago: true, data: hoje } : item
      ))
      toast.success('Marcado como pago!')
    }
  }

  return (
    <div className="space-y-4">
      {/* Modal confirmação exclusão de série */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
            <h3 className="font-bold text-slate-900 text-lg">Excluir despesa recorrente</h3>
            <p className="text-slate-600 text-sm">
              Esta é uma despesa fixa. Deseja excluir apenas este mês ou toda a série?
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleDeleteSingle(confirmDelete.id)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Excluir só este mês
              </button>
              <button
                onClick={() => handleDeleteSeries(confirmDelete.recurrenceId!)}
                className="w-full px-4 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-semibold hover:bg-rose-700 transition"
              >
                Excluir toda a série
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="w-full px-4 py-2.5 text-slate-500 text-sm hover:underline"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alertas urgentes */}
      {urgentes.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-2xl">🚨</span>
          <div>
            <p className="font-bold text-red-700">
              {urgentes.length === 1
                ? '1 pagamento vencido ou vence hoje!'
                : `${urgentes.length} pagamentos vencidos ou vencem hoje!`}
            </p>
            <p className="text-sm text-red-600 mt-0.5">
              {urgentes.map(s => `${s.descricao} (${fmt(s.valor)})`).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Icon name="search" className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por descrição ou fornecedor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
          />
        </div>
        <select
          value={categoria}
          onChange={e => setCategoria(e.target.value)}
          className="px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
        >
          <option value="">Todas categorias</option>
          {CATEGORIAS_DRE.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {aba === 'lancadas' && (
          <input
            type="month"
            value={mes}
            onChange={e => setMes(e.target.value)}
            className="px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
          />
        )}
      </div>

      {/* Abas */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setAba('lancadas')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            aba === 'lancadas'
              ? 'border-rose-500 text-rose-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Lançadas
          <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">
            {filteredLancadas.length}
          </span>
        </button>
        <button
          onClick={() => setAba('a_pagar')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            aba === 'a_pagar'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          A Pagar
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            urgentes.length > 0
              ? 'bg-red-100 text-red-600'
              : 'bg-amber-100 text-amber-600'
          }`}>
            {filteredAPagar.length}
          </span>
        </button>
      </div>

      {/* ── ABA: LANÇADAS ── */}
      {aba === 'lancadas' && (
        <>
          <div className="flex flex-wrap gap-3 text-sm">
            <div className="bg-rose-50 text-rose-700 px-4 py-2 rounded-xl">
              <span className="font-medium">Total:</span> {fmt(total)}
            </div>
            <div className="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl">
              <span className="font-medium">{filteredLancadas.length}</span> registros
            </div>
          </div>

          {Object.keys(porCategoria).length > 1 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <h4 className="font-semibold text-slate-700 mb-3 text-sm">Por categoria</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(porCategoria).sort((a, b) => b[1] - a[1]).map(([cat, val]) => (
                  <div key={cat} className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-500 truncate">{cat}</p>
                    <p className="font-bold text-slate-900">{fmt(val)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Mobile */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredLancadas.length === 0 ? (
                <div className="px-4 py-12 text-center text-slate-500">Nenhuma saída encontrada</div>
              ) : filteredLancadas.map(s => (
                <div key={s.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">{s.descricao}</p>
                        {s.is_recurring && <RecorrenteBadge />}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-xs text-slate-400">{parseDateBR(s.data)}</span>
                        <span className="px-2 py-0.5 bg-slate-100 rounded text-xs">{s.categoria_dre || 'Outros'}</span>
                        {s.subcategoria === 'aluguel_sala' && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">🏠 Aluguel de sala</span>
                        )}
                        {s.subcategoria === 'aluguel_mensal' && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">🏢 Aluguel mensal</span>
                        )}
                        {s.fornecedor && <span className="text-xs text-slate-500">{s.fornecedor}</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className="font-bold text-rose-600">-{fmt(s.valor)}</p>
                      <button onClick={() => requestDelete(s)} disabled={deleting === s.id}
                        className="mt-1 p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg transition">
                        <Icon name={deleting === s.id ? 'loader' : 'trash'} className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Data</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Descrição</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Categoria</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Fornecedor</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Forma</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Valor</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredLancadas.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                        Nenhuma saída encontrada
                      </td>
                    </tr>
                  ) : filteredLancadas.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm">{parseDateBR(s.data)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          {s.descricao}
                          {s.is_recurring && <RecorrenteBadge />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-1 bg-slate-100 rounded-lg text-xs">{s.categoria_dre || 'Outros'}</span>
                        {s.subcategoria === 'aluguel_sala' && (
                          <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs">🏠 Aluguel de sala</span>
                        )}
                        {s.subcategoria === 'aluguel_mensal' && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs">🏢 Aluguel mensal</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{s.fornecedor || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{s.forma_pagamento || '-'}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-rose-600">-{fmt(s.valor)}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => requestDelete(s)} disabled={deleting === s.id}
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition disabled:opacity-50">
                          <Icon name={deleting === s.id ? 'loader' : 'trash'} className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── ABA: A PAGAR ── */}
      {aba === 'a_pagar' && (
        <>
          <div className="flex flex-wrap gap-3 text-sm">
            <div className="bg-amber-50 text-amber-700 px-4 py-2 rounded-xl">
              <span className="font-medium">Total a pagar:</span> {fmt(totalAPagar)}
            </div>
            <div className="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl">
              <span className="font-medium">{filteredAPagar.length}</span> pendentes
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Mobile */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredAPagar.length === 0 ? (
                <div className="px-4 py-12 text-center text-slate-500">
                  <p className="text-2xl mb-2">✅</p>
                  <p>Nenhum pagamento pendente</p>
                </div>
              ) : filteredAPagar.map(s => (
                <div key={s.id} className={`p-4 ${
                  s.data_vencimento && diasParaVencer(s.data_vencimento) < 0
                    ? 'bg-red-50/60'
                    : s.data_vencimento && diasParaVencer(s.data_vencimento) === 0
                    ? 'bg-amber-50/60'
                    : ''
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">{s.descricao}</p>
                        {s.is_recurring && <RecorrenteBadge />}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {s.data_vencimento && <VencimentoBadge dataVenc={s.data_vencimento} />}
                        <span className="px-2 py-0.5 bg-slate-100 rounded text-xs">{s.categoria_dre || 'Outros'}</span>
                        {s.subcategoria === 'aluguel_sala' && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">🏠 Aluguel de sala</span>
                        )}
                        {s.subcategoria === 'aluguel_mensal' && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">🏢 Aluguel mensal</span>
                        )}
                        {s.fornecedor && <span className="text-xs text-slate-500">{s.fornecedor}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <p className="font-bold text-rose-600">-{fmt(s.valor)}</p>
                      <button
                        onClick={() => handleMarcarPago(s)}
                        disabled={marcando === s.id}
                        className="text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
                      >
                        {marcando === s.id ? '...' : '✓ Pago'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Vencimento</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Descrição</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Categoria</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Fornecedor</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Forma</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Valor</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredAPagar.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                        ✅ Nenhum pagamento pendente
                      </td>
                    </tr>
                  ) : filteredAPagar.map(s => (
                    <tr key={s.id} className={`${
                      s.data_vencimento && diasParaVencer(s.data_vencimento) < 0
                        ? 'bg-red-50/40'
                        : s.data_vencimento && diasParaVencer(s.data_vencimento) === 0
                        ? 'bg-amber-50/40'
                        : 'hover:bg-slate-50'
                    }`}>
                      <td className="px-4 py-3 text-sm">
                        {s.data_vencimento
                          ? <VencimentoBadge dataVenc={s.data_vencimento} />
                          : <span className="text-slate-400">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          {s.descricao}
                          {s.is_recurring && <RecorrenteBadge />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-1 bg-slate-100 rounded-lg text-xs">{s.categoria_dre || 'Outros'}</span>
                        {s.subcategoria === 'aluguel_sala' && (
                          <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs">🏠 Aluguel de sala</span>
                        )}
                        {s.subcategoria === 'aluguel_mensal' && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs">🏢 Aluguel mensal</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{s.fornecedor || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{s.forma_pagamento || '-'}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-rose-600">-{fmt(s.valor)}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleMarcarPago(s)}
                            disabled={marcando === s.id}
                            className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
                          >
                            {marcando === s.id ? '...' : '✓ Marcar pago'}
                          </button>
                          <button onClick={() => requestDelete(s)} disabled={deleting === s.id}
                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition disabled:opacity-50">
                            <Icon name={deleting === s.id ? 'loader' : 'trash'} className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
