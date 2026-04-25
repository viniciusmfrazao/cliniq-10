'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import { createClient } from '@/lib/supabase/client'
import { todayBR } from '@/lib/datetime'

type Props = {
  clinicId: string
  userId: string
}

const CATEGORIAS_DRE = [
  { value: 'CMV / Insumos', desc: 'Tudo para realizar procedimentos: botox, preenchedor, materiais' },
  { value: 'Despesas com Pessoal', desc: 'Salários, comissões, pró-labore, freelancers' },
  { value: 'Despesas Administrativas', desc: 'Aluguel, luz, água, internet, sistemas, manutenção' },
  { value: 'Despesas com Vendas', desc: 'Marketing, anúncios, designer, fotógrafo' },
  { value: 'Impostos e Obrigações', desc: 'DAS, INSS, contador, anuidades, alvarás' },
  { value: 'Despesas Financeiras', desc: 'Juros, IOF, parcelas de financiamento, tarifas bancárias' },
  { value: 'Outros', desc: 'Gastos que não se encaixam nas categorias acima' },
]

const FORMAS = ['Pix', 'Dinheiro', 'Débito', 'Crédito', 'Boleto', 'Transferência']

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

export default function SaidaForm({ clinicId, userId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  
  const [data, setData] = useState(todayBR())
  const [descricao, setDescricao] = useState('')
  const [categoria, setCategoria] = useState('')
  const [fornecedor, setFornecedor] = useState('')
  const [valor, setValor] = useState('')
  const [forma, setForma] = useState('Pix')
  const [observacoes, setObservacoes] = useState('')

  const categoriaInfo = CATEGORIAS_DRE.find(c => c.value === categoria)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const valorNum = parseFloat(valor)
    if (!descricao.trim()) {
      alert('Informe a descrição')
      return
    }
    if (!valorNum || valorNum <= 0) {
      alert('Informe o valor')
      return
    }
    
    setLoading(true)

    const { error } = await supabase.from('saidas').insert({
      clinic_id: clinicId,
      data,
      descricao: descricao.trim(),
      categoria_dre: categoria || null,
      fornecedor: fornecedor.trim() || null,
      valor: valorNum,
      forma_pagamento: forma,
      observacoes: observacoes.trim() || null,
      created_by: userId,
    })

    if (error) {
      alert('Erro ao salvar: ' + error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard/financeiro/saidas')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
        <h3 className="font-bold text-slate-900 flex items-center gap-2">
          <Icon name="receipt" className="w-5 h-5 text-slate-400" />
          Dados da despesa
        </h3>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Data *</label>
            <input
              type="date"
              value={data}
              onChange={e => setData(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fornecedor</label>
            <input
              type="text"
              value={fornecedor}
              onChange={e => setFornecedor(e.target.value)}
              placeholder="Nome do fornecedor"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Descrição *</label>
          <input
            type="text"
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            required
            placeholder="Ex: Compra de materiais, Conta de luz, Salário..."
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Categoria DRE *</label>
          <select
            value={categoria}
            onChange={e => setCategoria(e.target.value)}
            required
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
          >
            <option value="">Selecione a categoria</option>
            {CATEGORIAS_DRE.map(c => (
              <option key={c.value} value={c.value}>{c.value}</option>
            ))}
          </select>
          {categoriaInfo && (
            <p className="mt-2 text-sm text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
              💡 {categoriaInfo.desc}
            </p>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Forma de pagamento *</label>
            <select
              value={forma}
              onChange={e => setForma(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            >
              {FORMAS.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Valor (R$) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={valor}
              onChange={e => setValor(e.target.value)}
              required
              placeholder="0,00"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-lg font-semibold"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
          <textarea
            value={observacoes}
            onChange={e => setObservacoes(e.target.value)}
            rows={2}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            placeholder="Observações opcionais..."
          />
        </div>
      </div>

      {parseFloat(valor) > 0 && (
        <div className="bg-rose-50 rounded-2xl p-4 border border-rose-200">
          <div className="flex items-center justify-between">
            <span className="font-medium text-rose-700">Valor da saída</span>
            <span className="text-2xl font-bold text-rose-700">-{fmt(parseFloat(valor))}</span>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 px-6 py-3 border border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 transition"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-6 py-3 bg-rose-600 text-white rounded-xl font-semibold hover:bg-rose-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Icon name="loader" className="w-5 h-5 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Icon name="check" className="w-5 h-5" />
              Lançar Saída
            </>
          )}
        </button>
      </div>
    </form>
  )
}
