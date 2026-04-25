'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import { createClient } from '@/lib/supabase/client'
import { todayBR } from '@/lib/datetime'

type Saida = {
  id: string
  data: string
  descricao: string
  categoria_dre: string | null
  fornecedor: string | null
  valor: number
  forma_pagamento: string | null
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

export default function SaidasList({ saidas, clinicId }: Props) {
  const [list, setList] = useState(saidas)
  const [search, setSearch] = useState('')
  const [mes, setMes] = useState(todayBR().slice(0, 7))
  const [categoria, setCategoria] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const supabase = createClient()

  const filteredList = list.filter(s => {
    const matchSearch = !search || 
      s.descricao?.toLowerCase().includes(search.toLowerCase()) ||
      s.fornecedor?.toLowerCase().includes(search.toLowerCase())
    const matchMes = !mes || s.data?.startsWith(mes)
    const matchCategoria = !categoria || s.categoria_dre === categoria
    return matchSearch && matchMes && matchCategoria
  })

  const total = filteredList.reduce((s, e) => s + Number(e.valor || 0), 0)

  const porCategoria = filteredList.reduce((acc, s) => {
    const cat = s.categoria_dre || 'Outros'
    acc[cat] = (acc[cat] || 0) + Number(s.valor || 0)
    return acc
  }, {} as Record<string, number>)

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja excluir esta saída?')) return
    setDeleting(id)
    
    const { error } = await supabase.from('saidas').delete().eq('id', id)
    
    if (error) {
      alert('Erro ao excluir: ' + error.message)
    } else {
      setList(list.filter(e => e.id !== id))
    }
    setDeleting(null)
  }

  return (
    <div className="space-y-4">
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
        <input
          type="month"
          value={mes}
          onChange={e => setMes(e.target.value)}
          className="px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
        />
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <div className="bg-rose-50 text-rose-700 px-4 py-2 rounded-xl">
          <span className="font-medium">Total:</span> {fmt(total)}
        </div>
        <div className="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl">
          <span className="font-medium">{filteredList.length}</span> registros
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
        <div className="overflow-x-auto">
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
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    Nenhuma saída encontrada
                  </td>
                </tr>
              ) : (
                filteredList.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm">
                      {new Date(s.data).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">
                      {s.descricao}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-1 bg-slate-100 rounded-lg text-xs">
                        {s.categoria_dre || 'Outros'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {s.fornecedor || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {s.forma_pagamento || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-rose-600">
                      -{fmt(s.valor)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDelete(s.id)}
                        disabled={deleting === s.id}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition disabled:opacity-50"
                      >
                        <Icon name={deleting === s.id ? 'loader' : 'trash'} className="w-4 h-4" />
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
