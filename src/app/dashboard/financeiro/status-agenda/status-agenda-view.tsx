'use client'

import { useMemo, useState } from 'react'
import Icon from '@/components/ui/Icon'

type Appointment = {
  id: string
  start_time: string
  status: string
  patients: { name: string } | null
  professional: { id: string; name: string } | null
  procedures: { name: string } | null
}

type StatusKey = 'agendado' | 'confirmed' | 'completed' | 'no_show' | 'cancelled' | 'rescheduling'

const STATUS_MAP: Record<StatusKey, { label: string; icon: string; color: string; bg: string; border: string; statuses: string[] }> = {
  agendado: {
    label: 'Agendado',
    icon: 'calendar',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    statuses: ['scheduled', 'pending_confirmation'],
  },
  confirmed: {
    label: 'Confirmado',
    icon: 'check',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    statuses: ['confirmed'],
  },
  completed: {
    label: 'Realizado',
    icon: 'award',
    color: 'text-violet-700',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    statuses: ['completed'],
  },
  no_show: {
    label: 'Faltou',
    icon: 'alertCircle',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    statuses: ['no_show'],
  },
  cancelled: {
    label: 'Cancelado',
    icon: 'trash',
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    statuses: ['cancelled'],
  },
  rescheduling: {
    label: 'Aguardando reagendamento',
    icon: 'refresh',
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    statuses: ['rescheduling'],
  },
}

function fmtDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function StatusAgendaView({ appointments }: { appointments: Appointment[] }) {
  const [filtro, setFiltro] = useState<StatusKey | null>(null)

  const total = appointments.length

  const counts = useMemo(() => {
    const out = {} as Record<StatusKey, number>
    ;(Object.keys(STATUS_MAP) as StatusKey[]).forEach((k) => {
      out[k] = appointments.filter((a) => STATUS_MAP[k].statuses.includes(a.status)).length
    })
    return out
  }, [appointments])

  const listaFiltrada = useMemo(() => {
    if (!filtro) return appointments
    return appointments.filter((a) => STATUS_MAP[filtro].statuses.includes(a.status))
  }, [appointments, filtro])

  if (total === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-slate-500">Nenhum agendamento no período selecionado</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cards por status */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {(Object.keys(STATUS_MAP) as StatusKey[]).map((k) => {
          const cfg = STATUS_MAP[k]
          const count = counts[k]
          const pct = total > 0 ? Math.round((count / total) * 100) : 0
          const isActive = filtro === k
          return (
            <button
              key={k}
              onClick={() => setFiltro(isActive ? null : k)}
              className={`text-left rounded-2xl p-4 border shadow-sm transition ${cfg.bg} ${
                isActive ? `${cfg.border} ring-2 ring-offset-1 ring-violet-300` : 'border-slate-100 hover:border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon name={cfg.icon as any} className={`w-4 h-4 ${cfg.color}`} />
                <span className={`text-xs font-semibold ${cfg.color}`}>{pct}%</span>
              </div>
              <p className={`text-2xl font-black ${cfg.color}`}>{count}</p>
              <p className="text-xs text-slate-500 mt-0.5">{cfg.label}</p>
            </button>
          )
        })}
      </div>

      {filtro && (
        <button onClick={() => setFiltro(null)} className="text-sm text-violet-600 font-medium hover:underline">
          ← Limpar filtro ({STATUS_MAP[filtro].label})
        </button>
      )}

      {/* Tabela */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              {['Data', 'Paciente', 'Profissional', 'Procedimento', 'Status'].map((h) => (
                <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-slate-400">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {listaFiltrada.map((a) => {
              const statusKey = (Object.keys(STATUS_MAP) as StatusKey[]).find((k) => STATUS_MAP[k].statuses.includes(a.status))
              const cfg = statusKey ? STATUS_MAP[statusKey] : null
              return (
                <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-2.5 px-3 text-slate-600">{fmtDateTime(a.start_time)}</td>
                  <td className="py-2.5 px-3 font-medium text-slate-900">{a.patients?.name || '—'}</td>
                  <td className="py-2.5 px-3 text-slate-600">{a.professional?.name || '—'}</td>
                  <td className="py-2.5 px-3 text-slate-600">{a.procedures?.name || '—'}</td>
                  <td className="py-2.5 px-3">
                    {cfg && (
                      <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
