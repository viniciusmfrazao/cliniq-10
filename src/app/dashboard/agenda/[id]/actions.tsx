'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import AppointmentForm from '../appointment-form'
import Icon from '@/components/ui/Icon'

type Props = {
  appointment: {
    id: string
    patient_id: string
    procedure_id: string | null
    professional_id: string | null
    room_id: string | null
    start_time: string
    end_time: string
    notes: string | null
    status: string
    valor_sinal: number | null
    forma_pagamento_sinal: string | null
  }
  clinicId: string
  patients: { id: string; name: string }[]
  procedures: { id: string; name: string; duration_minutes: number; price: number; professional_ids?: string[] | null }[]
  professionals: { id: string; name: string }[]
  rooms: { id: string; name: string }[]
}

export default function AppointmentActions({ 
  appointment, 
  clinicId,
  patients,
  procedures,
  professionals,
  rooms
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)

  // Observações
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState(appointment.notes || '')
  const [savingNotes, startSavingNotes] = useTransition()

  // Sinal/pagamento antecipado
  const [showSinal, setShowSinal] = useState(false)
  const [valorSinal, setValorSinal] = useState(appointment.valor_sinal?.toString() || '')
  const [formaPgSinal, setFormaPgSinal] = useState(appointment.forma_pagamento_sinal || 'pix')
  const [savingSinal, startSavingSinal] = useTransition()
  const [sinalSalvo, setSinalSalvo] = useState(!!appointment.valor_sinal)

  async function saveNotes() {
    startSavingNotes(async () => {
      await supabase.from('appointments').update({ notes: notes.trim() || null }).eq('id', appointment.id)
      setEditingNotes(false)
      router.refresh()
    })
  }

  async function saveSinal() {
    if (!valorSinal || parseFloat(valorSinal) <= 0) return
    startSavingSinal(async () => {
      await supabase.from('appointments').update({
        valor_sinal: parseFloat(valorSinal),
        forma_pagamento_sinal: formaPgSinal,
      }).eq('id', appointment.id)
      setSinalSalvo(true)
      setShowSinal(false)
      router.refresh()
    })
  }

  async function updateStatus(status: string) {
    setLoading(true)
    await supabase.from('appointments').update({ status }).eq('id', appointment.id)
    router.refresh()
    setLoading(false)
  }

  async function handleDelete() {
    if (!confirm('Excluir este agendamento?')) return
    setLoading(true)
    await supabase.from('appointments').delete().eq('id', appointment.id)
    router.push(`/dashboard/agenda?date=${appointment.start_time.split('T')[0]}`)
    router.refresh()
  }

  if (editing) {
    return (
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Editar agendamento</h2>
        <AppointmentForm
          clinicId={clinicId}
          patients={patients}
          procedures={procedures}
          professionals={professionals}
          rooms={rooms}
          appointment={appointment}
        />
        <button 
          onClick={() => setEditing(false)} 
          className="mt-4 text-sm text-slate-500 hover:text-slate-700"
        >
          Cancelar edicao
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Observações */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Observações</h3>
          {!editingNotes && (
            <button onClick={() => setEditingNotes(true)} className="text-xs text-violet-600 hover:text-violet-800 font-medium flex items-center gap-1">
              <Icon name="edit" className="w-3.5 h-3.5" />
              {notes ? 'Editar' : 'Adicionar'}
            </button>
          )}
        </div>
        {editingNotes ? (
          <div className="space-y-2">
            <textarea className="input resize-none w-full" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observações sobre este agendamento..." autoFocus />
            <div className="flex gap-2">
              <button onClick={saveNotes} disabled={savingNotes} className="btn-primary text-sm py-2 px-4">{savingNotes ? 'Salvando...' : 'Salvar'}</button>
              <button onClick={() => { setEditingNotes(false); setNotes(appointment.notes || '') }} className="btn-secondary text-sm py-2 px-4">Cancelar</button>
            </div>
          </div>
        ) : (
          <p className={`text-sm ${notes ? 'text-slate-700' : 'text-slate-400 italic'}`}>{notes || 'Nenhuma observação. Clique em adicionar.'}</p>
        )}
      </div>

      {/* Sinal / Pagamento antecipado */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Pagamento antecipado</h3>
            <p className="text-xs text-slate-500">Sinal cobrado no agendamento</p>
          </div>
          {!showSinal && !sinalSalvo && (
            <button onClick={() => setShowSinal(true)} className="text-xs text-emerald-600 hover:text-emerald-800 font-medium flex items-center gap-1">
              <Icon name="plus" className="w-3.5 h-3.5" />
              Registrar sinal
            </button>
          )}
          {sinalSalvo && !showSinal && (
            <button onClick={() => setShowSinal(true)} className="text-xs text-slate-500 font-medium flex items-center gap-1">
              <Icon name="edit" className="w-3.5 h-3.5" />
              Editar
            </button>
          )}
        </div>
        {sinalSalvo && !showSinal && (
          <div className="flex items-center gap-3 bg-emerald-50 rounded-xl px-4 py-3">
            <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Icon name="check" className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-800">R$ {parseFloat(valorSinal || appointment.valor_sinal?.toString() || '0').toFixed(2).replace('.', ',')} recebido</p>
              <p className="text-xs text-emerald-600 capitalize">{formaPgSinal || appointment.forma_pagamento_sinal}</p>
            </div>
          </div>
        )}
        {!sinalSalvo && !showSinal && (
          <p className="text-sm text-slate-400 italic">Nenhum sinal registrado.</p>
        )}
        {showSinal && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Valor (R$) *</label>
                <input type="number" step="0.01" min="0" className="input" placeholder="0,00" value={valorSinal} onChange={e => setValorSinal(e.target.value)} autoFocus />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Forma de pagamento</label>
                <select className="input" value={formaPgSinal} onChange={e => setFormaPgSinal(e.target.value)}>
                  <option value="pix">Pix</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="credito">Crédito</option>
                  <option value="debito">Débito</option>
                  <option value="transferencia">Transferência</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={saveSinal} disabled={savingSinal || !valorSinal} className="btn-primary text-sm py-2 px-4">{savingSinal ? 'Salvando...' : 'Confirmar sinal'}</button>
              <button onClick={() => setShowSinal(false)} className="btn-secondary text-sm py-2 px-4">Cancelar</button>
            </div>
          </div>
        )}
      </div>

      {/* Ações */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Acoes</h2>
        <div className="flex flex-wrap gap-2">
        {appointment.status === 'scheduled' && (
          <button
            onClick={() => updateStatus('confirmed')}
            disabled={loading}
            className="text-sm bg-blue-50 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-100"
          >
            Confirmar
          </button>
        )}
        
        {(appointment.status === 'scheduled' || appointment.status === 'confirmed') && (
          <button
            onClick={() => updateStatus('in_progress')}
            disabled={loading}
            className="text-sm bg-amber-50 text-amber-700 px-4 py-2 rounded-lg hover:bg-amber-100"
          >
            Iniciar atendimento
          </button>
        )}

        {appointment.status === 'in_progress' && (
          <button
            onClick={() => updateStatus('completed')}
            disabled={loading}
            className="text-sm bg-green-50 text-green-700 px-4 py-2 rounded-lg hover:bg-green-100"
          >
            Finalizar
          </button>
        )}

        {appointment.status !== 'completed' && appointment.status !== 'cancelled' && (
          <>
            <button
              onClick={() => updateStatus('no_show')}
              disabled={loading}
              className="text-sm bg-red-50 text-red-700 px-4 py-2 rounded-lg hover:bg-red-100"
            >
              Faltou
            </button>
            <button
              onClick={() => updateStatus('cancelled')}
              disabled={loading}
              className="text-sm bg-red-50 text-red-700 px-4 py-2 rounded-lg hover:bg-red-100"
            >
              Cancelar
            </button>
          </>
        )}

        <button
          onClick={() => setEditing(true)}
          className="text-sm bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200"
        >
          Editar
        </button>

        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-sm text-red-500 px-4 py-2 hover:text-red-700"
        >
          Excluir
        </button>
      </div>
    </div>

    </div>
  )
}
