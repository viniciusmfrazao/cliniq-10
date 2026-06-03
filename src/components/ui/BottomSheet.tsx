'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

/**
 * Bottom Sheet — desliza de baixo para cima no mobile.
 * Renderizado via portal na raiz do body para nunca ser cortado.
 * Em desktop não é usado (o popup lateral continua).
 */
export default function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)

  // Bloquear scroll do body enquanto aberto
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Fechar ao clicar no backdrop
  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }

  if (!open) return null
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end md:hidden"
      onClick={handleBackdrop}
      style={{ background: 'rgba(0,0,0,0.45)' }}
    >
      <div
        ref={sheetRef}
        className="w-full bg-white dark:bg-slate-800 rounded-t-2xl shadow-2xl animate-bottom-sheet-in"
        style={{ maxHeight: '88dvh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-700">
            <span className="font-semibold text-slate-900 dark:text-white text-sm">{title}</span>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
            >
              ✕
            </button>
          </div>
        )}

        {/* Conteúdo */}
        <div className="px-4 pb-8">
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}
