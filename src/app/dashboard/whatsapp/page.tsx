'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'

type Conversation = {
  id: string
  phone: string
  name: string
  lastMessage: string
  lastMessageTime: string
  lastRole: 'user' | 'assistant'
  unread: number
}

type Message = {
  id: string
  content: string
  role: 'user' | 'assistant'
  created_at: string
  push_name?: string | null
}

type EvaRow = {
  id: string
  clinic_id: string
  phone: string
  role: 'user' | 'assistant' | null
  content: string | null
  created_at: string
  metadata?: { push_name?: string; evolution_message_id?: string } | null
}

function rowToMessage(r: EvaRow): Message | null {
  if (!r.role || !r.content) return null
  return {
    id: r.id,
    content: r.content,
    role: r.role,
    created_at: r.created_at,
    push_name: r.metadata?.push_name ?? null,
  }
}

function buildConversationFromRow(
  prev: Conversation | undefined,
  r: EvaRow,
): Conversation | null {
  if (!r.content) return prev ?? null
  const name = r.metadata?.push_name || prev?.name || r.phone
  // unread aumenta se for do paciente (role='user') E nao e a aberta no momento
  const isFromPatient = r.role === 'user'
  return {
    id: r.phone,
    phone: r.phone,
    name,
    lastMessage: r.content.length > 50 ? r.content.slice(0, 50) + '…' : r.content,
    lastMessageTime: r.created_at,
    lastRole: r.role === 'assistant' ? 'assistant' : 'user',
    unread: isFromPatient ? (prev?.unread ?? 0) + 1 : prev?.unread ?? 0,
  }
}

export default function WhatsAppPage() {
  const [loading, setLoading] = useState(true)
  const [configured, setConfigured] = useState(false)
  const [clinicId, setClinicId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [config, setConfig] = useState<any>(null)
  const [patient, setPatient] = useState<any>(null)
  const [realtimeStatus, setRealtimeStatus] = useState<'idle' | 'connecting' | 'live' | 'error'>('idle')
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const selectedPhoneRef = useRef<string | null>(null)

  // Mantem ref atualizada pra o handler de realtime saber qual conversa esta aberta
  useEffect(() => {
    selectedPhoneRef.current = selectedConversation?.phone ?? null
  }, [selectedConversation])

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const handleNewRow = useCallback((row: EvaRow) => {
    // Atualiza lista de conversas
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.phone === row.phone)
      const updated = buildConversationFromRow(idx >= 0 ? prev[idx] : undefined, row)
      if (!updated) return prev
      const isOpen = selectedPhoneRef.current === row.phone
      // se a conversa esta aberta, nao incrementa unread
      const finalConv = isOpen ? { ...updated, unread: 0 } : updated
      const filtered = prev.filter((c) => c.phone !== row.phone)
      return [finalConv, ...filtered]
    })

    // Se a conversa esta aberta, append na thread
    if (selectedPhoneRef.current === row.phone) {
      const m = rowToMessage(row)
      if (m) {
        setMessages((prev) => {
          if (prev.some((p) => p.id === m.id)) return prev
          return [...prev, m]
        })
      }
    }
  }, [])

  useEffect(() => {
    loadConfig()
  }, [])

  // Auto-scroll pro final ao receber/abrir mensagens
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Subscription Realtime — uma vez que a clinica esta resolvida
  useEffect(() => {
    if (!clinicId) return

    setRealtimeStatus('connecting')
    const channel = supabase
      .channel(`whatsapp:${clinicId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'eva_conversations',
          filter: `clinic_id=eq.${clinicId}`,
        },
        (payload) => {
          handleNewRow(payload.new as EvaRow)
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('live')
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setRealtimeStatus('error')
      })

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId])

  async function loadConfig() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: userData } = await supabase
        .from('users')
        .select('clinic_id')
        .eq('id', user.id)
        .single()

      if (!userData?.clinic_id) return

      const { data: instance } = await supabase
        .from('clinic_whatsapp')
        .select('status, instance_name')
        .eq('clinic_id', userData.clinic_id)
        .maybeSingle()

      if (instance?.status === 'connected') {
        setConfig({ instance_name: instance.instance_name } as never)
        setConfigured(true)
        setClinicId(userData.clinic_id)
        loadConversations(userData.clinic_id)
      } else {
        setConfigured(false)
      }
    } catch (error) {
      console.error('Error loading config:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadConversations(clinicId: string) {
    const { data } = await supabase
      .from('eva_conversations')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })

    if (!data) return

    // Agrupa por phone preservando a ordem (mais recente primeiro)
    const seen = new Set<string>()
    const convs: Conversation[] = []
    for (const r of data as EvaRow[]) {
      if (!r.content || seen.has(r.phone)) continue
      seen.add(r.phone)
      const conv = buildConversationFromRow(undefined, r)
      if (conv) convs.push({ ...conv, unread: 0 })
    }
    setConversations(convs)
  }

  async function loadMessages(phone: string) {
    if (!clinicId) return

    const { data: msgs } = await supabase
      .from('eva_conversations')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('phone', phone)
      .order('created_at', { ascending: true })

    if (msgs) {
      const mapped = (msgs as EvaRow[])
        .map(rowToMessage)
        .filter((m): m is Message => m !== null)
      setMessages(mapped)
    }

    // Zera unread da conversa aberta
    setConversations((prev) =>
      prev.map((c) => (c.phone === phone ? { ...c, unread: 0 } : c)),
    )

    const { data: patientData } = await supabase
      .from('patients')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('phone', phone)
      .maybeSingle()

    setPatient(patientData)
  }

  async function sendMessage() {
    if (!newMessage.trim() || !selectedConversation || !config) return

    setSending(true)
    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      content: newMessage,
      role: 'assistant',
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    const text = newMessage
    setNewMessage('')

    try {
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: selectedConversation.phone,
          message: text,
        }),
      })

      if (!response.ok) {
        // remove a otimista se falhou
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
        const err = await response.json().catch(() => ({}))
        alert(`Falha ao enviar: ${err.error || response.status}`)
      }
      // Quando o webhook do Evolution chegar com fromMe=true, a mensagem
      // entrara via realtime e substituira a otimista (mesmo conteudo).
    } catch (error) {
      console.error('Error sending:', error)
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
    } finally {
      setSending(false)
    }
  }

  function selectConversation(conv: Conversation) {
    setSelectedConversation(conv)
    loadMessages(conv.phone)
  }

  if (loading) {
    return (
      <div className="h-[calc(100dvh-180px)] md:h-[calc(100dvh-140px)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-300">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!configured) {
    return (
      <div className="h-[calc(100dvh-180px)] md:h-[calc(100dvh-140px)] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <svg className="w-10 h-10 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
            WhatsApp não configurado
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            Configure a Evolution API nas integrações para usar o chat do WhatsApp.
          </p>
          <Link
            href="/dashboard/config/whatsapp"
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-600 transition-colors"
          >
            <Icon name="settings" className="w-5 h-5" />
            Configurar Integrações
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100dvh-180px)] md:h-[calc(100dvh-140px)] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">WhatsApp</h1>
            <RealtimeBadge status={realtimeStatus} />
          </div>
          <p className="text-sm text-slate-500">Conversas via Evolution API</p>
        </div>
        <button
          onClick={() => loadConfig()}
          className="btn-secondary flex items-center gap-2"
        >
          <Icon name="refresh" className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      <div className="flex-1 card overflow-hidden flex">
        {/* Lista de conversas */}
        <div className="w-80 border-r border-slate-200 dark:border-slate-700 flex flex-col">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700">
            <div className="relative">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar conversa..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Icon name="message" className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>Nenhuma conversa ainda</p>
              </div>
            ) : (
              conversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => selectConversation(conv)}
                  className={`w-full p-4 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left ${
                    selectedConversation?.id === conv.id ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                      {conv.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">{conv.name}</p>
                    <p className={`text-xs truncate ${conv.unread > 0 ? 'text-slate-700 dark:text-slate-200 font-medium' : 'text-slate-500'}`}>
                      {conv.lastRole === 'assistant' ? '✓ ' : ''}{conv.lastMessage}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-xs text-slate-400">
                      {new Date(conv.lastMessageTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {conv.unread > 0 && (
                      <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center">
                        {conv.unread > 9 ? '9+' : conv.unread}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Header do chat */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                    {selectedConversation.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 dark:text-white">{selectedConversation.name}</p>
                  <p className="text-xs text-slate-500">{selectedConversation.phone}</p>
                </div>
                {patient && (
                  <Link
                    href={`/dashboard/pacientes/${patient.id}`}
                    className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-600"
                  >
                    Ver ficha
                  </Link>
                )}
              </div>

              {/* Mensagens */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'assistant' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] px-4 py-2 rounded-2xl ${
                        msg.role === 'assistant'
                          ? 'bg-emerald-500 text-white rounded-br-md'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white rounded-bl-md'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <p className={`text-xs mt-1 ${msg.role === 'assistant' ? 'text-emerald-100' : 'text-slate-400'}`}>
                        {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-slate-100 dark:border-slate-700">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && sendMessage()}
                    placeholder="Digite sua mensagem..."
                    className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={sending || !newMessage.trim()}
                    className="px-6 py-3 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50"
                  >
                    {sending ? '...' : 'Enviar'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Icon name="message" className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <p className="text-slate-500">Selecione uma conversa para começar</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function RealtimeBadge({ status }: { status: 'idle' | 'connecting' | 'live' | 'error' }) {
  if (status === 'live') {
    return (
      <span
        title="Atualizando em tempo real"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        AO VIVO
      </span>
    )
  }
  if (status === 'connecting') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
        Conectando…
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span
        title="Realtime indisponível — habilite a publication supabase_realtime"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-[10px] font-bold"
      >
        Sem realtime
      </span>
    )
  }
  return null
}
