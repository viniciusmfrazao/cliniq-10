'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'
import { parseSupabaseError } from '@/lib/error-messages'
import { todayBR } from '@/lib/datetime'
import { FORMAS_PAGAMENTO, BANDEIRAS_CARTAO, getTaxaPct, type TaxaPag } from '@/lib/pagamento-helpers'
import { useToast } from '@/components/ui/Toast'

type Produto = { id: string; name: string; sale_price: number; current_stock: number }
type CartItem = Produto & { quantidade: number }

type VendaProdutoInfo = { produtoNome: string; quantidade: number; valor: number }

type Props = {
  clinicId: string
  userId: string
  patientId: string | null
  patientName: string
  onClose: () => void
  onSuccess?: (itens: VendaProdutoInfo[]) => void
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

export default function SellProductModal({ clinicId, userId, patientId, patientName, onClose, onSuccess }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const toast = useToast()
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [produtos, setProdutos] = useState<Produto[]>([])
  const [taxasPagamento, setTaxasPagamento] = useState<TaxaPag[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [observacoes, setObservacoes] = useState('')
  const [pagamentos, setPagamentos] = useState<Array<{ forma: string; bandeira: string; valor: string }>>([
    { forma: 'Pix', bandeira: '', valor: '' }
  ])

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    async function init() {
      const { data: produtosData } = await supabase
        .from('products')
        .select('id, name, sale_price, current_stock')
        .eq('clinic_id', clinicId)
        .eq('is_active', true)
        .order('name')
      setProdutos((produtosData || []).map((p: any) => ({
        id: p.id, name: p.name, sale_price: Number(p.sale_price) || 0, current_stock: p.current_stock,
      })))

      const { data: taxasData } = await supabase
        .from('taxas_pagamento')
        .select('forma, bandeira, taxa_percentual')
        .eq('clinic_id', clinicId)
      setTaxasPagamento(taxasData || [])

      setLoading(false)
    }
    init()
  }, [clinicId])

  function syncPagamentoUnico(valor: number) {
    setPagamentos(prev => prev.length === 1 ? [{ ...prev[0], valor: valor > 0 ? valor.toFixed(2) : '' }] : prev)
  }

  function addToCart(id: string) {
    if (!id) return
    const prod = produtos.find(p => p.id === id)
    if (!prod) return
    setCart(prev => {
      const existing = prev.find(i => i.id === id)
      const next = existing
        ? prev.map(i => i.id === id ? { ...i, quantidade: i.quantidade + 1 } : i)
        : [...prev, { ...prod, quantidade: 1 }]
      const total = next.reduce((s, i) => s + i.sale_price * i.quantidade, 0)
      syncPagamentoUnico(total)
      return next
    })
  }

  function updateCartQuantidade(id: string, delta: number) {
    setCart(prev => {
      const next = prev
        .map(i => i.id === id ? { ...i, quantidade: Math.max(1, i.quantidade + delta) } : i)
      const total = next.reduce((s, i) => s + i.sale_price * i.quantidade, 0)
      syncPagamentoUnico(total)
      return next
    })
  }

  function removeFromCart(id: string) {
    setCart(prev => {
      const next = prev.filter(i => i.id !== id)
      const total = next.reduce((s, i) => s + i.sale_price * i.quantidade, 0)
      syncPagamentoUnico(total)
      return next
    })
  }

  function linhaCalc(p: { forma: string; bandeira: string; valor: string }) {
    const v = parseFloat(p.valor) || 0
    const taxaPct = getTaxaPct(taxasPagamento, p.forma, p.bandeira)
    const valorTaxa = v * (taxaPct / 100)
    const valorLiquido = v - valorTaxa
    const nParcelas = p.forma.match(/(\d+)x/) ? parseInt(p.forma.match(/(\d+)x/)![1]) : 1
    return { v, taxaPct, valorTaxa, valorLiquido, nParcelas }
  }

  const valorTotal = cart.reduce((s, i) => s + i.sale_price * i.quantidade, 0)
  const pagamentosCalc = pagamentos.map(linhaCalc)
  const totalAlocado = pagamentosCalc.reduce((s, p) => s + p.v, 0)
  const restante = Math.round((valorTotal - totalAlocado) * 100) / 100
  const valorTaxaTotal = pagamentosCalc.reduce((s, p) => s + p.valorTaxa, 0)
  const valorLiquidoTotal = pagamentosCalc.reduce((s, p) => s + p.valorLiquido, 0)
  const itensComEstoqueNegativo = cart.filter(i => i.quantidade > i.current_stock)

  function addPagamento() {
    setPagamentos(prev => [...prev, { forma: 'Pix', bandeira: '', valor: restante > 0 ? restante.toFixed(2) : '' }])
  }
  function removePagamento(idx: number) {
    setPagamentos(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)
  }
  function updatePagamento(idx: number, patch: Partial<{ forma: string; bandeira: string; valor: string }>) {
    setPagamentos(prev => prev.map((p, i) => i === idx ? { ...p, ...patch } : p))
  }

  async function handleSubmit() {
    if (cart.length === 0) { toast.error('Adicione ao menos um produto'); return }
    if (pagamentosCalc.some(p => p.v <= 0)) { toast.error('Cada forma de pagamento precisa de um valor maior que zero'); return }
    if (Math.abs(restante) > 0.01) {
      const ok = confirm(
        restante > 0
          ? `Faltam ${fmt(restante)} para completar o valor total. Salvar mesmo assim?`
          : `O total das formas de pagamento excede o valor em ${fmt(-restante)}. Salvar mesmo assim?`
      )
      if (!ok) return
    }

    setSaving(true)
    const itensPayload = cart.map(i => ({
      product_id: i.id,
      quantidade: i.quantidade,
      valor_unitario: i.sale_price,
    }))
    const pagamentosPayload = pagamentos.map((p, i) => {
      const calc = pagamentosCalc[i]
      return {
        forma: p.forma,
        bandeira: (p.forma.startsWith('Crédito') || p.forma === 'Débito') ? (p.bandeira || '') : '',
        valor: calc.v,
        taxa_percentual: calc.taxaPct,
        n_parcelas: calc.nParcelas,
      }
    })

    const { error } = await supabase.rpc('fn_registrar_venda_produtos', {
      p_user_id: userId,
      p_clinic_id: clinicId,
      p_itens: itensPayload,
      p_data_venda: todayBR(),
      p_paciente_id: patientId || null,
      p_paciente_nome: patientName || null,
      p_observacoes: observacoes || null,
      p_pagamentos: pagamentosPayload,
    })

    setSaving(false)
    if (error) {
      toast.error('Erro ao registrar venda', { description: parseSupabaseError(error) })
      return
    }

    const itensVendidos = cart.map(i => ({ produtoNome: i.name, quantidade: i.quantidade, valor: i.sale_price * i.quantidade }))
    toast.success(cart.length > 1 ? 'Produtos vendidos' : 'Produto vendido', {
      description: cart.length > 1
        ? `${cart.length} itens — ${fmt(valorTotal)}`
        : `${cart[0].name} × ${cart[0].quantidade} — ${fmt(valorTotal)}`,
    })
    router.refresh()
    onSuccess?.(itensVendidos)
    onClose()
  }

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[10010] flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-900">Vender produto</h2>
            <p className="text-sm text-slate-500">{patientName || 'Venda avulsa'}</p>
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
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Venda de produto que a paciente leva embora (sem vínculo com procedimento/atendimento). Pode adicionar mais de um produto na mesma venda.
            </p>

            <div>
              <label className="label">Adicionar produto</label>
              <select
                value=""
                onChange={e => addToCart(e.target.value)}
                className="input"
              >
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

            {cart.length > 0 && (
              <div className="space-y-2">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <span className="text-xs text-amber-800 font-medium flex-1">{item.name}</span>
                    <div className="flex items-center gap-1 bg-white border border-amber-200 rounded-md">
                      <button type="button" onClick={() => updateCartQuantidade(item.id, -1)}
                        className="w-6 h-6 flex items-center justify-center text-amber-600 hover:bg-amber-50 rounded-l-md text-sm font-bold">−</button>
                      <span className="text-xs font-semibold text-amber-900 w-5 text-center">{item.quantidade}</span>
                      <button type="button" onClick={() => updateCartQuantidade(item.id, 1)}
                        className="w-6 h-6 flex items-center justify-center text-amber-600 hover:bg-amber-50 rounded-r-md text-sm font-bold">+</button>
                    </div>
                    <span className="text-xs text-amber-700 w-16 text-right">{fmt(item.sale_price * item.quantidade)}</span>
                    <button type="button" onClick={() => removeFromCart(item.id)} className="text-amber-400 hover:text-red-500">
                      <Icon name="trash" className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {itensComEstoqueNegativo.length > 0 && (
              <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                {itensComEstoqueNegativo.map(i => `${i.name} (estoque: ${i.current_stock})`).join(', ')} — vai ficar com estoque negativo. Pode continuar, mas lembra de repor.
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
                    const showBandeira = p.forma.startsWith('Crédito') || p.forma === 'Débito'
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
                        </div>
                        {pagamentosCalc[idx].v > 0 && pagamentosCalc[idx].taxaPct > 0 && (
                          <p className="text-xs text-slate-500">
                            Taxa {pagamentosCalc[idx].taxaPct}% (-{fmt(pagamentosCalc[idx].valorTaxa)}) · líquido {fmt(pagamentosCalc[idx].valorLiquido)}
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
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Total dos produtos</span>
                    <span className="font-medium text-slate-700">{fmt(valorTotal)}</span>
                  </div>
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
          <button onClick={handleSubmit} disabled={saving || loading || cart.length === 0} className="flex-1 btn-primary flex items-center justify-center gap-2">
            {saving ? <Icon name="loader" className="w-4 h-4 animate-spin" /> : <Icon name="check" className="w-4 h-4" />}
            {saving ? 'Salvando...' : 'Confirmar venda'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
