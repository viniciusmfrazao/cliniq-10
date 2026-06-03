'use client'

import { useEffect, useState } from 'react'
import { Icon } from './Icon'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastOptions {
  description?: string
  duration?: number
}

interface ToastProps {
  message: string
  type?: ToastType
  duration?: number
  description?: string
  onClose?: () => void
}

const icons: Record<ToastType, string> = {
  success: 'check',
  error: 'alertTriangle',
  warning: 'alertTriangle',
  info: 'info',
}

const styles: Record<ToastType, { border: string; icon: string }> = {
  success: { border: 'border-l-green-500',  icon: 'text-green-600' },
  error:   { border: 'border-l-red-500',    icon: 'text-red-600' },
  warning: { border: 'border-l-yellow-500', icon: 'text-yellow-600' },
  info:    { border: 'border-l-violet-500', icon: 'text-violet-600' },
}

export function Toast({ message, type = 'info', duration = 3500, description, onClose }: ToastProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (duration <= 0) return
    const t = setTimeout(() => { setVisible(false); onClose?.() }, duration)
    return () => clearTimeout(t)
  }, [duration, onClose])

  if (!visible) return null
  const s = styles[type]

  return (
    <div className={`fixed bottom-6 right-6 z-[9999] bg-white border border-slate-200 border-l-4 ${s.border} rounded-lg shadow-xl px-5 py-4 flex items-start gap-3 animate-slideInRight max-w-sm`}>
      <Icon name={icons[type]} className={`w-5 h-5 flex-shrink-0 mt-0.5 ${s.icon}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900">{message}</p>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <button onClick={() => { setVisible(false); onClose?.() }} className="text-slate-400 hover:text-slate-600 flex-shrink-0 text-lg leading-none">✕</button>
    </div>
  )
}

/**
 * useToast — hook para toasts programáticos.
 * Aceita (message) ou (message, options) com description e duration.
 */
export function useToast() {
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: ToastType; description?: string; duration?: number }>>([])

  function show(message: string, typeOrOptions?: ToastType | ToastOptions, durationOrOptions?: number | ToastOptions) {
    const id = Math.random().toString(36).slice(2, 8)
    let type: ToastType = 'info'
    let description: string | undefined
    let duration = 3500

    if (typeof typeOrOptions === 'string') {
      type = typeOrOptions
      if (typeof durationOrOptions === 'number') duration = durationOrOptions
      if (typeof durationOrOptions === 'object' && durationOrOptions) {
        description = durationOrOptions.description
        if (durationOrOptions.duration) duration = durationOrOptions.duration
      }
    } else if (typeof typeOrOptions === 'object' && typeOrOptions) {
      description = typeOrOptions.description
      if (typeOrOptions.duration) duration = typeOrOptions.duration
    }

    setToasts(prev => [...prev, { id, message, type, description, duration }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration + 300)
  }

  return {
    show,
    success: (msg: string, opts?: ToastOptions) => show(msg, 'success', opts),
    error:   (msg: string, opts?: ToastOptions) => show(msg, 'error',   opts),
    warning: (msg: string, opts?: ToastOptions) => show(msg, 'warning', opts),
    info:    (msg: string, opts?: ToastOptions) => show(msg, 'info',    opts),
    toasts,
  }
}
