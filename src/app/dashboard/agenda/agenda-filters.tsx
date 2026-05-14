'use client'

import { useState, useRef, useEffect } from 'react'
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

const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DAY_NAMES = ['D','S','T','Q','Q','S','S']

export default function AgendaFilters({ currentDate, currentView, currentProfessional, currentStatus, professionals }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showPicker, setShowPicker] = useState(false)
  const [pickerMonth, setPickerMonth] = useState(() => {
    const d = new Date(currentDate + 'T12:00:00')
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const pickerRef = useRef<HTMLDivElement>(null)

  // Fecha ao clicar fora — delay de 50ms evita capturar o mesmo clique que abriu
  useEffect(() => {
    if (!showPicker) return
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false)
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick)
    }, 50)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [showPicker])

  function updateParams(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set(key, value)
    router.push(`/dashboard/agenda?${params.toString()}`)
  }

  function navigateDate(direction: 'prev' | 'next') {
    const date = new Date(currentDate + 'T12:00:00')
    if (currentView === 'day') date.setDate(date.getDate() + (direction === 'next' ? 1 : -1))
    else if (currentView === 'week') date.setDate(date.getDate() + (direction === 'next' ? 7 : -7))
    else date.setMonth(date.getMonth() + (direction === 'next' ? 1 : -1))
    updateParams('date', date.toISOString().split('T')[0])
  }

  function goToToday() {
    updateParams('date', todayBR())
  }

  function selectDay(day: number) {
    const iso = `${pickerMonth.year}-${String(pickerMonth.month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    updateParams('date', iso)
    setShowPicker(false)
  }

  function prevPickerMonth() {
    setPickerMonth(p => {
      if (p.month === 0) return { year: p.year - 1, month: 11 }
      return { year: p.year, month: p.month - 1 }
    })
  }

  function nextPickerMonth() {
    setPickerMonth(p => {
      if (p.month === 11) return { year: p.year + 1, month: 0 }
      return { year: p.year, month: p.month + 1 }
    })
  }

  // Gerar dias do mês do picker
  const firstDay = new Date(pickerMonth.year, pickerMonth.month, 1).getDay()
  const totalDays = new Date(pickerMonth.year, pickerMonth.month + 1, 0).getDate()
  const pickerDays: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1)
  ]
  while (pickerDays.length % 7 !== 0) pickerDays.push(null)

  const selectedDay = (() => {
    const d = new Date(currentDate + 'T12:00:00')
    return d.getFullYear() === pickerMonth.year && d.getMonth() === pickerMonth.month
      ? d.getDate() : null
  })()

  const todayDate = new Date()
  const todayMark = todayDate.getFullYear() === pickerMonth.year && todayDate.getMonth() === pickerMonth.month
    ? todayDate.getDate() : null

  const formatDateDisplay = () => {
    const date = new Date(currentDate + 'T12:00:00')
    if (currentView === 'day') {
      return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
    } else if (currentView === 'week') {
      const start = new Date(date)
      start.setDate(start.getDate() - start.getDay())
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
        {/* Navegação de data + calendário mini */}
        <div className="flex items-center gap-2 relative" ref={pickerRef}>
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

          {/* Data clicável que abre o calendário mini */}
          <button
            onClick={() => {
              const d = new Date(currentDate + 'T12:00:00')
              setPickerMonth({ year: d.getFullYear(), month: d.getMonth() })
              setShowPicker(v => !v)
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors group ml-1"
          >
            <span className="text-sm font-semibold text-slate-900 capitalize">
              {formatDateDisplay()}
            </span>
            <Icon name="chevronDown" className={`w-4 h-4 text-slate-400 transition-transform ${showPicker ? 'rotate-180' : ''}`} />
          </button>

          {/* Calendário mini dropdown */}
          {showPicker && (
            <div className="absolute top-full left-0 mt-2 z-50 bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 w-72 animate-in fade-in slide-in-from-top-2 duration-150">
              {/* Header do mês */}
              <div className="flex items-center justify-between mb-3">
                <button onClick={prevPickerMonth} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors">
                  <Icon name="chevronLeft" className="w-4 h-4 text-slate-600" />
                </button>
                <span className="text-sm font-semibold text-slate-900">
                  {MONTH_NAMES[pickerMonth.month]} {pickerMonth.year}
                </span>
                <button onClick={nextPickerMonth} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors">
                  <Icon name="chevronRight" className="w-4 h-4 text-slate-600" />
                </button>
              </div>

              {/* Dias da semana */}
              <div className="grid grid-cols-7 mb-1">
                {DAY_NAMES.map((d, i) => (
                  <div key={i} className="text-center text-xs font-semibold text-slate-400 py-1">{d}</div>
                ))}
              </div>

              {/* Grade de dias */}
              <div className="grid grid-cols-7 gap-0.5">
                {pickerDays.map((day, idx) => {
                  if (!day) return <div key={idx} />
                  const isSelected = day === selectedDay
                  const isToday = day === todayMark
                  return (
                    <button
                      key={idx}
                      onClick={() => selectDay(day)}
                      className={`h-9 w-full rounded-lg text-sm font-medium transition-all ${
                        isSelected
                          ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md shadow-violet-200'
                          : isToday
                          ? 'bg-violet-50 text-violet-700 font-bold ring-1 ring-violet-300'
                          : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>

              {/* Atalho "hoje" dentro do picker */}
              <div className="mt-3 pt-3 border-t border-slate-100">
                <button
                  onClick={() => { goToToday(); setShowPicker(false) }}
                  className="w-full py-2 text-xs font-medium text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                >
                  Ir para hoje
                </button>
              </div>
            </div>
          )}
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
          <option value="pending_confirmation">Aguard. confirmação</option>
          <option value="confirmed">Confirmados</option>
          <option value="in_progress">Em atendimento</option>
          <option value="completed">Realizados</option>
          <option value="cancelled">Cancelados</option>
          <option value="no_show">Faltantes</option>
        </select>
      </div>
    </div>
  )
}
