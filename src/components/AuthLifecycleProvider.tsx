'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * No app iOS (Capacitor/WKWebView), quando o app vai pra background os
 * timers de refresh do Supabase ficam congelados. Ao voltar pro foreground,
 * o SDK acha que perdeu vários ciclos de refresh e dispara tentativas em
 * rajada — isso colide com o refresh feito pelo middleware e o Supabase
 * revoga a sessão inteira (proteção contra roubo de token), derrubando o
 * usuário sem motivo real.
 *
 * Pausando o autoRefresh explicitamente no background e retomando limpo
 * no foreground, eliminamos a rajada. Usamos a Page Visibility API padrão
 * (funciona dentro do WKWebView sem precisar de plugin nativo do Capacitor,
 * então não exige rebuild/App Store).
 */
export default function AuthLifecycleProvider() {
  useEffect(() => {
    if (typeof document === 'undefined') return

    const supabase = createClient()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth.startAutoRefresh()
      } else {
        supabase.auth.stopAutoRefresh()
      }
    }

    // Garante estado correto no mount (ex: já carrega em background raramente,
    // mas cobre o caso de forma consistente)
    handleVisibilityChange()

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return null
}
