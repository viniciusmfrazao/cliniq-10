'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { useWaLine } from '@/contexts/WaLineContext'
import ScheduleModal from './schedule-modal'

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
  transcription?: string | null
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
    transcription?: string | null
  } | null
}

function threadKey(phone: string, instanceName: string | null | undefined): string {
  return phone // agrupa só por telefone — evita duplicatas por linha
}

function rowInstanceName(r: EvaRow): string | null {
  const m = r.metadata
  if (m && typeof m === 'object' && 'instance_name' in m && m.instance_name != null) {
    return String(m.instance_name)
  }
  return null
}

// Label do separador de data entre mensagens: "Hoje", "Ontem" ou "10 de julho".
// Comparação sempre no fuso America/Sao_Paulo, igual ao horário mostrado nas bolhas.
function dateSeparatorLabel(iso: string): string {
  const tz = 'America/Sao_Paulo'
  const dayKey = (d: Date) =>
    d.toLocaleDateString('en-CA', { timeZone: tz }) // YYYY-MM-DD, estável pra comparar

  const msgDate = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)

  if (dayKey(msgDate) === dayKey(today)) return 'Hoje'
  if (dayKey(msgDate) === dayKey(yesterday)) return 'Ontem'

  return msgDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: dayKey(msgDate).slice(0, 4) === dayKey(today).slice(0, 4) ? undefined : 'numeric',
    timeZone: tz,
  })
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
    transcription: r.metadata?.transcription ?? null,
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
  // Usa push_name só de mensagens do cliente (role='user')
  // Evita exibir nome da secretária/Eva quando ela foi a última a falar
  const pushName = r.role === 'user' ? (r.metadata?.push_name || null) : null
  const name = pushName || prev?.name || r.phone
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

  const [crmLead, setCrmLead] = useState<{
    id: string
    name: string
    status: string
  } | null>(null)
  /** custom_stages da linha de crm_settings que se aplica ao lead da
   * conversa aberta — null = usa os padrões (DEFAULT_CRM_STAGES) */
  const [crmStagesConfig, setCrmStagesConfig] = useState<
    { id: string; label: string; color: string }[] | null
  >(null)
  const [updatingCrm, setUpdatingCrm] = useState(false)
  const [resumingEva, setResumingEva] = useState(false)
  const [realtimeStatus, setRealtimeStatus] = useState<'idle' | 'connecting' | 'live' | 'error'>('idle')
  // Toggle Eva auto/manual: true = Eva responde automaticamente,
  // false = Eva fica calada e secretária responde pelo painel.
  const [evaEnabled, setEvaEnabled] = useState<boolean>(true)
  const [hasEvaModule, setHasEvaModule] = useState<boolean>(false)
  const [hasCrmModule, setHasCrmModule] = useState<boolean>(false)
  const [evaToggling, setEvaToggling] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const selectedThreadIdRef = useRef<string | null>(null)
  const conversationsRef = useRef<Conversation[]>([])
  /** Apelidos das linhas (instance_name → label amigável) vindos da API */
  const [lineLabels, setLineLabels] = useState<Record<string, string>>({})
  /** Linhas conectadas onde a Eva pode atender (role_inbound) — para o seletor do toggle */
  const [waInboundLines, setWaInboundLines] = useState<
    Array<{
      instance_name: string
      auto_reply_enabled: boolean
      role_inbound: boolean
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

  // Busca e filtro de status
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'waiting'>('all')

  // Modal de agendamento direto pelo chat
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [schedulePatient, setSchedulePatient] = useState<any>(null)

  // Mantem ref atualizada pra o handler de realtime saber qual conversa esta aberta
  useEffect(() => {
    selectedThreadIdRef.current = selectedConversation?.id ?? null
  }, [selectedConversation])

  useEffect(() => {
    conversationsRef.current = conversations
  }, [conversations])

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

  // Segurança: com 2+ linhas, sempre força uma selecionada especificamente —
  // nunca deixa em branco (que mostraria conversas de todas misturadas).
  // Se a selecionada some (desconectou/perdeu permissão), cai pra outra
  // válida (prioriza a default), nunca pra "todos".
  useEffect(() => {
    if (waInboundLines.length <= 1) return
    const stillValid = lineFilter && waInboundLines.some(l => l.instance_name === lineFilter)
    if (!stillValid) {
      const fallback =
        waInboundLines.find(l => l.instance_name === evaControlInstance) ??
        waInboundLines[0]
      setLineFilter(fallback.instance_name)
    }
  }, [waInboundLines, lineFilter, evaControlInstance])

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

  // Reconcilia (rebusca do banco) a lista de conversas + a conversa aberta.
  // Usado depois de qualquer gap de realtime (reconexão do canal ou volta de
  // foco da aba) pra pegar mensagens que chegaram enquanto o WebSocket
  // estava caído — o Postgres Changes não faz replay de eventos perdidos.
  const reconcile = useCallback(() => {
    if (!clinicId) return
    loadConversations(clinicId)
    const open = selectedThreadIdRef.current
    if (open) {
      const conv = conversationsRef.current.find((c) => c.id === open)
      if (conv) loadMessages(conv.phone, conv.instanceName)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId])

  // Subscription Realtime — reconexão automática em caso de erro
  useEffect(() => {
    if (!clinicId) return

    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let destroyed = false
    let hasConnectedBefore = false

    // Nome fixo do canal (sem Date.now) — evita múltiplos canais acumulados
    const CHANNEL_NAME = `whatsapp:${clinicId}`

    // Remove canal anterior se existir (segurança contra double-mount)
    try { supabase.removeChannel(supabase.channel(CHANNEL_NAME)) } catch { /* noop */ }

    function subscribe() {
      if (destroyed) return
      setRealtimeStatus('connecting')

      const channel = supabase
        .channel(CHANNEL_NAME)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'eva_conversations',
            filter: `clinic_id=eq.${clinicId}`,
          },
          (payload) => {
            if (!destroyed) handleNewRow(payload.new as EvaRow)
          },
        )
        .subscribe((status) => {
          if (destroyed) return
          if (status === 'SUBSCRIBED') {
            setRealtimeStatus('live')
            if (retryTimer) { clearTimeout(retryTimer); retryTimer = null }
            // Reconectou depois de ter caído (não é a primeira conexão) —
            // pode ter perdido inserts durante o gap, então rebusca.
            if (hasConnectedBefore) reconcile()
            hasConnectedBefore = true
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setRealtimeStatus('error')
            // Reconectar após 5s — sem re-criar canal duplicado
            if (retryTimer) clearTimeout(retryTimer)
            retryTimer = setTimeout(() => {
              try { supabase.removeChannel(channel) } catch { /* noop */ }
              subscribe()
            }, 5000)
          }
        })
    }

    subscribe()

    // Navegadores throttlam/matam WebSockets com a aba em background sem
    // sempre disparar CHANNEL_ERROR de forma limpa — ao voltar o foco,
    // rebusca como rede de segurança extra.
    function onVisible() {
      if (document.visibilityState === 'visible') reconcile()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      destroyed = true
      if (retryTimer) clearTimeout(retryTimer)
      document.removeEventListener('visibilitychange', onVisible)
      try { supabase.removeChannel(supabase.channel(CHANNEL_NAME)) } catch { /* noop */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId, reconcile])

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
          role_outbound_manual: boolean
          label?: string | null
          phone_number?: string | null
        }>
      }

      // Multi-numero: considera "configurado" se QUALQUER instance esta connected.
      const list = instance.instances ?? []
      const anyConnected = list.some(i => i.status === 'connected')
      // Linhas onde a Eva pode atender (role_inbound) — usado só pro toggle
      // "Eva ativa" (qual instância ele liga/desliga).
      const inboundConnected = list.filter(
        (i) => i.status === 'connected' && i.role_inbound !== false,
      )
      // Linhas de atendimento em geral — Eva OU secretária atendendo manual
      // (role_outbound_manual). Usado pro seletor de número na tela de
      // Conversas: a Sarah tem a Eva num número e a secretária atende manual
      // no outro, então os dois precisam aparecer aqui pra escolher.
      const chatCapableConnected = list.filter(
        (i) => i.status === 'connected' && (i.role_inbound !== false || i.role_outbound_manual !== false),
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

        // Verificar se clínica tem módulo Eva IA ativo
        const { data: clinicData } = await supabase
          .from('clinics')
          .select('settings')
          .eq('id', userData.clinic_id)
          .single()
        const activeModules: string[] = clinicData?.settings?.active_modules ?? []
        setHasEvaModule(activeModules.includes('eva_ia'))
        setHasCrmModule(activeModules.includes('crm'))

        const inboundLines = chatCapableConnected.map((i) => ({
          instance_name: i.instance_name,
          auto_reply_enabled: i.auto_reply_enabled !== false,
          role_inbound: i.role_inbound !== false,
          label: i.label ?? null,
          phone_number: i.phone_number ?? null,
        }))

        setWaInboundLines(inboundLines)

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

        loadConversations(userData.clinic_id, inboundLines)
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

  type InboundLine = { instance_name: string; auto_reply_enabled: boolean; role_inbound?: boolean; label: string | null; phone_number: string | null }

  async function loadConversations(clinicId: string, inboundLinesParam?: InboundLine[]) {
    // Usa as inbound lines passadas como parâmetro ou as do estado
    const effectiveInboundLines = inboundLinesParam ?? waInboundLines

    // RPC que já devolve 1 linha por telefone (a mais recente + não lidas),
    // agregado no servidor — evita o corte de ~1000 linhas que o select cru
    // sofria (linhas com menos volume, como a da Eva, sumiam da lista quando
    // a outra linha tinha muita atividade recente).
    const { data, error } = await supabase.rpc('get_whatsapp_conversation_threads', {
      p_clinic_id: clinicId,
    })

    if (error) {
      console.error('Erro ao carregar conversas:', error)
      return
    }
    if (!data) return

    type ThreadRow = {
      phone: string
      content: string | null
      role: 'user' | 'assistant' | null
      created_at: string
      metadata: EvaRow['metadata']
      unread_count: number
    }

    const convs: Conversation[] = []
    const linesFound = new Set<string>()

    // Instâncias de atendimento (Eva ou manual) — usadas pra decidir quais
    // mensagens entram na lista de conversas
    const inboundInstances = new Set(
      effectiveInboundLines.map((l) => l.instance_name)
    )

    for (const t of data as ThreadRow[]) {
      if (!t.content) continue
      const phone = t.phone ?? ''
      if (phone.length > 15) continue
      if (phone.includes('@g.us')) continue

      const row: EvaRow = {
        id: phone,
        clinic_id: clinicId,
        phone,
        role: t.role,
        content: t.content,
        created_at: t.created_at,
        metadata: t.metadata,
      }
      const inst = rowInstanceName(row)

      // Filtrar mensagens de instâncias que não são inbound (ex: automações)
      if (inboundInstances.size > 0 && inst && !inboundInstances.has(inst)) continue

      if (inst) linesFound.add(inst)

      const conv = buildConversationFromRow(undefined, row)
      if (conv) convs.push({ ...conv, unread: t.unread_count ?? 0 })
    }

    // Buscar nomes dos leads para enriquecer a lista
    const phones = convs.map(c => c.phone).filter(Boolean)
    if (phones.length > 0 && clinicId) {
      const { data: leadsData } = await supabase
        .from('leads')
        .select('phone, name')
        .eq('clinic_id', clinicId)
        .in('phone', phones)
      if (leadsData && leadsData.length > 0) {
        const leadNameMap = new Map(leadsData.map(l => [l.phone, l.name]))
        convs.forEach(c => {
          const leadName = leadNameMap.get(c.phone)
          const isPhoneAsName = leadName && /^\d{8,}$/.test(leadName.replace(/[\s+()-]/g, ''))
          if (leadName && leadName.trim().length > 2 && !isPhoneAsName && !/^lead whatsapp$/i.test(leadName)) {
            c.name = leadName
          }
        })
      }
    }
    // Enriquecer com nome do paciente cadastrado (prioridade sobre lead)
    if (phones.length > 0 && clinicId) {
      const { data: patientsData } = await supabase
        .from('patients')
        .select('phone, name')
        .eq('clinic_id', clinicId)
        .in('phone', phones)
      if (patientsData && patientsData.length > 0) {
        const patientNameMap = new Map(patientsData.map((p: any) => [p.phone, p.name]))
        convs.forEach(c => {
          const patientName = patientNameMap.get(c.phone)
          if (patientName && patientName.trim().length > 2) {
            c.name = patientName
          }
        })
      }
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
      .select('id, name, status, eva_pause_until, needs_human_review, human_review_reason, whatsapp_instance')
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
    setCrmLead(leadData?.id ? {
      id: leadData.id,
      name: leadData.name || 'Lead',
      status: leadData.status || 'new',
    } : null)

    // Busca as MESMAS etapas configuradas no CRM (crm-settings), pra esse
    // dropdown nunca ter nome ou opção diferente do Kanban. Prioriza a linha
    // de crm_settings da instância do lead; sem match, usa a padrão (null).
    const { data: crmSettingsRows } = await supabase
      .from('crm_settings')
      .select('custom_stages, whatsapp_instance')
      .eq('clinic_id', clinicId)
    const matchedSettings =
      crmSettingsRows?.find(s => s.whatsapp_instance === leadData?.whatsapp_instance) ??
      crmSettingsRows?.find(s => !s.whatsapp_instance) ??
      null
    setCrmStagesConfig(matchedSettings?.custom_stages ?? null)
  }

  // ── CRM: atualizar status do lead diretamente do WhatsApp ──
  // Mesmas etapas do Kanban (crm_settings.custom_stages da linha certa),
  // com fallback pros padrões — nunca um nome ou status que não existe
  // no CRM (ex: 'waiting' não é uma coluna real do funil).
  const STAGE_COLOR_CLASSES: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-600',
    blue: 'bg-blue-100 text-blue-700',
    amber: 'bg-amber-100 text-amber-700',
    violet: 'bg-violet-100 text-violet-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-700',
    pink: 'bg-pink-100 text-pink-700',
    cyan: 'bg-cyan-100 text-cyan-700',
  }
  const DEFAULT_CRM_STAGES = [
    { value: 'new', label: 'Novo Lead', color: 'slate' },
    { value: 'contacted', label: 'Em Conversa', color: 'blue' },
    { value: 'scheduled', label: 'Agendado', color: 'amber' },
    { value: 'converted', label: 'Cliente', color: 'emerald' },
    { value: 'lost', label: 'Perdido', color: 'red' },
  ]
  const CRM_STAGES = (
    crmStagesConfig && crmStagesConfig.length > 0
      ? crmStagesConfig.map(s => ({ value: s.id, label: s.label, color: s.color }))
      : DEFAULT_CRM_STAGES
  ).map(s => ({ ...s, color: STAGE_COLOR_CLASSES[s.color] ?? STAGE_COLOR_CLASSES.slate }))

  async function updateCrmStatus(newStatus: string) {
    if (!crmLead || !clinicId) return
    setUpdatingCrm(true)
    const { error } = await supabase
      .from('leads')
      .update({ status: newStatus, last_contact_at: new Date().toISOString() })
      .eq('id', crmLead.id)
      .eq('clinic_id', clinicId)
    if (!error) {
      setCrmLead(prev => prev ? { ...prev, status: newStatus } : null)
    }
    setUpdatingCrm(false)
  }

  async function createLead() {
    if (!selectedConversation || !clinicId) return
    setUpdatingCrm(true)
    const name = selectedConversation.name || selectedConversation.phone
    const { data, error } = await supabase
      .from('leads')
      .insert({
        clinic_id: clinicId,
        name,
        phone: selectedConversation.phone,
        source: 'whatsapp',
        status: 'new',
        whatsapp_chat_id: selectedConversation.phone,
        last_whatsapp_at: new Date().toISOString(),
        last_contact_at: new Date().toISOString(),
      })
      .select('id, name, status')
      .single()
    if (data) setCrmLead(data)
    setUpdatingCrm(false)
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
    <div className="h-[calc(100dvh-200px)] md:h-[calc(100dvh-140px)] flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">WhatsApp</h1>
            <RealtimeBadge status={realtimeStatus} />
          </div>
          <p className="text-sm text-slate-500">Conversas via Evolution API</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Seletor de número — aparece quando há 2+ linhas de atendimento
              (Eva OU atendimento manual, role_inbound || role_outbound_manual).
              Linha só de automação sem atendimento manual nunca entra aqui.
              Sem opção "Todos": é sempre um número específico por vez, nunca
              uma visão combinada (evita misturar conversas de linhas diferentes). */}
          {waInboundLines.length > 1 && (
            <select
              value={waInboundLines.some(l => l.instance_name === lineFilter) ? lineFilter : ''}
              onChange={(e) => setLineFilter(e.target.value)}
              className="btn-secondary text-sm pr-8"
              title="Escolher qual número exibir"
            >
              {waInboundLines.map((l) => (
                <option key={l.instance_name} value={l.instance_name}>
                  {(l.role_inbound ? 'Eva · ' : 'Manual · ') + (lineLabels[l.instance_name] ?? l.instance_name.slice(0, 10))}
                </option>
              ))}
            </select>
          )}
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

      <div className="flex-1 card overflow-hidden flex min-w-0">
        {/* Lista de conversas — esconde no mobile quando tem chat aberto */}
        <div className={`${selectedConversation ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 border-r border-slate-200 dark:border-slate-700 flex-col flex-shrink-0 min-w-0 md:min-w-[320px]`}>
          <div className="p-3 border-b border-slate-100 dark:border-slate-700 space-y-2">
            <div className="relative">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nome ou número..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setStatusFilter('all')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === 'all' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700'}`}
              >
                Todos
              </button>
              <button
                onClick={() => setStatusFilter('waiting')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 ${statusFilter === 'waiting' ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700'}`}
              >
                Aguardando
                {conversations.filter(c => c.unread > 0 && (!lineFilter || c.instanceName === lineFilter)).length > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${statusFilter === 'waiting' ? 'bg-white/30 text-white' : 'bg-emerald-500 text-white'}`}>
                    {conversations.filter(c => c.unread > 0 && (!lineFilter || c.instanceName === lineFilter)).length}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {conversations.filter(c => {
              return !lineFilter || c.instanceName === lineFilter
            }).length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Icon name="message" className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>Nenhuma conversa ainda</p>
              </div>
            ) : (
              conversations
                .filter(c => {
                  if (lineFilter && c.instanceName !== lineFilter) return false
                  if (statusFilter === 'waiting' && c.unread === 0) return false
                  if (searchQuery.trim()) {
                    const q = searchQuery.toLowerCase()
                    return c.name.toLowerCase().includes(q) || c.phone.includes(q)
                  }
                  return true
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
                        {new Date(conv.lastMessageTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}
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
        <div className={`${selectedConversation ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0`}>
          {selectedConversation ? (
            <>
              {/* Header do chat */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
                {/* Botão voltar — só no mobile */}
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex-shrink-0"
                >
                  <Icon name="arrowLeft" className="w-5 h-5 text-slate-600 dark:text-slate-300" />
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
                {/* CRM — seletor de status do lead */}
                {hasCrmModule && (
                  crmLead ? (
                    <select
                      value={crmLead.status}
                      onChange={e => updateCrmStatus(e.target.value)}
                      disabled={updatingCrm}
                      className={`text-xs font-semibold px-2 py-1 rounded-lg border-0 cursor-pointer disabled:opacity-60 transition-colors ${
                        CRM_STAGES.find(s => s.value === crmLead.status)?.color || 'bg-slate-100 text-slate-600'
                      }`}
                      title="Mover no CRM"
                    >
                      {CRM_STAGES.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  ) : (
                    <button
                      onClick={createLead}
                      disabled={updatingCrm}
                      className="px-2 py-1 bg-violet-50 text-violet-600 hover:bg-violet-100 rounded-lg text-xs font-medium border border-violet-200 disabled:opacity-60 flex items-center gap-1 transition-colors"
                      title="Criar lead no CRM"
                    >
                      <Icon name="plus" className="w-3 h-3" />
                      <span className="hidden sm:inline">Lead</span>
                    </button>
                  )
                )}
                <button
                  onClick={() => {
                    setSchedulePatient(patient)
                    setShowScheduleModal(true)
                  }}
                  className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                  title="Agendar consulta"
                >
                  <Icon name="calendar" className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Agendar</span>
                </button>
              </div>

              {/* Banner: Eva pausada - so aparece se clinica tem Eva */}
              {hasEvaModule && (leadEvaStatus.paused || leadEvaStatus.needsReview) && (
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
                {messages.map((msg, idx) => {
                  const prev = idx > 0 ? messages[idx - 1] : null
                  const showDateSeparator =
                    !prev ||
                    dateSeparatorLabel(prev.created_at) !== dateSeparatorLabel(msg.created_at)
                  return (
                    <div key={msg.id}>
                      {showDateSeparator && (
                        <div className="flex justify-center my-2">
                          <span className="text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-700 dark:text-slate-300 rounded-full px-3 py-1">
                            {dateSeparatorLabel(msg.created_at)}
                          </span>
                        </div>
                      )}
                      <MessageBubble msg={msg} />
                    </div>
                  )
                })}
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

      {/* Modal de agendamento rápido */}
      {showScheduleModal && clinicId && (
        <ScheduleModal
          clinicId={clinicId}
          patient={schedulePatient || (selectedConversation ? { id: patient?.id || '', name: selectedConversation.name, phone: selectedConversation.phone } : null)}
          onClose={() => setShowScheduleModal(false)}
          onScheduled={() => {}}
        />
      )}
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
    timeZone: 'America/Sao_Paulo',
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
          <div>
            <audio controls src={msg.mediaUrl} className="max-w-[240px] mt-0.5">
              Seu navegador não suporta áudio.
            </audio>
            {msg.transcription && (
              <p className={`text-xs mt-1 italic opacity-80 max-w-[240px] ${isMine ? 'text-emerald-100' : 'text-slate-500'}`}>
                🎙️ &ldquo;{msg.transcription}&rdquo;
              </p>
            )}
          </div>
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

        {msg.kind === 'video' && msg.mediaUrl && (
          <video
            controls
            src={msg.mediaUrl}
            className="rounded-xl max-w-[260px] max-h-[320px] mb-1 -mx-1 -mt-1"
          >
            Seu navegador não suporta vídeo.
          </video>
        )}

        {msg.kind === 'video' && !msg.mediaUrl && msg.mediaPath && (
          <div className={`px-3 py-2 rounded-xl ${isMine ? 'bg-emerald-600/40' : 'bg-black/10'} text-xs italic flex items-center gap-2`}>
            <span>🎬</span>
            <span>Vídeo (carregando…)</span>
          </div>
        )}

        {msg.kind === 'video' && !msg.mediaUrl && !msg.mediaPath && (
          <div className="px-3 py-2 rounded-xl bg-amber-500/20 text-xs italic flex items-center gap-2">
            <span>🎬</span>
            <span>Vídeo (não foi possível baixar — confira no celular)</span>
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


