'use client'

import { useEffect } from 'react'
import Icon from '@/components/ui/Icon'
import { PIN_LENGTH } from '@/lib/pin-auth'

interface PinKeypadProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  /** Sacode os pontinhos para sinalizar erro */
  shake?: boolean
}

/**
 * Teclado numérico de 6 dígitos. Aceita também teclado físico,
 * para funcionar no navegador desktop.
 */
export default function PinKeypad({ value, onChange, disabled, shake }: PinKeypadProps) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (disabled) return
      if (e.key >= '0' && e.key <= '9') {
        if (value.length < PIN_LENGTH) onChange(value + e.key)
      } else if (e.key === 'Backspace') {
        onChange(value.slice(0, -1))
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [value, onChange, disabled])

  function press(digit: string) {
    if (disabled || value.length >= PIN_LENGTH) return
    // Feedback tátil onde houver suporte
    try {
      navigator.vibrate?.(8)
    } catch {}
    onChange(value + digit)
  }

  return (
    <div className="select-none">
      {/* Pontinhos */}
      <div
        className={`flex items-center justify-center gap-4 mb-10 ${shake ? 'animate-shake' : ''}`}
      >
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <div
            key={i}
            className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
              i < value.length
                ? 'bg-violet-600 scale-110'
                : 'bg-slate-200 dark:bg-slate-700 scale-100'
            }`}
          />
        ))}
      </div>

      {/* Teclado */}
      <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button
            key={d}
            type="button"
            disabled={disabled}
            onClick={() => press(d)}
            className="h-16 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-2xl font-semibold text-slate-800 dark:text-slate-100 active:scale-95 active:bg-slate-100 dark:active:bg-slate-700 transition-all disabled:opacity-40"
          >
            {d}
          </button>
        ))}
        <div />
        <button
          type="button"
          disabled={disabled}
          onClick={() => press('0')}
          className="h-16 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-2xl font-semibold text-slate-800 dark:text-slate-100 active:scale-95 active:bg-slate-100 dark:active:bg-slate-700 transition-all disabled:opacity-40"
        >
          0
        </button>
        <button
          type="button"
          disabled={disabled || value.length === 0}
          onClick={() => onChange(value.slice(0, -1))}
          aria-label="Apagar"
          className="h-16 rounded-2xl flex items-center justify-center text-slate-500 dark:text-slate-400 active:scale-95 transition-all disabled:opacity-30"
        >
          <Icon name="chevronLeft" className="w-6 h-6" />
        </button>
      </div>
    </div>
  )
}
