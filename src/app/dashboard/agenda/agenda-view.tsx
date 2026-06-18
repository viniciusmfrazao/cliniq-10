'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import { createClient } from '@/lib/supabase/client'
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh'
import { useToast } from '@/components/ui/Toast'
import SendAnamneseButton from './send-anamnese-button'
import SendTermoButton from './send-termo-button'
import { useIsMobile } from '@/hooks/useIsMobile'
import BottomSheet from '@/components/ui/BottomSheet'
import BlockModal from './block-modal'
import PaymentModal from '@/components/agenda/payment-modal'
import ProceduresConfirmModal from '@/components/agenda/procedures-confirm-modal'
import { parseSupabaseError } from '@/lib/error-messages'


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
  appointment_procedures?: { id: string; procedure_id: string | null; procedure_name: string; duration_minutes: number; price: number }[]
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
  isRightColumn = false,
  columnIndex = 0,
  totalColumns = 1
}: { 
  apt: Appointment
  onStatusChange: (id: string, status: string) => void
  onCheckIn: (id: string) => void
  onDragStart?: (e: React.DragEvent, apt: Appointment) => void
  compact?: boolean
  isRightColumn?: boolean
  columnIndex?: number
  totalColumns?: number
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
  const [popupSide, setPopupSide] = useState<'left' | 'right'>('right')
  const [popupTop, setPopupTop] = useState(true)
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null)

  const [popupMaxH, setPopupMaxH] = useState<number | undefined>(undefined)

  // Reposiciona o popup e ajusta altura máxima após renderizar (considera zoom)
  useEffect(() => {
    if (!showPreview || useSheet || !popupRef.current || !popupPos) return
    const MARGIN = 8
    const rect = popupRef.current.getBoundingClientRect()
    const available = window.innerHeight - popupPos.y - MARGIN

    // Se o popup não cabe no espaço abaixo da posição atual, sobe e limita altura
    if (rect.height > available) {
      const maxY = Math.max(MARGIN, window.innerHeight - rect.height - MARGIN)
      const newY = Math.max(MARGIN, Math.min(popupPos.y, maxY))
      const newAvailable = window.innerHeight - newY - MARGIN
      if (newY !== popupPos.y) {
        setPopupPos(prev => prev ? { ...prev, y: newY } : prev)
      }
      // limita a altura ao espaço real disponível → scroll interno cobre o resto
      setPopupMaxH(Math.min(newAvailable, window.innerHeight - 2 * MARGIN))
    } else {
      setPopupMaxH(undefined)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPreview, popupPos?.x, popupPos?.y])
  const isMobile = useIsMobile()
  const [useSheet, setUseSheet] = useState(false)
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

  // Procedimento inline
  const [editingProc, setEditingProc] = useState(false)
  // Edição rápida no bottom sheet (mobile)
  const [editingSchedule, setEditingSchedule] = useState(false)
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')
  const [editProcIds, setEditProcIds] = useState<string[]>([])
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [procList, setProcList] = useState<{ id: string; name: string; duration_minutes: number; price: number }[]>([])
  const [procListLoaded, setProcListLoaded] = useState(false)
  const [selectedProcId, setSelectedProcId] = useState(apt.procedure_id || '')
  const [savingProc, setSavingProc] = useState(false)
  const [currentProcName, setCurrentProcName] = useState(apt.procedures?.name || '')

  async function openProcEdit(e: React.MouseEvent) {
    e.stopPropagation()
    if (!procListLoaded) {
      const { data } = await supabaseCard
        .from('procedures')
        .select('id, name, duration_minutes, price')
        .eq('active', true)
        .order('name')
      setProcList(data || [])
      setProcListLoaded(true)
    }
    setEditingProc(true)
  }

  async function saveProc() {
    if (!selectedProcId) return
    setSavingProc(true)
    const proc = procList.find(p => p.id === selectedProcId)
    await supabaseCard.from('appointments').update({
      procedure_id: selectedProcId,
      ...(proc ? { notes: apt.notes || null } : {}),
    }).eq('id', apt.id)
    setCurrentProcName(proc?.name || currentProcName)
    setSavingProc(false)
    setEditingProc(false)
    router.refresh()
  }

  async function saveSchedule() {
    if (!editDate || !editTime) return
    setSavingSchedule(true)
    const start = new Date(`${editDate}T${editTime}:00`)
    // Duração total = soma de todos os procedimentos selecionados
    const selectedProcs = procList.filter(p => editProcIds.includes(p.id))
    const totalDur = selectedProcs.reduce((sum, p) => sum + (p.duration_minutes || 30), 0) || 30
    const end = new Date(start.getTime() + totalDur * 60000)
    const mainProcId = editProcIds[0] || apt.procedure_id || null
    // Atualizar appointment
    await supabaseCard.from('appointments').update({
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      procedure_id: mainProcId,
    }).eq('id', apt.id)
    // Sincronizar appointment_procedures
    if (editProcIds.length > 0) {
      await supabaseCard.from('appointment_procedures').delete().eq('appointment_id', apt.id)
      const rows = selectedProcs.map((p, i) => ({
        appointment_id: apt.id,
        clinic_id: apt.clinic_id,
        procedure_id: p.id,
        procedure_name: p.name,
        duration_minutes: p.duration_minutes,
        price: p.price ?? 0,
      }))
      if (rows.length > 0) await supabaseCard.from('appointment_procedures').insert(rows)
    }
    setSavingSchedule(false)
    setEditingSchedule(false)
    setShowPreview(false)
    router.refresh()
  }

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
    // Popup: profissional na metade esquerda → abre à direita, e vice-versa
    const isLeftHalf = totalColumns <= 1
      ? (cardRef.current ? cardRef.current.getBoundingClientRect().left < window.innerWidth / 2 : true)
      : columnIndex < Math.ceil(totalColumns / 2)
    setPopupSide(isLeftHalf ? 'right' : 'left')
    // Vertical: se tem 420px abaixo, abre para baixo. Senão, para cima.
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect()
      const POPUP_W = 292
      const POPUP_H = Math.min(420, window.innerHeight * 0.8)
      const MARGIN = 8

      // Horizontal: tenta abrir à direita, se não couber abre à esquerda,
      // se ainda não couber empurra pra dentro da viewport
      let x: number
      if (isLeftHalf) {
        x = rect.right + 4
        if (x + POPUP_W > window.innerWidth - MARGIN) {
          x = rect.left - POPUP_W - 4
        }
      } else {
        x = rect.left - POPUP_W - 4
        if (x < MARGIN) {
          x = rect.right + 4
        }
      }
      x = Math.max(MARGIN, Math.min(x, window.innerWidth - POPUP_W - MARGIN))

      // Vertical: garante que nunca saia da viewport
      const hasSpaceBelow = window.innerHeight - rect.bottom >= POPUP_H + MARGIN
      setPopupTop(hasSpaceBelow)
      let y = hasSpaceBelow ? rect.top : rect.bottom - POPUP_H
      y = Math.max(MARGIN, Math.min(y, window.innerHeight - POPUP_H - MARGIN))

      setPopupPos({ x, y })
    }
    setShowPreview(true)
    setUseSheet(isMobile)
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
  const aptTime = new Date(apt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
  const isPatientIncomplete = apt.patients && (!apt.patients.cpf || !apt.patients.phone)
  const isConfirmed = apt.status === 'confirmed'
  const isCancelled = apt.status === 'cancelled' || apt.status === 'no_show'
  const canCheckIn = ['scheduled', 'confirmed', 'pending_confirmation'].includes(apt.status) && !apt.checked_in_at
  const isCheckedIn = !!apt.checked_in_at
  const checkedInTime = apt.checked_in_at 
    ? new Date(apt.checked_in_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
    : null

  // URL para agendar no mesmo horário/profissional do cancelado
  const rescheduleUrl = (() => {
    const d = new Date(apt.start_time)
    const date = d.toISOString().split('T')[0]
    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
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
      ref={cardRef}
      className="relative group h-full"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Link
        href={`/dashboard/atendimento/${apt.id}`}
        draggable={!!onDragStart}
        onDragStart={onDragStart ? (e) => onDragStart(e, apt) : undefined}
        onClick={(e) => {
          if (isMobile) {
            e.preventDefault()
            handleMouseEnter()
          }
        }}
        className={`block p-2 rounded-lg h-full overflow-hidden ${status.bg} hover:ring-2 hover:ring-violet-300 transition-all border-l-4 ${status.border} ${onDragStart ? 'cursor-grab active:cursor-grabbing' : ''} ${isCheckedIn ? 'ring-2 ring-emerald-400' : ''} ${isCancelled ? 'opacity-40' : ''}`}
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
          <p className="text-xs text-slate-500 truncate">
            {apt.appointment_procedures && apt.appointment_procedures.length > 0
              ? apt.appointment_procedures.map(p => p.procedure_name).join(' + ')
              : apt.procedures?.name || 'Atendimento'}
          </p>
        )}
      </Link>

      {/* Preview — só desktop (mobile: Link navega direto pro atendimento) */}
      {/* Bottom Sheet — mobile */}
      {showPreview && useSheet && (
        <BottomSheet
          open={true}
          onClose={() => setShowPreview(false)}
          title={apt.patients?.name || 'Agendamento'}
        >
          {/* Info resumida */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${isCheckedIn ? 'bg-emerald-500' : 'bg-violet-500'}`}>
                {apt.patients?.name?.charAt(0) || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 dark:text-white">{apt.patients?.name}</p>
                <p className="text-xs text-slate-500">{apt.patients?.phone || 'Sem telefone'}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${status.bg} ${status.text}`}>{status.label}</span>
            </div>

            <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
              <p><span className="text-slate-400">Procedimento{apt.appointment_procedures && apt.appointment_procedures.length > 1 ? 's' : ''}:</span>{' '}
                {apt.appointment_procedures && apt.appointment_procedures.length > 0
                  ? apt.appointment_procedures.map(p => p.procedure_name).join(', ')
                  : apt.procedures?.name || '-'}
              </p>
              <p><span className="text-slate-400">Profissional:</span> {apt.professional?.name || '-'}</p>
              <p><span className="text-slate-400">Horário:</span> {aptTime} — {apt.procedures?.duration_minutes || 30}min</p>
            </div>

            {/* Observações */}
            {apt.notes && (
              <div className="p-3 bg-slate-50 dark:bg-slate-700/40 rounded-lg">
                <p className="text-xs font-semibold text-slate-500 mb-1">Observações</p>
                <p className="text-sm text-slate-700 dark:text-slate-200">{apt.notes}</p>
              </div>
            )}

            {/* Sinal */}
            {apt.valor_sinal && apt.valor_sinal > 0 && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200">
                <p className="text-xs font-semibold text-emerald-700">
                  Sinal: R$ {Number(apt.valor_sinal).toFixed(2)}
                  {apt.forma_pagamento_sinal ? ` — ${apt.forma_pagamento_sinal}` : ''}
                </p>
              </div>
            )}

            {/* Débitos */}
            {debitos.length > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200">
                <p className="text-xs font-semibold text-amber-700">Débito pendente</p>
                {debitos.map((d, i) => (
                  <p key={i} className="text-xs text-amber-600">
                    {d.descricao} — R$ {Number(d.valor).toFixed(2)}
                  </p>
                ))}
              </div>
            )}

            {/* Mudar status */}
            {!isCancelled && apt.status !== 'completed' && (
              <div className="flex flex-wrap gap-2">
                {apt.status !== 'confirmed' && (
                  <button
                    onClick={() => { onStatusChange(apt.id, 'confirmed'); setShowPreview(false) }}
                    className="flex-1 py-2 text-xs font-semibold bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                  >
                    ✓ Confirmar
                  </button>
                )}
                {apt.status !== 'in_progress' && (
                  <button
                    onClick={() => { onStatusChange(apt.id, 'in_progress'); setShowPreview(false) }}
                    className="flex-1 py-2 text-xs font-semibold bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors"
                  >
                    ▶ Em atendimento
                  </button>
                )}
                <button
                  onClick={() => { onStatusChange(apt.id, 'no_show'); setShowPreview(false) }}
                  className="flex-1 py-2 text-xs font-semibold bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                >
                  ✕ Não compareceu
                </button>
              </div>
            )}

            {/* Ações */}
            <div className="space-y-2 pt-2">
              {/* Painel de edição */}
              {editingSchedule ? (
                <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-700/40 rounded-xl border border-slate-200 dark:border-slate-600">
                  <p className="text-xs font-semibold text-slate-500 uppercase">Reagendar</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-slate-500">Data</label>
                      <input
                        type="date"
                        value={editDate}
                        onChange={e => setEditDate(e.target.value)}
                        className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white dark:bg-slate-800 dark:border-slate-600"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Horário</label>
                      <input
                        type="time"
                        value={editTime}
                        onChange={e => setEditTime(e.target.value)}
                        className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white dark:bg-slate-800 dark:border-slate-600"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">
                      Procedimentos {editProcIds.length > 0 && <span className="text-violet-600">({editProcIds.length} selecionado{editProcIds.length > 1 ? 's' : ''})</span>}
                    </label>
                    <div className="max-h-40 overflow-y-auto space-y-1 border border-slate-200 dark:border-slate-600 rounded-lg p-2 bg-white dark:bg-slate-800">
                      {procList.map(p => (
                        <label key={p.id} className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700">
                          <input
                            type="checkbox"
                            checked={editProcIds.includes(p.id)}
                            onChange={e => {
                              if (e.target.checked) {
                                setEditProcIds(prev => [...prev, p.id])
                              } else {
                                setEditProcIds(prev => prev.filter(id => id !== p.id))
                              }
                            }}
                            className="w-4 h-4 rounded text-violet-600"
                          />
                          <span className="text-sm text-slate-700 dark:text-slate-200 flex-1">{p.name}</span>
                          <span className="text-xs text-slate-400">{p.duration_minutes}min</span>
                        </label>
                      ))}
                    </div>
                    {editProcIds.length > 1 && (
                      <p className="text-xs text-violet-600 mt-1">
                        Duração total: {procList.filter(p => editProcIds.includes(p.id)).reduce((s,p) => s + p.duration_minutes, 0)}min
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingSchedule(false)}
                      className="flex-1 py-2 text-sm font-semibold bg-slate-200 text-slate-700 rounded-lg"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={saveSchedule}
                      disabled={savingSchedule || !editDate || !editTime}
                      className="flex-1 py-2 text-sm font-semibold bg-violet-600 text-white rounded-lg disabled:opacity-50"
                    >
                      {savingSchedule ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={async () => {
                    // Carregar lista de procedimentos se necessário
                    if (!procListLoaded) {
                      const { data } = await supabaseCard.from('procedures').select('id, name, duration_minutes, price').eq('active', true).order('name')
                      setProcList(data || [])
                      setProcListLoaded(true)
                    }
                    // Pré-preencher com valores atuais
                    const d = new Date(apt.start_time)
                    const tz = 'America/Sao_Paulo'
                    setEditDate(d.toLocaleDateString('sv-SE', { timeZone: tz }))
                    setEditTime(d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: tz }))
                    // Pré-preencher com procedimentos existentes
                    const existing = apt.appointment_procedures?.map(p => p.procedure_id || '').filter(Boolean) || []
                    setEditProcIds(existing.length > 0 ? existing : (apt.procedure_id ? [apt.procedure_id] : []))
                    setEditingSchedule(true)
                  }}
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-semibold text-sm transition-colors hover:bg-slate-200"
                >
                  <Icon name="calendar" className="w-4 h-4" />
                  Reagendar / Trocar procedimento
                </button>
              )}

              {/* Registrar Pagamento */}
              {!isCancelled && (
                <button
                  onClick={() => { setShowPreview(false); setShowPayment(true) }}
                  className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm transition-colors ${
                    apt.payment_registered_at
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  <Icon name="dollarSign" className="w-4 h-4" />
                  {apt.payment_registered_at ? 'Pagamento registrado ✓' : 'Registrar Pagamento'}
                </button>
              )}

              <Link
                href={`/dashboard/atendimento/${apt.id}`}
                className="flex items-center justify-center gap-2 w-full py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold text-sm transition-colors"
              >
                <Icon name="arrowRight" className="w-4 h-4" />
                Ir para atendimento
              </Link>

              {!isCheckedIn && !isCancelled && apt.status !== 'completed' && (
                <button
                  onClick={() => { onCheckIn(apt.id); setShowPreview(false) }}
                  className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-sm transition-colors"
                >
                  <Icon name="check" className="w-4 h-4" />
                  Registrar Chegada
                </button>
              )}

              {apt.patients?.id && (
                <div className="flex gap-2">
                  <SendAnamneseButton
                    patientId={apt.patients.id}
                    patientName={apt.patients.name || ''}
                    patientPhone={apt.patients.phone || null}
                    appointmentId={apt.id}
                    variant="compact"
                  />
                  <SendTermoButton
                    patientId={apt.patients.id}
                    patientName={apt.patients.name || ''}
                    patientPhone={apt.patients.phone || null}
                    appointmentId={apt.id}
                    procedureName={apt.procedures?.name}
                    clinicId={apt.clinic_id}
                  />
                </div>
              )}
            </div>
          </div>
        </BottomSheet>
      )}

      {/* Popup lateral — só desktop, via portal+fixed para escapar overflow-x-auto e overflow-x-hidden */}
      {showPreview && !useSheet && (
        <ModalPortal>
          <div
            ref={popupRef}
            className="fixed w-72 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-4 overflow-y-auto"
            style={{ left: popupPos?.x ?? 0, top: popupPos?.y ?? 100, zIndex: 9999, maxHeight: popupMaxH ? `${popupMaxH}px` : '80vh' }}
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
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Procedimento:</span>
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-slate-700">{currentProcName || 'Atendimento'}</span>
                <button
                  onClick={openProcEdit}
                  className="text-[10px] text-violet-600 hover:text-violet-800 font-medium"
                >
                  Alterar
                </button>
              </div>
            </div>
            {editingProc && (
              <div className="space-y-1.5 pt-1" onClick={e => e.stopPropagation()}>
                <select
                  className="w-full text-xs border border-slate-200 rounded-lg p-1.5 focus:outline-none focus:ring-2 focus:ring-violet-300"
                  value={selectedProcId}
                  onChange={e => setSelectedProcId(e.target.value)}
                  autoFocus
                >
                  <option value="">— Sem procedimento —</option>
                  {procList.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <div className="flex gap-1.5">
                  <button
                    onClick={saveProc}
                    disabled={savingProc}
                    className="flex-1 py-1 text-xs bg-violet-500 text-white rounded-lg font-medium hover:bg-violet-600 disabled:opacity-50"
                  >
                    {savingProc ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button
                    onClick={() => { setEditingProc(false); setSelectedProcId(apt.procedure_id || '') }}
                    className="flex-1 py-1 text-xs bg-slate-100 text-slate-600 rounded-lg font-medium hover:bg-slate-200"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
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

            {/* Botão Registrar Pagamento */}
            {!isCancelled && (
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
                <SendTermoButton
                  patientId={apt.patients.id}
                  patientName={apt.patients.name}
                  patientPhone={apt.patients.phone}
                  appointmentId={apt.id}
                  procedureName={apt.procedures?.name}
                  clinicId={apt.clinic_id}
                />
              </div>
            )}
          </div>
          </div>
        </ModalPortal>
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

function ModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(children, document.body)
}

export default function AgendaView({ appointments: allAppointments, blocks: allBlocks, viewMode, selectedDate, professionals, selectedProfessional, clinicId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()
  const [localAppointments, setLocalAppointments] = useState<Appointment[]>(allAppointments)
  const [draggedAppointment, setDraggedAppointment] = useState<Appointment | null>(null)
  // Sincronizar com dados do servidor após refresh
  // Usar ref para evitar sobrescrever após atualização local imediata
  const skipNextSyncRef = React.useRef(false)
  React.useEffect(() => {
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false
      return
    }
    setLocalAppointments(allAppointments)
  }, [allAppointments])

  const [blockModal, setBlockModal] = useState<{ open: boolean; hour?: number; profId?: string; editBlock?: Block | null }>({ open: false })
  const [procConfirmModal, setProcConfirmModal] = useState<{
    open: boolean
    appointmentId: string
    patientName: string
    procedureName?: string | null
    procedureId?: string | null
  } | null>(null)

  // allAppointments é a prop do servidor, localAppointments é o estado local
  // Parse multi-select: 'all' ou 'id1,id2,...'
  const selectedProfIds = selectedProfessional === 'all'
    ? []
    : selectedProfessional.split(',').filter(Boolean)

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const displayProfessionals = selectedProfIds.length === 0
    ? professionals
    : professionals.filter(p => selectedProfIds.includes(p.id))

  // Aplica filtro de profissional em TODAS as views
  const appointments = selectedProfIds.length === 0
    ? localAppointments
    : localAppointments.filter(a => selectedProfIds.includes(a.professional_id || ''))

  const blocks = selectedProfIds.length === 0
    ? allBlocks
    : allBlocks.filter(b => selectedProfIds.includes(b.professional_id))

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
    // Se está concluindo, abre modal de confirmação de procedimentos
    if (newStatus === 'completed') {
      const apt = localAppointments.find(a => a.id === appointmentId)
      setProcConfirmModal({
        open: true,
        appointmentId,
        patientName: apt?.patients?.name || 'Paciente',
        procedureName: apt?.procedures?.name,
        procedureId: apt?.procedure_id,
      })
      return
    }

    const { error } = await supabase
      .from('appointments')
      .update({ status: newStatus })
      .eq('id', appointmentId)

    if (error) {
      toast.error(`Nao foi possivel atualizar: ${error.message}`)
      return
    }

    router.refresh()

    const labels: Record<string, string> = {
      confirmed: 'Confirmado',
      cancelled: 'Cancelado',
      completed: 'Concluido',
      no_show: 'Marcado como nao compareceu',
    }
    const label = labels[newStatus] || 'Status atualizado'
    toast.success(label)
  }, [supabase, router, toast, localAppointments, setLocalAppointments])

  // Confirmar procedimentos realizados e finalizar atendimento
  const handleProceduresConfirm = useCallback(async (procedures: Array<{ id: string; name: string; price: number }>) => {
    if (!procConfirmModal) return
    const { appointmentId } = procConfirmModal

    // 1. Atualizar appointment_procedures
    await supabase.from('appointment_procedures').delete().eq('appointment_id', appointmentId)
    if (procedures.length > 0) {
      await supabase.from('appointment_procedures').insert(
        procedures.map(p => ({
          appointment_id: appointmentId,
          procedure_id: p.id,
          procedure_name: p.name,
          price: p.price,
          duration_minutes: 30,
        }))
      )
    }

    // 2. Atualizar procedure principal se só 1 procedimento
    const mainProc = procedures[0]
    await supabase.from('appointments').update({
      status: 'completed',
      procedure_id: mainProc?.id || null,
    }).eq('id', appointmentId)

    // Atualizar estado local para refletir imediatamente na tela
    // Pular a próxima sincronização com o servidor para não sobrescrever
    skipNextSyncRef.current = true
    setLocalAppointments(prev => prev.map(a => {
      if (a.id !== appointmentId) return a
      return {
        ...a,
        status: 'completed',
        procedure_id: mainProc?.id || a.procedure_id,
        appointment_procedures: procedures.map(p => ({
          id: p.id,
          procedure_id: p.id,
          procedure_name: p.name,
          price: p.price,
          duration_minutes: 30,
        })),
      }
    }))

    setProcConfirmModal(null)
    router.refresh()
    toast.success('Atendimento concluído!')
  }, [procConfirmModal, supabase, router, toast])

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
          message: `Agendamento das ${new Date(apt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })} - ${apt.procedures?.name || 'Atendimento'}`,
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
      toast.error('Sem horarios livres: Nao encontramos horarios nos proximos 30 dias. Confira em Equipe se os profissionais tem horario cadastrado.')
    }
  }

  // Visão Dia - Colunas por profissional
  if (viewMode === 'day') {
    return (
      <>
        <ModalPortal>
          {procConfirmModal?.open && (
            <ProceduresConfirmModal
              appointmentId={procConfirmModal.appointmentId}
              clinicId={clinicId}
              patientName={procConfirmModal.patientName}
              initialProcedureName={procConfirmModal.procedureName}
              initialProcedureId={procConfirmModal.procedureId}
              onConfirm={handleProceduresConfirm}
              onCancel={() => setProcConfirmModal(null)}
            />
          )}
        </ModalPortal>
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
            
            {/* ── Grade proporcional — cada hora = SLOT_PX pixels ── */}
            {(() => {
              const SLOT_PX = 120 // altura de 1 hora em px
              const BR_TZ = 'America/Sao_Paulo'
              const now = new Date()
              const nowMinutes =
                parseInt(now.toLocaleTimeString('pt-BR', { hour: '2-digit', timeZone: BR_TZ })) * 60 +
                parseInt(now.toLocaleTimeString('pt-BR', { minute: '2-digit', timeZone: BR_TZ }))
              const firstHour = HOUR_SLOTS[0]
              const redLineTop = (nowMinutes - firstHour * 60) * (SLOT_PX / 60)
              const showRedLine = nowMinutes >= firstHour * 60 &&
                nowMinutes < (HOUR_SLOTS[HOUR_SLOTS.length - 1] + 1) * 60 &&
                selectedDate === new Date().toLocaleDateString('en-CA', { timeZone: BR_TZ })

              // Calcula top e height de um agendamento/bloco em px
              function calcBlock(startIso: string, endIso: string | null, fallbackMin = 30) {
                const s = new Date(startIso)
                const sMin = s.toLocaleTimeString('pt-BR', { hour: '2-digit', timeZone: BR_TZ }) as unknown as number * 60 +
                  (parseInt(s.toLocaleTimeString('pt-BR', { minute: '2-digit', timeZone: BR_TZ })) || 0)
                const startHour = parseInt(s.toLocaleTimeString('pt-BR', { hour: '2-digit', timeZone: BR_TZ }))
                const startMin = startHour * 60 + (parseInt(s.toLocaleTimeString('pt-BR', { minute: '2-digit', timeZone: BR_TZ })) || 0)
                const durMin = endIso
                  ? Math.round((new Date(endIso).getTime() - s.getTime()) / 60000)
                  : fallbackMin
                const top = (startMin - firstHour * 60) * (SLOT_PX / 60)
                const height = Math.max(durMin * (SLOT_PX / 60), 28) // mínimo 28px
                return { top, height, startMin, durMin }
              }

              const totalHours = HOUR_SLOTS.length
              const gridHeight = totalHours * SLOT_PX

              return (
                <div className="flex" style={{ position: 'relative' }}>
                  {/* Coluna de horas */}
                  <div className="w-20 flex-shrink-0 border-r border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" style={{ height: gridHeight }}>
                    {HOUR_SLOTS.map(hour => {
                      const isLunchTime = hour === 12
                      return (
                        <div
                          key={hour}
                          style={{ height: SLOT_PX, borderBottom: '1px solid' }}
                          className="border-slate-100 dark:border-slate-700 flex items-start justify-center pt-2"
                        >
                          <span className={`text-sm font-semibold ${isLunchTime ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
                            {`${hour.toString().padStart(2, '0')}:00`}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Colunas por profissional */}
                  {displayProfessionals.map((prof, profIdx) => {
                    const isLastColumn = profIdx === displayProfessionals.length - 1
                    const profApts = appointments.filter(apt => apt.professional_id === prof.id)
                    const profBlocks = blocks.filter(bl => bl.professional_id === prof.id)

                    return (
                      <div
                        key={prof.id}
                        className={`flex-1 min-w-[180px] border-r border-slate-100 dark:border-slate-700 last:border-r-0 relative`}
                        style={{ height: gridHeight, overflow: 'visible' }}
                      >
                        {/* Linhas de hora (fundo) */}
                        {HOUR_SLOTS.map(hour => {
                          const isLunch = hour === 12
                          return (
                            <div
                              key={hour}
                              style={{ position: 'absolute', top: (hour - firstHour) * SLOT_PX, left: 0, right: 0, height: SLOT_PX }}
                              className={`border-b border-slate-100 dark:border-slate-700 ${isLunch ? 'bg-amber-50/30 dark:bg-amber-900/10' : ''} group/cell`}
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDrop(e, selectedDate, hour, prof.id)}
                            >
                              {/* Link para novo agendamento ao hover */}
                              <Link
                                href={`/dashboard/agenda/novo?date=${selectedDate}&time=${hour.toString().padStart(2,'0')}:00&professional=${prof.id}`}
                                className="absolute inset-1 rounded-lg border-2 border-dashed border-transparent hover:border-violet-200 hover:bg-violet-50/50 dark:hover:bg-violet-900/10 transition-colors flex items-center justify-center opacity-0 group-hover/cell:opacity-100"
                              >
                                <Icon name="plus" className="w-4 h-4 text-violet-300" />
                              </Link>
                            </div>
                          )
                        })}

                        {/* Blocos de bloqueio (posicionados absoluto) */}
                        {profBlocks.map(bl => {
                          const blStyle = COLOR_BLOCK[bl.color] || COLOR_BLOCK.slate
                          const { top, height } = calcBlock(bl.start_time, bl.end_time, 60)
                          return (
                            <button
                              key={bl.id}
                              onClick={() => setBlockModal({ open: true, editBlock: bl })}
                              style={{ position: 'absolute', top: top + 2, left: 4, right: 4, height: height - 4, zIndex: 5 }}
                              className={`text-left p-2 rounded-lg border-l-4 ${blStyle.bg} ${blStyle.border} ${blStyle.text} hover:opacity-80 transition-opacity overflow-hidden`}
                            >
                              <div className="flex items-center gap-1">
                                <Icon name="lock" className="w-3 h-3 flex-shrink-0" />
                                <span className="text-xs font-semibold truncate">{bl.title}</span>
                              </div>
                              {bl.notes && <p className="text-xs opacity-70 truncate mt-0.5">{bl.notes}</p>}
                            </button>
                          )
                        })}

                        {/* Agendamentos (posicionados absoluto, proporcionais à duração) */}
                        {profApts.map((apt, aptIdx) => {
                          const totalDurMin = apt.end_time
                            ? Math.round((new Date(apt.end_time).getTime() - new Date(apt.start_time).getTime()) / 60000)
                            : (apt.appointment_procedures?.reduce((s, p) => s + (p.duration_minutes || 30), 0) || apt.procedures?.duration_minutes || 30)
                          const { top, height } = calcBlock(apt.start_time, apt.end_time, totalDurMin)
                          
                          // Detectar sobreposições para dividir largura
                          const overlapping = profApts.filter((other, otherIdx) => {
                            if (otherIdx === aptIdx) return false
                            const otherDur = other.end_time
                              ? Math.round((new Date(other.end_time).getTime() - new Date(other.start_time).getTime()) / 60000)
                              : (other.procedures?.duration_minutes || 30)
                            const { top: oTop, height: oHeight } = calcBlock(other.start_time, other.end_time, otherDur)
                            return top < oTop + oHeight && top + height > oTop
                          })
                          const overlapCount = overlapping.length + 1
                          const overlapIndex = overlapping.filter((_, i) => {
                            const other = overlapping[i]
                            return other.start_time < apt.start_time || (other.start_time === apt.start_time && other.id < apt.id)
                          }).length
                          const colWidth = 100 / overlapCount
                          const colLeft = overlapIndex * colWidth

                          return (
                            <div
                              key={apt.id}
                              style={{
                                position: 'absolute',
                                top: top + 2,
                                left: `calc(${colLeft}% + 2px)`,
                                width: `calc(${colWidth}% - 4px)`,
                                height: height - 4,
                                zIndex: 10,
                                overflow: 'visible',
                              }}
                            >
                              <AppointmentCard
                                apt={apt}
                                onStatusChange={handleStatusChange}
                                onCheckIn={handleCheckIn}
                                onDragStart={handleDragStart}
                                isRightColumn={isLastColumn}
                                columnIndex={profIdx}
                                totalColumns={displayProfessionals.length}
                                canDrag={true}
                              />
                            </div>
                          )
                        })}

                        {/* Linha vermelha do horário atual */}
                        {showRedLine && (
                          <div
                            style={{ position: 'absolute', top: redLineTop, left: 0, right: 0, zIndex: 20, pointerEvents: 'none' }}
                            className="flex items-center"
                          >
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0 -ml-1.5 shadow-sm" />
                            <div className="flex-1 h-px bg-red-500 opacity-80" />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })()}
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
        <ModalPortal>
          {procConfirmModal?.open && (
            <ProceduresConfirmModal
              appointmentId={procConfirmModal.appointmentId}
              clinicId={clinicId}
              patientName={procConfirmModal.patientName}
              initialProcedureName={procConfirmModal.procedureName}
              initialProcedureId={procConfirmModal.procedureId}
              onConfirm={handleProceduresConfirm}
              onCancel={() => setProcConfirmModal(null)}
            />
          )}
        </ModalPortal>
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
                        {new Date(apt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })} {apt.patients?.name?.split(' ')[0]}
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




