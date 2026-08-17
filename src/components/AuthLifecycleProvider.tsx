'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { hasPin, syncStoredToken } from '@/lib/pin-auth'

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

    /**
     * O Supabase invalida o refresh_token a cada rotação. Se o blob cifrado
     * do PIN guardar um token velho, o PIN funciona uma vez e depois quebra.
     * Aqui re-selamos o token atual sempre que ele muda. A partir da v2 o
     * blob é assimétrico: a chave pública fica em claro, então isso funciona
     * mesmo sem o usuário ter digitado o PIN. Sem PIN cadastrado é no-op.
     *
     * Rodamos também na visibilidade porque o middleware pode rotacionar o
     * token no servidor sem disparar TOKEN_REFRESHED no cliente.
     */
    const syncPinToken = async () => {
      if (!hasPin()) return
      try {
        const { data } = await supabase.auth.getSession()
        if (data.session?.refresh_token) await syncStoredToken(data.session.refresh_token)
      } catch {}
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth.startAutoRefresh()
        void syncPinToken()
      } else {
        // Grava a rotação ANTES do app ir dormir. Sem isso, um refresh que
        // acontece pouco antes de fechar deixa o blob com um token já
        // consumido e o PIN "some sozinho" na próxima abertura.
        void syncPinToken()
        supabase.auth.stopAutoRefresh()
      }
    }

    // Garante estado correto no mount (ex: já carrega em background raramente,
    // mas cobre o caso de forma consistente)
    handleVisibilityChange()

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' && session?.refresh_token) {
        void syncStoredToken(session.refresh_token)
      }
      // SIGNED_OUT NÃO apaga o PIN: sair é só encerrar a sessão do aparelho
      // (signOut local), não descadastrar o dispositivo. Quem quer zerar usa
      // "Sair e remover o PIN" no menu ou Segurança > remover PIN.
    })

    // Rede de segurança: o middleware rotaciona no servidor a cada navegação
    // e o cliente só percebe ao ler o cookie. Uma varredura periódica mantém
    // o blob em dia mesmo em sessões longas sem troca de aba.
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void syncPinToken()
    }, 60_000)

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      sub.subscription.unsubscribe()
    }
  }, [])

  return null
}
