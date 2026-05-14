'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from './Icon'

type Notification = {
  id: string
  type: string
  title: string
  message: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

export default function NotificationBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
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

    // Nome de canal unico por mount (evita colisao com remount no Strict Mode)
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
      console.warn('[NotificationBell] realtime indisponivel, usando polling', e)
    }

    // Fallback: polling a cada 2 min (funciona mesmo se o realtime falhar)
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

  function getTimeAgo(date: string): string {
    const diff = Date.now() - new Date(date).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'Agora'
    if (minutes < 60) return `${minutes}min`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    return `${days}d`
  }

  const typeConfig: Record<string, { icon: string; color: string }> = {
    check_in: { icon: 'userCheck', color: 'text-emerald-500 bg-emerald-100' },
    appointment: { icon: 'calendar', color: 'text-blue-500 bg-blue-100' },
    message: { icon: 'message', color: 'text-violet-500 bg-violet-100' },
    alert: { icon: 'bell', color: 'text-amber-500 bg-amber-100' },
    info: { icon: 'info', color: 'text-slate-500 bg-slate-100' },
  }

  // Proteção após os hooks
  if (!userId) return null

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
      >
        <Icon name="bell" className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed bottom-16 left-4 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-[100] overflow-hidden">
            <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-semibold text-slate-900">Notificações</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-violet-600 hover:underline"
                >
                  Marcar todas como lidas
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center">
                  <Icon name="loader" className="w-6 h-6 text-slate-400 animate-spin mx-auto" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Icon name="bell" className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Nenhuma notificação</p>
                </div>
              ) : (
                notifications.map(notification => {
                  const config = typeConfig[notification.type] || typeConfig.info
                  return (
                    <div
                      key={notification.id}
                      onClick={() => {
                        if (!notification.read_at) markAsRead(notification.id)
                        if (notification.link) {
                          window.location.href = notification.link
                        }
                      }}
                      className={`p-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors ${
                        !notification.read_at ? 'bg-violet-50/50' : ''
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${config.color}`}>
                          <Icon name={config.icon} className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-sm font-medium truncate ${!notification.read_at ? 'text-slate-900' : 'text-slate-600'}`}>
                              {notification.title}
                            </p>
                            <span className="text-xs text-slate-400 flex-shrink-0">
                              {getTimeAgo(notification.created_at)}
                            </span>
                          </div>
                          {notification.message && (
                            <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                              {notification.message}
                            </p>
                          )}
                        </div>
                        {!notification.read_at && (
                          <div className="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0 mt-2" />
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
