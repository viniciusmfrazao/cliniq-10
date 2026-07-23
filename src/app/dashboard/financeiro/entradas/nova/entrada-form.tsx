'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'

function PacienteBusca({ pacientes, onSelect }: { pacientes: { id: string; name: string }[], onSelect: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const filtered = query.length > 0
    ? pacientes.filter(p => p.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
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
  profissionais: { id: string; name: string }[]
  taxasPagamento: TaxaPag[]
  clinicId: string
  userId: string
}

const FORMAS = [
  'Pix', 'Dinheiro', 'Débito', 
  'Crédito 1x', 'Crédito 2x', 'Crédito 3x', 'Crédito 4x', 'Crédito 5x', 'Crédito 6x',
  'Crédito 7x', 'Crédito 8x', 'Crédito 9x', 'Crédito 10x', 'Crédito 11x', 'Crédito 12x'
]

const BANDEIRAS = ['Visa', 'Mastercard', 'Amex, Elo, outros']

// Mapeamento: label do form → chave no banco (taxas_pagamento.forma)
const FORMA_PARA_KEY: Record<string, string> = {
  'Pix': 'pix', 'Dinheiro': 'dinheiro', 'Débito': 'debito',
  'Crédito 1x': 'credito_1x', 'Crédito 2x': 'credito_2x', 'Crédito 3x': 'credito_3x',
  'Crédito 4x': 'credito_4x', 'Crédito 5x': 'credito_5x', 'Crédito 6x': 'credito_6x',
  'Crédito 7x': 'credito_7x', 'Crédito 8x': 'credito_8x', 'Crédito 9x': 'credito_9x',
  'Crédito 10x': 'credito_10x', 'Crédito 11x': 'credito_11x', 'Crédito 12x': 'credito_12x',
}

// Mapeamento: label da bandeira → chaves candidatas no banco
const BANDEIRA_PARA_KEY: Record<string, string[]> = {
  'Visa': ['visa'],
  'Mastercard': ['master'],
  'Amex, Elo, outros': ['amex', 'elo'],
}

type TaxaPag = { forma: string; bandeira: string; taxa_percentual: number }

function getTaxaPct(taxasPagamento: TaxaPag[], forma: string, bandeira: string): number {
  const formaKey = FORMA_PARA_KEY[forma]
  if (!formaKey || formaKey === 'pix' || formaKey === 'dinheiro') return 0
  const bandeiraKeys = BANDEIRA_PARA_KEY[bandeira] || []
  // 1. Tenta match específico pela bandeira selecionada
  for (const bKey of bandeiraKeys) {
    const t = taxasPagamento.find(t => t.forma === formaKey && t.bandeira === bKey)
    if (t) return Number(t.taxa_percentual)
  }
  // 2. Fallback para 'todas' (taxa padrão sem especificação de bandeira)
  const todas = taxasPagamento.find(t => t.forma === formaKey && t.bandeira === 'todas')
  if (todas) return Number(todas.taxa_percentual)
  return 0
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

export default function EntradaForm({ pacientes, procedimentos, profissionais, taxasPagamento, clinicId, userId }: Props) {
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
  const [profissionalId, setProfissionalId] = useState('')
  const [profissionalNome, setProfissionalNome] = useState('')
  const [valorBruto, setValorBruto] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [tipoReceita, setTipoReceita] = useState<'servico' | 'produto'>('servico')

  // Pagamento: lista de linhas (permite dividir entre múltiplas formas)
  const [pagamentos, setPagamentos] = useState<Array<{ forma: string; bandeira: string; valor: string }>>([
    { forma: 'Pix', bandeira: '', valor: '' }
  ])

  const valorNum = parseFloat(valorBruto) || 0
  const totalQuantidade = selectedProcs.reduce((s, p) => s + p.quantidade, 0)

  function linhaCalc(p: { forma: string; bandeira: string; valor: string }) {
    const v = parseFloat(p.valor) || 0
    const taxaPct = getTaxaPct(taxasPagamento, p.forma, p.bandeira)
    const valorTaxa = v * (taxaPct / 100)
    const valorLiquido = v - valorTaxa
    const nParcelas = p.forma.match(/(\d+)x/) ? parseInt(p.forma.match(/(\d+)x/)![1]) : 1
    return { v, taxaPct, valorTaxa, valorLiquido, nParcelas }
  }

  const pagamentosCalc = pagamentos.map(linhaCalc)
  const totalAlocado = pagamentosCalc.reduce((s, p) => s + p.v, 0)
  const restante = Math.round((valorNum - totalAlocado) * 100) / 100
  const valorTaxaTotal = pagamentosCalc.reduce((s, p) => s + p.valorTaxa, 0)
  const valorLiquidoTotal = pagamentosCalc.reduce((s, p) => s + p.valorLiquido, 0)

  function addPagamento() {
    setPagamentos(prev => [...prev, { forma: 'Pix', bandeira: '', valor: restante > 0 ? restante.toFixed(2) : '' }])
  }

  function removePagamento(idx: number) {
    setPagamentos(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)
  }

  function updatePagamento(idx: number, patch: Partial<{ forma: string; bandeira: string; valor: string }>) {
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
        bandeira: (p.forma.startsWith('Crédito') || p.forma === 'Débito') ? (p.bandeira || null) : null,
        valor_bruto: calc.v,
        taxa_percentual: calc.taxaPct,
        valor_taxa: calc.valorTaxa,
        valor_liquido: calc.valorLiquido,
        n_parcelas: calc.nParcelas,
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
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Profissional *</label>
            <select
              value={profissionalId}
              onChange={e => handleProfissionalChange(e.target.value)}
              required
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
            const showBandeiraLinha = p.forma.startsWith('Crédito') || p.forma === 'Débito'
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
                {pagamentosCalc[idx].v > 0 && pagamentosCalc[idx].taxaPct > 0 && (
                  <p className="text-xs text-slate-500">
                    Taxa {pagamentosCalc[idx].taxaPct}% (-{fmt(pagamentosCalc[idx].valorTaxa)}) · líquido {fmt(pagamentosCalc[idx].valorLiquido)}
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

