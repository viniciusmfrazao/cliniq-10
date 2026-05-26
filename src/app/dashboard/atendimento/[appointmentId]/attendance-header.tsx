'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { createLogger } from '@/lib/logger'

const log = createLogger('AttendanceHeader')

type Props = {
  appointment: {
    id: string
    status: string
    start_time: string
    checked_in_at?: string | null
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
  } | null
  clinicId: string
}

export default function AttendanceHeader({ appointment, patient, procedure, clinicId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [status, setStatus] = useState(appointment.status)
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
        .update({
          start_time: newStart.toISOString(),
          end_time: newEnd.toISOString(),
        })
        .eq('id', appointment.id)
      if (error) throw error
      setShowReschedule(false)
      router.refresh()
    } catch (err) {
      alert('Erro ao reagendar. Tente novamente.')
    } finally {
      setSavingReschedule(false)
    }
  }

  // Calcular idade
  const calculateAge = (birthDate: string | null) => {
    if (!birthDate) return null
    const today = new Date()
    const birth = new Date(birthDate)
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
    return age
  }

  // Cronometro
  useEffect(() => {
    if (status !== 'in_progress') return

    const startTime = appointment.checked_in_at 
      ? new Date(appointment.checked_in_at).getTime()
      : new Date(appointment.start_time).getTime()
    
    const updateTimer = () => {
      const now = Date.now()
      setElapsedTime(Math.floor((now - startTime) / 1000))
    }

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
      .update({ 
        status: 'in_progress',
        checked_in_at: new Date().toISOString()
      })
      .eq('id', appointment.id)
    
    setStatus('in_progress')
    setLoading(false)
    router.refresh()
  }

  const finishAttendance = async () => {
    if (!confirm('Finalizar este atendimento?\n\nO estoque dos injetáveis será descontado.')) return
    setLoading(true)
    
    try {
      console.log('=== FINALIZANDO ATENDIMENTO ===')
      console.log('Appointment ID:', appointment.id)

      // 1. Buscar aplicações de injetáveis que ainda não tiveram estoque descontado
      const { data: applications, error: fetchError } = await supabase
        .from('injectable_applications')
        .select('id, product_id, product_name, total_units')
        .eq('appointment_id', appointment.id)
        .eq('stock_deducted', false)

      console.log('Aplicações encontradas:', applications)
      console.log('Erro ao buscar:', fetchError)

      if (fetchError) {
        alert(`Erro ao buscar aplicações: ${fetchError.message}`)
        throw fetchError
      }

      if (!applications || applications.length === 0) {
        console.log('NENHUMA APLICAÇÃO ENCONTRADA para este atendimento')
        alert('Nenhuma aplicação de injetável encontrada para descontar.\n\nVerifique se você salvou os pontos no mapa.')
      } else {
        console.log(`${applications.length} aplicações para descontar`)

        // 2. Para cada aplicação, descontar do estoque
        for (const app of applications) {
          console.log('Processando aplicação:', app)

          // Buscar estoque atual do produto
          const { data: product, error: productError } = await supabase
            .from('products')
            .select('id, current_stock, name')
            .eq('id', app.product_id)
            .single()

          if (productError) {
            console.log('Erro ao buscar produto:', productError)
            continue
          }

          console.log('Produto encontrado:', product)
          const newStock = Math.max(0, (product.current_stock || 0) - (app.total_units || 0))
          console.log(`Estoque: ${product.current_stock} -> ${newStock} (descontando ${app.total_units})`)

          // Atualizar estoque do produto
          const { error: updateError } = await supabase
            .from('products')
            .update({ current_stock: newStock })
            .eq('id', app.product_id)

          if (updateError) {
            console.error('Erro ao atualizar estoque:', updateError)
            alert(`Erro ao atualizar estoque: ${updateError.message}`)
          } else {
            console.log('Estoque atualizado com sucesso!')
          }

          // Registrar movimentação de estoque
          const { error: movError } = await supabase.from('stock_movements').insert({
            clinic_id: clinicId,
            product_id: app.product_id,
            type: 'saida',
            quantity: app.total_units || 0,
            previous_stock: product.current_stock || 0,
            new_stock: newStock,
            reason: `Atendimento - ${app.product_name}`,
            appointment_id: appointment.id,
            patient_id: patient.id
          })

          if (movError) {
            console.error('Erro ao registrar movimentação:', movError)
          }

          // Marcar aplicação como descontada
          const { error: markError } = await supabase
            .from('injectable_applications')
            .update({ stock_deducted: true })
            .eq('id', app.id)

          if (markError) {
            console.error('Erro ao marcar como descontada:', markError)
          }
        }

        alert(`Estoque descontado!\n\n${applications.length} aplicação(ões) processada(s).`)
      }

      // 3. Finalizar o atendimento
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ status: 'completed' })
        .eq('id', appointment.id)

      if (updateError) {
        alert(`Erro ao finalizar: ${updateError.message}`)
        throw updateError
      }

      console.log('=== ATENDIMENTO FINALIZADO ===')
      setStatus('completed')
      router.push('/dashboard/agenda')
    } catch (err) {
      console.error('Erro geral:', err)
      alert('Erro ao finalizar atendimento. Veja o console.')
    } finally {
      setLoading(false)
    }
  }

  const age = calculateAge(patient.birth_date)

  return (
    <div className="sticky top-0 z-30 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 border-b border-slate-200 shadow-sm">
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-2.5 md:py-3">
        <div className="flex items-center justify-between gap-3">
          {/* Voltar + Info Paciente */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Link
              href="/dashboard/agenda"
              className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors flex-shrink-0"
              aria-label="Voltar para agenda"
            >
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
                <h1 className="text-base md:text-lg font-bold text-slate-900 truncate">
                  {patient.name}
                </h1>
                {age && (
                  <span className="hidden md:inline text-sm text-slate-500 flex-shrink-0">
                    {age} anos
                  </span>
                )}
              </div>
              {/* Data/hora clicável para reagendar */}
              <button
                onClick={() => setShowReschedule(v => !v)}
                className="flex items-center gap-1 text-xs md:text-sm text-slate-500 hover:text-violet-600 transition-colors group"
                title="Clique para alterar data/hora"
              >
                <span>{procedure?.name || 'Atendimento'} • {new Date(appointment.start_time).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })} às {new Date(appointment.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}</span>
                <Icon name="edit" className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
          </div>

          {/* Status + Cronometro + Acoes */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full ${
              status === 'in_progress'
                ? 'bg-blue-100 text-blue-700'
                : status === 'completed'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700'
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

            {/* Botão reagendar — sempre visível */}
            <button
              onClick={() => setShowReschedule(v => !v)}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                showReschedule ? 'bg-violet-100 text-violet-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              title="Alterar data/hora"
            >
              <Icon name="calendar" className="w-4 h-4" />
            </button>

            {(status === 'confirmed' || status === 'scheduled') && (
              <button
                onClick={startAttendance}
                disabled={loading}
                className="btn-primary w-auto px-3 md:px-4 py-2 flex items-center gap-1.5 text-sm"
              >
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
              <button
                onClick={finishAttendance}
                disabled={loading}
                className="px-3 md:px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white rounded-xl font-semibold flex items-center gap-1.5 transition-colors text-sm"
              >
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
              <input
                type="date"
                value={rescheduleDate}
                onChange={e => setRescheduleDate(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:border-violet-400 focus:ring-2 focus:ring-violet-200 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Horário</label>
              <select
                value={rescheduleTime}
                onChange={e => setRescheduleTime(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:border-violet-400 focus:ring-2 focus:ring-violet-200 outline-none transition-all"
              >
                {Array.from({ length: 26 }, (_, i) => {
                  const h = Math.floor(i / 2) + 7
                  const min = i % 2 === 0 ? '00' : '30'
                  const t = `${String(h).padStart(2,'0')}:${min}`
                  return <option key={t} value={t}>{t}</option>
                })}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleReschedule}
                disabled={savingReschedule}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
              >
                {savingReschedule ? (
                  <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                ) : (
                  <>
                    <Icon name="check" className="w-4 h-4" />
                    Salvar
                  </>
                )}
              </button>
              <button
                onClick={() => setShowReschedule(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
