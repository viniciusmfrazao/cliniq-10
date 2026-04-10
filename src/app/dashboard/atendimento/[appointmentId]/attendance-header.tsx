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

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

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
    <div className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-[1600px] mx-auto px-4">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Voltar + Info Paciente */}
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/agenda"
              className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
            >
              <Icon name="arrowLeft" className="w-5 h-5 text-slate-600" />
            </Link>

            {/* Avatar */}
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg overflow-hidden">
              {patient.photo_url ? (
                <img src={patient.photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                patient.name.charAt(0).toUpperCase()
              )}
            </div>

            {/* Nome e Info */}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900">{patient.name}</h1>
                {age && <span className="text-sm text-slate-500">{age} anos</span>}
              </div>
              <p className="text-sm text-slate-500">
                {procedure?.name || 'Consulta'} • {new Date(appointment.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          {/* Status + Timer + Ações */}
          <div className="flex items-center gap-4">
            {/* Badge Status */}
            <div className={`hidden md:flex items-center gap-2 px-4 py-2 rounded-full ${
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
              <span className="text-sm font-semibold">
                {status === 'in_progress' ? 'Em atendimento' : 
                 status === 'completed' ? 'Finalizado' : 'Aguardando'}
              </span>
            </div>

            {/* Cronometro */}
            {status === 'in_progress' && (
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-full">
                <Icon name="clock" className="w-4 h-4 text-slate-600" />
                <span className="text-sm font-mono font-semibold text-slate-700">
                  {formatTime(elapsedTime)}
                </span>
              </div>
            )}

            {/* Botões de Ação */}
            {status === 'confirmed' || status === 'scheduled' ? (
              <button
                onClick={startAttendance}
                disabled={loading}
                className="btn-primary w-auto px-6 flex items-center gap-2"
              >
                {loading ? (
                  <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                ) : (
                  <>
                    <Icon name="zap" className="w-4 h-4" />
                    Iniciar atendimento
                  </>
                )}
              </button>
            ) : status === 'in_progress' ? (
              <button
                onClick={finishAttendance}
                disabled={loading}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold flex items-center gap-2 transition-colors"
              >
                {loading ? (
                  <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                ) : (
                  <>
                    <Icon name="check" className="w-4 h-4" />
                    Finalizar
                  </>
                )}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
