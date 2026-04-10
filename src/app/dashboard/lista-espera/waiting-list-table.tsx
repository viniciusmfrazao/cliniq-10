'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'

type WaitingItem = {
  id: string
  patient_id: string
  procedure_id: string | null
  professional_id: string | null
  preferred_period: string | null
  preferred_days: string[] | null
  priority: string
  status: string
  notes: string | null
  created_at: string
  contacted_at: string | null
  patients: { id: string; name: string; phone: string | null; email: string | null }
  procedures: { id: string; name: string } | null
  users: { id: string; name: string } | null
}

type Props = {
  waitingList: WaitingItem[]
  patients: { id: string; name: string }[]
  procedures: { id: string; name: string }[]
  professionals: { id: string; name: string }[]
  clinicId: string
}

const PRIORITY_COLORS: Record<string, string> = {
  baixa: 'bg-slate-100 text-slate-600',
  normal: 'bg-blue-100 text-blue-700',
  alta: 'bg-amber-100 text-amber-700',
  urgente: 'bg-red-100 text-red-700',
}

const PRIORITY_LABELS: Record<string, string> = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
}

const STATUS_COLORS: Record<string, string> = {
  aguardando: 'bg-amber-100 text-amber-700',
  contatado: 'bg-blue-100 text-blue-700',
  agendado: 'bg-emerald-100 text-emerald-700',
  cancelado: 'bg-slate-100 text-slate-500',
}

const STATUS_LABELS: Record<string, string> = {
  aguardando: 'Aguardando',
  contatado: 'Contatado',
  agendado: 'Agendado',
  cancelado: 'Cancelado',
}

export default function WaitingListTable({ waitingList, patients, procedures, professionals, clinicId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState<string | null>(null)
  const [filter, setFilter] = useState<'todos' | 'aguardando' | 'contatado'>('todos')

  const filteredList = waitingList.filter(item => {
    if (filter === 'todos') return true
    return item.status === filter
  })

  const markAsContacted = async (id: string) => {
    setLoading(id)
    await supabase
      .from('waiting_list')
      .update({ status: 'contatado', contacted_at: new Date().toISOString() })
      .eq('id', id)
    router.refresh()
    setLoading(null)
  }

  const schedulePatient = async (item: WaitingItem) => {
    const params = new URLSearchParams({
      patient: item.patient_id,
      ...(item.procedure_id && { procedure: item.procedure_id }),
      ...(item.professional_id && { professional: item.professional_id }),
      waiting_list_id: item.id,
    })
    router.push(`/dashboard/agenda/novo?${params.toString()}`)
  }

  const cancelItem = async (id: string) => {
    if (!confirm('Remover este paciente da lista de espera?')) return
    setLoading(id)
    await supabase
      .from('waiting_list')
      .update({ status: 'cancelado' })
      .eq('id', id)
    router.refresh()
    setLoading(null)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    })
  }

  const formatDaysAgo = (date: string) => {
    const days = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
    if (days === 0) return 'Hoje'
    if (days === 1) return 'Ontem'
    return `${days} dias`
  }

  return (
    <div>
      {/* Filtros */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex gap-2">
          {(['todos', 'aguardando', 'contatado'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-violet-100 text-violet-700'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {f === 'todos' ? 'Todos' : STATUS_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {filteredList.length === 0 ? (
        <div className="p-8 text-center">
          <Icon name="users" className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Nenhum paciente na lista de espera</p>
          <Link href="/dashboard/lista-espera/novo" className="text-violet-600 text-sm font-medium hover:underline mt-2 inline-block">
            Adicionar paciente
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {filteredList.map(item => (
            <div key={item.id} className="p-4 hover:bg-slate-50 transition-colors">
              <div className="flex items-start justify-between gap-4">
                {/* Info do paciente */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link 
                      href={`/dashboard/pacientes/${item.patient_id}`}
                      className="font-semibold text-slate-900 hover:text-violet-600"
                    >
                      {item.patients.name}
                    </Link>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[item.priority]}`}>
                      {PRIORITY_LABELS[item.priority]}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[item.status]}`}>
                      {STATUS_LABELS[item.status]}
                    </span>
                  </div>
                  
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                    {item.procedures && (
                      <span className="flex items-center gap-1">
                        <Icon name="clipboard" className="w-3.5 h-3.5" />
                        {item.procedures.name}
                      </span>
                    )}
                    {item.users && (
                      <span className="flex items-center gap-1">
                        <Icon name="user" className="w-3.5 h-3.5" />
                        {item.users.name}
                      </span>
                    )}
                    {item.preferred_period && (
                      <span className="flex items-center gap-1">
                        <Icon name="clock" className="w-3.5 h-3.5" />
                        {item.preferred_period === 'manha' ? 'Manhã' : 
                         item.preferred_period === 'tarde' ? 'Tarde' : 
                         item.preferred_period === 'noite' ? 'Noite' : 'Qualquer horário'}
                      </span>
                    )}
                  </div>

                  {item.notes && (
                    <p className="mt-2 text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                      {item.notes}
                    </p>
                  )}

                  <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
                    <span>Adicionado em {formatDate(item.created_at)} ({formatDaysAgo(item.created_at)})</span>
                    {item.contacted_at && (
                      <span>Contatado em {formatDate(item.contacted_at)}</span>
                    )}
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2">
                  {item.patients.phone && (
                    <a
                      href={`https://wa.me/55${item.patients.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                      title="WhatsApp"
                    >
                      <Icon name="message" className="w-4 h-4" />
                    </a>
                  )}
                  
                  {item.status === 'aguardando' && (
                    <button
                      onClick={() => markAsContacted(item.id)}
                      disabled={loading === item.id}
                      className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                      title="Marcar como contatado"
                    >
                      <Icon name="phone" className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={() => schedulePatient(item)}
                    className="p-2 rounded-lg bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors"
                    title="Agendar"
                  >
                    <Icon name="calendar" className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => cancelItem(item.id)}
                    disabled={loading === item.id}
                    className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                    title="Remover da lista"
                  >
                    <Icon name="x" className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
