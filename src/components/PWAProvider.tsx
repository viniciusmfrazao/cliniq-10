'use client'

import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt: () => Promise<void>
}

const DISMISS_KEY = 'clinike-pwa-install-dismissed'

export default function PWAProvider() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Registra o service worker em prod (em dev pode atrapalhar HMR)
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch((e) => {
        console.warn('[PWA] falha ao registrar SW', e)
      })
    }

    // Captura o evento beforeinstallprompt (Chrome / Edge / Android)
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      const ev = e as BeforeInstallPromptEvent
      setDeferred(ev)

      // Nao re-mostra se o usuario ja dispensou ha menos de 7 dias
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0)
      if (Date.now() - dismissedAt > 7 * 24 * 60 * 60 * 1000) {
        setShow(true)
      }
    }

    const onInstalled = () => {
      setShow(false)
      setDeferred(null)
      localStorage.removeItem(DISMISS_KEY)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function handleInstall() {
    if (!deferred) return
    await deferred.prompt()
    const choice = await deferred.userChoice
    if (choice.outcome === 'dismissed') {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    }
    setShow(false)
    setDeferred(null)
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setShow(false)
  }

  if (!show || !deferred) return null

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[60] bottom-4 md:bottom-6 w-[calc(100%-2rem)] max-w-md"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3 animate-[slideUp_.3s_ease-out]">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Instalar Clinike</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">Acesso rápido como aplicativo</p>
        </div>
        <button
          onClick={handleInstall}
          className="text-xs font-semibold px-3 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:opacity-90 active:scale-95 transition-all"
        >
          Instalar
        </button>
        <button
          onClick={handleDismiss}
          aria-label="Dispensar"
          className="text-slate-400 hover:text-slate-600 p-1"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
