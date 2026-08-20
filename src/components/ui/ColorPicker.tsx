'use client'

import { useState, useRef, useEffect } from 'react'
import { AGENDA_PALETTE, AGENDA_PALETTE_KEYS } from '@/lib/agenda-colors'

type Props = {
  value: string | null
  onChange: (color: string | null) => void
  /** texto do tooltip/aria do botão */
  title?: string
  /** tamanho do gatilho */
  size?: 'sm' | 'md'
  disabled?: boolean
}

/**
 * Gatilho redondo que abre a paleta da agenda.
 * `null` = sem cor definida (o card cai no fallback de status).
 */
export default function ColorPicker({ value, onChange, title = 'Definir cor', size = 'md', disabled = false }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const current = value ? AGENDA_PALETTE[value] : null
  const dim = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        title={current ? `${title}: ${current.label}` : `${title}: sem cor`}
        aria-label={title}
        className={`${dim} rounded-full border transition-all flex-shrink-0 ${
          current
            ? `${current.dot} border-transparent`
            : 'bg-white border-dashed border-slate-300 hover:border-slate-400'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:ring-2 hover:ring-violet-200'}`}
      />

      {open && (
        <div className="absolute z-20 top-full left-0 mt-1.5 p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg w-[168px]">
          <div className="grid grid-cols-6 gap-1.5">
            {AGENDA_PALETTE_KEYS.map(key => {
              const c = AGENDA_PALETTE[key]
              const selected = value === key
              return (
                <button
                  key={key}
                  type="button"
                  title={c.label}
                  aria-label={c.label}
                  onClick={() => {
                    onChange(key)
                    setOpen(false)
                  }}
                  className={`w-5 h-5 rounded-full ${c.dot} transition-transform hover:scale-110 ${
                    selected ? 'ring-2 ring-offset-1 ring-slate-700' : ''
                  }`}
                />
              )
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              onChange(null)
              setOpen(false)
            }}
            className="mt-2 w-full text-[11px] text-slate-500 hover:text-slate-700 py-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Sem cor
          </button>
        </div>
      )}
    </div>
  )
}
