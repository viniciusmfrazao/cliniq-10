'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import { normalizeText } from '@/lib/text'
import {
  FORMAS_PAGAMENTO as FORMAS, BANDEIRAS_CARTAO as BANDEIRAS,
  calcPagamento, isBoleto, isCartao, type TaxaPag,
} from '@/lib/pagamento-helpers'

function PacienteBusca({ pacientes, onSelect }: { pacientes: { id: string; name: string }[], onSelect: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const filtered = query.length > 0
    ? pacientes.filter(p => normalizeText(p.name).includes(normalizeText(query))).slice(0, 8)
    : []

  function pick(p: { id: string; name: string }) {
    setSelected(p.name)
    setQuery(p.name)
    setOpen(false)
    onSelect(p.id)
  }

  return (
    <div className="relative" ref={ref}>
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onSelect('') }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Digite o nome do paciente..."
        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
          {filtered.map(p => (
            <button key={p.id} type="button" onMouseDown={() => pick(p)}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0">
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
import { createClient } from '@/lib/supabase/client'
import { todayBR } from '@/lib/datetime'
import { parseSupabaseError } from '@/lib/error-messages'


type Props = {
  pacientes: { id: string; name: string }[]
  procedimentos: { id: string; name: string; price: number }[]
  produtos: { id: string; name: string; sale_price: number; current_stock: number }[]
  profissionais: { id: string; name: string }[]
  taxasPagamento: TaxaPag[]
  clinicId: string
  userId: string
}

type Pagamento = { forma: string; bandeira: string; valor: string; vencimento: string }

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

export default function EntradaForm({ pacientes, procedimentos, produtos, profissionais, taxasPagamento, clinicId, userId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  
  const [dataVenda, setDataVenda] = useState(todayBR())
  const [pacienteId, setPacienteId] = useState('')
  const [pacienteNome, setPacienteNome] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [procedimentoId, setProcedimentoId] = useState('')
  const [procedimentoNome, setProcedimentoNome] = useState('')
  const [selectedProcs, setSelectedProcs] = useState<Array<{ id: string; name: string; price: number; quantidade: number }>>([])
  const [selectedProduto, setSelectedProduto] = useState<{ id: string; name: string; sale_price: number; current_stock: number; quantidade: number } | null>(null)
  const [profissionalId, setProfissionalId] = useState('')
  const [profissionalNome, setProfissionalNome] = useState('')
  const [valorBruto, setValorBruto] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [tipoReceita, setTipoReceitaRaw] = useState<'servico' | 'produto'>('servico')

  function setTipoReceita(tipo: 'servico' | 'produto') {
    setTipoReceitaRaw(tipo)
    // Limpa seleção do outro modo pra nao misturar procedimento + produto num mesmo lancamento
    if (tipo === 'servico') {
      setSelectedProduto(null)
      const v = selectedProcs.reduce((s, p) => s + p.price * p.quantidade, 0)
      setValorBruto(v.toString())
      syncPagamentoUnico(v)
    } else {
      setSelectedProcs([])
      setProcedimentoId('')
      setProcedimentoNome('')
      setValorBruto('')
      syncPagamentoUnico(0)
    }
  }

  // Mantem o valor da forma de pagamento em dia com o valor bruto quando so
  // existe uma linha de pagamento (se o usuario ja dividiu em mais de uma
  // forma manualmente, nao mexe pra nao bagunçar o que ele configurou).
  function syncPagamentoUnico(valor: number) {
    setPagamentos(prev => prev.length === 1 ? [{ ...prev[0], valor: valor > 0 ? valor.toString() : '' }] : prev)
  }

  function handleProdutoChange(id: string) {
    if (!id) { setSelectedProduto(null); setValorBruto(''); syncPagamentoUnico(0); return }
    const prod = produtos.find(p => p.id === id)
    if (!prod) return
    const next = { id: prod.id, name: prod.name, sale_price: prod.sale_price, current_stock: prod.current_stock, quantidade: 1 }
    setSelectedProduto(next)
    setValorBruto((prod.sale_price * 1).toString())
    syncPagamentoUnico(prod.sale_price * 1)
  }

  function updateProdutoQuantidade(delta: number) {
    setSelectedProduto(prev => {
      if (!prev) return prev
      const q = Math.max(1, prev.quantidade + delta)
      const next = { ...prev, quantidade: q }
      setValorBruto((next.sale_price * q).toString())
      syncPagamentoUnico(next.sale_price * q)
      return next
    })
  }

  // Pagamento: lista de linhas (permite dividir entre múltiplas formas)
  const [pagamentos, setPagamentos] = useState<Array<Pagamento>>([
    { forma: 'Pix', bandeira: '', valor: '', vencimento: '' }
  ])

  const valorNum = parseFloat(valorBruto) || 0
  const totalQuantidade = selectedProcs.reduce((s, p) => s + p.quantidade, 0)

  function linhaCalc(p: Pagamento) {
    return calcPagamento(taxasPagamento, p.forma, p.bandeira, parseFloat(p.valor) || 0)
  }

  const pagamentosCalc = pagamentos.map(linhaCalc)
  const totalAlocado = pagamentosCalc.reduce((s, p) => s + p.v, 0)
  const restante = Math.round((valorNum - totalAlocado) * 100) / 100
  const valorTaxaTotal = pagamentosCalc.reduce((s, p) => s + p.valorTaxa, 0)
  const valorLiquidoTotal = pagamentosCalc.reduce((s, p) => s + p.valorLiquido, 0)

  function addPagamento() {
    setPagamentos(prev => [...prev, { forma: 'Pix', bandeira: '', valor: restante > 0 ? restante.toFixed(2) : '', vencimento: '' }])
  }

  function removePagamento(idx: number) {
    setPagamentos(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)
  }

  function updatePagamento(idx: number, patch: Partial<Pagamento>) {
    setPagamentos(prev => prev.map((p, i) => i === idx ? { ...p, ...patch } : p))
  }

  function handlePacienteChange(id: string) {
    setPacienteId(id)
    const pac = pacientes.find(p => p.id === id)
    setPacienteNome(pac?.name || '')
  }

  function recalcTotais(next: Array<{ id: string; name: string; price: number; quantidade: number }>) {
    const total = next.reduce((s, p) => s + p.price * p.quantidade, 0)
    if (next.length > 0) setValorBruto(total > 0 ? total.toString() : '')
    setProcedimentoId(next[0]?.id || '')
    setProcedimentoNome(next.map(p => p.quantidade > 1 ? `${p.name} (x${p.quantidade})` : p.name).join(', '))
    syncPagamentoUnico(total)
  }

  function handleProcedimentoChange(id: string) {
    if (!id) return
    const proc = procedimentos.find(p => p.id === id)
    if (!proc) return
    // Toggle: se já está na lista, remove; se não, adiciona com quantidade 1
    setSelectedProcs(prev => {
      const exists = prev.find(p => p.id === id)
      const next = exists
        ? prev.filter(p => p.id !== id)
        : [...prev, { id: proc.id, name: proc.name, price: proc.price, quantidade: 1 }]
      recalcTotais(next)
      return next
    })
  }

  function updateProcQuantidade(id: string, quantidade: number) {
    if (quantidade < 1) return
    setSelectedProcs(prev => {
      const next = prev.map(p => p.id === id ? { ...p, quantidade } : p)
      recalcTotais(next)
      return next
    })
  }

  function removeProc(id: string) {
    setSelectedProcs(prev => {
      const next = prev.filter(p => p.id !== id)
      recalcTotais(next)
      return next
    })
  }

  function handleProfissionalChange(id: string) {
    setProfissionalId(id)
    const prof = profissionais.find(p => p.id === id)
    setProfissionalNome(prof?.name || '')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valorBruto || valorNum <= 0) {
      alert('Informe o valor')
      return
    }
    if (pagamentosCalc.some(p => p.v <= 0)) {
      alert('Cada forma de pagamento precisa de um valor maior que zero')
      return
    }
    if (Math.abs(restante) > 0.01) {
      const ok = confirm(
        restante > 0
          ? `Faltam ${fmt(restante)} para completar o valor total. Salvar mesmo assim?`
          : `O total das formas de pagamento excede o valor em ${fmt(-restante)}. Salvar mesmo assim?`
      )
      if (!ok) return
    }

    if (tipoReceita === 'produto') {
      if (!selectedProduto) {
        alert('Selecione um produto')
        return
      }
      setLoading(true)

      const pagamentosPayload = pagamentos.map((p, i) => {
        const calc = pagamentosCalc[i]
        return {
          forma: p.forma,
          bandeira: isCartao(p.forma) ? (p.bandeira || '') : '',
          valor: calc.v,
          taxa_percentual: calc.taxaEfetivaPct,
          valor_taxa: calc.valorTaxa,
          valor_liquido: calc.valorLiquido,
          n_parcelas: calc.nParcelas,
          primeiro_vencimento: isBoleto(p.forma) ? (p.vencimento || null) : null,
        }
      })

      const { error } = await supabase.rpc('fn_registrar_venda_produto', {
        p_user_id: userId,
        p_clinic_id: clinicId,
        p_product_id: selectedProduto.id,
        p_quantidade: selectedProduto.quantidade,
        p_data_venda: dataVenda,
        p_paciente_id: pacienteId || null,
        p_paciente_nome: pacienteNome || null,
        p_observacoes: observacoes || null,
        p_pagamentos: pagamentosPayload,
      })

      if (error) {
        alert('Erro ao registrar venda: ' + parseSupabaseError(error))
        setLoading(false)
        return
      }

      router.push('/dashboard/financeiro/entradas')
      router.refresh()
      return
    }

    setLoading(true)

    const vendaId = pagamentos.length > 1 ? crypto.randomUUID() : null
    const baseRow = {
      clinic_id: clinicId,
      data_venda: dataVenda,
      paciente_id: pacienteId || null,
      paciente_nome: pacienteNome || null,
      procedimento_id: procedimentoId || null,
      procedimento_nome: procedimentoNome || null,
      quantidade: totalQuantidade > 0 ? totalQuantidade : 1,
      profissional_id: profissionalId || null,
      profissional_nome: profissionalNome || null,
      observacoes: observacoes || null,
      created_by: userId,
      tipo_receita: tipoReceita,
      venda_id: vendaId,
    }

    const rows = pagamentos.map((p, i) => {
      const calc = pagamentosCalc[i]
      return {
        ...baseRow,
        forma_pagamento: p.forma,
        bandeira: isCartao(p.forma) ? (p.bandeira || null) : null,
        valor_bruto: calc.v,
        taxa_percentual: calc.taxaEfetivaPct,
        valor_taxa: calc.valorTaxa,
        valor_liquido: calc.valorLiquido,
        n_parcelas: calc.nParcelas,
        primeiro_vencimento: isBoleto(p.forma) ? (p.vencimento || null) : null,
      }
    })

    const { error } = await supabase.from('entradas').insert(rows)

    if (error) {
      alert('Erro ao salvar: ' + error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard/financeiro/entradas')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
        <h3 className="font-bold text-slate-900 flex items-center gap-2">
          <Icon name="clipboard" className="w-5 h-5 text-slate-400" />
          Dados do atendimento
        </h3>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Data *</label>
            <input
              type="date"
              value={dataVenda}
              onChange={e => setDataVenda(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Paciente</label>
            <PacienteBusca pacientes={pacientes} onSelect={handlePacienteChange} />
          </div>
        </div>

        {!pacienteId && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Ou digite o nome manualmente</label>
            <input
              type="text"
              value={pacienteNome}
              onChange={e => setPacienteNome(e.target.value)}
              placeholder="Nome do paciente"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de receita</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setTipoReceita('servico')}
              className={`flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium transition ${
                tipoReceita === 'servico'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
              Serviço (procedimento)
            </button>
            <button type="button" onClick={() => setTipoReceita('produto')}
              className={`flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium transition ${
                tipoReceita === 'produto'
                  ? 'bg-amber-50 border-amber-300 text-amber-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
              Produto (venda avulsa)
            </button>
          </div>
          {tipoReceita === 'produto' && (
            <p className="text-xs text-amber-600 mt-1.5">
              Venda de produto que a paciente leva embora (não aplicado por um profissional).
              Fica de fora da emissão de NFS-e — a nota desse tipo de venda é NF-e/NFC-e, ainda não integrada.
            </p>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {tipoReceita === 'servico' ? (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Procedimento(s)</label>
              <select
                value=""
                onChange={e => handleProcedimentoChange(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="">+ Adicionar procedimento</option>
                {procedimentos.map(p => (
                  <option key={p.id} value={p.id}
                    disabled={selectedProcs.some(s => s.id === p.id)}>
                    {selectedProcs.some(s => s.id === p.id) ? '✓ ' : ''}{p.name} - {fmt(p.price)}
                  </option>
                ))}
              </select>
              {selectedProcs.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedProcs.map(p => (
                    <div key={p.id} className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1">
                      <span className="text-xs text-emerald-800 font-medium">{p.name}</span>
                      <div className="flex items-center gap-1 bg-white border border-emerald-200 rounded-md">
                        <button type="button" onClick={() => updateProcQuantidade(p.id, p.quantidade - 1)}
                          className="w-5 h-5 flex items-center justify-center text-emerald-600 hover:bg-emerald-50 rounded-l-md text-xs font-bold">
                          −
                        </button>
                        <span className="text-xs font-semibold text-emerald-900 w-4 text-center">{p.quantidade}</span>
                        <button type="button" onClick={() => updateProcQuantidade(p.id, p.quantidade + 1)}
                          className="w-5 h-5 flex items-center justify-center text-emerald-600 hover:bg-emerald-50 rounded-r-md text-xs font-bold">
                          +
                        </button>
                      </div>
                      <span className="text-xs text-emerald-600">{fmt(p.price * p.quantidade)}</span>
                      <button type="button" onClick={() => removeProc(p.id)}
                        className="ml-0.5 text-emerald-500 hover:text-red-500 text-xs font-bold">
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Produto *</label>
              <select
                value={selectedProduto?.id || ''}
                onChange={e => handleProdutoChange(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="">Selecione um produto</option>
                {produtos.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {fmt(p.sale_price)} {p.current_stock <= 0 ? '(sem estoque)' : `(${p.current_stock} em estoque)`}
                  </option>
                ))}
              </select>
              {selectedProduto && (
                <div className="mt-2 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <span className="text-xs text-amber-800 font-medium flex-1">{selectedProduto.name}</span>
                  <div className="flex items-center gap-1 bg-white border border-amber-200 rounded-md">
                    <button type="button" onClick={() => updateProdutoQuantidade(-1)}
                      className="w-6 h-6 flex items-center justify-center text-amber-600 hover:bg-amber-50 rounded-l-md text-sm font-bold">
                      −
                    </button>
                    <span className="text-xs font-semibold text-amber-900 w-5 text-center">{selectedProduto.quantidade}</span>
                    <button type="button" onClick={() => updateProdutoQuantidade(1)}
                      className="w-6 h-6 flex items-center justify-center text-amber-600 hover:bg-amber-50 rounded-r-md text-sm font-bold">
                      +
                    </button>
                  </div>
                  <span className="text-xs text-amber-700">{fmt(selectedProduto.sale_price * selectedProduto.quantidade)}</span>
                </div>
              )}
              {selectedProduto && selectedProduto.quantidade > selectedProduto.current_stock && (
                <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mt-1">
                  Estoque tem só {selectedProduto.current_stock} unidade{selectedProduto.current_stock === 1 ? '' : 's'} — a venda vai deixar o estoque negativo. Pode continuar, mas lembra de repor.
                </p>
              )}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Profissional{tipoReceita === 'servico' ? ' *' : ''}
            </label>
            <select
              value={profissionalId}
              onChange={e => handleProfissionalChange(e.target.value)}
              required={tipoReceita === 'servico'}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="">Selecione</option>
              {profissionais.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
          <textarea
            value={observacoes}
            onChange={e => setObservacoes(e.target.value)}
            rows={2}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            placeholder="Observações opcionais..."
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
        <h3 className="font-bold text-slate-900 flex items-center gap-2">
          <Icon name="creditCard" className="w-5 h-5 text-slate-400" />
          Pagamento
        </h3>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Valor Bruto (R$) *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={valorBruto}
            onChange={e => setValorBruto(e.target.value)}
            required
            placeholder="0,00"
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-lg font-semibold"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-slate-700">Forma(s) de pagamento *</label>
          {pagamentos.length < 4 && (
            <button type="button" onClick={addPagamento}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
              <Icon name="plus" className="w-3.5 h-3.5" />
              Dividir pagamento
            </button>
          )}
        </div>

        <div className="space-y-3">
          {pagamentos.map((p, idx) => {
            const showBandeiraLinha = isCartao(p.forma)
            const showVencimento = isBoleto(p.forma)
            return (
              <div key={idx} className="border border-slate-200 rounded-xl p-3 space-y-3">
                <div className={`grid gap-3 ${showBandeiraLinha ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                  <select
                    value={p.forma}
                    onChange={e => updatePagamento(idx, { forma: e.target.value, bandeira: '' })}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    {FORMAS.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>

                  {showBandeiraLinha && (
                    <select
                      value={p.bandeira}
                      onChange={e => updatePagamento(idx, { bandeira: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    >
                      <option value="">Bandeira</option>
                      {BANDEIRAS.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  )}

                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={p.valor}
                      onChange={e => updatePagamento(idx, { valor: e.target.value })}
                      required
                      placeholder="0,00"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                    {pagamentos.length > 1 && (
                      <button type="button" onClick={() => removePagamento(idx)}
                        className="px-2 text-slate-400 hover:text-red-500">
                        <Icon name="trash" className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {showVencimento && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Vencimento do 1º boleto
                    </label>
                    <input
                      type="date"
                      value={p.vencimento}
                      onChange={e => updatePagamento(idx, { vencimento: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      As {pagamentosCalc[idx].nParcelas} parcelas vencem mês a mês a partir dessa data.
                    </p>
                  </div>
                )}

                {pagamentosCalc[idx].v > 0 && pagamentosCalc[idx].valorTaxa > 0 && (
                  <p className="text-xs text-slate-500">
                    Taxa {pagamentosCalc[idx].taxaPct > 0 ? `${pagamentosCalc[idx].taxaPct}%` : ''}
                    {pagamentosCalc[idx].taxaFixaTotal > 0
                      ? `${pagamentosCalc[idx].taxaPct > 0 ? ' + ' : ''}${fmt(pagamentosCalc[idx].taxaFixaUnit)}/boleto`
                      : ''}
                    {' '}(-{fmt(pagamentosCalc[idx].valorTaxa)}) · líquido {fmt(pagamentosCalc[idx].valorLiquido)}
                    {pagamentosCalc[idx].nParcelas > 1 && ` · ${pagamentosCalc[idx].nParcelas}x`}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {Math.abs(restante) > 0.01 && (
          <p className={`text-sm font-medium ${restante > 0 ? 'text-amber-600' : 'text-rose-600'}`}>
            {restante > 0
              ? `Faltam ${fmt(restante)} para completar o valor total`
              : `Excede o valor total em ${fmt(-restante)}`}
          </p>
        )}

        {valorNum > 0 && (
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Total das formas de pagamento</span>
              <span className="font-medium text-slate-900">{fmt(totalAlocado)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Valor da taxa (total)</span>
              <span className="font-medium text-rose-600">-{fmt(valorTaxaTotal)}</span>
            </div>
            <div className="flex justify-between text-lg border-t border-slate-200 pt-2 mt-2">
              <span className="font-semibold text-slate-900">Valor líquido (total)</span>
              <span className="font-bold text-emerald-600">{fmt(valorLiquidoTotal)}</span>
            </div>
          </div>
        )}
      </div>

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
          className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Icon name="loader" className="w-5 h-5 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Icon name="check" className="w-5 h-5" />
              Lançar Entrada
            </>
          )}
        </button>
      </div>
    </form>
  )
}

