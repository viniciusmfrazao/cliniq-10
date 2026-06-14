'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
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
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 })
  const [pickerMonth, setPickerMonth] = useState(() => {
    const d = new Date(currentDate + 'T12:00:00')
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const pickerDropdownRef = useRef<HTMLDivElement>(null)

  // Multi-select de profissionais
  const [showProfPicker, setShowProfPicker] = useState(false)
  const profPickerRef = useRef<HTMLDivElement>(null)
  const profTriggerRef = useRef<HTMLButtonElement>(null)

  // Parse dos IDs selecionados a partir da URL (?professional=id1,id2 ou 'all')
  const selectedProfIds: string[] = currentProfessional === 'all'
    ? []
    : currentProfessional.split(',').filter(Boolean)

  const allSelected = selectedProfIds.length === 0

  // Persistir filtros no localStorage
  const STORAGE_KEY = 'agenda_filters'
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    const params = new URLSearchParams(window.location.search)
    const hasProfParam = params.has('professional')
    const hasViewParam = params.has('view')
    const hasStatusParam = params.has('status')
    // Só restaura se não há nenhum parâmetro na URL (navegação limpa)
    if (!hasProfParam && !hasViewParam && !hasStatusParam && saved) {
      try {
        const { professional, view, status } = JSON.parse(saved)
        const updates: Record<string, string> = {}
        if (professional && professional !== 'all') updates.professional = professional
        if (view && view !== 'day') updates.view = view
        if (status && status !== 'all') updates.status = status
        if (Object.keys(updates).length > 0) {
          const newParams = new URLSearchParams(params.toString())
          Object.entries(updates).forEach(([k, v]) => newParams.set(k, v))
          router.replace(`/dashboard/agenda?${newParams.toString()}`)
        }
      } catch {}
    }
  }, []) // eslint-disable-line

  // Salvar filtros sempre que mudarem
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      professional: currentProfessional,
      view: currentView,
      status: currentStatus,
    }))
  }, [currentProfessional, currentView, currentStatus])

  function toggleProf(id: string) {
    let next: string[]
    if (selectedProfIds.includes(id)) {
      next = selectedProfIds.filter(x => x !== id)
    } else {
      next = [...selectedProfIds, id]
    }
    // Se nenhum selecionado ou todos selecionados → 'all'
    const value = next.length === 0 || next.length === professionals.length ? 'all' : next.join(',')
    updateParams('professional', value)
  }

  function selectAllProfs() {
    updateParams('professional', 'all')
  }

  // Fecha prof picker ao clicar fora
  useEffect(() => {
    if (!showProfPicker) return
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      if (!profTriggerRef.current?.contains(target) && !profPickerRef.current?.contains(target)) {
        setShowProfPicker(false)
      }
    }
    const t = setTimeout(() => document.addEventListener('mousedown', handleClick), 10)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handleClick) }
  }, [showProfPicker])

  // Quando currentDate muda via setas, não fecha o picker
  useEffect(() => {
    if (showPicker) {
      const d = new Date(currentDate + 'T12:00:00')
      setPickerMonth({ year: d.getFullYear(), month: d.getMonth() })
    }
  }, [currentDate]) // eslint-disable-line

  useEffect(() => {
    if (!showPicker) return
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      const inTrigger = triggerRef.current?.contains(target)
      const inDropdown = pickerDropdownRef.current?.contains(target)
      if (!inTrigger && !inDropdown) setShowPicker(false)
    }
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

  // Label do botão de profissional
  const profButtonLabel = allSelected
    ? 'Todos'
    : selectedProfIds.length === 1
      ? (professionals.find(p => p.id === selectedProfIds[0])?.name?.split(' ')[0] || '1 profissional')
      : `${selectedProfIds.length} profissionais`

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
              onClick={() => {
                if (!showPicker && triggerRef.current) {
                  const rect = triggerRef.current.getBoundingClientRect()
                  const pickerW = 288
                  let left = rect.left + rect.width / 2 - pickerW / 2
                  left = Math.max(8, Math.min(left, window.innerWidth - pickerW - 8))
                  setPickerPos({ top: rect.bottom + 8, left })
                }
                setShowPicker(v => !v)
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <span className="text-sm font-semibold text-slate-900 capitalize">{formatDateDisplay()}</span>
              <Icon name="chevronDown" className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showPicker ? 'rotate-180' : ''}`} />
            </button>

            {showPicker && typeof document !== 'undefined' && createPortal(
              <div
                ref={pickerDropdownRef}
                className="fixed z-[9999] bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 w-72"
                style={{ top: pickerPos.top, left: pickerPos.left }}
              >
                <div className="flex items-center justify-between mb-3">
                  <button onMouseDown={e => e.stopPropagation()} onClick={prevPickerMonth} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors">
                    <Icon name="chevronLeft" className="w-4 h-4 text-slate-600" />
                  </button>
                  <span className="text-sm font-semibold text-slate-900">
                    {MONTH_NAMES[pickerMonth.month]} {pickerMonth.year}
                  </span>
                  <button onMouseDown={e => e.stopPropagation()} onClick={nextPickerMonth} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors">
                    <Icon name="chevronRight" className="w-4 h-4 text-slate-600" />
                  </button>
                </div>
                <div className="grid grid-cols-7 mb-1">
                  {DAY_NAMES.map((d, i) => (
                    <div key={i} className="text-center text-xs font-semibold text-slate-400 py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {(() => {
                    const firstDay = new Date(pickerMonth.year, pickerMonth.month, 1).getDay()
                    const totalDays = new Date(pickerMonth.year, pickerMonth.month + 1, 0).getDate()
                    const days: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: totalDays }, (_, i) => i + 1)]
                    while (days.length % 7 !== 0) days.push(null)
                    const selD = new Date(currentDate + 'T12:00:00')
                    const selectedDay = selD.getFullYear() === pickerMonth.year && selD.getMonth() === pickerMonth.month ? selD.getDate() : null
                    const todayObj = new Date()
                    const todayMark = todayObj.getFullYear() === pickerMonth.year && todayObj.getMonth() === pickerMonth.month ? todayObj.getDate() : null
                    return days.map((day, idx) => {
                      if (!day) return <div key={idx} />
                      const isSel = day === selectedDay
                      const isToday = day === todayMark
                      return (
                        <button
                          key={idx}
                          onMouseDown={e => e.stopPropagation()}
                          onClick={() => selectDay(day)}
                          className={`h-9 w-full rounded-lg text-sm font-medium transition-all ${
                            isSel ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md'
                            : isToday ? 'bg-violet-50 text-violet-700 font-bold ring-1 ring-violet-300'
                            : 'hover:bg-slate-100 text-slate-700'
                          }`}
                        >{day}</button>
                      )
                    })
                  })()}
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <button
                    onMouseDown={e => e.stopPropagation()}
                    onClick={() => { goToToday(); setShowPicker(false) }}
                    className="w-full py-2 text-xs font-medium text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                  >
                    Ir para hoje
                  </button>
                </div>
              </div>,
              document.body
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

        {/* Multi-select de profissionais */}
        {professionals.length > 1 && (
          <div className="relative">
            <button
              ref={profTriggerRef}
              onClick={() => setShowProfPicker(v => !v)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                allSelected
                  ? 'bg-slate-100 border-transparent text-slate-600 hover:bg-slate-200'
                  : 'bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100'
              }`}
            >
              <Icon name="users" className="w-4 h-4" />
              <span>{profButtonLabel}</span>
              {!allSelected && (
                <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center font-bold">
                  {selectedProfIds.length}
                </span>
              )}
              <Icon name="chevronDown" className={`w-3.5 h-3.5 opacity-50 transition-transform ${showProfPicker ? 'rotate-180' : ''}`} />
            </button>

            {showProfPicker && typeof document !== 'undefined' && createPortal(
              (() => {
                const rect = profTriggerRef.current?.getBoundingClientRect()
                if (!rect) return null
                const dropW = 240
                let left = rect.right - dropW
                left = Math.max(8, Math.min(left, window.innerWidth - dropW - 8))
                return (
                  <div
                    ref={profPickerRef}
                    className="fixed z-[9999] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 p-2"
                    style={{ top: rect.bottom + 6, left, width: dropW }}
                  >
                    {/* Opção "Todos" */}
                    <button
                      onClick={selectAllProfs}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                        allSelected
                          ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-medium'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        allSelected ? 'bg-violet-600 border-violet-600' : 'border-slate-300 dark:border-slate-500'
                      }`}>
                        {allSelected && <Icon name="check" className="w-3 h-3 text-white" />}
                      </span>
                      Todos os profissionais
                    </button>

                    <div className="my-1.5 border-t border-slate-100 dark:border-slate-700" />

                    {/* Lista de profissionais */}
                    {professionals.map(prof => {
                      const checked = selectedProfIds.includes(prof.id)
                      return (
                        <button
                          key={prof.id}
                          onClick={() => toggleProf(prof.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                            checked
                              ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-medium'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            checked ? 'bg-violet-600 border-violet-600' : 'border-slate-300 dark:border-slate-500'
                          }`}>
                            {checked && <Icon name="check" className="w-3 h-3 text-white" />}
                          </span>
                          <span className="truncate">{prof.name}</span>
                        </button>
                      )
                    })}
                  </div>
                )
              })(),
              document.body
            )}
          </div>
        )}

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
    </div>
  )
}
