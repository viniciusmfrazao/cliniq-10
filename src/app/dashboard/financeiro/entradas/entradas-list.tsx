'use client'

import { useState, useTransition } from 'react'
import Icon from '@/components/ui/Icon'
import { todayBR } from '@/lib/datetime'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

type Entrada = {
  id: string
  data_venda: string
  paciente_nome: string
  procedimento_nome: string
  profissional_nome: string
  forma_pagamento: string
  bandeira: string | null
  valor_bruto: number
  valor_liquido: number
  taxa_percentual: number
}

type Props = {
  entradas: Entrada[]
  pacientes: { id: string; name: string }[]
  procedimentos: { id: string; name: string; price: number }[]
  profissionais: { id: string; name: string }[]
  clinicId: string
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

// Primeiro e último dia do mês atual
function primeiroDiaMes() {
  return todayBR().slice(0, 7) + '-01'
}
function ultimoDiaMes() {
  const hoje = todayBR()
  const [y, m] = hoje.slice(0, 7).split('-').map(Number)
  const ultimo = new Date(y, m, 0).getDate()
  return `${y}-${String(m).padStart(2,'0')}-${String(ultimo).padStart(2,'0')}`
}

export default function EntradasList({ entradas, clinicId }: Props) {
  const [list, setList] = useState(entradas)
  const [search, setSearch] = useState('')
  const [dataInicio, setDataInicio] = useState(primeiroDiaMes())
  const [dataFim, setDataFim] = useState(ultimoDiaMes())
  const [deleting, setDeleting] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()
  const toast = useToast()

  async function buscar() {
    startTransition(async () => {
      const params = new URLSearchParams()
      if (dataInicio) params.set('data_inicio', dataInicio)
      if (dataFim) params.set('data_fim', dataFim)
      const res = await fetch(`/api/financeiro/entradas?${params}`)
      if (!res.ok) {
        toast.error('Erro ao buscar entradas')
        return
      }
      const { data } = await res.json()
      setList(data || [])
    })
  }

  const filteredList = list.filter(e =>
    !search ||
    e.paciente_nome?.toLowerCase().includes(search.toLowerCase()) ||
    e.procedimento_nome?.toLowerCase().includes(search.toLowerCase()) ||
    e.profissional_nome?.toLowerCase().includes(search.toLowerCase())
  )

  const totalBruto = filteredList.reduce((s, e) => s + Number(e.valor_bruto || 0), 0)
  const totalLiquido = filteredList.reduce((s, e) => s + Number(e.valor_liquido || 0), 0)
  const totalTaxas = totalBruto - totalLiquido

  const porProcedimento = filteredList.reduce((acc, e) => {
    const proc = e.procedimento_nome || 'Sem procedimento'
    if (!acc[proc]) acc[proc] = { valor: 0, qtd: 0 }
    acc[proc].valor += Number(e.valor_bruto || 0)
    acc[proc].qtd += 1
    return acc
  }, {} as Record<string, { valor: number; qtd: number }>)

  async function handleDelete(id: string) {
    const removed = list.find(e => e.id === id)
    if (!removed) return

    setList(prev => prev.filter(e => e.id !== id))

    let undone = false
    toast.undo({
      title: 'Entrada removida',
      description: 'Você tem 5s para desfazer',
      duration: 5000,
      onUndo: () => {
        undone = true
        setList(prev => [...prev, removed].sort(
          (a, b) => (b.data_venda || '').localeCompare(a.data_venda || '')
        ))
      },
    })

    setTimeout(async () => {
      if (undone) return
      setDeleting(id)
      const { error } = await supabase.from('entradas').delete().eq('id', id)
      setDeleting(null)
      if (error) {
        setList(prev => [...prev, removed].sort(
          (a, b) => (b.data_venda || '').localeCompare(a.data_venda || '')
        ))
        toast.error('Erro ao excluir', { description: error.message })
      }
    }, 5200)
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Busca textual */}
          <div className="flex-1 relative">
            <Icon name="search" className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por paciente, procedimento ou profissional..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm"
            />
          </div>

          {/* Filtro de período */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <Icon name="calendar" className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <input
                type="date"
                value={dataInicio}
                onChange={e => setDataInicio(e.target.value)}
                className="bg-transparent text-sm text-slate-700 focus:outline-none w-32"
              />
              <span className="text-slate-400 text-sm">até</span>
              <input
                type="date"
                value={dataFim}
                onChange={e => setDataFim(e.target.value)}
                className="bg-transparent text-sm text-slate-700 focus:outline-none w-32"
              />
            </div>
            <button
              onClick={buscar}
              disabled={isPending}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-emerald-700 transition disabled:opacity-60 text-sm"
            >
              {isPending ? <LoadingSpinner size="sm" /> : <Icon name="search" className="w-4 h-4" />}
              Filtrar
            </button>
          </div>
        </div>
      </div>

      {/* Totais */}
      <div className="flex flex-wrap gap-3 text-sm">
        <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl">
          <span className="font-medium">Total Bruto:</span> {fmt(totalBruto)}
        </div>
        <div className="bg-violet-50 text-violet-700 px-4 py-2 rounded-xl">
          <span className="font-medium">Total Líquido:</span> {fmt(totalLiquido)}
        </div>
        {totalTaxas > 0 && (
          <div className="bg-rose-50 text-rose-700 px-4 py-2 rounded-xl">
            <span className="font-medium">Taxas:</span> {fmt(totalTaxas)}
          </div>
        )}
        <div className="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl">
          <span className="font-medium">{filteredList.length}</span> registros
        </div>
      </div>

      {/* Por procedimento */}
      {Object.keys(porProcedimento).length > 1 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <h4 className="font-semibold text-slate-700 mb-3 text-sm flex items-center gap-2">
            <Icon name="clipboard" className="w-4 h-4 text-emerald-600" />
            Por procedimento
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(porProcedimento)
              .sort((a, b) => b[1].valor - a[1].valor)
              .slice(0, 8)
              .map(([proc, data]) => (
              <div key={proc} className="bg-emerald-50 rounded-xl p-3">
                <p className="text-xs text-emerald-600 truncate" title={proc}>{proc}</p>
                <p className="font-bold text-emerald-700">{fmt(data.valor)}</p>
                <p className="text-xs text-emerald-500">{data.qtd} {data.qtd === 1 ? 'atendimento' : 'atendimentos'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Mobile: cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredList.length === 0 ? (
            <div className="px-4 py-12 text-center text-slate-500">
              {isPending ? 'Buscando...' : 'Nenhuma entrada encontrada'}
            </div>
          ) : filteredList.map(e => (
            <div key={e.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900">{e.paciente_nome || '-'}</p>
                  <p className="text-sm text-slate-500 truncate mt-0.5">{e.procedimento_nome || '-'}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-xs text-slate-400">
                      {new Date(e.data_venda + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </span>
                    <span className="px-2 py-0.5 bg-slate-100 rounded text-xs">{e.forma_pagamento}</span>
                    {e.profissional_nome && (
                      <span className="text-xs text-slate-400">{e.profissional_nome}</span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <p className="font-bold text-emerald-600">{fmt(e.valor_liquido)}</p>
                  <p className="text-xs text-slate-400">{fmt(e.valor_bruto)} bruto</p>
                  <button onClick={() => handleDelete(e.id)} disabled={deleting === e.id}
                    className="mt-1 p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg transition">
                    <Icon name={deleting === e.id ? 'loader' : 'trash'} className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: tabela */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Data</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Paciente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Procedimento</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Profissional</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Forma</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Bruto</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Líquido</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    {isPending ? 'Buscando...' : 'Nenhuma entrada encontrada'}
                  </td>
                </tr>
              ) : (
                filteredList.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm">
                      {new Date(e.data_venda + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">
                      {e.paciente_nome || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {e.procedimento_nome || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {e.profissional_nome || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-1 bg-slate-100 rounded-lg text-xs">
                        {e.forma_pagamento}
                        {e.bandeira && ` (${e.bandeira})`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-slate-900">
                      {fmt(e.valor_bruto)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span className="text-emerald-600 font-medium">{fmt(e.valor_liquido)}</span>
                      {e.taxa_percentual > 0 && (
                        <span className="text-xs text-slate-400 ml-1">(-{(e.taxa_percentual * 100).toFixed(1)}%)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDelete(e.id)}
                        disabled={deleting === e.id}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition disabled:opacity-50"
                      >
                        <Icon name={deleting === e.id ? 'loader' : 'trash'} className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
