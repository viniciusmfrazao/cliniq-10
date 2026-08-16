'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'
import { parseSupabaseError } from '@/lib/error-messages'
import { todayBR } from '@/lib/datetime'
import { FORMAS_PAGAMENTO, BANDEIRAS_CARTAO, calcPagamento, isBoleto, isCartao, type TaxaPag } from '@/lib/pagamento-helpers'
import { useToast } from '@/components/ui/Toast'
import { PROFESSIONAL_ROLES } from '@/lib/constants'

/**
 * Venda unificada: procedimentos e produtos no mesmo carrinho, N formas de pagamento.
 *
 * Substitui sell-procedure-modal + sell-product-modal. O financeiro continua
 * recebendo entradas separadas por tipo_receita (a RPC fn_registrar_venda faz o
 * rateio), então DRE, comissões, metas e nota fiscal seguem funcionando igual.
 */

type Procedimento = { id: string; name: string; price: number }
type Produto = { id: string; name: string; sale_price: number; current_stock: number }
type Profissional = { id: string; name: string }

type CartItem = {
  tipo: 'procedimento' | 'produto'
  id: string
  nome: string
  valor_unitario: number
  quantidade: number
  current_stock?: number
}

type Pagamento = { forma: string; bandeira: string; valor: string; vencimento: string }

type Props = {
  clinicId: string
  userId: string
  /** Paciente fixo. Passe null junto com selecionarPaciente para deixar o usuário escolher. */
  patientId: string | null
  patientName: string
  appointmentId?: string | null
  /** Mostra a busca de paciente dentro do modal (usado na tela de Nova entrada). */
  selecionarPaciente?: boolean
  /**
   * Esconde o seletor de procedimentos. Usado no fechamento do atendimento, onde
   * o procedimento ja' e' cobrado pelo proprio fechamento -- oferecer procedimento
   * ali faz a mesma coisa ser lancada duas vezes.
   */
  apenasProdutos?: boolean
  onClose: () => void
  onSuccess?: (resumo: { itens: number; total: number }) => void
}

function PacienteBusca({
  pacientes, onSelect,
}: {
  pacientes: { id: string; name: string }[]
  onSelect: (id: string, nome: string) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = query.length > 0
    ? pacientes.filter(p => p.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : []

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); onSelect('', e.target.value) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Buscar paciente ou digitar o nome..."
        className="input text-sm py-2"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
          {filtered.map(p => (
            <button key={p.id} type="button"
              onMouseDown={() => { setQuery(p.name); setOpen(false); onSelect(p.id, p.name) }}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0">
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

export default function VendaModal({
  clinicId, userId, patientId, patientName, appointmentId = null,
  selecionarPaciente = false, apenasProdutos = false, onClose, onSuccess,
}: Props) {
  const supabase = createClient()
  const router = useRouter()
  const toast = useToast()
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [profissionais, setProfissionais] = useState<Profissional[]>([])
  const [taxasPagamento, setTaxasPagamento] = useState<TaxaPag[]>([])

  const [pacientes, setPacientes] = useState<{ id: string; name: string }[]>([])
  const [pacienteIdSel, setPacienteIdSel] = useState<string | null>(patientId)
  const [pacienteNomeSel, setPacienteNomeSel] = useState(patientName)

  const [cart, setCart] = useState<CartItem[]>([])
  const [dataVenda, setDataVenda] = useState(todayBR())
  const [profissionalId, setProfissionalId] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([
    { forma: 'Pix', bandeira: '', valor: '', vencimento: '' },
  ])

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    async function init() {
      const [procRes, prodRes, profRes, taxaRes] = await Promise.all([
        supabase.from('procedures')
          .select('id, name, price')
          .eq('clinic_id', clinicId).eq('active', true).order('name'),
        supabase.from('products')
          .select('id, name, sale_price, current_stock')
          .eq('clinic_id', clinicId).eq('is_active', true).order('name'),
        supabase.from('users')
          .select('id, name')
          .eq('clinic_id', clinicId)
          .in('role', [...PROFESSIONAL_ROLES, 'admin'])
          .order('name'),
        supabase.from('taxas_pagamento')
          .select('forma, bandeira, taxa_percentual, taxa_fixa')
          .eq('clinic_id', clinicId),
      ])

      setProcedimentos((procRes.data || []).map((p: any) => ({
        id: p.id, name: p.name, price: Number(p.price) || 0,
      })))
      setProdutos((prodRes.data || []).map((p: any) => ({
        id: p.id, name: p.name, sale_price: Number(p.sale_price) || 0, current_stock: p.current_stock ?? 0,
      })))
      setProfissionais(profRes.data || [])
      setTaxasPagamento(taxaRes.data || [])

      if (selecionarPaciente) {
        const { data: pacData } = await supabase
          .from('patients').select('id, name')
          .eq('clinic_id', clinicId).order('name')
        setPacientes(pacData || [])
      }

      setLoading(false)
    }
    init()
  }, [clinicId])

  // ------------------------------------------------------------------ carrinho
  function totalDo(items: CartItem[]) {
    return items.reduce((s, i) => s + i.valor_unitario * i.quantidade, 0)
  }

  function syncPagamentoUnico(items: CartItem[]) {
    const total = totalDo(items)
    setPagamentos(prev => prev.length === 1
      ? [{ ...prev[0], valor: total > 0 ? total.toFixed(2) : '' }]
      : prev)
  }

  function addProcedimento(id: string) {
    if (!id) return
    const proc = procedimentos.find(p => p.id === id)
    if (!proc) return
    setCart(prev => {
      const existing = prev.find(i => i.tipo === 'procedimento' && i.id === id)
      const next = existing
        ? prev.map(i => (i.tipo === 'procedimento' && i.id === id) ? { ...i, quantidade: i.quantidade + 1 } : i)
        : [...prev, { tipo: 'procedimento' as const, id: proc.id, nome: proc.name, valor_unitario: proc.price, quantidade: 1 }]
      syncPagamentoUnico(next)
      return next
    })
  }

  function addProduto(id: string) {
    if (!id) return
    const prod = produtos.find(p => p.id === id)
    if (!prod) return
    setCart(prev => {
      const existing = prev.find(i => i.tipo === 'produto' && i.id === id)
      const next = existing
        ? prev.map(i => (i.tipo === 'produto' && i.id === id) ? { ...i, quantidade: i.quantidade + 1 } : i)
        : [...prev, {
            tipo: 'produto' as const, id: prod.id, nome: prod.name,
            valor_unitario: prod.sale_price, quantidade: 1, current_stock: prod.current_stock,
          }]
      syncPagamentoUnico(next)
      return next
    })
  }

  function updateQuantidade(tipo: CartItem['tipo'], id: string, delta: number) {
    setCart(prev => {
      const next = prev.map(i =>
        (i.tipo === tipo && i.id === id) ? { ...i, quantidade: Math.max(1, i.quantidade + delta) } : i)
      syncPagamentoUnico(next)
      return next
    })
  }

  function updateValorUnitario(tipo: CartItem['tipo'], id: string, valor: string) {
    setCart(prev => {
      const next = prev.map(i =>
        (i.tipo === tipo && i.id === id) ? { ...i, valor_unitario: parseFloat(valor) || 0 } : i)
      syncPagamentoUnico(next)
      return next
    })
  }

  function removeItem(tipo: CartItem['tipo'], id: string) {
    setCart(prev => {
      const next = prev.filter(i => !(i.tipo === tipo && i.id === id))
      syncPagamentoUnico(next)
      return next
    })
  }

  // ---------------------------------------------------------------- pagamentos
  function linhaCalc(p: Pagamento) {
    return calcPagamento(taxasPagamento, p.forma, p.bandeira, parseFloat(p.valor) || 0)
  }

  const itensServico = cart.filter(i => i.tipo === 'procedimento')
  const itensProduto = cart.filter(i => i.tipo === 'produto')
  const totalServicos = totalDo(itensServico)
  const totalProdutos = totalDo(itensProduto)
  const valorTotal = totalServicos + totalProdutos

  const pagamentosCalc = pagamentos.map(linhaCalc)
  const totalAlocado = pagamentosCalc.reduce((s, p) => s + p.v, 0)
  const restante = Math.round((valorTotal - totalAlocado) * 100) / 100
  const valorTaxaTotal = pagamentosCalc.reduce((s, p) => s + p.valorTaxa, 0)
  const valorLiquidoTotal = pagamentosCalc.reduce((s, p) => s + p.valorLiquido, 0)
  const estoqueNegativo = itensProduto.filter(i => i.quantidade > (i.current_stock ?? 0))
  const vendaMista = itensServico.length > 0 && itensProduto.length > 0

  function addPagamento() {
    setPagamentos(prev => [...prev, {
      forma: 'Pix', bandeira: '', valor: restante > 0 ? restante.toFixed(2) : '', vencimento: '',
    }])
  }
  function removePagamento(idx: number) {
    setPagamentos(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)
  }
  function updatePagamento(idx: number, patch: Partial<Pagamento>) {
    setPagamentos(prev => prev.map((p, i) => i === idx ? { ...p, ...patch } : p))
  }

  // -------------------------------------------------------------------- submit
  async function handleSubmit() {
    if (cart.length === 0) { toast.error(apenasProdutos ? 'Adicione ao menos um produto' : 'Adicione ao menos um item'); return }
    if (cart.some(i => i.valor_unitario <= 0)) { toast.error('Todo item precisa de um valor maior que zero'); return }
    if (pagamentosCalc.some(p => p.v <= 0)) { toast.error('Cada forma de pagamento precisa de um valor maior que zero'); return }
    if (pagamentos.some(p => isBoleto(p.forma) && !p.vencimento)) { toast.error('Informe o vencimento do 1º boleto'); return }
    if (Math.abs(restante) > 0.01) {
      const ok = confirm(
        restante > 0
          ? `Faltam ${fmt(restante)} para completar o valor total. Salvar mesmo assim?`
          : `O total das formas de pagamento excede o valor em ${fmt(-restante)}. Salvar mesmo assim?`
      )
      if (!ok) return
    }

    setSaving(true)

    const profissional = profissionais.find(p => p.id === profissionalId)

    const itensPayload = cart.map(i => ({
      tipo: i.tipo,
      id: i.id,
      nome: i.nome,
      quantidade: i.quantidade,
      valor_unitario: i.valor_unitario,
    }))

    const pagamentosPayload = pagamentos.map((p, i) => {
      const calc = pagamentosCalc[i]
      return {
        forma: p.forma,
        bandeira: isCartao(p.forma) ? (p.bandeira || '') : '',
        valor: calc.v,
        taxa_percentual: calc.taxaEfetivaPct,
        n_parcelas: calc.nParcelas,
        primeiro_vencimento: isBoleto(p.forma) ? (p.vencimento || '') : '',
      }
    })

    const { error } = await supabase.rpc('fn_registrar_venda', {
      p_user_id: userId,
      p_clinic_id: clinicId,
      p_data_venda: dataVenda,
      p_paciente_id: pacienteIdSel || null,
      p_paciente_nome: pacienteNomeSel || null,
      p_profissional_id: profissionalId || null,
      p_profissional_nome: profissional?.name || null,
      p_observacoes: observacoes || null,
      p_appointment_id: appointmentId,
      p_itens: itensPayload,
      p_pagamentos: pagamentosPayload,
    })

    if (error) {
      toast.error('Erro ao registrar venda', { description: parseSupabaseError(error) })
      setSaving(false)
      return
    }

    toast.success('Venda registrada', {
      description: `${cart.length} ${cart.length === 1 ? 'item' : 'itens'} — ${fmt(valorTotal)}`,
    })
    onSuccess?.({ itens: cart.length, total: valorTotal })
    router.refresh()
    onClose()
  }

  if (!mounted) return null

  // Classes estáticas: Tailwind não detecta template strings tipo `bg-${cor}-50`
  const ESTILO = {
    emerald: {
      box: 'flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2',
      nome: 'text-xs text-emerald-800 font-medium flex-1 truncate',
      qtdBox: 'flex items-center gap-1 bg-white border border-emerald-200 rounded-md',
      btnL: 'w-6 h-6 flex items-center justify-center text-emerald-600 hover:bg-emerald-50 rounded-l-md text-sm font-bold',
      btnR: 'w-6 h-6 flex items-center justify-center text-emerald-600 hover:bg-emerald-50 rounded-r-md text-sm font-bold',
      qtd: 'text-xs font-semibold text-emerald-900 w-5 text-center',
      total: 'text-xs text-emerald-700 w-16 text-right',
      trash: 'text-emerald-400 hover:text-red-500',
    },
    amber: {
      box: 'flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2',
      nome: 'text-xs text-amber-800 font-medium flex-1 truncate',
      qtdBox: 'flex items-center gap-1 bg-white border border-amber-200 rounded-md',
      btnL: 'w-6 h-6 flex items-center justify-center text-amber-600 hover:bg-amber-50 rounded-l-md text-sm font-bold',
      btnR: 'w-6 h-6 flex items-center justify-center text-amber-600 hover:bg-amber-50 rounded-r-md text-sm font-bold',
      qtd: 'text-xs font-semibold text-amber-900 w-5 text-center',
      total: 'text-xs text-amber-700 w-16 text-right',
      trash: 'text-amber-400 hover:text-red-500',
    },
  } as const

  const renderItens = (items: CartItem[], cor: 'emerald' | 'amber') => {
    const s = ESTILO[cor]
    return (
      <div className="space-y-2">
        {items.map(item => (
          <div key={`${item.tipo}-${item.id}`} className={s.box}>
            <span className={s.nome}>{item.nome}</span>
            <input
              type="number" step="0.01" min="0"
              value={item.valor_unitario}
              onChange={e => updateValorUnitario(item.tipo, item.id, e.target.value)}
              className="w-20 text-xs px-2 py-1 border border-slate-200 rounded-md text-right"
            />
            <div className={s.qtdBox}>
              <button type="button" onClick={() => updateQuantidade(item.tipo, item.id, -1)} className={s.btnL}>−</button>
              <span className={s.qtd}>{item.quantidade}</span>
              <button type="button" onClick={() => updateQuantidade(item.tipo, item.id, 1)} className={s.btnR}>+</button>
            </div>
            <span className={s.total}>{fmt(item.valor_unitario * item.quantidade)}</span>
            <button type="button" onClick={() => removeItem(item.tipo, item.id)} className={s.trash}>
              <Icon name="trash" className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-[10010] flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-900">{apenasProdutos ? 'Vender produto' : 'Nova venda'}</h2>
            <p className="text-sm text-slate-500">{pacienteNomeSel || 'Venda avulsa'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <Icon name="x" className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 flex justify-center">
            <Icon name="loader" className="w-6 h-6 animate-spin text-slate-300" />
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {selecionarPaciente && (
              <div>
                <label className="label">Paciente</label>
                <PacienteBusca
                  pacientes={pacientes}
                  onSelect={(id, nome) => { setPacienteIdSel(id || null); setPacienteNomeSel(nome) }}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Data *</label>
                <input type="date" value={dataVenda} onChange={e => setDataVenda(e.target.value)} className="input text-sm py-2" />
              </div>
              <div>
                <label className="label">Profissional</label>
                <select value={profissionalId} onChange={e => setProfissionalId(e.target.value)} className="input text-sm py-2">
                  <option value="">Selecione</option>
                  {profissionais.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>

            {!apenasProdutos && (
              <>
                <div>
                  <label className="label">Adicionar procedimento</label>
                  <select value="" onChange={e => addProcedimento(e.target.value)} className="input text-sm py-2">
                    <option value="">Selecione um procedimento</option>
                    {procedimentos.map(p => (
                      <option key={p.id} value={p.id}>{p.name} — {fmt(p.price)}</option>
                    ))}
                  </select>
                </div>
                {itensServico.length > 0 && renderItens(itensServico, 'emerald')}
              </>
            )}

            {apenasProdutos && (
              <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                Só produtos aqui — o procedimento do atendimento é cobrado no pagamento abaixo,
                então lançá-lo nesta tela cobraria duas vezes.
              </p>
            )}

            <div>
              <label className="label">Adicionar produto</label>
              <select value="" onChange={e => addProduto(e.target.value)} className="input text-sm py-2">
                <option value="">Selecione um produto</option>
                {produtos.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {fmt(p.sale_price)} {p.current_stock <= 0 ? '(sem estoque)' : `(${p.current_stock} em estoque)`}
                  </option>
                ))}
              </select>
              {produtos.length === 0 && (
                <p className="text-xs text-slate-400 mt-1">Nenhum produto ativo cadastrado no estoque.</p>
              )}
            </div>
            {itensProduto.length > 0 && renderItens(itensProduto, 'amber')}

            {estoqueNegativo.length > 0 && (
              <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                {estoqueNegativo.map(i => `${i.nome} (estoque: ${i.current_stock})`).join(', ')} — vai ficar com estoque negativo. Pode continuar, mas lembra de repor.
              </p>
            )}

            {vendaMista && (
              <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                Venda mista: o financeiro vai receber {fmt(totalServicos)} em serviço e {fmt(totalProdutos)} em produto,
                lançados separadamente. Se a clínica emite nota, saem uma NFS-e e uma NFe.
              </p>
            )}

            {cart.length > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <label className="label mb-0">Forma(s) de pagamento *</label>
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
                    const showBandeira = isCartao(p.forma)
                    const showVencimento = isBoleto(p.forma)
                    return (
                      <div key={idx} className="border border-slate-200 rounded-xl p-3 space-y-2">
                        <div className="grid grid-cols-1 gap-2">
                          <select value={p.forma} onChange={e => updatePagamento(idx, { forma: e.target.value, bandeira: '' })} className="input text-sm py-2">
                            {FORMAS_PAGAMENTO.map(f => <option key={f} value={f}>{f}</option>)}
                          </select>
                          {showBandeira && (
                            <select value={p.bandeira} onChange={e => updatePagamento(idx, { bandeira: e.target.value })} className="input text-sm py-2">
                              <option value="">Bandeira</option>
                              {BANDEIRAS_CARTAO.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                          )}
                          <div className="flex gap-2">
                            <input type="number" step="0.01" min="0" value={p.valor}
                              onChange={e => updatePagamento(idx, { valor: e.target.value })}
                              placeholder="0,00" className="input text-sm py-2" />
                            {pagamentos.length > 1 && (
                              <button type="button" onClick={() => removePagamento(idx)} className="px-2 text-slate-400 hover:text-red-500">
                                <Icon name="trash" className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          {showVencimento && (
                            <div>
                              <label className="text-xs text-slate-500">Vencimento do 1º boleto</label>
                              <input type="date" value={p.vencimento}
                                onChange={e => updatePagamento(idx, { vencimento: e.target.value })}
                                className="input text-sm py-2" />
                              <p className="text-xs text-slate-400 mt-1">
                                {pagamentosCalc[idx].nParcelas} parcela{pagamentosCalc[idx].nParcelas > 1 ? 's' : ''} vencendo mês a mês a partir dessa data.
                              </p>
                            </div>
                          )}
                        </div>
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
                    {restante > 0 ? `Faltam ${fmt(restante)} para completar o valor total` : `Excede o valor total em ${fmt(-restante)}`}
                  </p>
                )}

                <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
                  {itensServico.length > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Procedimentos</span>
                      <span className="font-medium text-slate-700">{fmt(totalServicos)}</span>
                    </div>
                  )}
                  {itensProduto.length > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Produtos</span>
                      <span className="font-medium text-slate-700">{fmt(totalProdutos)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Taxa (total)</span>
                    <span className="font-medium text-rose-600">-{fmt(valorTaxaTotal)}</span>
                  </div>
                  <div className="flex justify-between text-base border-t border-slate-200 pt-1.5 mt-1.5">
                    <span className="font-semibold text-slate-900">Líquido (total)</span>
                    <span className="font-bold text-emerald-600">{fmt(valorLiquidoTotal)}</span>
                  </div>
                </div>

                <div>
                  <label className="label">Observações</label>
                  <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} className="input" placeholder="Opcional..." />
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex gap-3 p-5 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 btn-secondary">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving || loading || cart.length === 0}
            className="flex-1 btn-primary flex items-center justify-center gap-2">
            {saving ? <Icon name="loader" className="w-4 h-4 animate-spin" /> : <Icon name="check" className="w-4 h-4" />}
            {saving ? 'Salvando...' : `Confirmar venda${valorTotal > 0 ? ` · ${fmt(valorTotal)}` : ''}`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
