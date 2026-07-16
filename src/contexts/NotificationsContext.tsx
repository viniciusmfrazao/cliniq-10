'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Notification = {
  id: string
  type: string
  title: string
  message: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

type NotificationsContextValue = {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

// Provider unico por pagina: antes, Sidebar (desktop) e TopBar (mobile) cada um
// montava seu proprio <NotificationBell>, e como o CSS so ESCONDE a versao
// fora de uso (hidden/md:hidden) em vez de desmontar, os dois ficavam ativos
// ao mesmo tempo — dobrando fetch inicial, subscription de realtime e
// polling de 2min. Centralizando aqui, so roda 1x por pagina.
export function NotificationsProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const unreadCount = notifications.filter(n => !n.read_at).length

  const loadNotifications = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)

      if (!error && data) setNotifications(data)
    } catch (e) {
      console.log('Erro ao carregar notificações:', e)
    }
    setLoading(false)
  }, [userId, supabase])

  useEffect(() => {
    if (!userId) return

    loadNotifications()

    const uniq = Math.random().toString(36).slice(2, 10)
    let channel: ReturnType<typeof supabase.channel> | null = null

    try {
      channel = supabase
        .channel(`rt:notifications:${userId}:${uniq}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              setNotifications(prev => [payload.new as Notification, ...prev].slice(0, 20))
            } else if (payload.eventType === 'UPDATE') {
              setNotifications(prev =>
                prev.map(n => (n.id === (payload.new as Notification).id ? (payload.new as Notification) : n))
              )
            } else if (payload.eventType === 'DELETE') {
              const oldId = (payload.old as { id?: string })?.id
              if (oldId) setNotifications(prev => prev.filter(n => n.id !== oldId))
            }
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            // Realtime nao habilitado ou rede caiu — ok, polling cobre
          }
        })
    } catch (e) {
      console.warn('[NotificationsProvider] realtime indisponivel, usando polling', e)
    }

    const interval = setInterval(loadNotifications, 120000)

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel)
        } catch {
          /* noop */
        }
      }
      clearInterval(interval)
    }
  }, [userId, supabase, loadNotifications])

  async function markAsRead(notificationId: string) {
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)

    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n)
    )
  }

  async function markAllAsRead() {
    const unreadIds = notifications.filter(n => !n.read_at).map(n => n.id)
    if (unreadIds.length === 0) return

    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', unreadIds)

    setNotifications(prev =>
      prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
    )
  }

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, loading, markAsRead, markAllAsRead }}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) {
    // Fallback seguro caso algum componente use fora do provider (nao deveria acontecer)
    return { notifications: [], unreadCount: 0, loading: false, markAsRead: async () => {}, markAllAsRead: async () => {} }
  }
  return ctx
}
