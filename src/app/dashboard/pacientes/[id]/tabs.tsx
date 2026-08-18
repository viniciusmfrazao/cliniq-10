'use client'

import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { useEffect, useRef, useState } from 'react'

export type PatientTab =
  | 'overview'
  | 'evolucoes'
  | 'consultas'
  | 'anamneses'
  | 'injetaveis'
  | 'pacotes'
  | 'financeiro'
  | 'documentos'
  | 'anexos'
  | 'odontograma'

const TABS: Array<{ id: PatientTab; label: string; icon: string; module?: string }> = [
  { id: 'overview', label: 'Visão geral', icon: 'user' },
  { id: 'evolucoes', label: 'Evoluções', icon: 'file' },
  { id: 'consultas', label: 'Atendimentos', icon: 'calendar' },
  { id: 'anamneses', label: 'Anamneses', icon: 'clipboard' },
  { id: 'injetaveis', label: 'Injetáveis', icon: 'syringe' },
  { id: 'pacotes', label: 'Pacotes', icon: 'package' },
  { id: 'financeiro', label: 'Financeiro', icon: 'dollarSign' },
  { id: 'documentos', label: 'Documentos', icon: 'file' },
  { id: 'anexos', label: 'Anexos', icon: 'paperclip' },
]

export function isValidTab(tab: string | undefined): tab is PatientTab {
  return !!tab && TABS.some((t) => t.id === tab)
}

/**
 * Contagens pra badges nas tabs vêm de count queries no server e são
 * passadas via prop.
 */
export function getVisibleTabs(enabledModules: string[] = []) {
  return TABS.filter(t => !t.module || enabledModules.includes(t.module))
}

/**
 * Tabs com scroll horizontal (swipe/drag). Em telas menores nem todas as
 * tabs cabem — as setas discretas nas bordas são só uma pista visual de
 * que dá pra rolar; o scroll em si já funciona por gesto/roda do mouse.
 * Aparecem só quando há conteúdo pra rolar naquela direção.
 */
export default function PatientTabs({
  patientId,
  current,
  counts,
}: {
  patientId: string
  current: PatientTab
  /** Contagem opcional pra mostrar badge nas tabs (ex: 3 anamneses) */
  counts?: Partial<Record<PatientTab, number>>
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  function updateArrows() {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 2)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
  }

  useEffect(() => {
    updateArrows()
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => updateArrows()
    el.addEventListener('scroll', onScroll, { passive: true })
    const ro = new ResizeObserver(updateArrows)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', onScroll)
      ro.disconnect()
    }
  }, [])

  function scrollBy(dir: 'left' | 'right') {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir === 'left' ? -160 : 160, behavior: 'smooth' })
  }

  return (
    <div className="relative border-b border-slate-200 mb-6">
      {canScrollLeft && (
        <>
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent pointer-events-none z-10" />
          <button
            type="button"
            onClick={() => scrollBy('left')}
            aria-label="Rolar tabs para a esquerda"
            className="absolute left-0.5 top-1/2 -translate-y-1/2 z-20 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 hover:text-slate-700 hover:border-slate-300"
          >
            <Icon name="chevronLeft" className="w-3.5 h-3.5" />
          </button>
        </>
      )}
      {canScrollRight && (
        <>
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none z-10" />
          <button
            type="button"
            onClick={() => scrollBy('right')}
            aria-label="Rolar tabs para a direita"
            className="absolute right-0.5 top-1/2 -translate-y-1/2 z-20 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 hover:text-slate-700 hover:border-slate-300"
          >
            <Icon name="chevronRight" className="w-3.5 h-3.5" />
          </button>
        </>
      )}
      <div
        ref={scrollRef}
        className="overflow-x-auto overflow-y-hidden scrollbar-hide"
      >
        <div className="flex gap-1 min-w-max">
        {TABS.map((tab) => {
          const active = tab.id === current
          const href =
            tab.id === 'overview'
              ? `/dashboard/pacientes/${patientId}`
              : `/dashboard/pacientes/${patientId}?tab=${tab.id}`
          const count = counts?.[tab.id]
          return (
            <Link
              key={tab.id}
              href={href}
              prefetch
              scroll={false}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                active
                  ? 'text-violet-700 border-violet-600'
                  : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Icon name={tab.icon} className="w-4 h-4" />
              <span>{tab.label}</span>
              {typeof count === 'number' && count > 0 && (
                <span
                  className={`ml-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    active ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              )}
            </Link>
          )
        })}
        </div>
      </div>
    </div>
  )
}
