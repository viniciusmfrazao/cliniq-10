'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'

type Props = {
  appointment: {
    id: string
    status: string
    start_time: string
    checked_in_at?: string | null
    procedure_id?: string | null
    procedures?: { name: string; duration_minutes: number; price: number } | null
  }
  patient: {
    id: string
    name: string
    birth_date: string | null
    photo_url?: string | null
  }
  procedure: {
    name: string
    duration_minutes: number
    price?: number
  } | null
  clinicId: string
}

export default function AttendanceHeader({ appointment, patient, procedure, clinicId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [status, setStatus] = useState(appointment.status)
  const [showFinishConfirm, setShowFinishConfirm] = useState(false)
  const [valorCobrado, setValorCobrado] = useState<string>(
    String(appointment.procedures?.price ?? procedure?.price ?? 0)
  )
  const [showReschedule, setShowReschedule] = useState(false)
  const [rescheduleDate, setRescheduleDate] = useState(
    new Date(appointment.start_time).toISOString().split('T')[0]
  )
  const [rescheduleTime, setRescheduleTime] = useState(
    new Date(appointment.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
  )
  const [savingReschedule, setSavingReschedule] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleReschedule = async () => {
    if (!rescheduleDate || !rescheduleTime) return
    setSavingReschedule(true)
    try {
      const [h, m] = rescheduleTime.split(':').map(Number)
      const newStart = new Date(`${rescheduleDate}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`)
      const newEnd = new Date(newStart.getTime() + (procedure?.duration_minutes || 30) * 60000)
      const { error } = await supabase
        .from('appointments')
        .update({ start_time: newStart.toISOString(), end_time: newEnd.toISOString() })
        .eq('id', appointment.id)
      if (error) throw error
      setShowReschedule(false)
      router.refresh()
    } catch {
      alert('Erro ao reagendar. Tente novamente.')
    } finally {
      setSavingReschedule(false)
    }
  }

  const calculateAge = (birthDate: string | null) => {
    if (!birthDate) return null
    const today = new Date()
    const birth = new Date(birthDate)
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
    return age
  }

  useEffect(() => {
    if (status !== 'in_progress') return
    const startTime = appointment.checked_in_at
      ? new Date(appointment.checked_in_at).getTime()
      : new Date(appointment.start_time).getTime()
    const updateTimer = () => setElapsedTime(Math.floor((Date.now() - startTime) / 1000))
    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [status, appointment.checked_in_at, appointment.start_time])

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const startAttendance = async () => {
    setLoading(true)
    await supabase
      .from('appointments')
      .update({ status: 'in_progress', checked_in_at: new Date().toISOString() })
      .eq('id', appointment.id)
    setStatus('in_progress')
    setLoading(false)
    router.refresh()
  }

  // Abre diretamente o modal de confirmação com valor editável
  const finishAttendance = () => {
    setValorCobrado(String(appointment.procedures?.price ?? procedure?.price ?? 0))
    setShowFinishConfirm(true)
  }

  const confirmFinish = async () => {
    setShowFinishConfirm(false)
    setLoading(true)

    try {
      const valor = parseFloat(valorCobrado) || 0
      const proc = appointment.procedures || (procedure ? { name: procedure.name, price: procedure?.price ?? 0 } : null)

      // 1. Descontar estoque de injetáveis
      const { data: applications } = await supabase
        .from('injectable_applications')
        .select('id, product_id, product_name, total_units')
        .eq('appointment_id', appointment.id)
        .eq('stock_deducted', false)

      for (const app of applications || []) {
        const { data: product } = await supabase
          .from('products')
          .select('id, current_stock, name')
          .eq('id', app.product_id)
          .single()

        if (!product) continue
        const newStock = Math.max(0, (product.current_stock || 0) - (app.total_units || 0))

        await supabase.from('products').update({ current_stock: newStock }).eq('id', app.product_id)
        await supabase.from('stock_movements').insert({
          clinic_id: clinicId,
          product_id: app.product_id,
          type: 'saida',
          quantity: app.total_units || 0,
          previous_stock: product.current_stock || 0,
          new_stock: newStock,
          reason: `Atendimento - ${app.product_name}`,
          appointment_id: appointment.id,
          patient_id: patient.id,
        })
        await supabase.from('injectable_applications').update({ stock_deducted: true }).eq('id', app.id)
      }

      // 2. Salvar procedimento realizado (usa o procedimento do agendamento)
      if (proc) {
        await supabase.from('appointment_procedures').delete().eq('appointment_id', appointment.id)
        await supabase.from('appointment_procedures').insert({
          appointment_id: appointment.id,
          procedure_id: appointment.procedure_id || null,
          procedure_name: proc.name,
          price: proc.price ?? 0,
          duration_minutes: procedure?.duration_minutes || 30,
        })
      }

      // 3. Finalizar atendimento e salvar valor cobrado
      const { error } = await supabase
        .from('appointments')
        .update({
          status: 'completed',
          valor_cobrado: valor,
        })
        .eq('id', appointment.id)

      if (error) {
        alert(`Erro ao finalizar: ${error.message}`)
        throw error
      }

      setStatus('completed')
      router.refresh()
      router.push('/dashboard/agenda')
    } catch (err) {
      alert('Erro ao finalizar atendimento. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const age = calculateAge(patient.birth_date)
  const showStartBanner = status === 'scheduled' || status === 'confirmed' || status === 'checked_in'
  const procedureName = appointment.procedures?.name || procedure?.name || 'Atendimento'
  const valorNum = parseFloat(valorCobrado) || 0
  const isGratuito = valorNum === 0

  const finishConfirmModal = showFinishConfirm && typeof document !== 'undefined'
    ? createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-800">Finalizar atendimento?</h3>
              <p className="text-sm text-slate-500 mt-1">{procedureName}</p>
              <p className="text-xs text-amber-600 mt-1 flex items-center justify-center gap-1">
                ⚠️ O estoque dos injetáveis lançados será descontado.
              </p>
            </div>

            {/* Valor cobrado editável */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block">
                Valor a cobrar
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">R$</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={valorCobrado}
                  onChange={e => setValorCobrado(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                />
              </div>
              {isGratuito ? (
                <p className="text-xs text-amber-600 font-medium">✓ Sem cobrança — não gera dívida</p>
              ) : (
                <p className="text-xs text-slate-400">
                  Este valor será pré-preenchido no registro de pagamento
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowFinishConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={confirmFinish}
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold">
                Confirmar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
    : null

  return (
    <>
      {finishConfirmModal}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 border-b border-slate-200 shadow-sm">
        {showStartBanner && (
          <div className="w-full bg-violet-50 border-b border-violet-200 px-4 py-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-violet-500 text-sm">⚡</span>
              <p className="text-violet-700 text-sm font-medium truncate">
                <span className="hidden sm:inline">Atendimento ainda não iniciado — </span>
                <span className="sm:hidden">Não iniciado — </span>
              </p>
            </div>
            <button onClick={startAttendance} disabled={loading}
              className="flex-shrink-0 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap disabled:opacity-60">
              {loading ? 'Iniciando...' : 'Iniciar agora'}
            </button>
          </div>
        )}

        <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-2.5 md:py-3">
          <div className="flex items-center justify-between gap-3">
            {/* Voltar + Info Paciente */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Link href="/dashboard/agenda"
                className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors flex-shrink-0"
                aria-label="Voltar para agenda">
                <Icon name="arrowLeft" className="w-5 h-5 text-slate-600" />
              </Link>

              <div className="hidden sm:flex w-10 h-10 md:w-11 md:h-11 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 items-center justify-center text-white font-bold overflow-hidden flex-shrink-0">
                {patient.photo_url && /^https?:\/\//.test(patient.photo_url) ? (
                  <img src={patient.photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  patient.name.charAt(0).toUpperCase()
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <h1 className="text-base md:text-lg font-bold text-slate-900 truncate">{patient.name}</h1>
                  {age && <span className="hidden md:inline text-sm text-slate-500 flex-shrink-0">{age} anos</span>}
                </div>
                <button onClick={() => setShowReschedule(v => !v)}
                  className="flex items-center gap-1 text-xs md:text-sm text-slate-500 hover:text-violet-600 transition-colors group"
                  title="Clique para alterar data/hora">
                  <span>
                    {procedure?.name || 'Atendimento'} • {new Date(appointment.start_time).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })} às {new Date(appointment.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}
                  </span>
                  <Icon name="edit" className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>
            </div>

            {/* Status + Cronômetro + Ações */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full ${
                status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  status === 'in_progress' ? 'bg-blue-500 animate-pulse' :
                  status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'
                }`} />
                <span className="text-xs font-semibold">
                  {status === 'in_progress' ? 'Em atendimento' :
                   status === 'completed' ? 'Finalizado' : 'Aguardando'}
                </span>
              </div>

              {status === 'in_progress' && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-full">
                  <Icon name="clock" className="w-3.5 h-3.5 text-slate-600" />
                  <span className="text-xs md:text-sm font-mono font-semibold text-slate-700">
                    {formatTime(elapsedTime)}
                  </span>
                </div>
              )}

              <button onClick={() => setShowReschedule(v => !v)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                  showReschedule ? 'bg-violet-100 text-violet-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title="Alterar data/hora">
                <Icon name="calendar" className="w-4 h-4" />
              </button>

              {(status === 'confirmed' || status === 'scheduled') && (
                <button onClick={startAttendance} disabled={loading}
                  className="btn-primary w-auto px-3 md:px-4 py-2 flex items-center gap-1.5 text-sm">
                  {loading ? (
                    <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                  ) : (
                    <>
                      <Icon name="zap" className="w-4 h-4" />
                      <span className="hidden sm:inline">Iniciar</span>
                    </>
                  )}
                </button>
              )}

              {status === 'in_progress' && (
                <button onClick={finishAttendance} disabled={loading}
                  className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white rounded-xl font-semibold flex items-center gap-1.5 transition-colors text-sm">
                  {loading ? (
                    <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                  ) : (
                    <>
                      <Icon name="check" className="w-4 h-4" />
                      <span className="hidden sm:inline">Finalizar</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Painel de reagendamento inline */}
          {showReschedule && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-end gap-3 animate-in fade-in slide-in-from-top-1 duration-150">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Data</label>
                <input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)}
                  className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:border-violet-400 focus:ring-2 focus:ring-violet-200 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Horário</label>
                <select value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)}
                  className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:border-violet-400 focus:ring-2 focus:ring-violet-200 outline-none transition-all">
                  {Array.from({ length: 26 }, (_, i) => {
                    const h = Math.floor(i / 2) + 7
                    const min = i % 2 === 0 ? '00' : '30'
                    const t = `${String(h).padStart(2,'0')}:${min}`
                    return <option key={t} value={t}>{t}</option>
                  })}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={handleReschedule} disabled={savingReschedule}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl flex items-center gap-1.5 transition-colors">
                  {savingReschedule ? (
                    <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                  ) : (
                    <><Icon name="check" className="w-4 h-4" />Salvar</>
                  )}
                </button>
                <button onClick={() => setShowReschedule(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
