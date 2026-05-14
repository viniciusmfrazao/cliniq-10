'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
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
  const triggerRef = useRef<HTMLButtonElement>(null)
  const pickerDropdownRef = useRef<HTMLDivElement>(null)

  // Quando currentDate muda via setas, não fecha o picker — só atualiza o mês exibido
  useEffect(() => {
    if (showPicker) {
      const d = new Date(currentDate + 'T12:00:00')
      setPickerMonth({ year: d.getFullYear(), month: d.getMonth() })
    }
  }, [currentDate]) // eslint-disable-line

  // Fecha ao clicar fora — monitora trigger + dropdown separadamente
  useEffect(() => {
    if (!showPicker) return
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      const inTrigger = triggerRef.current?.contains(target)
      const inDropdown = pickerDropdownRef.current?.contains(target)
      if (!inTrigger && !inDropdown) {
        setShowPicker(false)
      }
    }
    // Timeout pra não capturar o clique que abriu
    const t = setTimeout(() => document.addEventListener('mousedown', handleClick), 10)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handleClick) }
  }, [showPicker])

  const buildUrl = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([k, v]) => params.set(k, v))
    return `/dashboard/agenda?${params.toString()}`
  }, [searchParams])

  function updateParams(key: string, value: string) {
    router.push(buildUrl({ [key]: value }))
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
    router.push(buildUrl({ date: iso, view: 'day' }))
    setShowPicker(false)
  }

  function prevPickerMonth(e: React.MouseEvent) {
    e.stopPropagation()
    setPickerMonth(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { year: p.year, month: p.month - 1 })
  }

  function nextPickerMonth(e: React.MouseEvent) {
    e.stopPropagation()
    setPickerMonth(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { year: p.year, month: p.month + 1 })
  }

  // Grade do picker
  const firstDay = new Date(pickerMonth.year, pickerMonth.month, 1).getDay()
  const totalDays = new Date(pickerMonth.year, pickerMonth.month + 1, 0).getDate()
  const pickerDays: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1)
  ]
  while (pickerDays.length % 7 !== 0) pickerDays.push(null)

  const selectedDay = (() => {
    const d = new Date(currentDate + 'T12:00:00')
    return d.getFullYear() === pickerMonth.year && d.getMonth() === pickerMonth.month ? d.getDate() : null
  })()

  const todayObj = new Date()
  const todayMark = todayObj.getFullYear() === pickerMonth.year && todayObj.getMonth() === pickerMonth.month
    ? todayObj.getDate() : null

  const formatDateDisplay = () => {
    const date = new Date(currentDate + 'T12:00:00')
    if (currentView === 'day') return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
    if (currentView === 'week') {
      const start = new Date(date)
      start.setDate(start.getDate() - start.getDay())
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      return `${start.getDate()} - ${end.getDate()} de ${end.toLocaleDateString('pt-BR', { month: 'long' })}`
    }
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  }

  return (
    <div className="card p-4 mb-6">
      <div className="flex flex-col md:flex-row md:items-center gap-4">

        {/* Navegação de data */}
        <div className="flex items-center gap-2">
          <button onClick={() => navigateDate('prev')} className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
            <Icon name="chevronLeft" className="w-5 h-5 text-slate-600" />
          </button>
          <button onClick={goToToday} className="px-4 py-2 rounded-xl bg-slate-100 text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors">
            Hoje
          </button>
          <button onClick={() => navigateDate('next')} className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
            <Icon name="chevronRight" className="w-5 h-5 text-slate-600" />
          </button>

          {/* Botão data — abre picker */}
          <div className="relative">
            <button
              ref={triggerRef}
              onClick={() => setShowPicker(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <span className="text-sm font-semibold text-slate-900 capitalize">{formatDateDisplay()}</span>
              <Icon name="chevronDown" className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showPicker ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown do picker — separado do trigger pra evitar conflito de ref */}
            {showPicker && (
              <div
                ref={pickerDropdownRef}
                className="absolute top-full left-0 mt-2 z-50 bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 w-72"
                style={{ animation: 'fadeSlideDown 0.15s ease' }}
              >
                {/* Header mês */}
                <div className="flex items-center justify-between mb-3">
                  <button
                    onMouseDown={e => e.stopPropagation()}
                    onClick={prevPickerMonth}
                    className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
                  >
                    <Icon name="chevronLeft" className="w-4 h-4 text-slate-600" />
                  </button>
                  <span className="text-sm font-semibold text-slate-900">
                    {MONTH_NAMES[pickerMonth.month]} {pickerMonth.year}
                  </span>
                  <button
                    onMouseDown={e => e.stopPropagation()}
                    onClick={nextPickerMonth}
                    className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
                  >
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
                    const isSel = day === selectedDay
                    const isToday = day === todayMark
                    return (
                      <button
                        key={idx}
                        onMouseDown={e => e.stopPropagation()}
                        onClick={() => selectDay(day)}
                        className={`h-9 w-full rounded-lg text-sm font-medium transition-all ${
                          isSel
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

                {/* Ir para hoje */}
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <button
                    onMouseDown={e => e.stopPropagation()}
                    onClick={() => { goToToday(); setShowPicker(false) }}
                    className="w-full py-2 text-xs font-medium text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                  >
                    Ir para hoje
                  </button>
                </div>
              </div>
            )}
          </div>
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
                currentView === view.id ? 'gradient-bg text-white shadow-lg' : 'text-slate-600 hover:bg-white'
              }`}
            >
              <Icon name={view.icon} className="w-4 h-4" />
              <span className="hidden md:inline">{view.label}</span>
            </button>
          ))}
        </div>

        {/* Filtro profissional */}
        <select value={currentProfessional} onChange={e => updateParams('professional', e.target.value)} className="input w-auto min-w-[180px]">
          <option value="all">Todos os profissionais</option>
          {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        {/* Filtro status */}
        <select value={currentStatus} onChange={e => updateParams('status', e.target.value)} className="input w-auto min-w-[150px]">
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

      <style jsx>{`
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
