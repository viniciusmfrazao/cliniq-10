'use client'

import { useEffect, useState } from 'react'
import { Icon } from './Icon'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastProps {
  message: string
  type?: ToastType
  duration?: number
  onClose?: () => void
}

const icons: Record<ToastType, string> = {
  success: 'check',
  error: 'alertTriangle',
  warning: 'alertTriangle',
  info: 'info',
}

const colors: Record<ToastType, { border: string; bg: string; text: string }> = {
  success: { border: 'border-l-green-500', bg: 'bg-green-50', text: 'text-green-700' },
  error: { border: 'border-l-red-500', bg: 'bg-red-50', text: 'text-red-700' },
  warning: { border: 'border-l-yellow-500', bg: 'bg-yellow-50', text: 'text-yellow-700' },
  info: { border: 'border-l-violet-500', bg: 'bg-violet-50', text: 'text-violet-700' },
}

/**
 * Toast — notificação com slide-in animation
 * Aparece no canto inferior direito com auto-dismiss
 */
export function Toast({ message, type = 'info', duration = 3000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    if (duration <= 0) return
    const timer = setTimeout(() => {
      setIsVisible(false)
      onClose?.()
    }, duration)
    return () => clearTimeout(timer)
  }, [duration, onClose])

  if (!isVisible) return null

  const color = colors[type]
  const icon = icons[type]

  return (
    <div
      className={`
        fixed bottom-6 right-6 z-50
        bg-white border-l-4 ${color.border}
        rounded-lg shadow-lg
        px-5 py-4
        flex items-center gap-3
        animate-slideInRight
        max-w-sm
      `}
    >
      <Icon name={icon} className={`w-5 h-5 flex-shrink-0 ${type === 'success' ? 'text-green-600' : type === 'error' ? 'text-red-600' : type === 'warning' ? 'text-yellow-600' : 'text-violet-600'}`} />
      <span className="text-sm font-medium text-slate-900">{message}</span>
      <button
        onClick={() => { setIsVisible(false); onClose?.() }}
        className="ml-2 text-slate-400 hover:text-slate-600 flex-shrink-0"
      >
        ✕
      </button>
    </div>
  )
}

/**
 * useToast hook para exibir toasts programaticamente
 */
export function useToast() {
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: ToastType }>>([])

  function show(message: string, type: ToastType = 'info', duration = 3000) {
    const id = Math.random().toString(36).substring(7)
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
  }

  return {
    show,
    success: (msg: string) => show(msg, 'success'),
    error: (msg: string) => show(msg, 'error'),
    warning: (msg: string) => show(msg, 'warning'),
    info: (msg: string) => show(msg, 'info'),
    toasts,
  }
}
