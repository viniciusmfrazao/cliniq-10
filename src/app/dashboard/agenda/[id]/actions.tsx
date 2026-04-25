'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import AppointmentForm from '../appointment-form'

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
  )
}
