'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'

type Taxa = { forma: string; bandeira: string | null; taxa_percentual: number; taxa_fixa?: number | null }
type ProcItem = { id: string; name: string; price: number }
type Split = { id: string; forma: string; bandeira: string; valor: number; parcelas: number; taxa: number; taxaFixa: number; liquido: number; vencimento: string }
type Debito = { id: string; descricao: string; valor: number; data_vencimento: string; quitar: boolean }
type ProdItem = { id: string; name: string; sale_price: number; current_stock: number; quantidade: number }

type Props = {
  appointmentId: string
  clinicId: string
  patientId: string | null
  patientName: string
  procedureName: string
  procedurePrice: number | null
  procedureId: string | null
  professionalId: string | null
  professionalName: string
  valorCobrado?: number | null
  descontoTipoInicial?: 'valor' | 'percentual' | null
  descontoValorInicial?: number | null
  onClose: () => void
  onSuccess: () => void
}

const FORMAS = ['pix', 'dinheiro', 'credito', 'debito', 'boleto']
const FORMA_LABEL: Record<string, string> = { pix: 'PIX', dinheiro: 'Dinheiro', credito: 'Crédito', debito: 'Débito', boleto: 'Boleto' }

// Mesma lista de Configurações → Taxas de Pagamento — sempre visível,
// independente de já existir taxa configurada pra bandeira ou não.
const BANDEIRAS_ESPECIFICAS = [
  { key: 'visa', label: 'Visa' },
  { key: 'master', label: 'Mastercard' },
  { key: 'elo', label: 'Elo' },
  { key: 'amex', label: 'American Express' },
  { key: 'hipercard', label: 'Hipercard' },
]

function uid() { return Math.random().toString(36).slice(2) }
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function asProcUuid(id: string) { return UUID_RE.test(id) ? id : null }

export default function PaymentModal({ appointmentId, clinicId, patientId, patientName, procedureName, procedurePrice, procedureId, professionalId, professionalName, valorCobrado, descontoTipoInicial, descontoValorInicial, onClose, onSuccess }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [taxas, setTaxas] = useState<Taxa[]>([])
  const [procs, setProcs] = useState<ProcItem[]>([])
  const [splits, setSplits] = useState<Split[]>([])
  const [debitos, setDebitos] = useState<Debito[]>([])
  const [obs, setObs] = useState('')
  // O desconto ja' aplicado no agendamento vem preenchido. Antes o campo abria
  // vazio enquanto valorCobrado ja' chegava descontado -- quem digitasse desconto
  // aqui aplicava em cima de valor ja' descontado.
  const [descontoTipo, setDescontoTipo] = useState<'valor' | 'percentual'>(descontoTipoInicial || 'valor')
  const [descontoValorStr, setDescontoValorStr] = useState(descontoValorInicial ? String(descontoValorInicial) : '')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [showAddProc, setShowAddProc] = useState(false)
  const [allClinicProcs, setAllClinicProcs] = useState<ProcItem[]>([])
  const [procSearch, setProcSearch] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [showAddProd, setShowAddProd] = useState(false)
  const [allClinicProds, setAllClinicProds] = useState<ProdItem[]>([])
  const [prodSearch, setProdSearch] = useState('')
  const [produtos, setProdutos] = useState<ProdItem[]>([])

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)

      // Taxas
      const { data: taxasData } = await supabase
        .from('taxas_pagamento').select('forma, bandeira, taxa_percentual, taxa_fixa').eq('clinic_id', clinicId)
      setTaxas(taxasData || [])

      // Múltiplos procedimentos
      const { data: apProcs } = await supabase
        .from('appointment_procedures')
        .select('procedure_id, procedure_name, price')
        .eq('appointment_id', appointmentId)

      let procList: ProcItem[] = []
      if (apProcs && apProcs.length > 0) {
        procList = apProcs.map((ap: any) => ({
          id: ap.procedure_id || uid(),
          name: ap.procedure_name,
          price: Number(ap.price) || 0,
        }))
      } else {
        // Fallback: procedimento principal
        procList = [{ id: procedureId || uid(), name: procedureName, price: Number(procedurePrice) || 0 }]
      }
      setProcs(procList)

      const total = procList.reduce((s, p) => s + p.price, 0)
      const initialValor = (valorCobrado !== null && valorCobrado !== undefined) ? valorCobrado : total
      setSplits([{ id: uid(), forma: 'pix', bandeira: '', valor: initialValor, parcelas: 1, taxa: 0, taxaFixa: 0, liquido: initialValor, vencimento: '' }])

      // Todos os procedimentos da clínica (para adicionar no pagamento)
      const { data: clinicProcsData } = await supabase
        .from('procedures')
        .select('id, name, price')
        .eq('clinic_id', clinicId)
        .order('name')
      setAllClinicProcs((clinicProcsData || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price) || 0,
      })))

      // Produtos da clínica (pra vender junto com o procedimento)
      const { data: prodData } = await supabase
        .from('products')
        .select('id, name, sale_price, current_stock')
        .eq('clinic_id', clinicId)
        .eq('is_active', true)
        .order('name')
      setAllClinicProds((prodData || []).map((p: any) => ({
        id: p.id, name: p.name,
        sale_price: Number(p.sale_price) || 0,
        current_stock: p.current_stock ?? 0,
        quantidade: 1,
      })))

      // Débitos pendentes
      if (patientId) {
        const { data: deb } = await supabase
          .from('debitos')
          .select('id, descricao, valor, data_vencimento')
          .eq('clinic_id', clinicId)
          .eq('paciente_id', patientId)
          .eq('status', 'pendente')
          .order('data_vencimento', { ascending: true })
        setDebitos((deb || []).map((d: any) => ({ ...d, valor: Number(d.valor), quitar: false })))
      }

      setLoading(false)
    }
    init()
  }, [appointmentId, clinicId, patientId])

  // Boleto usa uma chave só ('boleto') — o parcelamento não muda a taxa,
  // e o custo por boleto emitido fica em taxa_fixa (R$ por documento).
  function findTaxaRow(forma: string, bandeira: string, parcelas: number = 1): Taxa | undefined {
    const formaKey = forma === 'credito' ? `credito_${parcelas}x` : forma
    return (
      taxas.find(t => t.forma === formaKey && t.bandeira === bandeira) ??
      taxas.find(t => t.forma === formaKey && (t.bandeira === 'todas' || !t.bandeira)) ??
      taxas.find(t => t.forma === forma && t.bandeira === bandeira) ??
      taxas.find(t => t.forma === forma && (t.bandeira === 'todas' || !t.bandeira))
    )
  }

  function getTaxa(forma: string, bandeira: string, parcelas: number = 1) {
    return Number(findTaxaRow(forma, bandeira, parcelas)?.taxa_percentual) || 0
  }

  function getTaxaFixa(forma: string, bandeira: string, parcelas: number = 1) {
    return Number(findTaxaRow(forma, bandeira, parcelas)?.taxa_fixa) || 0
  }

  // Total descontado do split: % sobre o valor + taxa fixa por boleto emitido.
  function calcTaxaValor(s: Pick<Split, 'forma' | 'valor' | 'taxa' | 'taxaFixa' | 'parcelas'>) {
    const fixaTotal = s.forma === 'boleto' ? s.taxaFixa * Math.max(1, s.parcelas) : 0
    return Math.min(s.valor, Math.round((s.valor * (s.taxa / 100) + fixaTotal) * 100) / 100)
  }

  function updateSplit(id: string, changes: Partial<Split>) {
    setSplits(prev => prev.map(s => {
      if (s.id !== id) return s
      const u = { ...s, ...changes }
      u.taxa = getTaxa(u.forma, u.bandeira, u.parcelas)
      u.taxaFixa = getTaxaFixa(u.forma, u.bandeira, u.parcelas)
      if (u.forma !== 'boleto') u.vencimento = ''
      if (u.forma !== 'credito' && u.forma !== 'boleto') u.parcelas = 1
      u.liquido = Math.round((u.valor - calcTaxaValor(u)) * 100) / 100
      return u
    }))
  }

  const totalProcs = procs.reduce((s, p) => s + p.price, 0)
  const totalProdutos = produtos.reduce((s, p) => s + p.sale_price * p.quantidade, 0)
  const totalDebitos = debitos.filter(d => d.quitar).reduce((s, d) => s + d.valor, 0)
  const estoqueNegativo = produtos.filter(p => p.quantidade > p.current_stock)
  const descontoNum = parseFloat(descontoValorStr) || 0

  // Base do desconto = valor CHEIO dos procedimentos. valorCobrado do agendamento
  // ja' vem descontado quando existe desconto gravado, entao usa-lo como base
  // aplicaria o desconto duas vezes. Só vale como override manual quando não
  // ha' desconto registrado.
  const baseProcs = (valorCobrado !== null && valorCobrado !== undefined && descontoValorInicial == null)
    ? valorCobrado
    : totalProcs
  const subtotalItens = baseProcs + totalProdutos
  const totalComDesconto = descontoTipo === 'percentual'
    ? Math.max(0, subtotalItens * (1 - descontoNum / 100))
    : Math.max(0, subtotalItens - descontoNum)
  // Desconto proporcional so' da parte de procedimento — e' isso que volta pro
  // appointment.valor_cobrado. Produto e debito nao entram nesse campo.
  const procsComDesconto = subtotalItens > 0
    ? Math.round(totalComDesconto * (baseProcs / subtotalItens) * 100) / 100
    : 0
  const totalDever = totalComDesconto + totalDebitos
  const totalPago = splits.reduce((s, p) => s + p.valor, 0)
  const totalLiquido = splits.reduce((s, p) => s + p.liquido, 0)
  const saldo = Math.max(0, totalDever - totalPago)

  function applyDesconto(newTipo: 'valor' | 'percentual', newValorStr: string) {
    setDescontoTipo(newTipo)
    setDescontoValorStr(newValorStr)
  }

  // Com pagamento único (padrão), o valor acompanha o total a pagar — procedimento,
  // produto, desconto E débito. Antes cada um desses mexia no split por conta
  // própria (ou nem mexia, no caso do débito), então o valor cobrado divergia do
  // total. Com split manual dividido, não mexe: o usuário já ajustou na mão.
  useEffect(() => {
    if (loading || splits.length !== 1) return
    setSplits(prev => {
      const s0 = prev[0]
      if (Math.abs(s0.valor - totalDever) < 0.01) return prev
      const atualizado = { ...s0, valor: totalDever }
      atualizado.liquido = Math.round((totalDever - calcTaxaValor(atualizado)) * 100) / 100
      return [atualizado]
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalDever, loading])

  async function save() {
    if (!userId) { console.error('Sem usuário autenticado'); return }
    setSaving(true)
    try {
      const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
        .split('/').reverse().join('-')

      // Procedimentos e produtos vao na MESMA venda: a paciente paga uma vez so'.
      // A fn_registrar_venda separa em entradas por tipo_receita (servico/produto)
      // com rateio proporcional, entao o financeiro continua recebendo as linhas
      // separadas de sempre — DRE, comissao, ranking e nota fiscal sem mudanca.
      const itens = [
        ...procs.map(p => ({
          tipo: 'procedimento' as const,
          id: asProcUuid(p.id),
          nome: p.name,
          quantidade: 1,
          valor_unitario: p.price,
        })),
        ...produtos.map(p => ({
          tipo: 'produto' as const,
          id: p.id,
          nome: p.name,
          quantidade: p.quantidade,
          valor_unitario: p.sale_price,
        })),
      ].filter(i => i.valor_unitario > 0 || i.tipo === 'procedimento')

      // Debito quitado nao e' item desta venda — e' divida antiga sendo paga junto.
      // Fica fora do rateio pra nao inflar a receita de produto/procedimento do dia.
      const proporcaoItens = totalDever > 0 ? totalComDesconto / totalDever : 1

      const pagamentosItens = splits
        .filter(sp => sp.valor > 0)
        .map(sp => {
          const valorItens = Math.round(sp.valor * proporcaoItens * 100) / 100
          const taxa = calcTaxaValor({ ...sp, valor: valorItens })
          const taxaPct = valorItens > 0 ? Math.round((taxa / valorItens) * 1000000) / 10000 : 0
          return {
            forma: sp.forma,
            bandeira: sp.bandeira || '',
            valor: valorItens,
            taxa_percentual: taxaPct,
            n_parcelas: sp.parcelas,
            primeiro_vencimento: sp.forma === 'boleto' ? (sp.vencimento || '') : '',
          }
        })
        .filter(sp => sp.valor > 0)

      if (itens.length > 0 && pagamentosItens.length > 0) {
        const { error: errVenda } = await supabase.rpc('fn_registrar_venda', {
          p_user_id: userId,
          p_clinic_id: clinicId,
          p_data_venda: hoje,
          p_paciente_id: patientId,
          p_paciente_nome: patientName,
          p_profissional_id: professionalId,
          p_profissional_nome: professionalName,
          p_observacoes: obs || null,
          p_appointment_id: appointmentId,
          p_itens: itens,
          p_pagamentos: pagamentosItens,
        })
        if (errVenda) {
          console.error('Erro ao registrar venda:', errVenda)
          alert('Erro ao registrar pagamento: ' + errVenda.message)
          setSaving(false)
          return
        }
      }

      // Quitacao de debito: entrada propria, com a descricao do debito.
      // Antes o valor ficava embutido na entrada do procedimento do dia, o que
      // escondia a origem da receita nos relatorios.
      const debitosQuitar = debitos.filter(d => d.quitar)
      if (debitosQuitar.length > 0) {
        const formaDebito = splits[0]?.forma || 'pix'
        const linhasDebito = debitosQuitar.map(d => ({
          clinic_id: clinicId,
          data_venda: hoje,
          paciente_id: patientId,
          paciente_nome: patientName,
          procedimento_nome: d.descricao,
          profissional_id: professionalId,
          profissional_nome: professionalName,
          forma_pagamento: formaDebito,
          valor_bruto: d.valor,
          taxa_percentual: 0,
          valor_taxa: 0,
          valor_liquido: d.valor,
          n_parcelas: 1,
          tipo_receita: 'servico',
          appointment_id: appointmentId,
          created_by: userId,
          observacoes: 'Quitação de débito',
        }))
        const { error: errDeb } = await supabase.from('entradas').insert(linhasDebito)
        if (errDeb) console.error('Erro ao lançar quitação de débito:', errDeb)

        for (const d of debitosQuitar) {
          const { error } = await supabase.from('debitos')
            .update({ status: 'pago', data_pagamento: hoje })
            .eq('id', d.id)
          if (error) console.error('Erro ao quitar débito:', error)
        }
      }

      await supabase.from('appointments')
        .update({
          payment_registered_at: new Date().toISOString(),
          ...(descontoNum > 0 ? {
            desconto_tipo: descontoTipo,
            desconto_valor: descontoNum,
            valor_cobrado: procsComDesconto,
          } : {}),
        })
        .eq('id', appointmentId)

      router.refresh()
      onSuccess()
    } finally { setSaving(false) }
  }

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const modal = (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between flex-shrink-0">
          <div>
            <h2 className="font-bold text-slate-900 text-lg">Registrar Pagamento</h2>
            <p className="text-sm text-slate-500 mt-0.5">{patientName}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center ml-4">
            <Icon name="x" className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Conteúdo scrollável */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {loading ? (
            <div className="text-center py-8 text-slate-400">Carregando...</div>
          ) : (
            <>
              {/* Gratuito notice */}
              {valorCobrado === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2 items-center">
                  <span className="text-lg">✓</span>
                  <div>
                    <p className="text-sm font-semibold text-amber-700">Sem cobrança neste atendimento</p>
                    <p className="text-xs text-amber-600">A profissional definiu valor R$ 0. Confirme para registrar sem gerar dívida.</p>
                  </div>
                </div>
              )}

              {/* Procedimentos */}
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Procedimentos</p>
                <div className="space-y-1.5">
                  {procs.map((p, idx) => (
                    <div key={`${p.id}-${idx}`} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                      <span className="text-sm text-slate-700 flex-1 truncate">{p.name}</span>
                      <input
                        type="number" step="0.01" min="0"
                        value={p.price}
                        onChange={e => {
                          const v = parseFloat(e.target.value) || 0
                          setProcs(prev => prev.map((x, i) => i === idx ? { ...x, price: v } : x))
                        }}
                        className="w-24 text-xs px-2 py-1 border border-slate-200 rounded-md text-right bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setProcs(prev => prev.filter((_, i) => i !== idx))}
                        className="text-slate-300 hover:text-red-500"
                        title="Remover"
                      >
                        <Icon name="trash" className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {(valorCobrado !== null && valorCobrado !== undefined && descontoValorInicial == null) && (
                    <div className="flex justify-between pt-1.5 border-t border-slate-200 mt-1">
                      <span className="text-xs text-slate-500">Valor definido pela profissional</span>
                      <span className="text-sm font-bold text-violet-600">{fmt(valorCobrado)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Desconto */}
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Desconto</p>
                <div className="flex gap-2">
                  <select
                    value={descontoTipo}
                    onChange={e => applyDesconto(e.target.value as 'valor' | 'percentual', descontoValorStr)}
                    className="input text-sm w-20 flex-shrink-0"
                  >
                    <option value="valor">R$</option>
                    <option value="percentual">%</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="0"
                    value={descontoValorStr}
                    onChange={e => applyDesconto(descontoTipo, e.target.value)}
                    className="input text-sm flex-1"
                  />
                </div>
                {descontoNum > 0 && (
                  <p className="text-xs text-slate-500 mt-2">
                    {fmt(subtotalItens)} <span className="text-slate-400">→</span> <span className="font-semibold text-emerald-600">{fmt(totalComDesconto)}</span>
                  </p>
                )}
              </div>

              {/* Adicionar procedimento */}
              <button
                onClick={() => setShowAddProc(v => !v)}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-violet-500 hover:text-violet-700 border border-dashed border-violet-200 hover:border-violet-400 rounded-xl transition-colors"
              >
                <span className="text-base leading-none">+</span> Adicionar procedimento
              </button>
              {showAddProc && (
                <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                  <input
                    type="text"
                    placeholder="Buscar procedimento..."
                    value={procSearch}
                    onChange={e => setProcSearch(e.target.value)}
                    className="input w-full text-sm"
                  />
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {allClinicProcs
                      .filter(p => !procSearch || p.name.toLowerCase().includes(procSearch.toLowerCase()))
                      .map(p => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setProcs(prev => [...prev, p])
                            setShowAddProc(false)
                            setProcSearch('')
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white text-sm text-left transition-colors"
                        >
                          <span className="text-slate-700">{p.name}</span>
                          <span className="text-slate-500 text-xs ml-2">{p.price > 0 ? fmt(p.price) : 'Gratuito'}</span>
                        </button>
                      ))
                    }
                  </div>
                </div>
              )}

              {/* Adicionar produto — item da MESMA venda, somado no total a pagar.
                  Antes era uma venda paralela confirmada na hora, o que fazia a
                  paciente aparecer com dois pagamentos separados no financeiro. */}
              <button
                onClick={() => setShowAddProd(v => !v)}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-amber-600 hover:text-amber-700 border border-dashed border-amber-200 hover:border-amber-400 rounded-xl transition-colors"
              >
                <span className="text-base leading-none">+</span> Adicionar produto
              </button>
              {showAddProd && (
                <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                  <input
                    type="text"
                    placeholder="Buscar produto..."
                    value={prodSearch}
                    onChange={e => setProdSearch(e.target.value)}
                    className="input w-full text-sm"
                  />
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {allClinicProds
                      .filter(p => !prodSearch || p.name.toLowerCase().includes(prodSearch.toLowerCase()))
                      .map(p => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setProdutos(prev => {
                              const ja = prev.find(x => x.id === p.id)
                              return ja
                                ? prev.map(x => x.id === p.id ? { ...x, quantidade: x.quantidade + 1 } : x)
                                : [...prev, { ...p, quantidade: 1 }]
                            })
                            setShowAddProd(false)
                            setProdSearch('')
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white text-sm text-left transition-colors"
                        >
                          <span className="text-slate-700">{p.name}</span>
                          <span className="text-slate-500 text-xs ml-2">
                            {fmt(p.sale_price)}
                            <span className="text-slate-400 ml-1">
                              {p.current_stock <= 0 ? '(sem estoque)' : `(${p.current_stock})`}
                            </span>
                          </span>
                        </button>
                      ))
                    }
                  </div>
                </div>
              )}

              {produtos.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-semibold text-amber-700">Produtos nesta venda</p>
                  {produtos.map(item => (
                    <div key={item.id} className="flex items-center gap-2">
                      <span className="text-xs text-amber-800 font-medium flex-1 truncate">{item.name}</span>
                      <input
                        type="number" step="0.01" min="0"
                        value={item.sale_price}
                        onChange={e => {
                          const v = parseFloat(e.target.value) || 0
                          setProdutos(prev => prev.map(x => x.id === item.id ? { ...x, sale_price: v } : x))
                        }}
                        className="w-20 text-xs px-2 py-1 border border-amber-200 rounded-md text-right bg-white"
                      />
                      <div className="flex items-center gap-1 bg-white border border-amber-200 rounded-md">
                        <button
                          type="button"
                          onClick={() => {
                            setProdutos(prev => prev.flatMap(x => {
                              if (x.id !== item.id) return [x]
                              return x.quantidade <= 1 ? [] : [{ ...x, quantidade: x.quantidade - 1 }]
                            }))
                          }}
                          className="w-6 h-6 flex items-center justify-center text-amber-600 hover:bg-amber-50 rounded-l-md text-sm font-bold"
                        >−</button>
                        <span className="text-xs font-semibold text-amber-900 w-5 text-center">{item.quantidade}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setProdutos(prev => prev.map(x => x.id === item.id ? { ...x, quantidade: x.quantidade + 1 } : x))
                          }}
                          className="w-6 h-6 flex items-center justify-center text-amber-600 hover:bg-amber-50 rounded-r-md text-sm font-bold"
                        >+</button>
                      </div>
                      <span className="text-xs text-amber-700 w-20 text-right">{fmt(item.sale_price * item.quantidade)}</span>
                    </div>
                  ))}
                  {estoqueNegativo.length > 0 && (
                    <p className="text-xs text-rose-600">
                      {estoqueNegativo.map(i => `${i.name} (estoque: ${i.current_stock})`).join(', ')} — vai ficar negativo. Pode continuar, mas lembra de repor.
                    </p>
                  )}
                </div>
              )}

              {/* Débitos pendentes */}
              {debitos.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name="alertTriangle" className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <p className="text-xs font-semibold text-red-700">Débitos pendentes — quitar junto?</p>
                  </div>
                  <div className="space-y-2">
                    {debitos.map(d => (
                      <label key={d.id} className="flex items-center justify-between gap-3 cursor-pointer">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input type="checkbox" checked={d.quitar}
                            onChange={e => setDebitos(prev => prev.map(x => x.id === d.id ? { ...x, quitar: e.target.checked } : x))}
                            className="w-4 h-4 rounded accent-red-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-red-800 truncate">{d.descricao}</p>
                            <p className="text-xs text-red-400">Vence: {new Date(d.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-red-600 flex-shrink-0">{fmt(d.valor)}</span>
                      </label>
                    ))}
                    {totalDebitos > 0 && (
                      <div className="flex justify-between pt-1.5 border-t border-red-200">
                        <span className="text-xs font-semibold text-red-700">Total selecionado</span>
                        <span className="text-sm font-bold text-red-700">{fmt(totalDebitos)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Splits */}
              {splits.map((s, idx) => (
                <div key={s.id} className="bg-slate-50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">Pagamento {idx + 1}</span>
                    {splits.length > 1 && (
                      <button onClick={() => setSplits(p => p.filter(x => x.id !== s.id))} className="text-xs text-red-400 hover:text-red-600">Remover</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Forma</label>
                      <select value={s.forma} onChange={e => updateSplit(s.id, { forma: e.target.value, bandeira: '' })} className="input w-full text-sm">
                        {FORMAS.map(f => <option key={f} value={f}>{FORMA_LABEL[f]}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Valor (R$)</label>
                      <input type="number" value={s.valor} min={0} step={0.01}
                        onChange={e => updateSplit(s.id, { valor: parseFloat(e.target.value) || 0 })}
                        className="input w-full text-sm" />
                    </div>
                  </div>
                  {s.forma === 'credito' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Parcelas</label>
                        <select value={s.parcelas} onChange={e => updateSplit(s.id, { parcelas: parseInt(e.target.value) })} className="input w-full text-sm">
                          {[1,2,3,4,5,6,7,8,9,10,11,12].map(p => <option key={p} value={p}>{p}x</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Bandeira *</label>
                        <select value={s.bandeira} onChange={e => updateSplit(s.id, { bandeira: e.target.value })}
                          className={`input w-full text-sm ${!s.bandeira ? 'border-amber-400' : ''}`}>
                          <option value="">Selecione...</option>
                          {BANDEIRAS_ESPECIFICAS.map(b => (
                            <option key={b.key} value={b.key}>{b.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                  {s.forma === 'boleto' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Parcelas</label>
                        <select value={s.parcelas} onChange={e => updateSplit(s.id, { parcelas: parseInt(e.target.value) })} className="input w-full text-sm">
                          {[1,2,3,4,5,6,7,8,9,10,11,12].map(p => <option key={p} value={p}>{p}x</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Venc. 1º boleto *</label>
                        <input type="date" value={s.vencimento}
                          onChange={e => updateSplit(s.id, { vencimento: e.target.value })}
                          className={`input w-full text-sm ${!s.vencimento ? 'border-amber-400' : ''}`} />
                      </div>
                    </div>
                  )}
                  {s.forma === 'debito' && (
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Bandeira *</label>
                      <select value={s.bandeira} onChange={e => updateSplit(s.id, { bandeira: e.target.value })}
                        className={`input w-full text-sm ${!s.bandeira ? 'border-amber-400' : ''}`}>
                        <option value="">Selecione...</option>
                        {BANDEIRAS_ESPECIFICAS.map(b => (
                          <option key={b.key} value={b.key}>{b.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>
                      Taxa: {s.taxa}%
                      {s.forma === 'boleto' && s.taxaFixa > 0 && ` + ${fmt(s.taxaFixa)}/boleto`}
                    </span>
                    <span className="font-medium text-emerald-600">Líquido: {fmt(s.liquido)}</span>
                  </div>
                  {s.forma === 'boleto' && s.parcelas > 1 && s.vencimento && (
                    <p className="text-[11px] text-slate-400">
                      {s.parcelas}x de {fmt(s.liquido / s.parcelas)} líquidos, vencendo mês a mês a partir de {s.vencimento.split('-').reverse().join('/')}.
                    </p>
                  )}
                </div>
              ))}

              <button onClick={() => setSplits(p => [...p, { id: uid(), forma: 'pix', bandeira: '', valor: 0, parcelas: 1, taxa: 0, taxaFixa: 0, liquido: 0, vencimento: '' }])}
                className="w-full py-2 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-400 hover:border-violet-300 hover:text-violet-500 transition-colors flex items-center justify-center gap-2">
                <Icon name="plus" className="w-4 h-4" /> Adicionar forma de pagamento
              </button>

              {/* Resumo */}
              <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
                {(totalDebitos > 0 || descontoNum > 0 || totalProdutos > 0) && (
                  <div className="flex justify-between text-sm text-slate-500"><span>Procedimentos</span><span>{fmt(baseProcs)}</span></div>
                )}
                {totalProdutos > 0 && (
                  <div className="flex justify-between text-sm text-amber-600"><span>Produtos</span><span>{fmt(totalProdutos)}</span></div>
                )}
                {descontoNum > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600">
                    <span>Desconto</span>
                    <span>-{descontoTipo === 'percentual' ? `${descontoNum}%` : fmt(descontoNum)}</span>
                  </div>
                )}
                {totalDebitos > 0 && (
                  <div className="flex justify-between text-sm text-red-500 pb-1.5 border-b border-slate-200"><span>Débitos selecionados</span><span>{fmt(totalDebitos)}</span></div>
                )}
                <div className="flex justify-between text-sm font-bold text-slate-900"><span>Total a pagar</span><span>{fmt(totalDever)}</span></div>
                <div className="flex justify-between text-sm text-slate-500"><span>Total líquido</span><span className="font-semibold text-emerald-600">{fmt(totalLiquido)}</span></div>

              </div>



              <div>
                <label className="text-xs text-slate-500 mb-1 block">Observações</label>
                <input type="text" value={obs} onChange={e => setObs(e.target.value)}
                  placeholder="Ex: pagou metade hoje, restante na volta"
                  className="input w-full text-sm" />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 flex flex-col gap-2 flex-shrink-0">
          {splits.some(s => (s.forma === 'credito' || s.forma === 'debito') && s.valor > 0 && !s.bandeira) && (
            <p className="text-xs text-amber-600 text-center">Selecione a bandeira do cartão antes de confirmar.</p>
          )}
          {splits.some(s => s.forma === 'boleto' && s.valor > 0 && !s.vencimento) && (
            <p className="text-xs text-amber-600 text-center">Informe o vencimento do 1º boleto antes de confirmar.</p>
          )}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={
                saving || loading ||
                splits.every(s => s.valor <= 0) ||
                splits.some(s => (s.forma === 'credito' || s.forma === 'debito') && s.valor > 0 && !s.bandeira) ||
                splits.some(s => s.forma === 'boleto' && s.valor > 0 && !s.vencimento)
              }
              className="flex-1 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-all">
              {saving ? 'Salvando...' : 'Confirmar Pagamento'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  if (!mounted) return null
  return createPortal(modal, document.body)
}




