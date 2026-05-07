'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { useWaLine } from '@/contexts/WaLineContext'

type MessageKind =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'sticker'

type Conversation = {
  /** Chave única: telefone + linha WhatsApp (multi-número) */
  id: string
  phone: string
  /** Instance Evolution que recebeu/enviou a thread (null = histórico antes do multi-número) */
  instanceName: string | null
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
    instance_name?: string
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

function threadKey(phone: string, instanceName: string | null | undefined): string {
  return `${phone}::${instanceName ?? ''}`
}

function rowInstanceName(r: EvaRow): string | null {
  const m = r.metadata
  if (m && typeof m === 'object' && 'instance_name' in m && m.instance_name != null) {
    return String(m.instance_name)
  }
  return null
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
  const instanceName = rowInstanceName(r)
  const name = r.metadata?.push_name || prev?.name || r.phone
  // unread aumenta se for do paciente (role='user') E nao e a aberta no momento
  const isFromPatient = r.role === 'user'
  return {
    id: threadKey(r.phone, instanceName),
    phone: r.phone,
    instanceName,
    name,
    lastMessage: r.content.length > 50 ? r.content.slice(0, 50) + '…' : r.content,
    lastMessageTime: r.created_at,
    lastRole: r.role === 'assistant' ? 'assistant' : 'user',
    unread: isFromPatient ? (prev?.unread ?? 0) + 1 : prev?.unread ?? 0,
  }
}

export default function WhatsAppPage() {
  const searchParams = useSearchParams()
  const phoneFromQuery = searchParams.get('phone')
  const autoSelectedRef = useRef<string | null>(null)

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
  // Status da Eva pra essa conversa especifica (lead). Quando humano assume
  // (envia msg manual ou foi escalado), Eva fica calada ate clicar "Devolver".
  const [leadEvaStatus, setLeadEvaStatus] = useState<{
    paused: boolean
    needsReview: boolean
    reviewReason: string | null
  }>({ paused: false, needsReview: false, reviewReason: null })
  const [resumingEva, setResumingEva] = useState(false)
  const [realtimeStatus, setRealtimeStatus] = useState<'idle' | 'connecting' | 'live' | 'error'>('idle')
  // Toggle Eva auto/manual: true = Eva responde automaticamente,
  // false = Eva fica calada e secretária responde pelo painel.
  const [evaEnabled, setEvaEnabled] = useState<boolean>(true)
  const [evaToggling, setEvaToggling] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const selectedThreadIdRef = useRef<string | null>(null)
  /** Apelidos das linhas (instance_name → label amigável) vindos da API */
  const [lineLabels, setLineLabels] = useState<Record<string, string>>({})
  /** Linhas conectadas onde a Eva pode atender (role_inbound) — para o seletor do toggle */
  const [waInboundLines, setWaInboundLines] = useState<
    Array<{
      instance_name: string
      auto_reply_enabled: boolean
      label: string | null
      phone_number: string | null
    }>
  >([])
  /** Qual linha o toggle "Eva ativa" controla quando há várias com inbound */
  const [evaControlInstance, setEvaControlInstance] = useState<string>('')
  /** Filtro de linha na lista de conversas: '' = todos, ou instance_name específica */
  const [lineFilter, setLineFilter] = useState<string>('')
  /** Todas as linhas distintas encontradas nas conversas (para montar as abas) */
  const [allLines, setAllLines] = useState<string[]>([])

  const { selectedLine } = useWaLine()

  // Mantem ref atualizada pra o handler de realtime saber qual conversa esta aberta
  useEffect(() => {
    selectedThreadIdRef.current = selectedConversation?.id ?? null
  }, [selectedConversation])

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const handleNewRow = useCallback((row: EvaRow) => {
    const tid = threadKey(row.phone, rowInstanceName(row))
    // Atualiza lista de conversas
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === tid)
      const updated = buildConversationFromRow(idx >= 0 ? prev[idx] : undefined, row)
      if (!updated) return prev
      const isOpen = selectedThreadIdRef.current === tid
      // se a conversa esta aberta, nao incrementa unread
      const finalConv = isOpen ? { ...updated, unread: 0 } : updated
      const filtered = prev.filter((c) => c.id !== tid)
      return [finalConv, ...filtered]
    })

    // Se a conversa esta aberta, append na thread
    if (selectedThreadIdRef.current === tid) {
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

  // Quando vem com ?phone=... (vindo da Eva IA), abre direto a conversa
  useEffect(() => {
    if (!phoneFromQuery || !clinicId) return
    if (autoSelectedRef.current === phoneFromQuery) return
    const conv = conversations.find((c) => c.phone === phoneFromQuery)
    if (conv) {
      autoSelectedRef.current = phoneFromQuery
      selectConversation(conv)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneFromQuery, clinicId, conversations])

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
      // Busca clinic_id do usuário autenticado (precisa pra realtime e queries diretas)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: userData } = await supabase
        .from('users')
        .select('clinic_id')
        .eq('id', user.id)
        .single()

      if (!userData?.clinic_id) return

      // Lê status da instância via API (server-side, com service role) — assim
      // não depende de RLS no client e a UI bate com /dashboard/config/whatsapp.
      const r = await fetch('/api/whatsapp/instance', { cache: 'no-store' })
      if (!r.ok) {
        setConfigured(false)
        return
      }
      const instance = (await r.json()) as {
        configured?: boolean
        status?: string
        instance_name?: string | null
        auto_reply_enabled?: boolean
        instances?: Array<{
          status: string
          instance_name: string
          auto_reply_enabled: boolean
          is_default: boolean
          role_inbound: boolean
          label?: string | null
          phone_number?: string | null
        }>
      }

      // Multi-numero: considera "configurado" se QUALQUER instance esta connected.
      const list = instance.instances ?? []
      const anyConnected = list.some(i => i.status === 'connected')
      const inboundConnected = list.filter(
        (i) => i.status === 'connected' && i.role_inbound !== false,
      )
      const mainForEva =
        inboundConnected.find((i) => i.is_default) ??
        inboundConnected[0] ??
        list.find((i) => i.is_default && i.status === 'connected') ??
        list.find((i) => i.status === 'connected')

      const labelMap: Record<string, string> = {}
      for (const i of list) {
        const friendly =
          (i.label && i.label.trim()) ||
          (i.phone_number && i.phone_number.replace(/\D/g, '').slice(-8)) ||
          i.instance_name.slice(0, 12)
        labelMap[i.instance_name] = friendly
      }
      setLineLabels(labelMap)

      if (anyConnected || (instance.configured && instance.status === 'connected')) {
        setConfig({
          instance_name: mainForEva?.instance_name ?? instance.instance_name ?? null,
        } as never)
        setConfigured(true)
        setClinicId(userData.clinic_id)

        setWaInboundLines(
          inboundConnected.map((i) => ({
            instance_name: i.instance_name,
            auto_reply_enabled: i.auto_reply_enabled !== false,
            label: i.label ?? null,
            phone_number: i.phone_number ?? null,
          })),
        )

        const nextCtrl =
          (evaControlInstance &&
            inboundConnected.some((i) => i.instance_name === evaControlInstance) &&
            evaControlInstance) ||
          mainForEva?.instance_name ||
          inboundConnected[0]?.instance_name ||
          ''
        setEvaControlInstance(nextCtrl)
        const ctrlRow = inboundConnected.find((i) => i.instance_name === nextCtrl) ?? mainForEva
        setEvaEnabled(ctrlRow?.auto_reply_enabled !== false)

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

  async function toggleEva() {
    console.log('[EvaToggle] click recebido', { clinicId, evaToggling, evaEnabled })
    if (evaToggling) {
      console.log('[EvaToggle] ignorado: ja em andamento')
      return
    }
    if (!clinicId) {
      console.warn('[EvaToggle] clinicId vazio — recarregando config antes')
      await loadConfig()
      alert('Tentando reconectar… clique de novo em 2 segundos.')
      return
    }
    const next = !evaEnabled
    setEvaToggling(true)
    setEvaEnabled(next)
    try {
      console.log('[EvaToggle] enviando PATCH', { enabled: next, instance_name: evaControlInstance })
      const r = await fetch('/api/whatsapp/instance/auto-reply', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: next,
          ...(evaControlInstance ? { instance_name: evaControlInstance } : {}),
        }),
      })
      const j = await r.json().catch(() => ({}))
      console.log('[EvaToggle] resposta', { status: r.status, body: j })
      if (!r.ok) {
        throw new Error(j.error || `HTTP ${r.status}`)
      }
    } catch (error) {
      console.error('[EvaToggle] falha:', error)
      setEvaEnabled(!next)
      alert('Falha ao alternar Eva: ' + (error instanceof Error ? error.message : 'erro desconhecido'))
    } finally {
      setEvaToggling(false)
    }
  }

  async function loadConversations(clinicId: string) {
    const { data } = await supabase
      .from('eva_conversations')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })

    if (!data) return

    // Agrupa por telefone + linha (instance), ordem mais recente primeiro
    const seen = new Set<string>()
    const convs: Conversation[] = []
    const linesFound = new Set<string>()
    for (const r of data as EvaRow[]) {
      if (!r.content) continue
      const inst = rowInstanceName(r)
      if (inst) linesFound.add(inst)
      const tid = threadKey(r.phone, inst)
      if (seen.has(tid)) continue
      seen.add(tid)
      const conv = buildConversationFromRow(undefined, r)
      if (conv) convs.push({ ...conv, unread: 0 })
    }
    setConversations(convs)
    setAllLines(Array.from(linesFound))
  }

  async function loadMessages(phone: string, instanceName: string | null) {
    if (!clinicId) return

    // Reset status da Eva pra essa nova conversa (evita flash do status anterior)
    setLeadEvaStatus({ paused: false, needsReview: false, reviewReason: null })

    const { data: msgs } = await supabase
      .from('eva_conversations')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('phone', phone)
      .order('created_at', { ascending: true })

    const instNorm = (instanceName ?? '').trim()
    const rows = ((msgs ?? []) as EvaRow[]).filter((row) => {
      // Se não há instanceName definido, mostra tudo
      if (!instNorm) return true
      const ri = (rowInstanceName(row) ?? '').trim()
      // Aceita: mesma instância OU sem instância gravada (mensagens antigas)
      return ri === instNorm || ri === ''
    })

    const mapped = rows
      .map(rowToMessage)
      .filter((m): m is Message => m !== null)

    // Regenera signed URLs frescos pras mídias persistidas.
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

    const tid = threadKey(phone, instanceName)
    setConversations((prev) =>
      prev.map((c) => (c.id === tid ? { ...c, unread: 0 } : c)),
    )

    const { data: patientData } = await supabase
      .from('patients')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('phone', phone)
      .maybeSingle()

    setPatient(patientData)

    // Status do lead — Eva pausada / em revisão humana?
    const { data: leadData } = await supabase
      .from('leads')
      .select('eva_pause_until, needs_human_review, human_review_reason')
      .eq('clinic_id', clinicId)
      .eq('phone', phone)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const pauseUntil = leadData?.eva_pause_until
    const isPaused = !!(pauseUntil && new Date(pauseUntil).getTime() > Date.now())
    setLeadEvaStatus({
      paused: isPaused,
      needsReview: leadData?.needs_human_review === true,
      reviewReason: leadData?.human_review_reason ?? null,
    })
  }

  async function resumeEva() {
    if (!selectedConversation || resumingEva) return
    setResumingEva(true)
    try {
      const res = await fetch('/api/whatsapp/resume-eva', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: selectedConversation.phone }),
      })
      if (res.ok) {
        setLeadEvaStatus({ paused: false, needsReview: false, reviewReason: null })
      } else {
        const err = await res.json().catch(() => ({}))
        alert(`Não foi possível devolver pra Eva: ${err.error || 'erro desconhecido'}`)
      }
    } catch (e) {
      alert(`Erro: ${e instanceof Error ? e.message : 'desconhecido'}`)
    } finally {
      setResumingEva(false)
    }
  }

  /**
   * Apos o /api/whatsapp/send responder OK, recebemos o conversation_id real.
   * Trocamos o id da mensagem optimista pelo real pra que o realtime
   * subscription nao duplique quando o INSERT chegar (o handleNewRow ja
   * dedupa por id).
   */
  function reconcileOptimistic(optimisticId: string, realId: string | undefined) {
    if (!realId) return
    setMessages((prev) => {
      const hasReal = prev.some((m) => m.id === realId)
      if (hasReal) {
        return prev.filter((m) => m.id !== optimisticId)
      }
      return prev.map((m) => (m.id === optimisticId ? { ...m, id: realId } : m))
    })
  }

  async function sendMessage() {
    if (!newMessage.trim() || !selectedConversation || !config) return

    setSending(true)
    const optimisticId = `tmp-${Date.now()}`
    const optimistic: Message = {
      id: optimisticId,
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
          ...(selectedConversation.instanceName
            ? { instance_name: selectedConversation.instanceName }
            : {}),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
        alert(`Falha ao enviar: ${data.error || response.status}`)
      } else {
        reconcileOptimistic(optimisticId, data.persisted?.conversation_id)
        // Envio manual pausa Eva nessa conversa (UI imediata; backend ja salvou)
        setLeadEvaStatus((prev) => ({ ...prev, paused: true }))
      }
    } catch (error) {
      console.error('Error sending:', error)
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
    } finally {
      setSending(false)
    }
  }

  async function sendImage(file: File, caption?: string) {
    if (!selectedConversation || !config) return
    setSending(true)
    const previewUrl = URL.createObjectURL(file)
    const optimisticId = `tmp-${Date.now()}`
    const optimistic: Message = {
      id: optimisticId,
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
          ...(selectedConversation.instanceName
            ? { instance_name: selectedConversation.instanceName }
            : {}),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
        alert(`Falha ao enviar imagem: ${data.error || response.status}`)
      } else {
        reconcileOptimistic(optimisticId, data.persisted?.conversation_id)
        setLeadEvaStatus((prev) => ({ ...prev, paused: true }))
      }
    } catch (error) {
      console.error('Error sending image:', error)
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
      alert('Erro inesperado ao enviar imagem')
    } finally {
      setSending(false)
    }
  }

  async function sendAudio(blob: Blob) {
    if (!selectedConversation || !config) return
    setSending(true)
    const previewUrl = URL.createObjectURL(blob)
    const optimisticId = `tmp-${Date.now()}`
    const optimistic: Message = {
      id: optimisticId,
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
          mimetype: blob.type || 'audio/ogg',
          ...(selectedConversation.instanceName
            ? { instance_name: selectedConversation.instanceName }
            : {}),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
        alert(`Falha ao enviar áudio: ${data.error || response.status}`)
      } else {
        reconcileOptimistic(optimisticId, data.persisted?.conversation_id)
        setLeadEvaStatus((prev) => ({ ...prev, paused: true }))
      }
    } catch (error) {
      console.error('Error sending audio:', error)
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
      alert('Erro inesperado ao enviar áudio')
    } finally {
      setSending(false)
    }
  }

  function selectConversation(conv: Conversation) {
    setSelectedConversation(conv)
    loadMessages(conv.phone, conv.instanceName)
    // Sincroniza o toggle da Eva com a linha dessa conversa
    if (conv.instanceName) {
      const lineRow = waInboundLines.find((i) => i.instance_name === conv.instanceName)
      if (lineRow) {
        setEvaControlInstance(conv.instanceName)
        setEvaEnabled(lineRow.auto_reply_enabled !== false)
      }
    }
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">WhatsApp</h1>
            <RealtimeBadge status={realtimeStatus} />
          </div>
          <p className="text-sm text-slate-500">Conversas via Evolution API</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <EvaToggle
            enabled={evaEnabled}
            disabled={evaToggling}
            onToggle={toggleEva}
            label={
              evaControlInstance && lineLabels[evaControlInstance]
                ? lineLabels[evaControlInstance]
                : undefined
            }
          />
          <button
            onClick={() => loadConfig()}
            className="btn-secondary flex items-center gap-2"
            title="Recarregar conversas"
          >
            <Icon name="refresh" className="w-4 h-4" />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>
      </div>

      <div className="flex-1 card overflow-hidden flex">
        {/* Lista de conversas — esconde no mobile quando tem chat aberto */}
        <div className={`${selectedConversation ? 'hidden md:flex' : 'flex'} w-full md:w-80 border-r border-slate-200 dark:border-slate-700 flex-col flex-shrink-0`}>
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

          {/* Abas de filtro por linha — só aparece quando há mais de 1 linha */}
          {allLines.length > 1 && (
            <div className="flex border-b border-slate-100 dark:border-slate-700 overflow-x-auto">
              <button
                onClick={() => setLineFilter('')}
                className={`flex-shrink-0 px-3 py-2 text-xs font-medium transition-colors border-b-2 ${
                  lineFilter === ''
                    ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Todos
              </button>
              {allLines.map((inst) => {
                const label = lineLabels[inst] ?? inst.slice(0, 10)
                const isInbound = waInboundLines.some((l) => l.instance_name === inst)
                return (
                  <button
                    key={inst}
                    onClick={() => setLineFilter(inst)}
                    className={`flex-shrink-0 flex items-center gap-1 px-3 py-2 text-xs font-medium transition-colors border-b-2 ${
                      lineFilter === inst
                        ? 'border-violet-500 text-violet-700 dark:text-violet-400'
                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        isInbound ? 'bg-emerald-500' : 'bg-slate-400'
                      }`}
                    />
                    {label}
                  </button>
                )
              })}
            </div>
          )}
          
          <div className="flex-1 overflow-y-auto">
            {conversations.filter(c => {
              const active = selectedLine || lineFilter
              return !active || c.instanceName === active
            }).length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Icon name="message" className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>Nenhuma conversa ainda</p>
              </div>
            ) : (
              conversations
                .filter(c => {
                  const active = selectedLine || lineFilter
                  return !active || c.instanceName === active
                })
                .map(conv => {
                const isInbound = conv.instanceName
                  ? waInboundLines.some((l) => l.instance_name === conv.instanceName)
                  : false
                return (
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
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">{conv.name}</p>
                      </div>
                      {conv.instanceName ? (
                        <div className="flex items-center gap-1 mt-0.5">
                          <span
                            className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                              isInbound ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                          />
                          <p className="text-[10px] text-violet-600 dark:text-violet-400 truncate font-medium">
                            {lineLabels[conv.instanceName] ?? conv.instanceName.slice(0, 12)}
                            {!isInbound && <span className="ml-1 text-slate-400">(manual)</span>}
                          </p>
                        </div>
                      ) : null}
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
                )
              })
            )}
          </div>
        </div>

        {/* Chat */}
        {/* Painel do chat — ocupa tela toda no mobile */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedConversation ? (
            <>
              {/* Header do chat */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
                {/* Botão voltar — só no mobile */}
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex-shrink-0"
                >
                  <Icon name="chevron-left" className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                </button>
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                    {selectedConversation.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 dark:text-white">{selectedConversation.name}</p>
                  <p className="text-xs text-slate-500">{selectedConversation.phone}</p>
                  {selectedConversation.instanceName ? (() => {
                    const isInbound = waInboundLines.some(
                      (l) => l.instance_name === selectedConversation.instanceName,
                    )
                    const lineLabel =
                      lineLabels[selectedConversation.instanceName] ??
                      selectedConversation.instanceName
                    return (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className={`inline-block w-1.5 h-1.5 rounded-full ${
                            isInbound ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                        />
                        <p className="text-[10px] text-violet-600 dark:text-violet-400 font-medium">
                          {lineLabel}
                          {isInbound
                            ? evaEnabled
                              ? ' · Eva ativa'
                              : ' · Eva pausada'
                            : ' · só manual'}
                        </p>
                      </div>
                    )
                  })() : null}
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

              {/* Banner: Eva pausada (intervencao humana) */}
              {(leadEvaStatus.paused || leadEvaStatus.needsReview) && (
                <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/50 flex items-center gap-3">
                  <span className="text-lg">🤝</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                      {leadEvaStatus.needsReview
                        ? `Atendimento humano${leadEvaStatus.reviewReason ? ` (${leadEvaStatus.reviewReason})` : ''}`
                        : 'Você assumiu essa conversa'}
                    </p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-300/80 truncate">
                      Eva está calada nessa conversa. Quando terminar, devolva pra ela voltar a responder automaticamente.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={resumeEva}
                    disabled={resumingEva}
                    className="shrink-0 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    {resumingEva ? (
                      <>
                        <Icon name="loader" className="w-3 h-3 animate-spin" />
                        Devolvendo…
                      </>
                    ) : (
                      <>
                        <span className="text-sm">✨</span>
                        Devolver pra Eva
                      </>
                    )}
                  </button>
                </div>
              )}

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

        {msg.kind === 'image' && !msg.mediaUrl && msg.mediaPath && (
          <div className="mb-1 px-3 py-2 rounded-xl bg-black/10 text-xs italic">
            🖼️ Imagem (carregando…)
          </div>
        )}

        {msg.kind === 'image' && !msg.mediaUrl && !msg.mediaPath && (
          <div className="mb-1 px-3 py-2 rounded-xl bg-amber-500/20 text-xs italic flex items-center gap-2">
            <span>🖼️</span>
            <span>Imagem (não foi possível baixar — confira no celular)</span>
          </div>
        )}

        {msg.kind === 'audio' && msg.mediaUrl && (
          <audio controls src={msg.mediaUrl} className="max-w-[240px] mt-0.5">
            Seu navegador não suporta áudio.
          </audio>
        )}

        {msg.kind === 'audio' && !msg.mediaUrl && msg.mediaPath && (
          <div className="px-2 py-1 rounded-lg bg-black/10 text-xs italic flex items-center gap-2">
            <Icon name="mic" className="w-3 h-3" />
            Áudio (carregando…)
          </div>
        )}

        {msg.kind === 'audio' && !msg.mediaUrl && !msg.mediaPath && (
          <div className="px-2 py-1 rounded-lg bg-amber-500/20 text-xs italic flex items-center gap-2">
            <Icon name="mic" className="w-3 h-3" />
            Áudio (não foi possível baixar — confira no celular)
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

/**
 * Toggle Eva auto/manual.
 *
 * - 🤖 Eva ativa (verde): respostas automáticas via Edge Function eva-process
 * - 👤 Modo manual (cinza): Eva fica calada; secretária responde pelo painel
 *
 * O estado é persistido em `clinic_whatsapp.auto_reply_enabled`. Webhook e
 * cron eva-followup respeitam o valor.
 */
function EvaToggle({
  enabled,
  disabled,
  onToggle,
  label,
}: {
  enabled: boolean
  disabled: boolean
  onToggle: () => void
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      disabled={disabled}
      title={
        enabled
          ? 'Eva está respondendo automaticamente. Clique para PAUSAR (modo manual).'
          : 'Eva está em MODO MANUAL — você responde, ela fica calada. Clique para reativar.'
      }
      className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
        enabled
          ? 'bg-gradient-to-br from-violet-50 to-emerald-50 border-violet-200 hover:from-violet-100 hover:to-emerald-100 text-violet-900 dark:from-violet-900/20 dark:to-emerald-900/20 dark:border-violet-700 dark:text-violet-100'
          : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
      } ${disabled ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}
    >
      <span className="text-base leading-none">{enabled ? '🤖' : '👤'}</span>
      <div className="flex flex-col items-start leading-tight">
        <span className="text-xs font-semibold">
          {enabled ? 'Eva ativa' : 'Modo manual'}
        </span>
        <span className="text-[10px] text-slate-500 dark:text-slate-400 hidden sm:inline">
          {label ? label : (enabled ? 'respondendo auto.' : 'você responde')}
        </span>
      </div>
      <div
        className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
          enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
        }`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
            enabled ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </div>
    </button>
  )
}
