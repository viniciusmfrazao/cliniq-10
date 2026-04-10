'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { createClient } from '@/lib/supabase/client'

type Appointment = {
  id: string
  start_time: string
  end_time: string | null
  status: string
  notes: string | null
  checked_in_at: string | null
  professional_id: string | null
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
  professionals: Professional[]
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Aguardando', color: 'text-slate-600 bg-slate-100' },
  confirmed: { label: 'Confirmado', color: 'text-blue-600 bg-blue-100' },
  in_progress: { label: 'Em atendimento', color: 'text-amber-600 bg-amber-100' },
  completed: { label: 'Finalizado', color: 'text-emerald-600 bg-emerald-100' },
}

export default function ReceptionView({ appointments, professionals }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [filter, setFilter] = useState<'all' | 'waiting' | 'checked_in'>('all')
  const [loadingId, setLoadingId] = useState<string | null>(null)

  // Estatísticas
  const stats = {
    total: appointments.length,
    waiting: appointments.filter(a => !a.checked_in_at && ['scheduled', 'confirmed'].includes(a.status)).length,
    checkedIn: appointments.filter(a => a.checked_in_at && a.status !== 'completed').length,
    inProgress: appointments.filter(a => a.status === 'in_progress').length,
    completed: appointments.filter(a => a.status === 'completed').length,
  }

  // Filtrar agendamentos
  const filteredAppointments = appointments.filter(apt => {
    if (filter === 'waiting') return !apt.checked_in_at && ['scheduled', 'confirmed'].includes(apt.status)
    if (filter === 'checked_in') return apt.checked_in_at && apt.status !== 'completed'
    return apt.status !== 'completed'
  })

  // Registrar check-in
  async function handleCheckIn(appointmentId: string) {
    setLoadingId(appointmentId)
    
    // Buscar dados do agendamento para a notificação
    const apt = appointments.find(a => a.id === appointmentId)
    
    const { error } = await supabase
      .from('appointments')
      .update({ 
        checked_in_at: new Date().toISOString(),
        status: 'confirmed'
      })
      .eq('id', appointmentId)
    
    if (!error && apt?.professional_id) {
      // Enviar notificação para o profissional
      await supabase.from('notifications').insert({
        clinic_id: apt.patients?.id ? undefined : undefined, // será pego pela RLS
        user_id: apt.professional_id,
        type: 'check_in',
        title: `${apt.patients?.name || 'Paciente'} chegou!`,
        message: `Agendamento das ${new Date(apt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - ${apt.procedures?.name || 'Consulta'}`,
        link: `/dashboard/atendimento/${appointmentId}`
      })
      
      router.refresh()
    }
    setLoadingId(null)
  }

  // Iniciar atendimento
  async function handleStartAttendance(appointmentId: string) {
    setLoadingId(appointmentId)
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'in_progress' })
      .eq('id', appointmentId)
    
    if (!error) {
      router.refresh()
    }
    setLoadingId(null)
  }

  // Calcular tempo de espera
  function getWaitTime(checkedInAt: string): string {
    const diff = Date.now() - new Date(checkedInAt).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}min`
  }

  // Verificar se está atrasado (mais de 15 min de espera)
  function isLateWait(checkedInAt: string): boolean {
    const diff = Date.now() - new Date(checkedInAt).getTime()
    return diff > 15 * 60 * 1000
  }

  const now = new Date()
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Icon name="users" className="w-6 h-6 text-violet-500" />
            Recepção
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Hoje, {now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} • {timeStr}
          </p>
        </div>
        <Link href="/dashboard/agenda/novo" className="btn-primary w-auto px-4 flex items-center gap-2">
          <Icon name="plus" className="w-4 h-4" />
          Novo Agendamento
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center">
              <Icon name="calendar" className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              <p className="text-xs text-slate-500">Total hoje</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setFilter('waiting')}
          className={`card p-4 text-left transition-all ${filter === 'waiting' ? 'ring-2 ring-amber-400' : 'hover:bg-slate-50'}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Icon name="clock" className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.waiting}</p>
              <p className="text-xs text-slate-500">Aguardando</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setFilter('checked_in')}
          className={`card p-4 text-left transition-all ${filter === 'checked_in' ? 'ring-2 ring-emerald-400' : 'hover:bg-slate-50'}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <Icon name="userCheck" className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.checkedIn}</p>
              <p className="text-xs text-slate-500">Na clínica</p>
            </div>
          </div>
        </button>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
              <Icon name="activity" className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.inProgress}</p>
              <p className="text-xs text-slate-500">Em atendimento</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'all' 
              ? 'bg-violet-100 text-violet-700' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Todos
        </button>
        <button
          onClick={() => setFilter('waiting')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'waiting' 
              ? 'bg-amber-100 text-amber-700' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Aguardando chegada
        </button>
        <button
          onClick={() => setFilter('checked_in')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'checked_in' 
              ? 'bg-emerald-100 text-emerald-700' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Na clínica
        </button>
      </div>

      {/* Lista de agendamentos */}
      <div className="card overflow-hidden">
        {filteredAppointments.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Icon name="users" className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-600 font-medium">
              {filter === 'waiting' && 'Nenhum paciente aguardando'}
              {filter === 'checked_in' && 'Nenhum paciente na clínica'}
              {filter === 'all' && 'Nenhum agendamento para hoje'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredAppointments.map(apt => {
              const statusInfo = STATUS_LABELS[apt.status] || STATUS_LABELS.scheduled
              const isPatientIncomplete = apt.patients && (!apt.patients.cpf || !apt.patients.birth_date)
              const aptTime = new Date(apt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
              const isLoading = loadingId === apt.id
              const waitTime = apt.checked_in_at ? getWaitTime(apt.checked_in_at) : null
              const isLate = apt.checked_in_at ? isLateWait(apt.checked_in_at) : false

              return (
                <div
                  key={apt.id}
                  className={`p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors ${
                    apt.checked_in_at && apt.status !== 'in_progress' ? 'bg-emerald-50/50' : ''
                  } ${apt.status === 'in_progress' ? 'bg-amber-50/50' : ''}`}
                >
                  {/* Horário */}
                  <div className="w-16 text-center flex-shrink-0">
                    <p className="text-lg font-bold text-slate-900">{aptTime}</p>
                    {apt.checked_in_at && (
                      <p className={`text-xs font-medium ${isLate ? 'text-red-500' : 'text-emerald-600'}`}>
                        {isLate ? '⚠️ ' : '✓ '}{waitTime}
                      </p>
                    )}
                  </div>

                  {/* Avatar */}
                  <div className="relative">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                      apt.checked_in_at 
                        ? 'bg-gradient-to-br from-emerald-500 to-teal-500' 
                        : 'bg-gradient-to-br from-slate-400 to-slate-500'
                    }`}>
                      {apt.patients?.name?.charAt(0) || '?'}
                    </div>
                    {apt.checked_in_at && (
                      <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white">
                        <Icon name="check" className="w-3 h-3 text-white" />
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900 truncate">{apt.patients?.name || 'Paciente'}</p>
                      {isPatientIncomplete && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                          Cadastro pendente
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 truncate">
                      {apt.procedures?.name || 'Consulta'} • {apt.professional?.name || 'Sem profissional'}
                    </p>
                    {apt.patients?.phone && (
                      <p className="text-xs text-slate-400">{apt.patients.phone}</p>
                    )}
                  </div>

                  {/* Status */}
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>

                  {/* Ações */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!apt.checked_in_at && ['scheduled', 'confirmed'].includes(apt.status) && (
                      <button
                        onClick={() => handleCheckIn(apt.id)}
                        disabled={isLoading}
                        className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold rounded-lg hover:from-emerald-600 hover:to-teal-600 transition-all flex items-center gap-2 shadow-md disabled:opacity-50"
                      >
                        {isLoading ? (
                          <Icon name="loader" className="w-4 h-4 animate-spin" />
                        ) : (
                          <Icon name="userCheck" className="w-4 h-4" />
                        )}
                        Check-in
                      </button>
                    )}

                    {apt.checked_in_at && apt.status === 'confirmed' && (
                      <button
                        onClick={() => handleStartAttendance(apt.id)}
                        disabled={isLoading}
                        className="px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white text-sm font-semibold rounded-lg hover:from-violet-600 hover:to-purple-600 transition-all flex items-center gap-2 shadow-md disabled:opacity-50"
                      >
                        {isLoading ? (
                          <Icon name="loader" className="w-4 h-4 animate-spin" />
                        ) : (
                          <Icon name="play" className="w-4 h-4" />
                        )}
                        Iniciar
                      </button>
                    )}

                    {apt.status === 'in_progress' && (
                      <Link
                        href={`/dashboard/atendimento/${apt.id}`}
                        className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all flex items-center gap-2 shadow-md"
                      >
                        <Icon name="activity" className="w-4 h-4" />
                        Ver atendimento
                      </Link>
                    )}

                    <Link
                      href={`/dashboard/atendimento/${apt.id}`}
                      className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                      title="Ver detalhes"
                    >
                      <Icon name="eye" className="w-5 h-5" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Finalizados do dia */}
      {stats.completed > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-slate-500 mb-3 flex items-center gap-2">
            <Icon name="check" className="w-4 h-4" />
            Finalizados hoje ({stats.completed})
          </h2>
          <div className="card overflow-hidden opacity-75">
            <div className="divide-y divide-slate-100">
              {appointments.filter(a => a.status === 'completed').map(apt => {
                const aptTime = new Date(apt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                return (
                  <div key={apt.id} className="p-3 flex items-center gap-4 bg-slate-50">
                    <span className="text-sm font-medium text-slate-500 w-12">{aptTime}</span>
                    <span className="text-sm text-slate-600 truncate flex-1">{apt.patients?.name}</span>
                    <span className="text-xs text-slate-400">{apt.procedures?.name}</span>
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                      ✓ Finalizado
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
