'use client'

import { useState } from 'react'
import { useNotifications } from '@/contexts/NotificationsContext'
import Icon from './Icon'

// userId aceito por compatibilidade de assinatura (Sidebar/TopBar ja passam),
// mas nao e mais usado aqui: o fetch/realtime/polling agora vive uma unica
// vez em NotificationsProvider (ver contexts/NotificationsContext.tsx) —
// antes, Sidebar (desktop) e TopBar (mobile) montavam essa logica em
// dobro, ja que o CSS so esconde a versao fora de uso, nao desmonta.
export default function NotificationBell({ userId: _userId }: { userId: string }) {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications()
  const [isOpen, setIsOpen] = useState(false)

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
