'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'

type Taxa = { forma: string; bandeira: string | null; taxa_percentual: number }
type ProcItem = { id: string; name: string; price: number }
type Split = { id: string; forma: string; bandeira: string; valor: number; parcelas: number; taxa: number; liquido: number }
type Debito = { id: string; descricao: string; valor: number; data_vencimento: string; quitar: boolean }

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
  onClose: () => void
  onSuccess: () => void
}

const FORMAS = ['pix', 'dinheiro', 'credito', 'debito']
const FORMA_LABEL: Record<string, string> = { pix: 'PIX', dinheiro: 'Dinheiro', credito: 'Crédito', debito: 'Débito' }

function uid() { return Math.random().toString(36).slice(2) }

export default function PaymentModal({ appointmentId, clinicId, patientId, patientName, procedureName, procedurePrice, procedureId, professionalId, professionalName, onClose, onSuccess }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [taxas, setTaxas] = useState<Taxa[]>([])
  const [procs, setProcs] = useState<ProcItem[]>([])
  const [splits, setSplits] = useState<Split[]>([])
  const [debitos, setDebitos] = useState<Debito[]>([])
  const [obs, setObs] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    async function init() {
      // Taxas
      const { data: taxasData } = await supabase
        .from('taxas_pagamento').select('forma, bandeira, taxa_percentual').eq('clinic_id', clinicId)
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
      setSplits([{ id: uid(), forma: 'pix', bandeira: '', valor: total, parcelas: 1, taxa: 0, liquido: total }])

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

  function getTaxa(forma: string, bandeira: string) {
    return taxas.find(t => t.forma === forma && (t.bandeira === bandeira || !t.bandeira))?.taxa_percentual || 0
  }

  function updateSplit(id: string, changes: Partial<Split>) {
    setSplits(prev => prev.map(s => {
      if (s.id !== id) return s
      const u = { ...s, ...changes }
      u.taxa = getTaxa(u.forma, u.bandeira)
      u.liquido = u.valor * (1 - u.taxa / 100)
      return u
    }))
  }

  const totalProcs = procs.reduce((s, p) => s + p.price, 0)
  const totalDebitos = debitos.filter(d => d.quitar).reduce((s, d) => s + d.valor, 0)
  const totalDever = totalProcs + totalDebitos
  const totalPago = splits.reduce((s, p) => s + p.valor, 0)
  const totalLiquido = splits.reduce((s, p) => s + p.liquido, 0)
  const saldo = Math.max(0, totalDever - totalPago)

  async function save() {
    setSaving(true)
    try {
      const hoje = new Date().toISOString().split('T')[0]

      // Entradas por procedimento
      for (const proc of procs) {
        const proporcao = totalProcs > 0 ? proc.price / totalProcs : 1 / procs.length
        for (const s of splits) {
          if (s.valor <= 0) continue
          const val = Math.round(s.valor * proporcao * 100) / 100
          const taxa = Math.round(val * s.taxa) / 100
          const liquido = Math.round((val - taxa) * 100) / 100
          await supabase.from('entradas').insert({
            clinic_id: clinicId, data_venda: hoje,
            paciente_id: patientId, paciente_nome: patientName,
            procedimento_nome: proc.name,
            profissional_id: professionalId, profissional_nome: professionalName,
            forma_pagamento: s.forma, bandeira: s.bandeira || null,
            valor_bruto: val, taxa_percentual: s.taxa,
            valor_taxa: taxa, valor_liquido: liquido,
            n_parcelas: s.parcelas, observacoes: obs || null,
          })
        }
      }

      // Quitar débitos marcados — com data de pagamento real
      for (const d of debitos.filter(x => x.quitar)) {
        const { error } = await supabase.from('debitos').update({
          status: 'pago',
          data_pagamento: hoje,
        }).eq('id', d.id)
        if (error) console.error('Erro ao quitar débito:', error)
      }

      // Novo saldo devedor
      if (saldo > 0.01 && patientId) {
        await supabase.from('debitos').insert({
          clinic_id: clinicId,
          paciente_id: patientId,
          paciente_nome: patientName,
          valor: saldo,
          descricao: `Saldo devedor — ${procs.map(p => p.name).join(' + ')}`,
          data_vencimento: hoje,
          status: 'pendente',
        })
      }

      // Marcar pagamento
      await supabase.from('appointments')
        .update({ payment_registered_at: new Date().toISOString() })
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
              {/* Procedimentos */}
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Procedimentos</p>
                <div className="space-y-1.5">
                  {procs.map(p => (
                    <div key={p.id} className="flex justify-between items-center">
                      <span className="text-sm text-slate-700">{p.name}</span>
                      <span className="text-sm font-semibold text-slate-900">{p.price > 0 ? fmt(p.price) : '—'}</span>
                    </div>
                  ))}
                  {procs.length > 1 && totalProcs > 0 && (
                    <div className="flex justify-between pt-1.5 border-t border-slate-200">
                      <span className="text-sm font-semibold text-slate-700">Total procedimentos</span>
                      <span className="text-sm font-bold text-slate-900">{fmt(totalProcs)}</span>
                    </div>
                  )}
                </div>
              </div>

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
                        <label className="text-xs text-slate-500 mb-1 block">Bandeira</label>
                        <select value={s.bandeira} onChange={e => updateSplit(s.id, { bandeira: e.target.value })} className="input w-full text-sm">
                          <option value="">Selecione</option>
                          {[...new Set(taxas.filter(t => t.forma === 'credito').map(t => t.bandeira).filter(Boolean))].map(b => (
                            <option key={b!} value={b!}>{b}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Parcelas</label>
                        <select value={s.parcelas} onChange={e => updateSplit(s.id, { parcelas: parseInt(e.target.value) })} className="input w-full text-sm">
                          {[1,2,3,4,5,6,7,8,9,10,11,12].map(p => <option key={p} value={p}>{p}x</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Taxa: {s.taxa}%</span>
                    <span className="font-medium text-emerald-600">Líquido: {fmt(s.liquido)}</span>
                  </div>
                </div>
              ))}

              <button onClick={() => setSplits(p => [...p, { id: uid(), forma: 'pix', bandeira: '', valor: 0, parcelas: 1, taxa: 0, liquido: 0 }])}
                className="w-full py-2 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-400 hover:border-violet-300 hover:text-violet-500 transition-colors flex items-center justify-center gap-2">
                <Icon name="plus" className="w-4 h-4" /> Adicionar forma de pagamento
              </button>

              {/* Resumo */}
              <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
                {totalDebitos > 0 && <>
                  <div className="flex justify-between text-sm text-slate-500"><span>Procedimentos</span><span>{fmt(totalProcs)}</span></div>
                  <div className="flex justify-between text-sm text-red-500 pb-1.5 border-b border-slate-200"><span>Débitos selecionados</span><span>{fmt(totalDebitos)}</span></div>
                </>}
                <div className="flex justify-between text-sm font-bold text-slate-900"><span>Total a pagar</span><span>{fmt(totalDever)}</span></div>
                <div className="flex justify-between text-sm text-slate-500"><span>Total pago</span><span className="font-semibold">{fmt(totalPago)}</span></div>
                <div className="flex justify-between text-sm text-slate-500"><span>Total líquido</span><span className="font-semibold text-emerald-600">{fmt(totalLiquido)}</span></div>
                {saldo > 0.01 && (
                  <div className="flex justify-between text-sm pt-1.5 border-t border-slate-200">
                    <span className="text-red-500 font-medium">Saldo devedor</span>
                    <span className="font-bold text-red-600">{fmt(saldo)}</span>
                  </div>
                )}
              </div>

              {saldo > 0.01 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
                  <Icon name="alertTriangle" className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    O saldo de <strong>{fmt(saldo)}</strong> será criado automaticamente em <strong>Devedores</strong>.
                  </p>
                </div>
              )}

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
        <div className="p-5 border-t border-slate-100 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button onClick={save} disabled={saving || loading || splits.every(s => s.valor <= 0)}
            className="flex-1 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-all">
            {saving ? 'Salvando...' : 'Confirmar Pagamento'}
          </button>
        </div>
      </div>
    </div>
  )

  if (!mounted) return null
  return createPortal(modal, document.body)
}
