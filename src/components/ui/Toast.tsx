'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import Icon from '@/components/ui/Icon'

type ToastVariant = 'success' | 'error' | 'info' | 'loading'

export type ToastAction = {
  label: string
  onClick: () => void
}

export type ToastInput = {
  title: string
  description?: string
  variant?: ToastVariant
  duration?: number // ms; 0 = nao fecha sozinho
  action?: ToastAction
}

type Toast = ToastInput & {
  id: string
  createdAt: number
}

type ToastContextValue = {
  show: (t: ToastInput) => string
  dismiss: (id: string) => void
  success: (title: string, opts?: Omit<ToastInput, 'title' | 'variant'>) => string
  error: (title: string, opts?: Omit<ToastInput, 'title' | 'variant'>) => string
  info: (title: string, opts?: Omit<ToastInput, 'title' | 'variant'>) => string
  /**
   * Helper "undo": executa a acao, mostra toast com botao Desfazer.
   * Se o usuario clicar Desfazer dentro de `duration`, chama `onUndo`.
   */
  undo: (opts: {
    title: string
    description?: string
    duration?: number
    onUndo: () => void | Promise<void>
  }) => string
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

function makeId() {
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const tm = timers.current.get(id)
    if (tm) {
      clearTimeout(tm)
      timers.current.delete(id)
    }
  }, [])

  const show = useCallback(
    (t: ToastInput) => {
      const id = makeId()
      const toast: Toast = {
        id,
        createdAt: Date.now(),
        variant: t.variant ?? 'info',
        duration: t.duration ?? 4000,
        ...t,
      }
      setToasts((prev) => [...prev, toast])
      const dur = toast.duration ?? 4000
      if (dur > 0) {
        const tm = setTimeout(() => dismiss(id), dur)
        timers.current.set(id, tm)
      }
      return id
    },
    [dismiss],
  )

  const success = useCallback(
    (title: string, opts?: Omit<ToastInput, 'title' | 'variant'>) =>
      show({ title, variant: 'success', ...opts }),
    [show],
  )
  const error = useCallback(
    (title: string, opts?: Omit<ToastInput, 'title' | 'variant'>) =>
      show({ title, variant: 'error', duration: 6000, ...opts }),
    [show],
  )
  const info = useCallback(
    (title: string, opts?: Omit<ToastInput, 'title' | 'variant'>) =>
      show({ title, variant: 'info', ...opts }),
    [show],
  )

  const undo = useCallback<ToastContextValue['undo']>(
    ({ title, description, duration = 5000, onUndo }) => {
      let undone = false
      const id = show({
        title,
        description,
        variant: 'info',
        duration,
        action: {
          label: 'Desfazer',
          onClick: async () => {
            if (undone) return
            undone = true
            await onUndo()
            dismiss(id)
          },
        },
      })
      return id
    },
    [show, dismiss],
  )

  // Limpa timers quando o componente sai
  useEffect(() => {
    return () => {
      timers.current.forEach((tm) => clearTimeout(tm))
      timers.current.clear()
    }
  }, [])

  const value = useMemo<ToastContextValue>(
    () => ({ show, dismiss, success, error, info, undo }),
    [show, dismiss, success, error, info, undo],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onClose={dismiss} />
    </ToastContext.Provider>
  )
}

function ToastViewport({ toasts, onClose }: { toasts: Toast[]; onClose: (id: string) => void }) {
  if (toasts.length === 0) return null
  return (
    <div
      role="region"
      aria-label="Notificacoes"
      className="fixed z-[100] right-3 left-3 bottom-3 sm:left-auto sm:right-4 sm:bottom-4 sm:w-[380px] flex flex-col gap-2 pointer-events-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onClose={() => onClose(t.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const { variant = 'info' } = toast
  const [enter, setEnter] = useState(false)

  useEffect(() => {
    const r = requestAnimationFrame(() => setEnter(true))
    return () => cancelAnimationFrame(r)
  }, [])

  const accent =
    variant === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : variant === 'error'
        ? 'border-rose-200 bg-rose-50 text-rose-900'
        : variant === 'loading'
          ? 'border-violet-200 bg-violet-50 text-violet-900'
          : 'border-slate-200 bg-white text-slate-900'

  const iconName =
    variant === 'success'
      ? 'check'
      : variant === 'error'
        ? 'alertCircle'
        : variant === 'loading'
          ? 'sparkles'
          : 'info'

  const iconColor =
    variant === 'success'
      ? 'text-emerald-600'
      : variant === 'error'
        ? 'text-rose-600'
        : variant === 'loading'
          ? 'text-violet-600'
          : 'text-slate-500'

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto rounded-2xl border shadow-lg backdrop-blur-md px-4 py-3 transition-all duration-200 ${accent} ${
        enter ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`shrink-0 mt-0.5 ${iconColor}`}>
          <Icon name={iconName as any} className={`w-5 h-5 ${variant === 'loading' ? 'animate-spin' : ''}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight truncate">{toast.title}</p>
          {toast.description ? (
            <p className="text-xs text-slate-600 mt-0.5 leading-snug">{toast.description}</p>
          ) : null}
        </div>
        {toast.action ? (
          <button
            type="button"
            onClick={toast.action.onClick}
            className="shrink-0 text-xs font-bold uppercase tracking-wide text-violet-600 hover:text-violet-800 px-2 py-1 rounded-md hover:bg-violet-100/60 transition-colors"
          >
            {toast.action.label}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <Icon name="x" className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
