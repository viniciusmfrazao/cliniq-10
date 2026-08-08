'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'
import { parseSupabaseError } from '@/lib/error-messages'
import { todayBR } from '@/lib/datetime'
import { FORMAS_PAGAMENTO, BANDEIRAS_CARTAO, calcPagamento, isBoleto, isCartao, type TaxaPag } from '@/lib/pagamento-helpers'
import { gerarVencimentosBoleto } from '@/lib/recebiveis'
import { useToast } from '@/components/ui/Toast'

type Procedimento = { id: string; name: string; price: number }
type CartItem = Procedimento & { quantidade: number }
type Profissional = { id: string; name: string }

type Props = {
  clinicId: string
  userId: string
  patientId: string
  patientName: string
  onClose: () => void
  onSuccess?: () => void
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

type Pagamento = { forma: string; bandeira: string; valor: string; vencimento: string }

/**
 * Venda de procedimento sem vínculo com atendimento agendado — pro caso
 * de vender um serviço/pacote pontual direto na ficha do paciente, sem
 * precisar criar/concluir um agendamento antes. Espelha a lógica de
 * "servico" do formulário de Nova Entrada (financeiro), inserindo direto
 * em `entradas` com tipo_receita='servico'.
 */
export default function SellProcedureModal({ clinicId, userId, patientId, patientName, onClose, onSuccess }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const toast = useToast()
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([])
  const [profissionais, setProfissionais] = useState<Profissional[]>([])
  const [taxasPagamento, setTaxasPagamento] = useState<TaxaPag[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [profissionalId, setProfissionalId] = useState('')
  const [dataVenda, setDataVenda] = useState(todayBR())
  const [observacoes, setObservacoes] = useState('')
  const [pagamentos, setPagamentos] = useState<Array<Pagamento>>([
    { forma: 'Pix', bandeira: '', valor: '', vencimento: '' }
  ])

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    async function init() {
      const [{ data: procData }, { data: profData }, { data: taxasData }] = await Promise.all([
        supabase.from('procedures').select('id, name, price').eq('clinic_id', clinicId).eq('active', true).order('name'),
        supabase.from('users').select('id, name').eq('clinic_id', clinicId).in('role', ['doctor', 'esthetician', 'admin']).order('name'),
        supabase.from('taxas_pagamento').select('forma, bandeira, taxa_percentual, taxa_fixa').eq('clinic_id', clinicId),
      ])
      setProcedimentos((procData || []).map((p: any) => ({ id: p.id, name: p.name, price: Number(p.price) || 0 })))
      setProfissionais(profData || [])
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
    const proc = procedimentos.find(p => p.id === id)
    if (!proc) return
    setCart(prev => {
      const existing = prev.find(i => i.id === id)
      const next = existing
        ? prev.map(i => i.id === id ? { ...i, quantidade: i.quantidade + 1 } : i)
        : [...prev, { ...proc, quantidade: 1 }]
      const total = next.reduce((s, i) => s + i.price * i.quantidade, 0)
      syncPagamentoUnico(total)
      return next
    })
  }

  function updateCartQuantidade(id: string, delta: number) {
    setCart(prev => {
      const next = prev.map(i => i.id === id ? { ...i, quantidade: Math.max(1, i.quantidade + delta) } : i)
      const total = next.reduce((s, i) => s + i.price * i.quantidade, 0)
      syncPagamentoUnico(total)
      return next
    })
  }

  function removeFromCart(id: string) {
    setCart(prev => {
      const next = prev.filter(i => i.id !== id)
      const total = next.reduce((s, i) => s + i.price * i.quantidade, 0)
      syncPagamentoUnico(total)
      return next
    })
  }

  function linhaCalc(p: Pagamento) {
    return calcPagamento(taxasPagamento, p.forma, p.bandeira, parseFloat(p.valor) || 0)
  }

  const valorTotal = cart.reduce((s, i) => s + i.price * i.quantidade, 0)
  const pagamentosCalc = pagamentos.map(linhaCalc)
  const totalAlocado = pagamentosCalc.reduce((s, p) => s + p.v, 0)
  const restante = Math.round((valorTotal - totalAlocado) * 100) / 100
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

  function handleProfissionalChange(id: string) {
    setProfissionalId(id)
  }

  async function handleSubmit() {
    if (cart.length === 0) { toast.error('Adicione ao menos um procedimento'); return }
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
    const procedimentoNome = cart.map(i => i.quantidade > 1 ? `${i.name} (x${i.quantidade})` : i.name).join(', ')
    const totalQuantidade = cart.reduce((s, i) => s + i.quantidade, 0)
    const vendaId = pagamentos.length > 1 ? crypto.randomUUID() : null

    const baseRow = {
      clinic_id: clinicId,
      data_venda: dataVenda,
      paciente_id: patientId,
      paciente_nome: patientName,
      procedimento_id: cart[0]?.id || null,
      procedimento_nome: procedimentoNome,
      quantidade: totalQuantidade > 0 ? totalQuantidade : 1,
      profissional_id: profissionalId || null,
      profissional_nome: profissional?.name || null,
      observacoes: observacoes || null,
      created_by: userId,
      tipo_receita: 'servico' as const,
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

    const { data: entradasInseridas, error } = await supabase.from('entradas').insert(rows).select('id')

    if (error) {
      toast.error('Erro ao registrar venda', { description: parseSupabaseError(error) })
      setSaving(false)
      return
    }

    const parcelasBoleto = pagamentos.flatMap((p, i) => {
      if (!isBoleto(p.forma) || !p.vencimento) return []
      const entradaId = entradasInseridas?.[i]?.id
      if (!entradaId) return []
      const calc = pagamentosCalc[i]
      const vencimentos = gerarVencimentosBoleto(p.vencimento, calc.nParcelas)
      const valorParcela = Math.round((calc.valorLiquido / calc.nParcelas) * 100) / 100
      const somaAteAqui = valorParcela * (calc.nParcelas - 1)
      return vencimentos.map((venc, idx) => ({
        clinic_id: clinicId,
        entrada_id: entradaId,
        numero_parcela: idx + 1,
        total_parcelas: calc.nParcelas,
        valor_liquido: idx === calc.nParcelas - 1 ? Math.round((calc.valorLiquido - somaAteAqui) * 100) / 100 : valorParcela,
        vencimento: venc,
        paciente_nome: patientName,
        procedimento_nome: procedimentoNome,
      }))
    })
    if (parcelasBoleto.length > 0) {
      const { error: errParcelas } = await supabase.from('boleto_parcelas').insert(parcelasBoleto)
      if (errParcelas) console.error('Erro ao criar parcelas do boleto:', errParcelas)
    }

    setSaving(false)
    toast.success(cart.length > 1 ? 'Procedimentos vendidos' : 'Procedimento vendido', {
      description: cart.length > 1
        ? `${cart.length} itens — ${fmt(valorTotal)}`
        : `${cart[0].name} — ${fmt(valorTotal)}`,
    })
    router.refresh()
    onSuccess?.()
    onClose()
  }

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[10010] flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-900">Vender procedimento</h2>
            <p className="text-sm text-slate-500">{patientName}</p>
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
            <p className="text-xs text-violet-600 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
              Venda avulsa de procedimento, sem precisar de agendamento. Pode adicionar mais de um procedimento na mesma venda.
            </p>

            <div>
              <label className="label">Data da venda</label>
              <input type="date" value={dataVenda} onChange={e => setDataVenda(e.target.value)} className="input" />
            </div>

            <div>
              <label className="label">Adicionar procedimento</label>
              <select value="" onChange={e => addToCart(e.target.value)} className="input">
                <option value="">Selecione um procedimento</option>
                {procedimentos.map(p => (
                  <option key={p.id} value={p.id}>{p.name} — {fmt(p.price)}</option>
                ))}
              </select>
              {procedimentos.length === 0 && (
                <p className="text-xs text-slate-400 mt-1">Nenhum procedimento ativo cadastrado.</p>
              )}
            </div>

            {cart.length > 0 && (
              <div className="space-y-2">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
                    <span className="text-xs text-violet-800 font-medium flex-1">{item.name}</span>
                    <div className="flex items-center gap-1 bg-white border border-violet-200 rounded-md">
                      <button type="button" onClick={() => updateCartQuantidade(item.id, -1)}
                        className="w-6 h-6 flex items-center justify-center text-violet-600 hover:bg-violet-50 rounded-l-md text-sm font-bold">−</button>
                      <span className="text-xs font-semibold text-violet-900 w-5 text-center">{item.quantidade}</span>
                      <button type="button" onClick={() => updateCartQuantidade(item.id, 1)}
                        className="w-6 h-6 flex items-center justify-center text-violet-600 hover:bg-violet-50 rounded-r-md text-sm font-bold">+</button>
                    </div>
                    <span className="text-xs text-violet-700 w-16 text-right">{fmt(item.price * item.quantidade)}</span>
                    <button type="button" onClick={() => removeFromCart(item.id)} className="text-violet-400 hover:text-red-500">
                      <Icon name="trash" className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="label">Profissional</label>
              <select value={profissionalId} onChange={e => handleProfissionalChange(e.target.value)} className="input">
                <option value="">Não informar</option>
                {profissionais.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

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
                        </div>
                        {showVencimento && (
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Vencimento do 1º boleto</label>
                            <input type="date" value={p.vencimento}
                              onChange={e => updatePagamento(idx, { vencimento: e.target.value })}
                              className="input text-sm py-2" />
                            <p className="text-[11px] text-slate-400 mt-1">
                              {pagamentosCalc[idx].nParcelas} parcela{pagamentosCalc[idx].nParcelas > 1 ? 's' : ''} vencendo mês a mês a partir dessa data.
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
                    {restante > 0 ? `Faltam ${fmt(restante)} para completar o valor total` : `Excede o valor total em ${fmt(-restante)}`}
                  </p>
                )}

                <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Total dos procedimentos</span>
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
