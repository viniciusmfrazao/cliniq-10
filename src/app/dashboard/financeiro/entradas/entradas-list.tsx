'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import { createClient } from '@/lib/supabase/client'
import { todayBR } from '@/lib/datetime'
import { useToast } from '@/components/ui/Toast'

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

export default function EntradasList({ entradas, clinicId }: Props) {
  const [list, setList] = useState(entradas)
  const [search, setSearch] = useState('')
  const [mes, setMes] = useState(todayBR().slice(0, 7))
  const [deleting, setDeleting] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()

  const filteredList = list.filter(e => {
    const matchSearch = !search || 
      e.paciente_nome?.toLowerCase().includes(search.toLowerCase()) ||
      e.procedimento_nome?.toLowerCase().includes(search.toLowerCase())
    const matchMes = !mes || e.data_venda?.startsWith(mes)
    return matchSearch && matchMes
  })

  const totalBruto = filteredList.reduce((s, e) => s + Number(e.valor_bruto || 0), 0)
  const totalLiquido = filteredList.reduce((s, e) => s + Number(e.valor_liquido || 0), 0)

  const porProcedimento = filteredList.reduce((acc, e) => {
    const proc = e.procedimento_nome || 'Sem procedimento'
    if (!acc[proc]) acc[proc] = { valor: 0, qtd: 0 }
    acc[proc].valor += Number(e.valor_bruto || 0)
    acc[proc].qtd += 1
    return acc
  }, {} as Record<string, { valor: number; qtd: number }>)

  async function handleDelete(id: string) {
    // Padrao optimistic-undo:
    // 1) Remove visualmente AGORA (UX rapida)
    // 2) Mostra toast com botao "Desfazer" por 5s
    // 3) Se nao desfizer no prazo, manda o DELETE pro banco
    const removed = list.find(e => e.id === id)
    if (!removed) return

    setList(prev => prev.filter(e => e.id !== id))

    let undone = false
    toast.undo({
      title: 'Entrada removida',
      description: 'Voce tem 5s pra desfazer',
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
        // restaura e avisa
        setList(prev => [...prev, removed].sort(
          (a, b) => (b.data_venda || '').localeCompare(a.data_venda || '')
        ))
        toast.error('Erro ao excluir', { description: error.message })
      }
    }, 5200)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Icon name="search" className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por paciente ou procedimento..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>
        <input
          type="month"
          value={mes}
          onChange={e => setMes(e.target.value)}
          className="px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
        />
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl">
          <span className="font-medium">Total Bruto:</span> {fmt(totalBruto)}
        </div>
        <div className="bg-violet-50 text-violet-700 px-4 py-2 rounded-xl">
          <span className="font-medium">Total Líquido:</span> {fmt(totalLiquido)}
        </div>
        <div className="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl">
          <span className="font-medium">{filteredList.length}</span> registros
        </div>
      </div>

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

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
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
                    Nenhuma entrada encontrada
                  </td>
                </tr>
              ) : (
                filteredList.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm">
                      {new Date(e.data_venda).toLocaleDateString('pt-BR')}
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
                        <span className="text-xs text-slate-400 ml-1">(-{e.taxa_percentual}%)</span>
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
