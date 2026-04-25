'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import { todayBR } from '@/lib/datetime'

type Props = {
  currentDate: string
  currentView: string
  currentProfessional: string
  currentStatus: string
  professionals: { id: string; name: string }[]
}

export default function AgendaFilters({ currentDate, currentView, currentProfessional, currentStatus, professionals }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function updateParams(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set(key, value)
    router.push(`/dashboard/agenda?${params.toString()}`)
  }

  function navigateDate(direction: 'prev' | 'next') {
    const date = new Date(currentDate)
    
    if (currentView === 'day') {
      date.setDate(date.getDate() + (direction === 'next' ? 1 : -1))
    } else if (currentView === 'week') {
      date.setDate(date.getDate() + (direction === 'next' ? 7 : -7))
    } else {
      date.setMonth(date.getMonth() + (direction === 'next' ? 1 : -1))
    }
    
    updateParams('date', date.toISOString().split('T')[0])
  }

  function goToToday() {
    updateParams('date', todayBR())
  }

  const formatDateDisplay = () => {
    const date = new Date(currentDate + 'T12:00:00')
    
    if (currentView === 'day') {
      return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
    } else if (currentView === 'week') {
      const start = new Date(date)
      const dayOfWeek = start.getDay()
      start.setDate(start.getDate() - dayOfWeek)
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      return `${start.getDate()} - ${end.getDate()} de ${end.toLocaleDateString('pt-BR', { month: 'long' })}`
    } else {
      return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    }
  }

  return (
    <div className="card p-4 mb-6">
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        {/* Navegacao de data */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateDate('prev')}
            className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
          >
            <Icon name="chevronLeft" className="w-5 h-5 text-slate-600" />
          </button>
          <button
            onClick={goToToday}
            className="px-4 py-2 rounded-xl bg-slate-100 text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Hoje
          </button>
          <button
            onClick={() => navigateDate('next')}
            className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
          >
            <Icon name="chevronRight" className="w-5 h-5 text-slate-600" />
          </button>
          <span className="text-sm font-semibold text-slate-900 capitalize ml-2">
            {formatDateDisplay()}
          </span>
        </div>

        <div className="flex-1" />

        {/* Seletor de view */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
          {[
            { id: 'day', label: 'Dia', icon: 'calendar' },
            { id: 'week', label: 'Semana', icon: 'grid' },
            { id: 'month', label: 'Mes', icon: 'layers' },
          ].map(view => (
            <button
              key={view.id}
              onClick={() => updateParams('view', view.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                currentView === view.id
                  ? 'gradient-bg text-white shadow-lg'
                  : 'text-slate-600 hover:bg-white'
              }`}
            >
              <Icon name={view.icon} className="w-4 h-4" />
              <span className="hidden md:inline">{view.label}</span>
            </button>
          ))}
        </div>

        {/* Filtro de profissional */}
        <select
          value={currentProfessional}
          onChange={e => updateParams('professional', e.target.value)}
          className="input w-auto min-w-[180px]"
        >
          <option value="all">Todos os profissionais</option>
          {professionals.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {/* Filtro de status */}
        <select
          value={currentStatus}
          onChange={e => updateParams('status', e.target.value)}
          className="input w-auto min-w-[150px]"
        >
          <option value="all">Todos status</option>
          <option value="scheduled">Agendados</option>
          <option value="confirmed">Confirmados</option>
          <option value="completed">Realizados</option>
          <option value="cancelled">Cancelados</option>
          <option value="no_show">Faltantes</option>
        </select>
      </div>
    </div>
  )
}
