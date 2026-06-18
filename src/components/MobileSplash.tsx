'use client'

import { useEffect, useState } from 'react'

/**
 * Splash screen web — aparece só no app mobile (Capacitor).
 * Mostra a logo do Clinike por 2s antes de renderizar o conteúdo.
 */
export default function MobileSplash({ children }: { children: React.ReactNode }) {
  const [showSplash, setShowSplash] = useState(false)
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    // Só ativa no app nativo (Capacitor)
    const isNative = !!(window as any).Capacitor?.isNativePlatform?.()
    if (!isNative) return

    // Evita mostrar a splash mais de uma vez por sessão
    if (sessionStorage.getItem('splash_shown')) return

    setShowSplash(true)
    sessionStorage.setItem('splash_shown', '1')

    // Começa o fade out após 1.8s
    const fadeTimer = setTimeout(() => setFadeOut(true), 1800)
    // Remove completamente após 2.3s
    const hideTimer = setTimeout(() => setShowSplash(false), 2300)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(hideTimer)
    }
  }, [])

  return (
    <>
      {showSplash && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: '#7c3aed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '20px',
            transition: 'opacity 0.5s ease',
            opacity: fadeOut ? 0 : 1,
            pointerEvents: 'none',
          }}
        >
          <img
            src="/logo.svg"
            alt="Clinike"
            style={{
              width: '100px',
              height: '100px',
              borderRadius: '24px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
          />
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'white', fontSize: '28px', fontWeight: 800, margin: 0 }}>
              Clinike
            </p>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', margin: '4px 0 0' }}>
              Simples como deve ser
            </p>
          </div>
        </div>
      )}
      {children}
    </>
  )
}
