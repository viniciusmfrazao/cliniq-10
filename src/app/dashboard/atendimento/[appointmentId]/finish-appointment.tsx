'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'

type Props = {
  appointmentId: string
  currentStatus: string
  clinicId: string
}

export default function FinishAppointment({ appointmentId, currentStatus, clinicId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  async function startAppointment() {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'in_progress' })
        .eq('id', appointmentId)
      if (error) throw error
      router.refresh()
    } catch (err) {
      console.error(err)
      alert('Erro ao iniciar atendimento')
    } finally {
      setLoading(false)
    }
  }

  async function finishAppointment() {
    if (!confirm('Finalizar este atendimento? O estoque dos injetaveis sera descontado automaticamente.')) return
    setLoading(true)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()

      // 1. Buscar aplicacoes de injetaveis deste atendimento que ainda nao foram descontadas
      const { data: applications } = await supabase
        .from('injectable_applications')
        .select('id, product_id, total_units, patient_id')
        .eq('appointment_id', appointmentId)
        .eq('stock_deducted', false)
        .not('product_id', 'is', null)

      // 2. Para cada aplicacao, descontar do estoque
      if (applications && applications.length > 0) {
        for (const app of applications) {
          if (!app.product_id || !app.total_units) continue

          // Buscar estoque atual do produto
          const { data: product } = await supabase
            .from('products')
            .select('current_stock')
            .eq('id', app.product_id)
            .single()

          if (!product) continue

          const newStock = Math.max(0, product.current_stock - app.total_units)

          // Criar movimentacao de estoque
          await supabase.from('stock_movements').insert({
            clinic_id: clinicId,
            product_id: app.product_id,
            type: 'uso_atendimento',
            quantity: app.total_units,
            previous_stock: product.current_stock,
            new_stock: newStock,
            reason: 'Aplicacao de injetavel',
            appointment_id: appointmentId,
            patient_id: app.patient_id,
            user_id: user!.id,
          })

          // Marcar aplicacao como descontada
          await supabase
            .from('injectable_applications')
            .update({ stock_deducted: true })
            .eq('id', app.id)
        }
      }

      // 3. Finalizar o atendimento
      const { error } = await supabase
        .from('appointments')
        .update({ 
          status: 'completed',
          end_time: new Date().toISOString()
        })
        .eq('id', appointmentId)
      
      if (error) throw error

      router.push('/dashboard/agenda')
      router.refresh()
    } catch (err) {
      console.error(err)
      alert('Erro ao finalizar atendimento')
    } finally {
      setLoading(false)
    }
  }

  if (currentStatus === 'scheduled' || currentStatus === 'confirmed') {
    return (
      <button
        onClick={startAppointment}
        disabled={loading}
        className="btn-primary w-auto px-6 flex items-center gap-2"
      >
        {loading ? (
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <Icon name="zap" className="w-4 h-4" />
        )}
        Iniciar Atendimento
      </button>
    )
  }

  return (
    <button
      onClick={finishAppointment}
      disabled={loading}
      className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-6 py-2.5 rounded-xl font-medium text-sm hover:opacity-90 transition-all flex items-center gap-2 shadow-lg shadow-emerald-200"
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
        <Icon name="check" className="w-4 h-4" />
      )}
      Finalizar Atendimento
    </button>
  )
}
