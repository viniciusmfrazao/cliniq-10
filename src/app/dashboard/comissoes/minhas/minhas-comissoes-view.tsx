'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

type EntradaComissao = {
  id: string
  data_venda: string
  paciente_nome: string
  procedimento_nome: string
  valor_bruto: number
  valor_liquido: number
  comissao_paga: boolean
  comissao_paga_em: string | null
}

type Props = {
  entradasIniciais: EntradaComissao[]
  percentual: number
  comissaoBase: 'bruto' | 'liquido'
  clinicId: string
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

function dataBR(iso: string) {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

export default function MinhasComissoesView({ entradasIniciais, percentual, comissaoBase, clinicId }: Props) {
  const supabase = createClient()
  const [mes, setMes] = useState(() => {
    const hoje = new Date()
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  })
  const [entradas, setEntradas] = useState(entradasIniciais)
  const [loading, setLoading] = useState(false)

  async function buscarMes(novoMes: string) {
    setMes(novoMes)
    setLoading(true)
    const [ano, m] = novoMes.split('-').map(Number)
    const primeiroDia = `${ano}-${String(m).padStart(2, '0')}-01`
    const ultimoDiaData = new Date(ano, m, 0)
    const ultimoDia = `${ultimoDiaData.getFullYear()}-${String(ultimoDiaData.getMonth() + 1).padStart(2, '0')}-${String(ultimoDiaData.getDate()).padStart(2, '0')}`

    const { data: me } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('entradas')
      .select('id, data_venda, paciente_nome, procedimento_nome, valor_bruto, valor_liquido, comissao_paga, comissao_paga_em')
      .eq('clinic_id', clinicId)
      .eq('profissional_id', me.user?.id)
      .gte('data_venda', primeiroDia)
      .lte('data_venda', ultimoDia)
      .order('data_venda', { ascending: false })

    setEntradas(data || [])
    setLoading(false)
  }

  function base(e: EntradaComissao) {
    return Number((comissaoBase === 'liquido' ? e.valor_liquido : e.valor_bruto) || 0)
  }
  function valorComissao(e: EntradaComissao) {
    return base(e) * (percentual / 100)
  }

  const totalGeral = entradas.reduce((s, e) => s + valorComissao(e), 0)
  const totalPago = entradas.filter(e => e.comissao_paga).reduce((s, e) => s + valorComissao(e), 0)
  const totalPendente = totalGeral - totalPago

  return (
    <div className="space-y-6">
      <div className="card p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Icon name="calendar" className="w-4 h-4 text-slate-400" />
          <input type="month" value={mes} onChange={e => buscarMes(e.target.value)}
            className="input text-sm" />
        </div>
        <span className="text-xs text-slate-400">
          Comissão de {percentual}% sobre o valor {comissaoBase === 'liquido' ? 'líquido' : 'bruto'} de cada atendimento
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-xs text-slate-500">Total do mês</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{fmt(totalGeral)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500">Já recebido</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{fmt(totalPago)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500">A receber</p>
          <p className="text-xl font-bold text-amber-600 mt-1">{fmt(totalPendente)}</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center"><LoadingSpinner /></div>
        ) : entradas.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-10">
            Nenhum atendimento com comissão nesse mês.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {entradas.map(e => (
              <div key={e.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{e.paciente_nome}</p>
                  <p className="text-xs text-slate-500 truncate">{e.procedimento_nome} · {dataBR(e.data_venda)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-semibold text-teal-700">{fmt(valorComissao(e))}</p>
                  <p className="text-xs text-slate-400">{fmt(base(e))} {comissaoBase === 'liquido' ? 'líquido' : 'bruto'}</p>
                  <span className={`inline-block mt-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                    e.comissao_paga ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {e.comissao_paga ? 'Paga' : 'Pendente'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
