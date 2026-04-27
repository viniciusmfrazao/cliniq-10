'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'

type MessageKind =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'sticker'

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
  kind: MessageKind
  mediaUrl?: string | null
  mediaPath?: string | null
  mimetype?: string | null
  fileName?: string | null
  caption?: string | null
}

type EvaRow = {
  id: string
  clinic_id: string
  phone: string
  role: 'user' | 'assistant' | null
  content: string | null
  created_at: string
  metadata?: {
    push_name?: string
    evolution_message_id?: string
    kind?: MessageKind
    mimetype?: string | null
    file_name?: string | null
    media_path?: string | null
    media_url?: string | null
    caption?: string | null
  } | null
}

function rowToMessage(r: EvaRow): Message | null {
  if (!r.role || !r.content) return null
  return {
    id: r.id,
    content: r.content,
    role: r.role,
    created_at: r.created_at,
    push_name: r.metadata?.push_name ?? null,
    kind: r.metadata?.kind ?? 'text',
    mediaUrl: r.metadata?.media_url ?? null,
    mediaPath: r.metadata?.media_path ?? null,
    mimetype: r.metadata?.mimetype ?? null,
    fileName: r.metadata?.file_name ?? null,
    caption: r.metadata?.caption ?? null,
  }
}

const COMMON_EMOJIS = [
  '😀', '😂', '😍', '😊', '🥰', '😘', '😉', '😎',
  '🤔', '🙏', '👍', '👏', '🙌', '💪', '✨', '❤️',
  '🥳', '🎉', '🌸', '💎', '💉', '💋', '😴', '😅',
  '😢', '🤗', '🤝', '👌', '🔥', '💯', '⭐', '✅',
]

// Converte File pra base64 puro (sem prefixo data:)
function fileToBase64(file: File): Promise<string> {
  return blobToBase64(file)
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',')[1] ?? ''
      resolve(base64)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
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

      // Regenera signed URLs frescos pras mídias persistidas.
      // O webhook gera signed_url com TTL de 7 dias mas, pra UI confiável,
      // regeramos toda vez que abrimos a conversa.
      const paths = Array.from(
        new Set(
          mapped
            .map((m) => m.mediaPath)
            .filter((p): p is string => !!p),
        ),
      )
      if (paths.length > 0) {
        const { data, error } = await supabase.storage
          .from('whatsapp-media')
          .createSignedUrls(paths, 60 * 60 * 24) // 24h
        if (!error && data) {
          const map = new Map<string, string>()
          data.forEach((d) => {
            if (d.path && d.signedUrl) map.set(d.path, d.signedUrl)
          })
          for (const m of mapped) {
            if (m.mediaPath && map.has(m.mediaPath)) {
              m.mediaUrl = map.get(m.mediaPath)!
            }
          }
        }
      }
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
      kind: 'text',
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
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
        const err = await response.json().catch(() => ({}))
        alert(`Falha ao enviar: ${err.error || response.status}`)
      }
    } catch (error) {
      console.error('Error sending:', error)
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
    } finally {
      setSending(false)
    }
  }

  async function sendImage(file: File, caption?: string) {
    if (!selectedConversation || !config) return
    setSending(true)
    const previewUrl = URL.createObjectURL(file)
    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      content: caption || '🖼️ Imagem',
      role: 'assistant',
      created_at: new Date().toISOString(),
      kind: 'image',
      mediaUrl: previewUrl,
      mimetype: file.type,
      caption: caption || null,
    }
    setMessages((prev) => [...prev, optimistic])

    try {
      const base64 = await fileToBase64(file)
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: selectedConversation.phone,
          type: 'image',
          media: base64,
          mimetype: file.type || 'image/jpeg',
          caption,
          fileName: file.name,
        }),
      })
      if (!response.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
        const err = await response.json().catch(() => ({}))
        alert(`Falha ao enviar imagem: ${err.error || response.status}`)
      }
    } catch (error) {
      console.error('Error sending image:', error)
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      alert('Erro inesperado ao enviar imagem')
    } finally {
      setSending(false)
    }
  }

  async function sendAudio(blob: Blob) {
    if (!selectedConversation || !config) return
    setSending(true)
    const previewUrl = URL.createObjectURL(blob)
    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      content: '🎤 Mensagem de voz',
      role: 'assistant',
      created_at: new Date().toISOString(),
      kind: 'audio',
      mediaUrl: previewUrl,
      mimetype: blob.type,
    }
    setMessages((prev) => [...prev, optimistic])

    try {
      const base64 = await blobToBase64(blob)
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: selectedConversation.phone,
          type: 'audio',
          media: base64,
        }),
      })
      if (!response.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
        const err = await response.json().catch(() => ({}))
        alert(`Falha ao enviar áudio: ${err.error || response.status}`)
      }
    } catch (error) {
      console.error('Error sending audio:', error)
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      alert('Erro inesperado ao enviar áudio')
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
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} msg={msg} />
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input com mídia + emojis */}
              <ChatComposer
                value={newMessage}
                onChange={setNewMessage}
                onSendText={sendMessage}
                onSendImage={sendImage}
                onSendAudio={sendAudio}
                disabled={sending}
              />
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

function MessageBubble({ msg }: { msg: Message }) {
  const isMine = msg.role === 'assistant'
  const baseBubble =
    'max-w-[75%] px-3 py-2 rounded-2xl ' +
    (isMine
      ? 'bg-emerald-500 text-white rounded-br-md'
      : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white rounded-bl-md')

  const time = new Date(msg.created_at).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
  const timeCls = isMine ? 'text-emerald-100' : 'text-slate-400'

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div className={baseBubble}>
        {msg.kind === 'image' && msg.mediaUrl && (
          <a
            href={msg.mediaUrl}
            target="_blank"
            rel="noreferrer"
            className="block mb-1 -mx-1 -mt-1"
          >
            <img
              src={msg.mediaUrl}
              alt={msg.caption || 'Imagem'}
              className="rounded-xl max-w-[260px] max-h-[260px] object-cover"
            />
          </a>
        )}

        {msg.kind === 'image' && !msg.mediaUrl && (
          <div className="mb-1 px-3 py-2 rounded-xl bg-black/10 text-xs italic">
            🖼️ Imagem (carregando...)
          </div>
        )}

        {msg.kind === 'audio' && msg.mediaUrl && (
          <audio controls src={msg.mediaUrl} className="max-w-[240px] mt-0.5">
            Seu navegador não suporta áudio.
          </audio>
        )}

        {msg.kind === 'audio' && !msg.mediaUrl && (
          <div className="px-2 py-1 rounded-lg bg-black/10 text-xs italic flex items-center gap-2">
            <Icon name="mic" className="w-3 h-3" />
            Áudio recebido (carregando…)
          </div>
        )}

        {msg.kind === 'video' && (
          <div className={`px-3 py-2 rounded-xl ${isMine ? 'bg-emerald-600/40' : 'bg-black/10'} text-xs flex items-center gap-2`}>
            <span>🎬</span>
            <span>Vídeo recebido — confira no celular</span>
          </div>
        )}

        {msg.kind === 'document' && (
          <div className={`px-3 py-2 rounded-xl ${isMine ? 'bg-emerald-600/40' : 'bg-black/10'} text-xs flex items-center gap-2`}>
            <span>📎</span>
            <span className="truncate max-w-[200px]">
              {msg.fileName || 'Documento'}
            </span>
            {msg.mediaUrl && (
              <a
                href={msg.mediaUrl}
                target="_blank"
                rel="noreferrer"
                className="underline ml-1"
              >
                abrir
              </a>
            )}
          </div>
        )}

        {msg.kind === 'sticker' && msg.mediaUrl && (
          <img
            src={msg.mediaUrl}
            alt="Figurinha"
            className="w-32 h-32 object-contain"
          />
        )}

        {/* Texto / caption */}
        {(msg.kind === 'text' || (msg.caption && msg.caption.trim())) && (
          <p className="text-sm whitespace-pre-wrap break-words">
            {msg.kind === 'text' ? msg.content : msg.caption}
          </p>
        )}

        <p className={`text-[10px] mt-0.5 text-right ${timeCls}`}>{time}</p>
      </div>
    </div>
  )
}

type ComposerProps = {
  value: string
  onChange: (v: string) => void
  onSendText: () => void
  onSendImage: (file: File, caption?: string) => void
  onSendAudio: (blob: Blob) => void
  disabled?: boolean
}

function ChatComposer({
  value,
  onChange,
  onSendText,
  onSendImage,
  onSendAudio,
  disabled,
}: ComposerProps) {
  const [showEmoji, setShowEmoji] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [pendingImage, setPendingImage] = useState<{ file: File; preview: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingStartRef = useRef<number>(0)
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const insertEmoji = (emoji: string) => {
    onChange(value + emoji)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 16 * 1024 * 1024) {
      alert('Imagem muito grande (máximo 16MB)')
      e.target.value = ''
      return
    }
    setPendingImage({ file, preview: URL.createObjectURL(file) })
    e.target.value = ''
  }

  const confirmImage = (caption: string) => {
    if (!pendingImage) return
    onSendImage(pendingImage.file, caption || undefined)
    URL.revokeObjectURL(pendingImage.preview)
    setPendingImage(null)
    onChange('')
  }

  const cancelImage = () => {
    if (pendingImage) URL.revokeObjectURL(pendingImage.preview)
    setPendingImage(null)
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeCandidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
      const mime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || ''
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      audioChunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: rec.mimeType || 'audio/webm' })
        stream.getTracks().forEach((t) => t.stop())
        if (blob.size > 0) onSendAudio(blob)
      }
      mediaRecorderRef.current = rec
      rec.start()
      recordingStartRef.current = Date.now()
      setRecordingTime(0)
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(Math.floor((Date.now() - recordingStartRef.current) / 1000))
      }, 250)
      setRecording(true)
    } catch (err) {
      console.error(err)
      alert('Não foi possível acessar o microfone. Permita o acesso e tente novamente.')
    }
  }

  const stopRecording = (cancel = false) => {
    const rec = mediaRecorderRef.current
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    if (rec) {
      if (cancel) {
        // descarta: troca o handler antes de parar
        rec.onstop = () => {
          rec.stream?.getTracks().forEach((t) => t.stop())
        }
      }
      rec.stop()
    }
    setRecording(false)
    setRecordingTime(0)
  }

  // Modal de pré-visualização da imagem
  if (pendingImage) {
    return (
      <div className="border-t border-slate-100 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-900">
        <div className="flex items-start gap-3 mb-3">
          <img
            src={pendingImage.preview}
            alt="Pré-visualização"
            className="w-24 h-24 rounded-lg object-cover border border-slate-200"
          />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && confirmImage(value)}
            placeholder="Legenda (opcional)"
            className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800"
            autoFocus
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={cancelImage}
            disabled={disabled}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
          >
            Cancelar
          </button>
          <button
            onClick={() => confirmImage(value)}
            disabled={disabled}
            className="px-4 py-2 text-sm font-semibold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"
          >
            {disabled ? 'Enviando…' : 'Enviar imagem'}
          </button>
        </div>
      </div>
    )
  }

  if (recording) {
    return (
      <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex items-center gap-3">
        <button
          onClick={() => stopRecording(true)}
          className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center hover:bg-rose-200"
          title="Cancelar"
        >
          <Icon name="x" className="w-4 h-4" />
        </button>
        <div className="flex-1 flex items-center gap-2 px-4 py-3 bg-rose-50 dark:bg-rose-900/20 rounded-xl">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-70" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
          </span>
          <Icon name="mic" className="w-4 h-4 text-rose-600" />
          <span className="text-sm text-rose-700 dark:text-rose-300 font-medium">
            Gravando… {String(Math.floor(recordingTime / 60)).padStart(1, '0')}:
            {String(recordingTime % 60).padStart(2, '0')}
          </span>
        </div>
        <button
          onClick={() => stopRecording(false)}
          className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600"
          title="Enviar áudio"
        >
          <Icon name="send" className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 border-t border-slate-100 dark:border-slate-700 relative">
      {showEmoji && (
        <div
          className="absolute bottom-full left-2 mb-2 z-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-2 grid grid-cols-8 gap-1"
          onMouseLeave={() => setShowEmoji(false)}
        >
          {COMMON_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                insertEmoji(e)
              }}
              className="w-8 h-8 flex items-center justify-center text-lg hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowEmoji((s) => !s)}
          disabled={disabled}
          className="w-10 h-10 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center disabled:opacity-50"
          title="Emojis"
        >
          <Icon name="smile" className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="w-10 h-10 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center disabled:opacity-50"
          title="Enviar imagem"
        >
          <Icon name="image" className="w-5 h-5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (value.trim()) onSendText()
            }
          }}
          placeholder="Digite sua mensagem..."
          disabled={disabled}
          className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
        />

        {value.trim() ? (
          <button
            type="button"
            onClick={onSendText}
            disabled={disabled}
            className="w-12 h-12 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center"
            title="Enviar mensagem"
          >
            <Icon name="send" className="w-5 h-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={startRecording}
            disabled={disabled}
            className="w-12 h-12 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center"
            title="Gravar áudio"
          >
            <Icon name="mic" className="w-5 h-5" />
          </button>
        )}
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
