'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from './Icon'

type User = {
  id: string
  name: string
  role: string
}

type Message = {
  id: string
  sender_id: string
  receiver_id: string
  message: string
  read_at: string | null
  created_at: string
}

type Props = {
  currentUserId: string
  clinicId: string
  users: User[]
}

export default function ChatWidget({ currentUserId, clinicId, users }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0)
  const otherUsers = users.filter(u => u.id !== currentUserId)

  useEffect(() => {
    loadUnreadCounts()

    // Realtime subscription for new messages
    const channel = supabase
      .channel('chat_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `receiver_id=eq.${currentUserId}`
        },
        (payload) => {
          const newMsg = payload.new as Message
          if (selectedUser?.id === newMsg.sender_id) {
            setMessages(prev => [...prev, newMsg])
            markMessagesAsRead(newMsg.sender_id)
          } else {
            setUnreadCounts(prev => ({
              ...prev,
              [newMsg.sender_id]: (prev[newMsg.sender_id] || 0) + 1
            }))
            playNotificationSound()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId, selectedUser])

  useEffect(() => {
    if (selectedUser) {
      loadMessages(selectedUser.id)
      markMessagesAsRead(selectedUser.id)
    }
  }, [selectedUser])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadUnreadCounts() {
    const { data } = await supabase
      .from('chat_messages')
      .select('sender_id')
      .eq('receiver_id', currentUserId)
      .is('read_at', null)

    if (data) {
      const counts: Record<string, number> = {}
      data.forEach(msg => {
        counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1
      })
      setUnreadCounts(counts)
    }
  }

  async function loadMessages(userId: string) {
    setLoading(true)
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUserId})`)
      .order('created_at', { ascending: true })
      .limit(100)

    if (data) setMessages(data)
    setLoading(false)
  }

  async function markMessagesAsRead(senderId: string) {
    await supabase
      .from('chat_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('sender_id', senderId)
      .eq('receiver_id', currentUserId)
      .is('read_at', null)

    setUnreadCounts(prev => ({ ...prev, [senderId]: 0 }))
  }

  async function sendMessage() {
    if (!newMessage.trim() || !selectedUser) return

    const messageData = {
      clinic_id: clinicId,
      sender_id: currentUserId,
      receiver_id: selectedUser.id,
      message: newMessage.trim()
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .insert(messageData)
      .select()
      .single()

    if (!error && data) {
      setMessages(prev => [...prev, data])
      setNewMessage('')
    }
  }

  function playNotificationSound() {
    try {
      const audio = new Audio('/notification.mp3')
      audio.volume = 0.3
      audio.play().catch(() => {})
    } catch {}
  }

  function formatTime(date: string): string {
    return new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  function formatDate(date: string): string {
    const d = new Date(date)
    const today = new Date()
    if (d.toDateString() === today.toDateString()) return 'Hoje'
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (d.toDateString() === yesterday.toDateString()) return 'Ontem'
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }

  const roleLabels: Record<string, string> = {
    admin: 'Admin',
    doctor: 'Médico(a)',
    esthetician: 'Esteticista',
    receptionist: 'Recepção',
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full shadow-lg flex items-center justify-center text-white hover:from-violet-600 hover:to-purple-600 transition-all hover:scale-105"
      >
        {isOpen ? (
          <Icon name="x" className="w-6 h-6" />
        ) : (
          <>
            <Icon name="message" className="w-6 h-6" />
            {totalUnread > 0 && (
              <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                {totalUnread > 9 ? '9+' : totalUnread}
              </span>
            )}
          </>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
          {/* Header */}
          <div className="p-3 bg-gradient-to-r from-violet-500 to-purple-500 text-white">
            {selectedUser ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedUser(null)}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <Icon name="chevronLeft" className="w-5 h-5" />
                </button>
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold">
                  {selectedUser.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{selectedUser.name}</p>
                  <p className="text-xs text-white/70">{roleLabels[selectedUser.role] || selectedUser.role}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Icon name="message" className="w-5 h-5" />
                <span className="font-semibold">Chat da Equipe</span>
              </div>
            )}
          </div>

          {/* Content */}
          {selectedUser ? (
            <>
              {/* Messages */}
              <div className="h-72 overflow-y-auto p-3 space-y-3 bg-slate-50">
                {loading ? (
                  <div className="h-full flex items-center justify-center">
                    <Icon name="loader" className="w-6 h-6 text-slate-400 animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400">
                    <Icon name="message" className="w-8 h-8 mb-2" />
                    <p className="text-sm">Nenhuma mensagem ainda</p>
                    <p className="text-xs">Comece a conversa!</p>
                  </div>
                ) : (
                  <>
                    {messages.map((msg, idx) => {
                      const isMe = msg.sender_id === currentUserId
                      const showDate = idx === 0 || 
                        formatDate(msg.created_at) !== formatDate(messages[idx - 1].created_at)
                      
                      return (
                        <div key={msg.id}>
                          {showDate && (
                            <div className="text-center my-2">
                              <span className="text-xs text-slate-400 bg-white px-2 py-1 rounded-full">
                                {formatDate(msg.created_at)}
                              </span>
                            </div>
                          )}
                          <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div
                              className={`max-w-[80%] px-3 py-2 rounded-2xl ${
                                isMe
                                  ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-br-md'
                                  : 'bg-white text-slate-900 rounded-bl-md shadow-sm'
                              }`}
                            >
                              <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                              <p className={`text-xs mt-1 ${isMe ? 'text-white/70' : 'text-slate-400'}`}>
                                {formatTime(msg.created_at)}
                                {isMe && msg.read_at && ' ✓✓'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Input */}
              <div className="p-3 border-t border-slate-200 bg-white">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && sendMessage()}
                    placeholder="Digite sua mensagem..."
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                    className="w-10 h-10 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-full flex items-center justify-center hover:from-violet-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <Icon name="send" className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* User List */
            <div className="max-h-80 overflow-y-auto">
              {otherUsers.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Icon name="users" className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm">Nenhum colega disponível</p>
                </div>
              ) : (
                otherUsers.map(user => (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUser(user)}
                    className="w-full p-3 flex items-center gap-3 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center text-white font-bold">
                      {user.name.charAt(0)}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-medium text-slate-900 truncate">{user.name}</p>
                      <p className="text-xs text-slate-500">{roleLabels[user.role] || user.role}</p>
                    </div>
                    {unreadCounts[user.id] > 0 && (
                      <span className="w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {unreadCounts[user.id]}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
