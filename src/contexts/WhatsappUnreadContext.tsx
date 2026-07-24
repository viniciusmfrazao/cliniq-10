'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type WhatsappUnreadContextValue = {
  unreadCount: number
}

const WhatsappUnreadContext = createContext<WhatsappUnreadContextValue>({ unreadCount: 0 })

// Provider unico por pagina (mesmo racional do NotificationsContext): conta
// quantas conversas de WhatsApp tem mensagem do paciente sem resposta ainda,
// pra badge no menu (Sidebar + drawer mobile). Usa a RPC get_whatsapp_unread_total
// (mesma definicao de "nao lida" da tela /dashboard/whatsapp) em vez de carregar
// a lista inteira de conversas so pra contar.
export function WhatsappUnreadProvider({ clinicId, children }: { clinicId: string; children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0)
  const supabase = createClient()

  const loadUnread = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_whatsapp_unread_total', { p_clinic_id: clinicId })
      if (!error && typeof data === 'number') setUnreadCount(data)
    } catch (e) {
      console.log('Erro ao carregar nao lidas do WhatsApp:', e)
    }
  }, [clinicId, supabase])

  useEffect(() => {
    if (!clinicId) return

    loadUnread()

    const uniq = Math.random().toString(36).slice(2, 10)
    let channel: ReturnType<typeof supabase.channel> | null = null

    try {
      channel = supabase
        .channel(`rt:wa-unread:${clinicId}:${uniq}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'eva_conversations',
            filter: `clinic_id=eq.${clinicId}`,
          },
          () => {
            loadUnread()
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            // Realtime indisponivel — polling cobre
          }
        })
    } catch (e) {
      console.warn('[WhatsappUnreadProvider] realtime indisponivel, usando polling', e)
    }

    const interval = setInterval(loadUnread, 60000)

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel)
        } catch {
          // noop
        }
      }
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId])

  return (
    <WhatsappUnreadContext.Provider value={{ unreadCount }}>
      {children}
    </WhatsappUnreadContext.Provider>
  )
}

export function useWhatsappUnread() {
  return useContext(WhatsappUnreadContext)
}
