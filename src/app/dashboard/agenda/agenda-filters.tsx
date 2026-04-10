'use client'

import { useRouter } from 'next/navigation'

type Professional = { id: string; name: string; role: string }
type Room = { id: string; name: string; color: string }

type Props = {
  selectedDate: string
  professionals: Professional[]
  rooms: Room[]
  currentProfessional?: string
  currentRoom?: string
}

export default function AgendaFilters({ 
  selectedDate, 
  professionals, 
  rooms, 
  currentProfessional, 
  currentRoom 
}: Props) {
  const router = useRouter()

  function updateFilters(params: Record<string, string>) {
    const searchParams = new URLSearchParams()
    searchParams.set('date', params.date || selectedDate)
    if (params.professional || currentProfessional) {
      searchParams.set('professional', params.professional || currentProfessional || '')
    }
    if (params.room || currentRoom) {
      searchParams.set('room', params.room || currentRoom || '')
    }
    // Remove parametros vazios
    if (!searchParams.get('professional')) searchParams.delete('professional')
    if (!searchParams.get('room')) searchParams.delete('room')
    
    router.push(`/dashboard/agenda?${searchParams.toString()}`)
  }

  function goToDay(offset: number) {
    const date = new Date(selectedDate + 'T12:00:00')
    date.setDate(date.getDate() + offset)
    updateFilters({ date: date.toISOString().split('T')[0] })
  }

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <div className="flex items-center gap-2">
        <button 
          onClick={() => goToDay(-1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50"
        >
          ←
        </button>
        <input
          type="date"
          className="input w-auto"
          value={selectedDate}
          onChange={e => updateFilters({ date: e.target.value })}
        />
        <button 
          onClick={() => goToDay(1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50"
        >
          →
        </button>
        <button 
          onClick={() => updateFilters({ date: new Date().toISOString().split('T')[0] })}
          className="text-xs text-brand-600 font-medium px-2"
        >
          Hoje
        </button>
      </div>

      <div className="flex gap-2 ml-auto">
        <select
          className="input w-auto text-sm"
          value={currentProfessional || ''}
          onChange={e => updateFilters({ professional: e.target.value })}
        >
          <option value="">Todos profissionais</option>
          {professionals.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {rooms.length > 0 && (
          <select
            className="input w-auto text-sm"
            value={currentRoom || ''}
            onChange={e => updateFilters({ room: e.target.value })}
          >
            <option value="">Todas salas</option>
            {rooms.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  )
}
