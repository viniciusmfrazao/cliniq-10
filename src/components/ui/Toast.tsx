'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import Icon from './Icon'

type ToastType = 'success' | 'error' | 'warning' | 'info'

type Toast = {
  id: string
  type: ToastType
  message: string
  duration?: number
}

type ToastContextType = {
  toasts: Toast[]
  showToast: (type: ToastType, message: string, duration?: number) => void
  success: (message: string) => void
  error: (message: string) => void
  warning: (message: string) => void
  info: (message: string) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const showToast = useCallback((type: ToastType, message: string, duration = 4000) => {
    const id = `toast-${Date.now()}`
    const toast: Toast = { id, type, message, duration }
    
    setToasts(prev => [...prev, toast])

    if (duration > 0) {
      setTimeout(() => dismiss(id), duration)
    }
  }, [dismiss])

  const success = useCallback((message: string) => showToast('success', message), [showToast])
  const error = useCallback((message: string) => showToast('error', message, 6000), [showToast])
  const warning = useCallback((message: string) => showToast('warning', message), [showToast])
  const info = useCallback((message: string) => showToast('info', message), [showToast])

  return (
    <ToastContext.Provider value={{ toasts, showToast, success, error, warning, info, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  )
}

function ToastContainer({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const config = {
    success: { bg: 'bg-emerald-500', icon: 'check' },
    error: { bg: 'bg-red-500', icon: 'x' },
    warning: { bg: 'bg-amber-500', icon: 'bell' },
    info: { bg: 'bg-blue-500', icon: 'bell' },
  }[toast.type]

  return (
    <div 
      className={`${config.bg} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-slide-up`}
      role="alert"
    >
      <Icon name={config.icon} className="w-5 h-5 flex-shrink-0" />
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button onClick={onDismiss} className="hover:opacity-70 transition-opacity">
        <Icon name="x" className="w-4 h-4" />
      </button>
    </div>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

export default ToastProvider
