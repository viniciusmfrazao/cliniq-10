'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'

type Taxa = { forma: string; bandeira: string | null; taxa_percentual: number }
type ProcItem = { id: string; name: string; price: number }
type Split = { id: string; forma: string; bandeira: string; valor: number; parcelas: number; taxa: number; liquido: number }

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

export default function PaymentModal({
  appointmentId, clinicId, patientId, patientName,
  procedureName, procedurePrice, procedureId,
  professionalId, professionalName, onClose, onSuccess
}: Props) {
  const supabase = createClient()
  const [taxas, setTaxas] = useState<Taxa[]>([])
  const [procs, setProcs] = useState<ProcItem[]>([])
  const [splits, setSplits] = useState<Split[]>([])
  const [obs, setObs] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      // Buscar taxas
      const { data: taxasData } = await supabase
        .from('taxas_pagamento').select('forma, bandeira, taxa_percentual').eq('clinic_id', clinicId)
      setTaxas(taxasData || [])

      // Buscar múltiplos procedimentos do agendamento
      const { data: apProcs } = await supabase
        .from('appointment_procedures')
        .select('id, procedure_id, procedure_name, price')
        .eq('appointment_id', appointmentId)

      let procList: ProcItem[] = []
      if (apProcs && apProcs.length > 0) {
        procList = apProcs.map((ap: any) => ({
          id: ap.procedure_id || ap.id,
          name: ap.procedure_name,
          price: ap.price || 0,
        }))
      } else {
        // Fallback: usar o procedimento principal do agendamento
        procList = [{ id: procedureId || '', name: procedureName, price: procedurePrice || 0 }]
      }
      setProcs(procList)

      // Valor total dos procedimentos como valor inicial do split
      const total = procList.reduce((s, p) => s + p.price, 0)
      setSplits([{ id: uid(), forma: 'pix', bandeira: '', valor: total, parcelas: 1, taxa: 0, liquido: total }])
      setLoading(false)
    }
    init()
  }, [appointmentId, clinicId])

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
  const totalPago = splits.reduce((s, p) => s + p.valor, 0)
  const totalLiquido = splits.reduce((s, p) => s + p.liquido, 0)
  const saldo = Math.max(0, totalProcs - totalPago)

  async function save() {
    setSaving(true)
    try {
      const hoje = new Date().toISOString().split('T')[0]

      // Criar entrada por procedimento
      for (const proc of procs) {
        if (proc.price <= 0) continue
        // Distribuir o pagamento proporcionalmente por procedimento
        const proporcao = totalProcs > 0 ? proc.price / totalProcs : 1 / procs.length
        for (const s of splits) {
          if (s.valor <= 0) continue
          const valorProc = s.valor * proporcao
          await supabase.from('entradas').insert({
            clinic_id: clinicId,
            data_venda: hoje,
            paciente_id: patientId,
            paciente_nome: patientName,
            procedimento_nome: proc.name,
            profissional_id: professionalId,
            profissional_nome: professionalName,
            forma_pagamento: s.forma,
            bandeira: s.bandeira || null,
            valor_bruto: valorProc,
            taxa_percentual: s.taxa,
            valor_taxa: valorProc * s.taxa / 100,
            valor_liquido: valorProc * (1 - s.taxa / 100),
            n_parcelas: s.parcelas,
            observacoes: obs || null,
          })
        }
      }

      // Saldo devedor → Devedores
      if (saldo > 0.01 && patientId) {
        const nomesProcs = procs.map(p => p.name).join(' + ')
        await supabase.from('debitos').insert({
          clinic_id: clinicId,
          paciente_id: patientId,
          valor: saldo,
          descricao: `Saldo devedor — ${nomesProcs}`,
          data_vencimento: hoje,
          status: 'pendente',
        })
      }

      // Marcar pagamento registrado
      await supabase.from('appointments')
        .update({ payment_registered_at: new Date().toISOString() })
        .eq('id', appointmentId)

      onSuccess()
    } finally { setSaving(false) }
  }

  if (loading) return null

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Registrar Pagamento</h2>
            <p className="text-sm text-slate-500 mt-0.5">{patientName}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center flex-shrink-0">
            <Icon name="x" className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Procedimentos */}
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs font-semibold text-slate-500 mb-2">PROCEDIMENTOS</p>
            <div className="space-y-1.5">
              {procs.map(p => (
                <div key={p.id} className="flex justify-between items-center">
                  <span className="text-sm text-slate-700">{p.name}</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {p.price > 0 ? p.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                  </span>
                </div>
              ))}
              {procs.length > 1 && (
                <div className="flex justify-between items-center pt-1.5 border-t border-slate-200">
                  <span className="text-sm font-semibold text-slate-700">Total</span>
                  <span className="text-sm font-bold text-slate-900">
                    {totalProcs.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Splits de pagamento */}
          {splits.map((s, idx) => (
            <div key={s.id} className="bg-slate-50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Pagamento {idx + 1}</span>
                {splits.length > 1 && (
                  <button onClick={() => setSplits(p => p.filter(x => x.id !== s.id))} className="text-xs text-red-400 hover:text-red-600">
                    Remover
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
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
                <div className="grid grid-cols-2 gap-2">
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
                <span>Líquido: <strong className="text-emerald-600">
                  {s.liquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </strong></span>
              </div>
            </div>
          ))}

          <button onClick={() => setSplits(p => [...p, { id: uid(), forma: 'pix', bandeira: '', valor: 0, parcelas: 1, taxa: 0, liquido: 0 }])}
            className="w-full py-2 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-400 hover:border-violet-300 hover:text-violet-500 transition-colors flex items-center justify-center gap-2">
            <Icon name="plus" className="w-4 h-4" /> Adicionar forma de pagamento
          </button>

          {/* Resumo */}
          <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Total pago</span>
              <span className="font-semibold">{totalPago.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Total líquido</span>
              <span className="font-semibold text-emerald-600">{totalLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </div>
            {saldo > 0.01 && (
              <div className="flex justify-between text-sm pt-1.5 border-t border-slate-200">
                <span className="text-red-500 font-medium">Saldo devedor</span>
                <span className="font-bold text-red-600">{saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
            )}
          </div>

          {saldo > 0.01 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
              <Icon name="alertTriangle" className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                O saldo de <strong>{saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong> será criado automaticamente em <strong>Devedores</strong>.
              </p>
            </div>
          )}

          <div>
            <label className="text-xs text-slate-500 mb-1 block">Observações</label>
            <input type="text" value={obs} onChange={e => setObs(e.target.value)}
              placeholder="Ex: pagou metade hoje, restante na volta"
              className="input w-full text-sm" />
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button onClick={save} disabled={saving || splits.every(s => s.valor <= 0)}
            className="flex-1 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-all">
            {saving ? 'Salvando...' : 'Confirmar Pagamento'}
          </button>
        </div>
      </div>
    </div>
  )
}
