'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'

type User = {
  id: string
  name: string
  role: string
}

type Message = {
  id: string
  content: string
  sender_id: string
  sender_name?: string
  created_at: string
  is_system?: boolean
}

type Props = {
  currentUser: User
  clinicId: string
  users: User[]
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  doctor: 'Médico(a)',
  esthetician: 'Esteticista',
  receptionist: 'Recepção',
  viewer: 'Visualizador',
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'from-violet-500 to-purple-500',
  doctor: 'from-blue-500 to-cyan-500',
  esthetician: 'from-rose-500 to-pink-500',
  receptionist: 'from-emerald-500 to-teal-500',
  viewer: 'from-slate-400 to-slate-500',
}

export default function ChatRoom({ currentUser, clinicId, users }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Scroll para a última mensagem
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    loadMessages()
    
    // Inscrever para novas mensagens em tempo real
    const channel = supabase
      .channel('chat-room')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `clinic_id=eq.${clinicId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message
          // Buscar nome do remetente
          const sender = users.find(u => u.id === newMsg.sender_id) || 
            (newMsg.sender_id === currentUser.id ? currentUser : null)
          
          setMessages(prev => [...prev, {
            ...newMsg,
            sender_name: sender?.name || 'Usuário'
          }])
        }
      )
      .subscribe()

    // Presença online (simplificado)
    const presenceChannel = supabase.channel('online-users')
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState()
        const online = Object.keys(state).map(key => state[key][0]?.user_id).filter(Boolean)
        setOnlineUsers(online as string[])
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ user_id: currentUser.id })
        }
      })

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(presenceChannel)
    }
  }, [clinicId, currentUser.id, users, supabase])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  async function loadMessages() {
    setLoading(true)
    
    // Tentar criar a tabela se não existir (vai falhar silenciosamente se já existir)
    await supabase.rpc('create_chat_messages_if_not_exists').catch(() => {})
    
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: true })
      .limit(100)

    if (!error && data) {
      // Adicionar nomes dos remetentes
      const messagesWithNames = data.map(msg => ({
        ...msg,
        sender_name: msg.sender_id === currentUser.id 
          ? currentUser.name 
          : users.find(u => u.id === msg.sender_id)?.name || 'Usuário'
      }))
      setMessages(messagesWithNames)
    }
    
    setLoading(false)
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!newMessage.trim() || sending) return

    setSending(true)
    const { error } = await supabase
      .from('chat_messages')
      .insert({
        clinic_id: clinicId,
        sender_id: currentUser.id,
        content: newMessage.trim(),
      })

    if (!error) {
      setNewMessage('')
    }
    setSending(false)
  }

  function formatTime(dateStr: string) {
    const date = new Date(dateStr)
    const today = new Date()
    const isToday = date.toDateString() === today.toDateString()
    
    if (isToday) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' +
           date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  const allUsers = [currentUser, ...users]

  return (
    <div className="flex h-full gap-4">
      {/* Lista de usuários */}
      <div className="w-64 flex-shrink-0 card overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <Icon name="users" className="w-4 h-4 text-violet-500" />
            Equipe
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {allUsers.map(user => {
            const isOnline = onlineUsers.includes(user.id) || user.id === currentUser.id
            const isCurrentUser = user.id === currentUser.id
            
            return (
              <div
                key={user.id}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  isCurrentUser ? 'bg-violet-50' : 'hover:bg-slate-50'
                }`}
              >
                <div className="relative">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${ROLE_COLORS[user.role] || ROLE_COLORS.viewer} flex items-center justify-center text-white font-bold`}>
                    {user.name.charAt(0)}
                  </div>
                  <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                    isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate text-sm">
                    {user.name} {isCurrentUser && '(você)'}
                  </p>
                  <p className="text-xs text-slate-500">{ROLE_LABELS[user.role] || user.role}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Área de chat */}
      <div className="flex-1 card overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <Icon name="message" className="w-4 h-4 text-violet-500" />
            Chat da Equipe
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {onlineUsers.length + 1} online agora
          </p>
        </div>

        {/* Mensagens */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Icon name="loader" className="w-6 h-6 text-violet-500 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center mb-4">
                <Icon name="message" className="w-8 h-8 text-violet-500" />
              </div>
              <p className="text-slate-600 font-medium">Nenhuma mensagem ainda</p>
              <p className="text-sm text-slate-400 mt-1">Comece a conversa!</p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isOwn = msg.sender_id === currentUser.id
              const sender = allUsers.find(u => u.id === msg.sender_id)
              const showAvatar = idx === 0 || messages[idx - 1].sender_id !== msg.sender_id
              
              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}
                >
                  {showAvatar ? (
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${ROLE_COLORS[sender?.role || 'viewer']} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                      {msg.sender_name?.charAt(0) || '?'}
                    </div>
                  ) : (
                    <div className="w-8 flex-shrink-0" />
                  )}
                  
                  <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
                    {showAvatar && !isOwn && (
                      <p className="text-xs text-slate-500 mb-1 ml-1">{msg.sender_name}</p>
                    )}
                    <div
                      className={`px-4 py-2 rounded-2xl ${
                        isOwn
                          ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-br-md'
                          : 'bg-slate-100 text-slate-900 rounded-bl-md'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                    </div>
                    <p className={`text-xs text-slate-400 mt-1 ${isOwn ? 'text-right mr-1' : 'ml-1'}`}>
                      {formatTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input de mensagem */}
        <form onSubmit={handleSend} className="p-4 border-t border-slate-100 bg-slate-50">
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Digite sua mensagem..."
              className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="px-6 py-3 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl font-medium hover:from-violet-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {sending ? (
                <Icon name="loader" className="w-5 h-5 animate-spin" />
              ) : (
                <Icon name="send" className="w-5 h-5" />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
