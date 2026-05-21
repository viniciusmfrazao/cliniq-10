'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import { createClient } from '@/lib/supabase/client'
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh'
import { useToast } from '@/components/ui/Toast'
import SendAnamneseButton from './send-anamnese-button'
import BlockModal from './block-modal'
import PaymentModal from '@/components/agenda/payment-modal'

type Block = {
  id: string
  title: string
  start_time: string
  end_time: string
  notes: string | null
  color: string
  professional_id: string
  professional?: { name: string } | null
}

type Appointment = {
  id: string
  clinic_id: string
  start_time: string
  end_time: string | null
  status: string
  notes: string | null
  professional_id: string | null
  procedure_id: string | null
  checked_in_at: string | null
  payment_registered_at: string | null
  valor_sinal: number | null
  forma_pagamento_sinal: string | null
  patients: { id: string; name: string; phone: string | null; photo_url: string | null; cpf: string | null; birth_date: string | null } | null
  procedures: { name: string; duration_minutes: number; price: number } | null
  professional: { id: string; name: string } | null
}

type Professional = {
  id: string
  name: string
  role: string
}

type Props = {
  appointments: Appointment[]
  blocks: Block[]
  viewMode: string
  selectedDate: string
  professionals: Professional[]
  selectedProfessional: string
  clinicId: string
}

const HOUR_SLOTS = Array.from({ length: 14 }, (_, i) => i + 7)

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string; label: string }> = {
  scheduled: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', label: 'Agendado' },
  pending_confirmation: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300', label: 'Aguard. confirmação' },
  confirmed: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', label: 'Confirmado' },
  in_progress: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300', label: 'Em atendimento' },
  completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', label: 'Realizado' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', label: 'Cancelado' },
  no_show: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', label: 'Não compareceu' },
}

const PROFESSIONAL_COLORS = [
  'from-violet-500 to-purple-500',
  'from-blue-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-rose-500 to-pink-500',
  'from-amber-500 to-orange-500',
]

// Componente de Card de Agendamento com preview e ações rápidas
const AppointmentCard = React.memo(function AppointmentCard({ 
  apt, 
  onStatusChange,
  onCheckIn,
  onDragStart,
  compact = false,
  isRightColumn = false
}: { 
  apt: Appointment
  onStatusChange: (id: string, status: string) => void
  onCheckIn: (id: string) => void
  onDragStart?: (e: React.DragEvent, apt: Appointment) => void
  compact?: boolean
  isRightColumn?: boolean
  canDrag?: boolean
}) {
  const [showPreview, setShowPreview] = useState(false)
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabaseCard = createClient()
  const [debitos, setDebitos] = useState<{ valor: number; descricao: string; data_vencimento: string }[]>([])
  const [debitosLoaded, setDebitosLoaded] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const [popupDir, setPopupDir] = useState<'up' | 'down'>('up')
  const [popupPos, setPopupPos] = useState<{ top: number; bottom: number; left: number } | null>(null)
  const status = STATUS_CONFIG[apt.status] || STATUS_CONFIG.scheduled
  const router = useRouter()

  // Observações inline
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState(apt.notes || '')
  const [savingNotes, setSavingNotes] = useState(false)

  // Sinal inline
  const [showSinal, setShowSinal] = useState(false)
  const [valorSinal, setValorSinal] = useState(apt.valor_sinal?.toString() || '')
  const [formaPgSinal, setFormaPgSinal] = useState(apt.forma_pagamento_sinal || 'pix')
  const [savingSinal, setSavingSinal] = useState(false)
  const [sinalSalvo, setSinalSalvo] = useState(!!apt.valor_sinal)

  async function saveNotes() {
    setSavingNotes(true)
    await supabaseCard.from('appointments').update({ notes: notes.trim() || null }).eq('id', apt.id)
    setSavingNotes(false)
    setEditingNotes(false)
    router.refresh()
  }

  async function saveSinal() {
    if (!valorSinal || parseFloat(valorSinal) <= 0) return
    setSavingSinal(true)
    await supabaseCard.from('appointments').update({
      valor_sinal: parseFloat(valorSinal),
      forma_pagamento_sinal: formaPgSinal,
    }).eq('id', apt.id)
    setSavingSinal(false)
    setSinalSalvo(true)
    setShowSinal(false)
    router.refresh()
  }
  
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
    }
  }, [])
  
  const handleMouseEnter = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
    // Calcular posição fixed do popup no viewport
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const dir = spaceBelow < 420 ? 'up' : 'down'
      setPopupDir(dir)
      const left = isRightColumn
        ? rect.left - 324
        : rect.right + 4
      setPopupPos({ top: rect.bottom + 4, bottom: rect.top - 4, left })
    }
    setShowPreview(true)
    // Buscar débitos do paciente ao abrir o popup (só uma vez)
    if (!debitosLoaded && apt.patients?.id) {
      setDebitosLoaded(true)
      supabaseCard
        .from('debitos')
        .select('valor, descricao, data_vencimento')
        .eq('paciente_id', apt.patients.id)
        .eq('status', 'pendente')
        .order('data_vencimento', { ascending: true })
        .then(({ data }) => setDebitos(data || []))
    }
  }
  
  const handleMouseLeave = () => {
    hideTimeoutRef.current = setTimeout(() => {
      setShowPreview(false)
    }, 150)
  }
  const aptTime = new Date(apt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const isPatientIncomplete = apt.patients && (!apt.patients.cpf || !apt.patients.phone)
  const isConfirmed = apt.status === 'confirmed'
  const isCancelled = apt.status === 'cancelled' || apt.status === 'no_show'
  const canCheckIn = ['scheduled', 'confirmed', 'pending_confirmation'].includes(apt.status) && !apt.checked_in_at
  const isCheckedIn = !!apt.checked_in_at
  const checkedInTime = apt.checked_in_at 
    ? new Date(apt.checked_in_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null

  // URL para agendar no mesmo horário/profissional do cancelado
  const rescheduleUrl = (() => {
    const d = new Date(apt.start_time)
    const date = d.toISOString().split('T')[0]
    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const prof = apt.professional_id || ''
    return `/dashboard/agenda/novo?date=${date}&time=${time}&professional=${prof}`
  })()

  const ALL_STATUSES = [
    { value: 'scheduled', label: 'Agendado' },
    { value: 'pending_confirmation', label: 'Aguard. confirmação' },
    { value: 'confirmed', label: 'Confirmado' },
    { value: 'in_progress', label: 'Em atendimento' },
    { value: 'completed', label: 'Realizado' },
    { value: 'no_show', label: 'Não compareceu' },
    { value: 'cancelled', label: 'Cancelado' },
  ]

  return (
    <div 
      className="relative group"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Link
        href={`/dashboard/atendimento/${apt.id}`}
        draggable={!!onDragStart}
        onDragStart={onDragStart ? (e) => onDragStart(e, apt) : undefined}
        className={`block p-2 rounded-lg ${status.bg} hover:ring-2 hover:ring-violet-300 transition-all border-l-4 ${status.border} ${onDragStart ? 'cursor-grab active:cursor-grabbing' : ''} ${isCheckedIn ? 'ring-2 ring-emerald-400' : ''} ${isCancelled ? 'opacity-40' : ''}`}
      >
        {/* Botão rápido de agendar no mesmo slot — só para cancelados */}
        {isCancelled && (
          <Link
            href={rescheduleUrl}
            onClick={e => e.stopPropagation()}
            className="absolute top-1 right-1 w-5 h-5 bg-violet-500 hover:bg-violet-600 text-white rounded-full flex items-center justify-center shadow-sm transition-colors z-10"
            title="Agendar nesse horário"
          >
            <Icon name="plus" className="w-3 h-3" />
          </Link>
        )}
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs font-bold text-slate-700">{aptTime}</span>
          <div className="flex items-center gap-1">
            {isConfirmed && !isCheckedIn && (
              <span className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center" title="Confirmado">
                <Icon name="check" className="w-2 h-2 text-white" />
              </span>
            )}
            {isCheckedIn && (
              <span className="w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center" title={`Chegou às ${checkedInTime}`}>
                <Icon name="check" className="w-2 h-2 text-white" />
              </span>
            )}
            {isPatientIncomplete && (
              <span className="w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center" title="Cadastro pendente">
                <Icon name="bell" className="w-2 h-2 text-white" />
              </span>
            )}
            {onDragStart && (
              <Icon name="menu" className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100" />
            )}
          </div>
        </div>
        <p className={`${compact ? 'text-xs' : 'text-sm'} font-semibold text-slate-900 truncate`}>
          {apt.patients?.name || 'Paciente'}
        </p>
        {!compact && (
          <p className="text-xs text-slate-500 truncate">{apt.procedures?.name || 'Atendimento'}</p>
        )}
      </Link>

      {/* Preview ao passar o mouse */}
      {showPreview && popupPos && (
        <div 
          ref={popupRef}
          className="fixed z-[9999] w-80 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-4 overflow-y-auto max-h-[80vh]"
          style={{
            top: popupDir === 'down' ? popupPos.top : undefined,
            bottom: popupDir === 'up' ? window.innerHeight - popupPos.bottom : undefined,
            left: Math.max(8, Math.min(popupPos.left, window.innerWidth - 328)),
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="flex items-start gap-3 mb-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${isCheckedIn ? 'bg-gradient-to-br from-emerald-500 to-teal-500' : 'bg-gradient-to-br from-violet-500 to-purple-500'}`}>
              {apt.patients?.name?.charAt(0) || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 truncate">{apt.patients?.name}</p>
              <p className="text-xs text-slate-500">{apt.patients?.phone || 'Sem telefone'}</p>
            </div>
            {isCheckedIn && (
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-medium">
                ✓ {checkedInTime}
              </span>
            )}
          </div>
          
          <div className="space-y-2 text-xs mb-3">
            <div className="flex justify-between">
              <span className="text-slate-500">Procedimento:</span>
              <span className="font-medium text-slate-700">{apt.procedures?.name || 'Atendimento'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Profissional:</span>
              <span className="font-medium text-slate-700">{apt.professional?.name || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Duração:</span>
              <span className="font-medium text-slate-700">{apt.procedures?.duration_minutes || 30} min</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Status:</span>
              <span className={`font-medium ${status.text}`}>{status.label}</span>
            </div>
            {/* Observações editáveis */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-1">
                <p className="text-slate-500">Observações:</p>
                {!editingNotes && (
                  <button onClick={e => { e.stopPropagation(); setEditingNotes(true) }} className="text-[10px] text-violet-600 hover:text-violet-800 font-medium">
                    {notes ? 'Editar' : '+ Adicionar'}
                  </button>
                )}
              </div>
              {editingNotes ? (
                <div className="space-y-1.5" onClick={e => e.stopPropagation()}>
                  <textarea
                    className="w-full text-xs border border-slate-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-violet-300"
                    rows={3}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Observações..."
                    autoFocus
                  />
                  <div className="flex gap-1.5">
                    <button onClick={saveNotes} disabled={savingNotes} className="flex-1 py-1 text-xs bg-violet-500 text-white rounded-lg font-medium hover:bg-violet-600 disabled:opacity-50">
                      {savingNotes ? 'Salvando...' : 'Salvar'}
                    </button>
                    <button onClick={() => { setEditingNotes(false); setNotes(apt.notes || '') }} className="flex-1 py-1 text-xs bg-slate-100 text-slate-600 rounded-lg font-medium hover:bg-slate-200">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <p className={`text-xs ${notes ? 'text-slate-700' : 'text-slate-400 italic'}`} onClick={e => { e.stopPropagation(); setEditingNotes(true) }}>
                  {notes || 'Clique para adicionar...'}
                </p>
              )}
            </div>

            {/* Sinal / Pagamento antecipado */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-1">
                <p className="text-slate-500">Sinal:</p>
                {!showSinal && (
                  <button onClick={e => { e.stopPropagation(); setShowSinal(true) }} className="text-[10px] text-emerald-600 hover:text-emerald-800 font-medium">
                    {sinalSalvo ? 'Editar' : '+ Registrar'}
                  </button>
                )}
              </div>
              {sinalSalvo && !showSinal && (
                <div className="flex items-center gap-2 bg-emerald-50 rounded-lg px-2.5 py-1.5">
                  <Icon name="check" className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                  <span className="text-xs font-semibold text-emerald-700">
                    R$ {parseFloat(valorSinal || '0').toFixed(2).replace('.', ',')}
                    <span className="font-normal text-emerald-600 ml-1 capitalize">({formaPgSinal})</span>
                  </span>
                </div>
              )}
              {!sinalSalvo && !showSinal && (
                <p className="text-xs text-slate-400 italic">Nenhum sinal registrado.</p>
              )}
              {showSinal && (
                <div className="space-y-1.5" onClick={e => e.stopPropagation()}>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="number" step="0.01" min="0"
                      className="text-xs border border-slate-200 rounded-lg p-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                      placeholder="Valor R$"
                      value={valorSinal}
                      onChange={e => setValorSinal(e.target.value)}
                      autoFocus
                    />
                    <select
                      className="text-xs border border-slate-200 rounded-lg p-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                      value={formaPgSinal}
                      onChange={e => setFormaPgSinal(e.target.value)}
                    >
                      <option value="pix">Pix</option>
                      <option value="dinheiro">Dinheiro</option>
                      <option value="credito">Crédito</option>
                      <option value="debito">Débito</option>
                    </select>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={saveSinal} disabled={savingSinal || !valorSinal} className="flex-1 py-1 text-xs bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 disabled:opacity-50">
                      {savingSinal ? 'Salvando...' : 'Confirmar'}
                    </button>
                    <button onClick={() => setShowSinal(false)} className="flex-1 py-1 text-xs bg-slate-100 text-slate-600 rounded-lg font-medium hover:bg-slate-200">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Aviso de débito pendente */}
          {debitos.length > 0 && (
            <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon name="alertTriangle" className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
                <span className="text-xs font-semibold text-red-700">Débito pendente</span>
              </div>
              {debitos.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-xs text-red-600 mt-0.5">
                  <span className="truncate max-w-[120px]">{d.descricao || 'Débito'}</span>
                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                    <span className="font-semibold">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(d.valor))}
                    </span>
                    <span className="text-red-400 text-[10px]">
                      vence {d.data_vencimento.split('-').reverse().join('/')}
                    </span>
                  </div>
                </div>
              ))}
              <a
                href="/dashboard/financeiro/devedores"
                onClick={e => e.stopPropagation()}
                className="text-[10px] text-red-500 hover:text-red-700 hover:underline mt-1 block"
              >
                Ver no financeiro →
              </a>
            </div>
          )}

          {/* Ações rápidas */}
          <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
            {/* Botão de agendar no mesmo horário — só para cancelados/faltou */}
            {isCancelled && (
              <Link
                href={rescheduleUrl}
                onClick={(e) => e.stopPropagation()}
                className="w-full py-2 px-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-semibold rounded-lg hover:from-violet-600 hover:to-purple-700 transition-all flex items-center justify-center gap-2 shadow-md"
              >
                <Icon name="plus" className="w-4 h-4" />
                Agendar nesse horário
              </Link>
            )}

            {/* Check-in - destaque */}
            {canCheckIn && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCheckIn(apt.id) }}
                className="w-full py-2 px-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold rounded-lg hover:from-emerald-600 hover:to-teal-600 transition-all flex items-center justify-center gap-2 shadow-md"
              >
                <Icon name="userCheck" className="w-4 h-4" />
                Registrar Chegada
              </button>
            )}
            
            {/* Select de status — todos os status disponíveis, sem restrição de data */}
            <div className="flex flex-col gap-1">
              <span className="text-xs text-slate-500 font-medium">Alterar status:</span>
              <select
                value={apt.status}
                onChange={(e) => { e.preventDefault(); e.stopPropagation(); onStatusChange(apt.id, e.target.value) }}
                onClick={(e) => e.stopPropagation()}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:border-violet-400 focus:ring-2 focus:ring-violet-200 outline-none transition-all cursor-pointer"
              >
                {ALL_STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-1.5">
              <Link
                href={`/dashboard/atendimento/${apt.id}`}
                className="flex-1 py-1.5 px-2 bg-slate-100 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                <Icon name="eye" className="w-3 h-3" />
                Atendimento
              </Link>
              <Link
                href={`/dashboard/agenda/${apt.id}`}
                className="flex-1 py-1.5 px-2 bg-violet-50 text-violet-700 text-xs font-medium rounded-lg hover:bg-violet-100 transition-colors flex items-center justify-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                <Icon name="edit" className="w-3 h-3" />
                Editar
              </Link>
            </div>

            {/* Botão Registrar Pagamento — só para atendimentos realizados */}
            {apt.status === 'completed' && !isCancelled && (
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setShowPreview(false) // fecha o popup
                  setShowPayment(true)
                }}
                className={`w-full py-2 px-3 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                  apt.payment_registered_at
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                }`}
              >
                <Icon name="dollarSign" className="w-4 h-4" />
                {apt.payment_registered_at ? 'Pagamento registrado ✓' : 'Registrar Pagamento'}
              </button>
            )}

            {apt.patients?.id && !isCancelled && (
              <div className="flex gap-2">
                <SendAnamneseButton
                  patientId={apt.patients.id}
                  patientName={apt.patients.name}
                  patientPhone={apt.patients.phone}
                  appointmentId={apt.id}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de pagamento */}
      {showPayment && (
        <PaymentModal
          appointmentId={apt.id}
          clinicId={apt.clinic_id}
          patientId={apt.patients?.id || null}
          patientName={apt.patients?.name || ''}
          procedureName={apt.procedures?.name || 'Atendimento'}
          procedurePrice={apt.procedures?.price || null}
          procedureId={apt.procedure_id || null}
          professionalId={apt.professional_id || null}
          professionalName={apt.professional?.name || ''}
          onClose={() => setShowPayment(false)}
          onSuccess={() => { setShowPayment(false); onStatusChange(apt.id, apt.status) }}
        />
      )}
    </div>
  )
})

export default function AgendaView({ appointments: allAppointments, blocks: allBlocks, viewMode, selectedDate, professionals, selectedProfessional, clinicId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()
  const [draggedAppointment, setDraggedAppointment] = useState<Appointment | null>(null)
  const [blockModal, setBlockModal] = useState<{ open: boolean; hour?: number; profId?: string; editBlock?: Block | null }>({ open: false })

  const displayProfessionals = selectedProfessional === 'all' 
    ? professionals 
    : professionals.filter(p => p.id === selectedProfessional)

  // Aplica filtro de profissional em TODAS as views (corrige bug semana/mes)
  const appointments = selectedProfessional === 'all'
    ? allAppointments
    : allAppointments.filter(a => a.professional_id === selectedProfessional)

  const blocks = selectedProfessional === 'all'
    ? allBlocks
    : allBlocks.filter(b => b.professional_id === selectedProfessional)

  const COLOR_BLOCK: Record<string, { bg: string; text: string; border: string }> = {
    slate:  { bg: 'bg-slate-200',  text: 'text-slate-700',  border: 'border-slate-400' },
    red:    { bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-400' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-400' },
    amber:  { bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-400' },
    blue:   { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-400' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-400' },
  }

  // Realtime: qualquer mudança em appointments da clínica dispara refresh (debounced)
  useRealtimeRefresh({
    table: 'appointments',
    filter: { column: 'clinic_id', value: clinicId },
  })

  useRealtimeRefresh({
    table: 'professional_blocks',
    filter: { column: 'clinic_id', value: clinicId },
  })

  // Atualizar status do agendamento
  const handleStatusChange = useCallback(async (appointmentId: string, newStatus: string) => {
    // Guarda status anterior pra permitir Desfazer
    const apt = allAppointments.find(a => a.id === appointmentId)
    const previousStatus = apt?.status

    const { error } = await supabase
      .from('appointments')
      .update({ status: newStatus })
      .eq('id', appointmentId)

    if (error) {
      toast.error('Nao foi possivel atualizar', { description: error.message })
      return
    }

    router.refresh()

    // Mostra feedback adequado por tipo de mudanca
    const labels: Record<string, string> = {
      confirmed: 'Confirmado',
      cancelled: 'Cancelado',
      completed: 'Concluido',
      no_show: 'Marcado como nao compareceu',
    }
    const label = labels[newStatus] || 'Status atualizado'

    if (previousStatus && previousStatus !== newStatus) {
      toast.undo({
        title: label,
        description: apt?.patients?.name || undefined,
        duration: 5000,
        onUndo: async () => {
          await supabase
            .from('appointments')
            .update({ status: previousStatus })
            .eq('id', appointmentId)
          router.refresh()
        },
      })
    } else {
      toast.success(label)
    }
  }, [supabase, router, toast, allAppointments])

  // Registrar check-in do paciente
  const handleCheckIn = useCallback(async (appointmentId: string) => {
    const apt = appointments.find(a => a.id === appointmentId)

    const { error } = await supabase
      .from('appointments')
      .update({
        checked_in_at: new Date().toISOString(),
        status: 'confirmed'
      })
      .eq('id', appointmentId)

    if (!error) {
      if (apt?.professional_id) {
        await supabase.from('notifications').insert({
          user_id: apt.professional_id,
          type: 'check_in',
          title: `${apt.patients?.name || 'Paciente'} chegou!`,
          message: `Agendamento das ${new Date(apt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - ${apt.procedures?.name || 'Atendimento'}`,
          link: `/dashboard/atendimento/${appointmentId}`
        })
      }
      router.refresh()
    }
  }, [appointments, supabase, router])

  const handleDragStart = useCallback((e: React.DragEvent, apt: Appointment) => {
    setDraggedAppointment(apt)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  async function handleDrop(e: React.DragEvent, targetDate: string, targetHour: number, targetProfessionalId?: string) {
    e.preventDefault()
    if (!draggedAppointment) return

    const oldStartTime = new Date(draggedAppointment.start_time)
    const newStartTime = new Date(`${targetDate}T${targetHour.toString().padStart(2, '0')}:${oldStartTime.getMinutes().toString().padStart(2, '0')}:00`)
    
    const duration = draggedAppointment.end_time 
      ? new Date(draggedAppointment.end_time).getTime() - oldStartTime.getTime()
      : 30 * 60 * 1000
    const newEndTime = new Date(newStartTime.getTime() + duration)

    const updateData: Record<string, string> = {
      start_time: newStartTime.toISOString(),
      end_time: newEndTime.toISOString(),
    }
    
    if (targetProfessionalId) {
      updateData.professional_id = targetProfessionalId
    }

    const { error } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', draggedAppointment.id)

    if (!error) {
      router.refresh()
    }
    setDraggedAppointment(null)
  }

  // Encontrar próximo horário livre (usa RPC get_available_slots)
  async function findNextAvailableSlot(): Promise<{ date: string; time: string; professionalId: string } | null> {
    const checkDate = new Date(selectedDate + 'T00:00:00')

    for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
      const currentDate = new Date(checkDate)
      currentDate.setDate(checkDate.getDate() + dayOffset)
      const dateStr = currentDate.toISOString().split('T')[0]

      const profId = selectedProfessional === 'all' ? null : selectedProfessional

      const { data, error } = await supabase.rpc('get_available_slots', {
        p_clinic_id: clinicId,
        p_date: dateStr,
        p_professional_id: profId,
        p_duration_min: 30,
      })

      if (error) {
        console.error('Erro ao buscar slots:', error)
        continue
      }
      if (data && data.length > 0) {
        const first: any = data[0]
        return {
          date: dateStr,
          time: String(first.slot_time).slice(0, 5),
          professionalId: first.professional_id,
        }
      }
    }
    return null
  }

  async function handleFindNextSlot() {
    const slot = await findNextAvailableSlot()
    if (slot) {
      router.push(`/dashboard/agenda/novo?date=${slot.date}&time=${slot.time}&professional=${slot.professionalId}`)
    } else {
      toast.error('Sem horarios livres', {
        description: 'Nao encontramos horarios nos proximos 30 dias. Confira em Equipe se os profissionais tem horario cadastrado.',
        duration: 7000,
      })
    }
  }

  // Visão Dia - Colunas por profissional
  if (viewMode === 'day') {
    return (
      <>
        <BlockModal
          isOpen={blockModal.open}
          onClose={() => setBlockModal({ open: false })}
          professionals={displayProfessionals}
          clinicId={clinicId}
          selectedDate={selectedDate}
          selectedHour={blockModal.hour}
          selectedProfessionalId={blockModal.profId}
          editBlock={blockModal.editBlock}
        />
      <div className="card dark:bg-slate-800 dark:border-slate-700" style={{overflow: "visible"}}>
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {appointments.length} agendamento{appointments.length !== 1 ? 's' : ''} • {displayProfessionals.length} profissional{displayProfessionals.length !== 1 ? 'is' : ''}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleFindNextSlot}
                className="text-sm text-emerald-600 font-medium hover:bg-emerald-50 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
              >
                <Icon name="search" className="w-4 h-4" />
                Próximo livre
              </button>
              <button
                onClick={() => setBlockModal({ open: true })}
                className="text-sm text-orange-600 font-medium hover:bg-orange-50 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
              >
                <Icon name="lock" className="w-4 h-4" />
                Bloquear
              </button>
              <Link 
                href={`/dashboard/agenda/novo?date=${selectedDate}`}
                className="text-sm text-violet-600 font-medium hover:bg-violet-50 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
              >
                <Icon name="plus" className="w-4 h-4" />
                Novo
              </Link>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <div style={{ minWidth: displayProfessionals.length > 1 ? `${displayProfessionals.length * 200 + 80}px` : '100%' }}>
            {/* Header com profissionais */}
            <div className="flex border-b border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 sticky top-0 z-10">
              <div className="w-20 flex-shrink-0 p-3 text-center border-r border-slate-200 dark:border-slate-600">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Hora</p>
              </div>
              {displayProfessionals.map((prof, idx) => (
                <div 
                  key={prof.id}
                  className="flex-1 min-w-[180px] p-3 text-center border-r border-slate-200 last:border-r-0"
                >
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r ${PROFESSIONAL_COLORS[idx % PROFESSIONAL_COLORS.length]} text-white text-sm font-medium`}>
                    <Icon name="user" className="w-3 h-3" />
                    {prof.name.startsWith('Dra.') || prof.name.startsWith('Dr.') 
                      ? prof.name.split(' ').slice(0, 2).join(' ')
                      : prof.name.split(' ')[0]}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Grade de horários */}
            {HOUR_SLOTS.map(hour => {
              const timeStr = `${hour.toString().padStart(2, '0')}:00`
              const isLunchTime = hour === 12
              
              return (
                <div key={hour} className={`flex border-b border-slate-100 dark:border-slate-700 ${isLunchTime ? 'bg-amber-50/30 dark:bg-amber-900/20' : ''}`}>
                  <div className="w-20 flex-shrink-0 p-2 text-center border-r border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                    <p className={`text-sm font-semibold ${isLunchTime ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400'}`}>
                      {timeStr}
                    </p>
                    {isLunchTime && <p className="text-xs text-amber-500">🍽️</p>}
                  </div>
                  
                  {displayProfessionals.map((prof, profIdx) => {
                    const hourAppointments = appointments.filter(apt => {
                      const aptHour = new Date(apt.start_time).getHours()
                      return apt.professional_id === prof.id && aptHour === hour
                    })
                    const hourBlocks = blocks.filter(bl => {
                      const blHour = new Date(bl.start_time).getHours()
                      return bl.professional_id === prof.id && blHour === hour
                    })
                    const isLastColumn = profIdx === displayProfessionals.length - 1
                    const hasContent = hourAppointments.length > 0 || hourBlocks.length > 0
                    const novoUrl = `/dashboard/agenda/novo?date=${selectedDate}&time=${timeStr}&professional=${prof.id}&overlap=1`
                    
                    return (
                      <div 
                        key={prof.id}
                        className={`flex-1 min-w-[180px] p-1.5 border-r border-slate-100 dark:border-slate-700 last:border-r-0 min-h-[70px] transition-colors relative group/cell ${
                          draggedAppointment ? 'hover:bg-violet-100 dark:hover:bg-violet-900/30' : ''
                        }`}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, selectedDate, hour, prof.id)}
                      >
                        {hasContent ? (
                          <div className="space-y-1">
                            {hourAppointments.map(apt => (
                              <div key={apt.id} className="relative">
                                <AppointmentCard
                                  apt={apt}
                                  onStatusChange={handleStatusChange}
                                  onCheckIn={handleCheckIn}
                                  onDragStart={handleDragStart}
                                  isRightColumn={isLastColumn}
                                  canDrag={true}
                                />
                              </div>
                            ))}
                            {hourBlocks.map(bl => {
                              const blStyle = COLOR_BLOCK[bl.color] || COLOR_BLOCK.slate
                              return (
                                <button
                                  key={bl.id}
                                  onClick={() => setBlockModal({ open: true, editBlock: bl })}
                                  className={`w-full text-left p-2 rounded-lg border-l-4 ${blStyle.bg} ${blStyle.border} ${blStyle.text} hover:opacity-80 transition-opacity`}
                                >
                                  <div className="flex items-center gap-1">
                                    <Icon name="lock" className="w-3 h-3 flex-shrink-0" />
                                    <span className="text-xs font-semibold truncate">{bl.title}</span>
                                  </div>
                                  {bl.notes && <p className="text-xs opacity-70 truncate mt-0.5">{bl.notes}</p>}
                                </button>
                              )
                            })}
                            {/* Botão + para adicionar segundo paciente no mesmo horário */}
                            <Link
                              href={novoUrl}
                              className="w-full flex items-center justify-center gap-1 py-1 rounded-lg border border-dashed border-slate-200 hover:border-violet-300 hover:bg-violet-50 transition-colors opacity-0 group-hover/cell:opacity-100 text-slate-300 hover:text-violet-500"
                              title="Adicionar outro paciente nesse horário"
                            >
                              <Icon name="plus" className="w-3 h-3" />
                              <span className="text-xs">Adicionar</span>
                            </Link>
                          </div>
                        ) : (
                          <Link
                            href={`/dashboard/agenda/novo?date=${selectedDate}&time=${timeStr}&professional=${prof.id}`}
                            className="h-full min-h-[60px] flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-lg hover:border-violet-300 hover:bg-violet-50 transition-colors group/link"
                          >
                            <Icon name="plus" className="w-4 h-4 text-slate-300 group-hover/link:text-violet-500" />
                          </Link>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      </>
    )
  }

  // Visão Semana - Com clique no dia e preview
  if (viewMode === 'week') {
    const date = new Date(selectedDate + 'T12:00:00')
    const dayOfWeek = date.getDay()
    const weekStart = new Date(date)
    weekStart.setDate(date.getDate() - dayOfWeek)

    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + i)
      return d
    })

    return (
      <div className="card" style={{overflow: "visible"}}>
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-600">
              Semana de {weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            </p>
            <button
              onClick={handleFindNextSlot}
              className="text-sm text-emerald-600 font-medium hover:bg-emerald-50 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
            >
              <Icon name="search" className="w-4 h-4" />
              Próximo livre
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-slate-100">
              {/* Célula vazia do canto hora */}
              <div className="bg-slate-50 border-r border-slate-100" />
              {weekDays.map((day, idx) => {
                const isToday = day.toDateString() === new Date().toDateString()
                const dayStr = day.toISOString().split('T')[0]
                const dayAppointments = appointments.filter(apt => apt.start_time.startsWith(dayStr))
                
                return (
                  <Link
                    key={idx}
                    href={`/dashboard/agenda?date=${dayStr}&view=day`}
                    className={`p-3 text-center border-l border-slate-100 hover:bg-slate-100 transition-colors ${isToday ? 'bg-purple-50' : 'bg-slate-50'}`}
                  >
                    <p className="text-xs text-slate-500 uppercase">
                      {day.toLocaleDateString('pt-BR', { weekday: 'short' })}
                    </p>
                    <p className={`text-lg font-bold ${isToday ? 'gradient-text' : 'text-slate-900'}`}>
                      {day.getDate()}
                    </p>
                    {dayAppointments.length > 0 && (
                      <span className="inline-flex items-center justify-center w-5 h-5 bg-violet-500 text-white text-xs font-bold rounded-full">
                        {dayAppointments.length}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>

            {/* Grade com faixas de horário */}
            <div onDragOver={handleDragOver}>
              {HOUR_SLOTS.map(hour => {
                const timeStr = `${String(hour).padStart(2,'0')}:00`
                const isLunch = hour === 12
                return (
                  <div key={hour} className={`grid grid-cols-[64px_repeat(7,1fr)] border-b border-slate-100 ${isLunch ? 'bg-amber-50/30' : ''}`}>
                    {/* Coluna de hora */}
                    <div className="p-2 text-center border-r border-slate-100 bg-slate-50 flex items-start justify-center pt-2">
                      <span className={`text-xs font-semibold ${isLunch ? 'text-amber-600' : 'text-slate-500'}`}>{timeStr}</span>
                    </div>
                    {weekDays.map((day, idx) => {
                      const dayStr = day.toISOString().split('T')[0]
                      const hourApts = appointments
                        .filter(apt => {
                          const aptHour = new Date(apt.start_time).getHours()
                          return apt.start_time.startsWith(dayStr) && aptHour === hour
                        })
                        .sort((a,b) => a.start_time.localeCompare(b.start_time))
                      const isToday = day.toDateString() === new Date().toDateString()

                      return (
                        <div
                          key={idx}
                          className={`p-1 border-l border-slate-100 min-h-[56px] ${isToday ? 'bg-purple-50/20' : ''}`}
                          onDrop={(e) => handleDrop(e, dayStr, hour)}
                        >
                          {hourApts.length > 0 ? (
                            <div className="space-y-0.5">
                              {hourApts.slice(0,3).map(apt => (
                                <AppointmentCard
                                  key={apt.id}
                                  apt={apt}
                                  onStatusChange={handleStatusChange}
                                  onCheckIn={handleCheckIn}
                                  onDragStart={handleDragStart}
                                  compact
                                  isRightColumn={idx >= 5}
                                />
                              ))}
                              {hourApts.length > 3 && (
                                <Link href={`/dashboard/agenda?date=${dayStr}&view=day`} className="block text-center text-xs text-violet-500 font-medium hover:underline">
                                  +{hourApts.length - 3}
                                </Link>
                              )}
                            </div>
                          ) : (
                            <Link
                              href={`/dashboard/agenda/novo?date=${dayStr}&time=${timeStr}`}
                              className="h-full min-h-[48px] flex items-center justify-center hover:bg-violet-50 rounded transition-colors group/wk"
                            >
                              <Icon name="plus" className="w-3.5 h-3.5 text-slate-200 group-hover/wk:text-violet-400" />
                            </Link>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Visão Mês - Com resumo e clique para dia
  const monthDate = new Date(selectedDate + 'T12:00:00')
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startPadding = firstDay.getDay()
  const totalDays = lastDay.getDate()

  const calendarDays: (number | null)[] = [
    ...Array(startPadding).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1)
  ]

  while (calendarDays.length % 7 !== 0) {
    calendarDays.push(null)
  }

  // Calcular estatísticas do mês
  const monthStats = {
    total: appointments.length,
    confirmed: appointments.filter(a => a.status === 'confirmed').length,
    completed: appointments.filter(a => a.status === 'completed').length,
  }

  return (
    <div className="card overflow-hidden">
      {/* Estatísticas do mês */}
      <div className="p-4 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <p className="text-sm font-medium text-slate-600">
              {monthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </p>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                {monthStats.total} total
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                {monthStats.confirmed} confirmados
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                {monthStats.completed} realizados
              </span>
            </div>
          </div>
          <button
            onClick={handleFindNextSlot}
            className="text-sm text-emerald-600 font-medium hover:bg-emerald-50 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
          >
            <Icon name="search" className="w-4 h-4" />
            Próximo livre
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
          <div key={day} className="p-3 text-center text-xs font-semibold text-slate-500 uppercase">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {calendarDays.map((day, idx) => {
          if (day === null) {
            return <div key={idx} className="p-2 min-h-[100px] bg-slate-50/50 border-b border-r border-slate-100" />
          }

          const dayDate = new Date(year, month, day)
          const dayStr = dayDate.toISOString().split('T')[0]
          const dayAppointments = appointments.filter(apt => apt.start_time.startsWith(dayStr))
          const isToday = dayDate.toDateString() === new Date().toDateString()
          const isPast = dayDate < new Date(new Date().setHours(0, 0, 0, 0))

          const confirmed = dayAppointments.filter(a => a.status === 'confirmed').length
          const scheduled = dayAppointments.filter(a => a.status === 'scheduled').length

          return (
            <Link
              key={idx}
              href={`/dashboard/agenda?date=${dayStr}&view=day`}
              className={`p-2 min-h-[100px] border-b border-r border-slate-100 hover:bg-slate-50 transition-colors group ${
                isToday ? 'bg-purple-50 ring-2 ring-inset ring-violet-300' : ''
              } ${isPast ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-semibold ${isToday ? 'gradient-text' : 'text-slate-700'}`}>
                  {day}
                </span>
                {dayAppointments.length > 0 && (
                  <span className="text-xs font-bold text-violet-600 bg-violet-100 px-1.5 py-0.5 rounded">
                    {dayAppointments.length}
                  </span>
                )}
              </div>
              
              {dayAppointments.length > 0 ? (
                <div className="space-y-0.5">
                  {dayAppointments.slice(0, 3).map(apt => {
                    const status = STATUS_CONFIG[apt.status] || STATUS_CONFIG.scheduled
                    return (
                      <div
                        key={apt.id}
                        className={`px-1.5 py-0.5 rounded text-xs truncate ${status.bg} ${status.text}`}
                      >
                        {new Date(apt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} {apt.patients?.name?.split(' ')[0]}
                      </div>
                    )
                  })}
                  {dayAppointments.length > 3 && (
                    <p className="text-xs text-slate-400 pl-1">+{dayAppointments.length - 3} mais</p>
                  )}
                </div>
              ) : !isPast ? (
                <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Icon name="plus" className="w-4 h-4 text-violet-400" />
                </div>
              ) : null}
              
              {/* Mini indicadores */}
              {dayAppointments.length > 0 && (
                <div className="flex gap-1 mt-1">
                  {confirmed > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" title={`${confirmed} confirmado(s)`}></span>
                  )}
                  {scheduled > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" title={`${scheduled} pendente(s)`}></span>
                  )}
                </div>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
