'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from './Icon'
import Link from 'next/link'

type Notification = {
  id: string
  type: 'check_in' | 'message' | 'appointment'
  title: string
  message: string
  link?: string
  read: boolean
  created_at: string
  data?: Record<string, string>
}

type Props = {
  userId: string
  clinicId: string
}

export default function NotificationBell({ userId, clinicId }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [playSound, setPlaySound] = useState(false)
  const supabase = createClient()

  const unreadCount = notifications.filter(n => !n.read).length

  useEffect(() => {
    // Carregar notificações existentes
    loadNotifications()

    // Inscrever para novos check-ins em tempo real
    const channel = supabase
      .channel('check-ins')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'appointments',
          filter: `clinic_id=eq.${clinicId}`,
        },
        async (payload) => {
          // Verificar se foi um check-in (checked_in_at foi preenchido)
          if (payload.new.checked_in_at && !payload.old.checked_in_at) {
            // Buscar dados do paciente
            const { data: appointment } = await supabase
              .from('appointments')
              .select('patients(name), professional_id')
              .eq('id', payload.new.id)
              .single()

            // Só notifica se o usuário atual é o profissional do agendamento
            if (appointment?.professional_id === userId) {
              const newNotification: Notification = {
                id: `checkin-${payload.new.id}`,
                type: 'check_in',
                title: 'Paciente chegou! 🏥',
                message: `${appointment?.patients?.name || 'Paciente'} fez check-in`,
                link: `/dashboard/atendimento/${payload.new.id}`,
                read: false,
                created_at: new Date().toISOString(),
              }
              
              setNotifications(prev => [newNotification, ...prev.slice(0, 19)])
              setPlaySound(true)
            }
          }
        }
      )
      .subscribe()

    // Inscrever para novas mensagens de chat
    const chatChannel = supabase
      .channel('chat-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `clinic_id=eq.${clinicId}`,
        },
        async (payload) => {
          // Não notifica as próprias mensagens
          if (payload.new.sender_id !== userId) {
            const { data: sender } = await supabase
              .from('users')
              .select('name')
              .eq('id', payload.new.sender_id)
              .single()

            const newNotification: Notification = {
              id: `msg-${payload.new.id}`,
              type: 'message',
              title: 'Nova mensagem 💬',
              message: `${sender?.name || 'Alguém'}: ${payload.new.content.substring(0, 50)}...`,
              link: '/dashboard/chat',
              read: false,
              created_at: new Date().toISOString(),
            }
            
            setNotifications(prev => [newNotification, ...prev.slice(0, 19)])
            setPlaySound(true)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(chatChannel)
    }
  }, [clinicId, userId, supabase])

  // Tocar som de notificação
  useEffect(() => {
    if (playSound) {
      try {
        const audio = new Audio('/notification.mp3')
        audio.volume = 0.5
        audio.play().catch(() => {})
      } catch (e) {}
      setPlaySound(false)
    }
  }, [playSound])

  async function loadNotifications() {
    // Por enquanto, carrega do localStorage (podemos migrar para banco depois)
    const stored = localStorage.getItem(`notifications-${userId}`)
    if (stored) {
      setNotifications(JSON.parse(stored))
    }
  }

  function markAsRead(notificationId: string) {
    setNotifications(prev => {
      const updated = prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      )
      localStorage.setItem(`notifications-${userId}`, JSON.stringify(updated))
      return updated
    })
  }

  function markAllAsRead() {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }))
      localStorage.setItem(`notifications-${userId}`, JSON.stringify(updated))
      return updated
    })
    setShowDropdown(false)
  }

  function clearAll() {
    setNotifications([])
    localStorage.removeItem(`notifications-${userId}`)
    setShowDropdown(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 text-slate-500 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
      >
        <Icon name="bell" className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <>
          {/* Overlay para fechar */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowDropdown(false)} 
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
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

            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center">
                  <Icon name="bell" className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Nenhuma notificação</p>
                </div>
              ) : (
                notifications.map(notification => (
                  <Link
                    key={notification.id}
                    href={notification.link || '#'}
                    onClick={() => {
                      markAsRead(notification.id)
                      setShowDropdown(false)
                    }}
                    className={`block p-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                      !notification.read ? 'bg-violet-50/50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        notification.type === 'check_in' 
                          ? 'bg-emerald-100 text-emerald-600'
                          : notification.type === 'message'
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-violet-100 text-violet-600'
                      }`}>
                        <Icon 
                          name={
                            notification.type === 'check_in' ? 'userCheck' :
                            notification.type === 'message' ? 'message' : 'calendar'
                          } 
                          className="w-4 h-4" 
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900">{notification.title}</p>
                        <p className="text-xs text-slate-500 truncate">{notification.message}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {new Date(notification.created_at).toLocaleTimeString('pt-BR', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                      {!notification.read && (
                        <span className="w-2 h-2 bg-violet-500 rounded-full flex-shrink-0" />
                      )}
                    </div>
                  </Link>
                ))
              )}
            </div>

            {notifications.length > 0 && (
              <div className="p-2 border-t border-slate-100 bg-slate-50">
                <button 
                  onClick={clearAll}
                  className="w-full text-center text-xs text-slate-500 hover:text-red-600 py-1"
                >
                  Limpar todas
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
