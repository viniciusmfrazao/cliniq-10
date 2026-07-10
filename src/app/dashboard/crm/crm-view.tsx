'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { createClient } from '@/lib/supabase/client'
import CrmReport from './crm-report'
import FollowupAlertBadge from '@/components/crm/FollowupAlertBadge'
import LeadFollowupPanel from '@/components/crm/LeadFollowupPanel'
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh'
import CRMSettingsModal from './crm-settings-modal'

type Lead = {
  id: string
  name: string
  phone: string | null
  email: string | null
  source: string
  status: string
  interest: string | null
  procedure_id: string | null
  estimated_value: number | null
  assigned_to: string | null
  notes: string | null
  tags: string[] | null
  next_contact_at: string | null
  last_contact_at: string | null
  converted_at: string | null
  lost_reason: string | null
  // WhatsApp
  whatsapp_chat_id: string | null
  last_whatsapp_at: string | null
  patient_replied_at: string | null
  whatsapp_opt_in: boolean
  // Eva IA
  ai_score: number | null
  ai_priority: string | null
  ai_suggested_action: string | null
  ai_sentiment: string | null
  // Eva follow-up
  eva_followup_count: number | null
  eva_next_followup_at: string | null
  // Atendimento humano
  needs_human_review: boolean | null
  human_review_reason: string | null
  human_review_details: string | null
  human_review_at: string | null
  // Pausa manual da Eva
  eva_pause_until: string | null
  whatsapp_instance: string | null
  whatsapp_name: string | null
  created_at: string
  updated_at: string
}

/**
 * Badge de follow-up pendente (Eva enviou msg e ta esperando resposta).
 * null se nao tem follow-up ativo, lead ja virou cliente/perdido, OU se ja
 * esta em atendimento humano (humano cuida, follow-up pausado).
 *
 * Sao 5 estagios de follow-up — alinhados com o cron eva-followup-cron:
 *   count 0 -> aguardando 1a resposta, proxima tentativa em ~2h
 *   count 1 -> ja mandou 1, proxima em ~24h
 *   count 2 -> ja mandou 2, proxima em ~48h
 *   count 3 -> ja mandou 3, proxima em ~5 dias
 *   count 4 -> ja mandou 4, proxima (ultima) em ~10 dias
 */
function getFollowupBadge(
  lead: Lead,
): { label: string; tone: 'amber' | 'orange' | 'red' | 'darkred' } | null {
  if (!lead.eva_next_followup_at) return null
  if (lead.status === 'converted' || lead.status === 'lost') return null
  if (lead.needs_human_review) return null
  const count = lead.eva_followup_count ?? 0
  // Cor escala conforme o estágio (1 a 5) da sequência da Eva.
  const tone: 'amber' | 'orange' | 'red' | 'darkred' =
    count >= 4 ? 'darkred' : count === 3 ? 'red' : count >= 1 ? 'orange' : 'amber'
  // Tempo REAL até o próximo followup automático (igual ao modal), não rótulo fixo.
  const diffMs = new Date(lead.eva_next_followup_at).getTime() - Date.now()
  let when: string
  if (diffMs <= 0) when = 'enviando'
  else {
    const totalMin = Math.round(diffMs / 60000)
    if (totalMin < 60) when = `em ${totalMin}min`
    else {
      const h = Math.floor(totalMin / 60)
      const m = totalMin % 60
      if (h < 24) when = m > 0 ? `em ${h}h${m}min` : `em ${h}h`
      else {
        const d = Math.floor(h / 24)
        const rh = h % 24
        when = rh > 0 ? `em ${d}d${rh}h` : `em ${d}d`
      }
    }
  }
  return { label: `Followup Eva · ${when}`, tone }
}

/**
 * Badge de prazo do follow-up MANUAL no card do funil.
 * Mostra se está atrasado e há quanto tempo, ou quanto falta.
 * scheduledAt é um timestamp ISO com timezone (instante absoluto).
 */
function getRetornoBadge(lead: Lead): { label: string } | null {
  if (!lead.eva_pause_until) return null
  if (lead.status === 'converted' || lead.status === 'lost') return null
  const pauseDate = new Date(lead.eva_pause_until)
  if (pauseDate <= new Date()) return null
  const day = pauseDate.getUTCDate().toString().padStart(2, '0')
  const month = (pauseDate.getUTCMonth() + 1).toString().padStart(2, '0')
  return { label: `Retorno ${day}/${month}` }
}

function getManualFollowupBadge(
  scheduledAt: string | undefined,
  status: string,
): { label: string; overdue: boolean } | null {
  if (!scheduledAt) return null
  if (status === 'converted' || status === 'lost') return null
  const diffMs = new Date(scheduledAt).getTime() - Date.now()
  const overdue = diffMs < 0
  const abs = Math.abs(diffMs)
  const mins = Math.round(abs / 60000)
  let delta: string
  if (mins < 1) delta = 'agora'
  else if (mins < 60) delta = `${mins} min`
  else {
    const hours = Math.round(mins / 60)
    if (hours < 24) delta = `${hours}h`
    else {
      const days = Math.round(hours / 24)
      delta = `${days} ${days === 1 ? 'dia' : 'dias'}`
    }
  }
  const label = overdue
    ? (delta === 'agora' ? 'Follow-up agora' : `Follow-up atrasado · há ${delta}`)
    : (delta === 'agora' ? 'Follow-up agora' : `Follow-up em ${delta}`)
  return { label, overdue }
}

const HUMAN_REVIEW_REASONS: Record<string, { label: string; emoji: string }> = {
  cancelamento: { label: 'Cancelamento', emoji: '🚫' },
  reagendamento: { label: 'Reagendamento', emoji: '🔄' },
  reclamacao: { label: 'Reclamação', emoji: '⚠️' },
  duvida_complexa: { label: 'Dúvida', emoji: '❓' },
  media_recebida: { label: 'Foto/Áudio', emoji: '📷' },
}

type CRMSettings = {
  custom_stages: { id: string; label: string; color: string; order: number }[]
  custom_sources: { id: string; label: string; icon: string }[]
  whatsapp_auto_reply: boolean
  whatsapp_welcome_message: string | null
  eva_auto_analyze: boolean
  eva_auto_suggest: boolean
  whatsapp_instance?: string | null
}

type MessageTemplate = {
  id: string
  name: string
  type: string
  channel: string
  content: string
  trigger_stage: string | null
}

type Props = {
  leads: Lead[]
  procedures: { id: string; name: string; price: number }[]
  users: { id: string; name: string }[]
  clinicId: string
  settings: CRMSettings | null
  /** Todas as linhas de crm_settings da clínica. 1 item = comportamento de
   * hoje (sem seletor). 2+ = clínica tem CRM dedicado por número. */
  settingsList?: CRMSettings[]
  /** Linhas WhatsApp conectadas — alimenta o seletor e o cálculo de Eva
   * ativa/pausada por linha selecionada. */
  waLines?: {
    instance_name: string
    label: string | null
    phone_number: string | null
    auto_reply_enabled: boolean
    is_default: boolean
    role_inbound: boolean
    role_outbound_automation: boolean
  }[]
  templates: MessageTemplate[]
  /** Quando true, mostra banner indicando que a Eva está em modo manual. */
  evaPaused?: boolean
  /** Eva ativa (módulo + auto-resposta). Quando false, não exibe follow-up automático da Eva. */
  evaActive?: boolean
  /** Mapa lead_id -> data ISO do próximo follow-up MANUAL pendente. */
  manualFollowups?: Record<string, string>
}

const DEFAULT_STAGES = [
  { id: 'new', label: 'Novo Lead', color: 'slate', order: 0 },
  { id: 'contacted', label: 'Em Conversa', color: 'blue', order: 1 },
  { id: 'scheduled', label: 'Agendado', color: 'amber', order: 2 },
  { id: 'converted', label: 'Cliente', color: 'emerald', order: 3 },
  { id: 'lost', label: 'Perdido', color: 'red', order: 4 },
]

const DEFAULT_SOURCES = [
  { id: 'instagram', label: 'Instagram', icon: '📸' },
  { id: 'whatsapp', label: 'WhatsApp', icon: '💬' },
  { id: 'indication', label: 'Indicação', icon: '👥' },
  { id: 'google', label: 'Google', icon: '🔍' },
  { id: 'facebook', label: 'Facebook', icon: '📘' },
  { id: 'website', label: 'Site', icon: '🌐' },
  { id: 'other', label: 'Outro', icon: '📌' },
]

const STAGE_ICONS: Record<string, string> = {
  new: 'userPlus',
  contacted: 'phone',
  scheduled: 'calendar',
  converted: 'check',
  lost: 'x'
}

const STAGE_COLORS: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-700',
  blue: 'bg-blue-100 text-blue-700',
  amber: 'bg-amber-100 text-amber-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  red: 'bg-red-100 text-red-700',
  violet: 'bg-violet-100 text-violet-700',
  pink: 'bg-pink-100 text-pink-700',
  cyan: 'bg-cyan-100 text-cyan-700',
}

// Calcular temperatura do lead
// ❄️ Frio:  lead chegou mas ainda não respondeu à Eva
// ☀️ Morno: lead respondeu à Eva (patient_replied_at preenchido)
// 🔥 Quente: lead perguntou preço/horário/disponibilidade (ai_priority='hot')
function calcTemperatura(lead: Lead): 'hot' | 'warm' | 'cold' | null {
  // Cliente ou convertido não tem temperatura
  if (lead.status === 'client' || lead.status === 'converted') return null

  // Agendado = sempre quente (interesse máximo confirmado)
  if (lead.status === 'scheduled') return 'hot'

  // ai_priority='hot' definida pela Eva = perguntou preço/horário
  if (lead.ai_priority === 'hot') return 'hot'

  // Lead respondeu à Eva = morno
  if (lead.patient_replied_at) return 'warm'

  // Lead chegou mas ainda não respondeu = frio
  return 'cold'
}

const AI_PRIORITY_CONFIG = {
  hot: { label: '🔥 Quente', color: 'bg-red-100 text-red-700' },
  warm: { label: '☀️ Morno', color: 'bg-amber-100 text-amber-700' },
  cold: { label: '❄️ Frio', color: 'bg-blue-100 text-blue-700' },
}

export default function CRMView({ leads, procedures, users, clinicId, settings, settingsList = [], waLines = [], templates, evaPaused: evaPausedProp = false, evaActive: evaActiveProp = true, manualFollowups = {} }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'report'>('kanban')
  const [showNewLead, setShowNewLead] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [showSettings, setShowSettings] = useState(false)
  const [showLegend, setShowLegend] = useState(false)
  const [showBell, setShowBell] = useState(false)
  // Drag & drop nativo HTML5 — usado pra mover lead entre colunas do Kanban
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null)

  // ─── CRM por número ──────────────────────────────────────────────────────
  // '' representa o CRM padrão (whatsapp_instance null na linha de settings).
  // Só existe seletor quando a clínica tem 2+ linhas de crm_settings — pra
  // qualquer clínica com 1 linha só, tudo cai no comportamento de sempre.
  const hasMultiCrm = settingsList.length > 1
  const [crmLine, setCrmLine] = useState<string>('')
  // Instâncias explicitamente configuradas com CRM próprio, exceto o padrão.
  const otherCrmInstances = settingsList
    .map(s => s.whatsapp_instance)
    .filter((i): i is string => !!i)
  useEffect(() => {
    if (!hasMultiCrm) return
    if (crmLine === '') return // bucket padrão é sempre válido
    const stillValid = settingsList.some(s => s.whatsapp_instance === crmLine)
    if (!stillValid) setCrmLine('')
  }, [hasMultiCrm, crmLine, settingsList])

  // Realtime: atualiza o CRM automaticamente quando leads ou follow-ups mudam.
  // Canal com nome fixo (evita duplicação no reconnect). Refresh com debounce.
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!clinicId) return
    let destroyed = false

    const scheduleRefresh = () => {
      if (destroyed) return
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = setTimeout(() => {
        if (!destroyed) router.refresh()
      }, 800)
    }

    const channelName = `crm:${clinicId}`
    try { supabase.removeChannel(supabase.channel(channelName)) } catch { /* noop */ }

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'leads', filter: `clinic_id=eq.${clinicId}` },
        () => scheduleRefresh())
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'lead_followups', filter: `clinic_id=eq.${clinicId}` },
        () => scheduleRefresh())
      .subscribe()

    return () => {
      destroyed = true
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
      try { supabase.removeChannel(channel) } catch { /* noop */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId])

  // Os contadores de follow-up ("em 6 min") e o status "pendente" dependem só
  // da passagem do tempo — não há evento de banco para o realtime captar.
  // Por isso atualizamos a tela periodicamente (a cada 60s).
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh()
    }, 60000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [draggingFromStage, setDraggingFromStage] = useState<string | null>(null)
  const [hoverStage, setHoverStage] = useState<string | null>(null)

  // Realtime: novos leads (Donna criando do WhatsApp) e mudancas de status
  // aparecem na hora em todos os usuarios da clinica.
  useRealtimeRefresh({
    table: 'leads',
    filter: { column: 'clinic_id', value: clinicId },
  })

  // Settings ativas: da linha escolhida, ou o bucket padrão (settings prop,
  // que já vem do server como a linha com whatsapp_instance null).
  const activeSettings = hasMultiCrm
    ? (settingsList.find(s => s.whatsapp_instance === (crmLine || null)) ?? settings)
    : settings

  // Usar configurações customizadas ou padrão
  const STAGES = activeSettings?.custom_stages || DEFAULT_STAGES
  const SOURCES = activeSettings?.custom_sources || DEFAULT_SOURCES

  // Eva ativa/pausada da linha selecionada (só relevante com CRM multi-linha;
  // sem isso, usa os valores calculados no server pro bucket padrão).
  const selectedWaLine = hasMultiCrm && crmLine
    ? waLines.find(w => w.instance_name === crmLine)
    : null
  // Sombra as props originais — todo o resto do arquivo que já usa
  // evaActive/evaPaused passa a refletir a linha selecionada automaticamente.
  // Sem CRM multi-linha (caso de hoje pra quase toda clínica), é exatamente
  // igual ao valor calculado no server, sem nenhuma mudança.
  const evaActive = selectedWaLine ? selectedWaLine.auto_reply_enabled === true : evaActiveProp
  const evaPaused = selectedWaLine ? selectedWaLine.auto_reply_enabled === false : evaPausedProp

  // ─── Helpers de followup ─────────────────────────────────────────────────
  // Um lead esta "em followup" quando a Eva ja agendou a proxima tentativa
  // E o lead nao virou cliente/perdido E nao foi escalado pra humano.
  // Os 5 estagios batem com o cron eva-followup:
  //   count 0 -> aguardando 1a resposta (~2h)
  //   count 1 -> ja mandou 1, proxima em 24h
  //   count 2 -> ja mandou 2, proxima em 48h
  //   count 3 -> ja mandou 3, proxima em 5d
  //   count 4 -> ultima chance (~10d)
  const isEvaFollowup = (l: Lead): boolean =>
    evaActive &&
    !!l.eva_next_followup_at &&
    l.status !== 'converted' &&
    l.status !== 'lost' &&
    !l.needs_human_review

  // Follow-up MANUAL pendente (secretaria agendou, ainda não concluído).
  const manualFollowupSet = new Set(Object.keys(manualFollowups))
  const hasManualFollowup = (l: Lead): boolean =>
    manualFollowupSet.has(l.id) &&
    l.status !== 'converted' &&
    l.status !== 'lost'

  // Um lead está "em follow-up" se a Eva agendou a próxima tentativa OU se há
  // um follow-up manual pendente. Alimenta o card e o filtro "Em follow-up".
  const isInFollowup = (l: Lead): boolean => isEvaFollowup(l) || hasManualFollowup(l)

  // "Verificar" — alerta de silêncio em clínica 100% manual (sem Eva).
  // Só faz sentido quando não há Eva: com Eva ativa, o ciclo automático dela
  // (isEvaFollowup, 5 estágios) já cobre esse silêncio e esse alerta ficaria
  // redundante. Dispara quando: lead está "Em Contato", ninguém (nem
  // paciente nem atendente) tocou a conversa nos últimos 15min, e não há
  // follow-up manual agendado pra esse lead.
  const CHECK_IN_SILENCE_MS = 15 * 60 * 1000
  const needsCheckIn = (l: Lead): boolean =>
    !evaActive &&
    l.status === 'contacted' &&
    !hasManualFollowup(l) &&
    !!l.last_contact_at &&
    Date.now() - new Date(l.last_contact_at).getTime() >= CHECK_IN_SILENCE_MS

  const getFollowupCount = (l: Lead): number => l.eva_followup_count ?? 0

  const followupBucket = (l: Lead): 'fu_2h' | 'fu_4h' | 'fu_48h' | 'fu_5d' | 'fu_10d' | null => {
    // Os 5 sub-estágios são exclusivos da Eva — follow-up manual não entra nos buckets.
    if (!isEvaFollowup(l)) return null
    const c = getFollowupCount(l)
    if (c >= 4) return 'fu_10d'
    if (c === 3) return 'fu_5d'
    if (c === 2) return 'fu_48h'
    if (c === 1) return 'fu_4h'
    return 'fu_2h'
  }

  // Filtro real por linha do CRM. Sem CRM multi-linha, mostra tudo (igual
  // sempre foi). Com CRM multi-linha: bucket padrão pega tudo que não foi
  // explicitamente reivindicado por outra linha (leads antigos, sem
  // whatsapp_instance, ou de instância não configurada aqui); uma linha
  // específica só pega o que bate exatamente com ela.
  const leadsForLine = !hasMultiCrm
    ? leads
    : crmLine
      ? leads.filter(l => l.whatsapp_instance === crmLine)
      : leads.filter(l => !l.whatsapp_instance || !otherCrmInstances.includes(l.whatsapp_instance))

  // Stats — sempre da linha selecionada, nunca mistura com outra linha do CRM
  const stats = {
    total: leadsForLine.length,
    new: leadsForLine.filter(l => l.status === 'new').length,
    contacted: leadsForLine.filter(l => l.status === 'contacted').length,
    scheduled: leadsForLine.filter(l => l.status === 'scheduled').length,
    converted: leadsForLine.filter(l => l.status === 'converted').length,
    lost: leadsForLine.filter(l => l.status === 'lost').length,
    // Conversao: % do total de leads que viraram cliente.
    // (Antes era convertidos/(convertidos+perdidos), o que dava 100% enganoso
    //  quando os outros leads ainda estavam em conversa. Agora reflete a
    //  performance real do funil considerando todo mundo.)
    conversionRate:
      leadsForLine.length > 0
        ? Math.round((leadsForLine.filter(l => l.status === 'converted').length / leadsForLine.length) * 100)
        : 0,
    // Eva IA stats — temperatura do lead (priority calculada pela IA)
    hotLeads: leadsForLine.filter(l => l.ai_priority === 'hot').length,
    warmLeads: leadsForLine.filter(l => l.ai_priority === 'warm').length,
    coldLeads: leadsForLine.filter(l => l.ai_priority === 'cold').length,
    estimatedValue: leadsForLine.filter(l => l.status !== 'lost').reduce((sum, l) => sum + (l.estimated_value || 0), 0),
    pendingContact: leadsForLine.filter(l => { const mf = manualFollowups[l.id]; return mf && new Date(mf) <= new Date() }).length,
    // Atendimento humano (Eva escalou)
    humanReview: leadsForLine.filter(l => l.needs_human_review === true).length,
    // Conversas paradas em clínica 100% manual (sem Eva) — ver needsCheckIn
    checkInTotal: leadsForLine.filter(needsCheckIn).length,
    // Followup buckets (Eva aguardando resposta) — 5 estagios
    followupTotal: leadsForLine.filter(isInFollowup).length,
    followup2h: leadsForLine.filter(l => followupBucket(l) === 'fu_2h').length,
    followup4h: leadsForLine.filter(l => followupBucket(l) === 'fu_4h').length,
    followup48h: leadsForLine.filter(l => followupBucket(l) === 'fu_48h').length,
    followup5d: leadsForLine.filter(l => followupBucket(l) === 'fu_5d').length,
    followup10d: leadsForLine.filter(l => followupBucket(l) === 'fu_10d').length,
    retornoAgendado: leadsForLine.filter(l => l.eva_pause_until != null && new Date(l.eva_pause_until) > new Date()).length,
  }

  const isFollowupFilter = (f: string) =>
    f === 'followup_all' || f === 'fu_2h' || f === 'fu_4h' || f === 'fu_48h' || f === 'fu_5d' || f === 'fu_10d'

  // Filtrar leads — alem dos status, tem filtros especiais:
  //   'human_review'        -> leads escalados pra atendimento humano
  //   'hot' / 'warm' / 'cold' -> filtra por temperatura (ai_priority)
  //   'pending_contact'      -> leads com next_contact_at vencido
  //   'followup_all'         -> qualquer lead em followup ativo
  //   'fu_2h' / 'fu_4h' / 'fu_48h' / 'fu_5d' / 'fu_10d' -> bucket especifico

  const filteredLeads =
    filter === 'all'
      ? leadsForLine
      : filter === 'retorno_agendado'
        ? leadsForLine.filter(l => l.eva_pause_until != null && new Date(l.eva_pause_until) > new Date())
      : filter === 'human_review'
        ? leadsForLine.filter(l => l.needs_human_review === true)
        : filter === 'hot' || filter === 'warm' || filter === 'cold'
          ? leadsForLine.filter(l => l.ai_priority === filter)
          : filter === 'pending_contact'
            ? leadsForLine.filter(l => { const mf = manualFollowups[l.id]; return mf && new Date(mf) <= new Date() })
            : filter === 'checkin'
              ? leadsForLine.filter(needsCheckIn)
              : filter === 'followup_all'
              ? leadsForLine.filter(isInFollowup)
              : isFollowupFilter(filter)
                ? leadsForLine.filter(l => followupBucket(l) === filter)
                : filter === 'no_contact_7'
                ? leadsForLine.filter(l => {
                    if (!l.last_contact_at) return true
                    return (Date.now() - new Date(l.last_contact_at).getTime()) > 7 * 24 * 60 * 60 * 1000
                  })
                : filter === 'no_contact_14'
                  ? leadsForLine.filter(l => {
                      if (!l.last_contact_at) return true
                      return (Date.now() - new Date(l.last_contact_at).getTime()) > 14 * 24 * 60 * 60 * 1000
                    })
                  : filter === 'no_contact_30'
                    ? leadsForLine.filter(l => {
                        if (!l.last_contact_at) return true
                        return (Date.now() - new Date(l.last_contact_at).getTime()) > 30 * 24 * 60 * 60 * 1000
                      })
                    : filter === 'eva_paused'
                      ? leadsForLine.filter(l => l.eva_pause_until && new Date(l.eva_pause_until) > new Date())
                      : leadsForLine.filter(l => l.status === filter)

  // Agrupar por stage para Kanban (respeita os filtros especiais)
  const leadsForKanban =
    filter === 'retorno_agendado'
      ? leadsForLine.filter(l => l.eva_pause_until != null && new Date(l.eva_pause_until) > new Date())
      : filter === 'human_review'
      ? leadsForLine.filter(l => l.needs_human_review === true)
      : filter === 'hot' || filter === 'warm' || filter === 'cold'
        ? leadsForLine.filter(l => l.ai_priority === filter)
        : filter === 'pending_contact'
          ? leadsForLine.filter(l => { const mf = manualFollowups[l.id]; return mf && new Date(mf) <= new Date() })
          : filter === 'checkin'
            ? leadsForLine.filter(needsCheckIn)
            : filter === 'followup_all'
            ? leadsForLine.filter(isInFollowup)
            : isFollowupFilter(filter)
              ? leadsForLine.filter(l => followupBucket(l) === filter)
              : filter === 'no_contact_7'
                ? leadsForLine.filter(l => { if (!l.last_contact_at) return true; return (Date.now() - new Date(l.last_contact_at).getTime()) > 7 * 24 * 60 * 60 * 1000 })
                : filter === 'no_contact_14'
                  ? leadsForLine.filter(l => { if (!l.last_contact_at) return true; return (Date.now() - new Date(l.last_contact_at).getTime()) > 14 * 24 * 60 * 60 * 1000 })
                  : filter === 'no_contact_30'
                    ? leadsForLine.filter(l => { if (!l.last_contact_at) return true; return (Date.now() - new Date(l.last_contact_at).getTime()) > 30 * 24 * 60 * 60 * 1000 })
                    : filter === 'eva_paused'
                      ? leadsForLine.filter(l => l.eva_pause_until && new Date(l.eva_pause_until) > new Date())
                      : leadsForLine
  const leadsByStage = STAGES.reduce((acc, stage) => {
    acc[stage.id] = leadsForKanban.filter(l => l.status === stage.id)
    return acc
  }, {} as Record<string, Lead[]>)

  async function updateLeadStatus(leadId: string, newStatus: string) {
    const updateData: Record<string, string | null> = { status: newStatus }
    
    if (newStatus === 'converted') {
      updateData.converted_at = new Date().toISOString()
    }
    
    await supabase
      .from('leads')
      .update(updateData)
      .eq('id', leadId)
    
    router.refresh()
  }

  // ─── Drag & drop entre colunas ───────────────────────────────────────────
  function handleDragStart(e: React.DragEvent<HTMLDivElement>, lead: Lead) {
    setDraggingLeadId(lead.id)
    setDraggingFromStage(lead.status)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', lead.id)
  }

  function handleDragEnd() {
    setDraggingLeadId(null)
    setDraggingFromStage(null)
    setHoverStage(null)
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>, stageId: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (hoverStage !== stageId) setHoverStage(stageId)
  }

  function handleDragLeave(stageId: string) {
    if (hoverStage === stageId) setHoverStage(null)
  }

  async function handleDrop(e: React.DragEvent<HTMLDivElement>, newStatus: string) {
    e.preventDefault()
    const leadId = e.dataTransfer.getData('text/plain') || draggingLeadId
    handleDragEnd()
    if (!leadId) return
    const lead = leads.find(l => l.id === leadId)
    if (!lead || lead.status === newStatus) return
    await updateLeadStatus(leadId, newStatus)
  }

  function getTimeAgo(date: string): string {
    const diff = Date.now() - new Date(date).getTime()
    const hours = Math.floor(diff / 3600000)
    if (hours < 1) return 'Agora'
    if (hours < 24) return `${hours}h atrás`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d atrás`
    return new Date(date).toLocaleDateString('pt-BR')
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Banner: Eva em modo manual */}
      {evaPaused && (
        <div className="mb-4 p-3 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 flex items-center gap-3">
          <span className="text-2xl leading-none">⏸️</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">
              Eva está em modo manual
            </p>
            <p className="text-xs text-amber-700">
              Mensagens recebidas pelo WhatsApp continuam virando leads aqui no CRM,
              mas a Eva não responde automaticamente — você responde pelo painel.
            </p>
          </div>
          <Link
            href="/dashboard/whatsapp"
            className="text-xs font-semibold text-amber-700 hover:text-amber-900 underline whitespace-nowrap"
          >
            Reativar Eva →
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Icon name="target" className="w-6 h-6 text-violet-500" />
            CRM - Funil de Vendas
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Gerencie seus leads e oportunidades</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Seletor de CRM por número — só aparece com 2+ linhas de crm_settings
              configuradas (settingsList.length > 1). Sem opção "Todos": é sempre
              um CRM específico por vez, nunca leads de linhas diferentes misturados. */}
          {hasMultiCrm && (
            <select
              value={crmLine}
              onChange={(e) => setCrmLine(e.target.value)}
              className="btn-secondary text-sm pr-8"
              title="Escolher qual CRM exibir"
            >
              <option value="">
                {(() => {
                  const def = waLines.find(w => w.is_default) ?? waLines.find(w => w.role_inbound)
                  return def ? `Eva · ${def.label || def.phone_number?.replace(/\D/g, '').slice(-8) || def.instance_name.slice(0, 10)}` : 'Eva (padrão)'
                })()}
              </option>
              {otherCrmInstances.map((inst) => {
                const w = waLines.find(l => l.instance_name === inst)
                const label = w?.label || w?.phone_number?.replace(/\D/g, '').slice(-8) || inst.slice(0, 10)
                return (
                  <option key={inst} value={inst}>
                    {w?.role_outbound_automation ? `Recepção · ${label}` : label}
                  </option>
                )
              })}
            </select>
          )}
          {(() => {
            // pendências: follow-up manual vencido e não concluído, OU
            // (clínica manual sem Eva) conversa parada sem follow-up agendado
            const now = new Date()
            const pendentes = leadsForLine.filter(l => {
              const mf = manualFollowups[l.id]
              return (mf && new Date(mf) <= now) || needsCheckIn(l)
            })
            const count = pendentes.length
            return (
              <div className="relative">
                <button
                  onClick={() => setShowBell(v => !v)}
                  className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Pendências de contato e follow-up"
                >
                  <Icon name="bell" className="w-5 h-5" />
                  {count > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </button>
                {showBell && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowBell(false)} />
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 max-h-96 overflow-y-auto">
                      <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3">
                        <p className="font-bold text-slate-900 text-sm flex items-center gap-2">
                          🔔 Pendências
                          {count > 0 && <span className="text-xs font-normal text-slate-500">({count})</span>}
                        </p>
                      </div>
                      {count === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-slate-400">
                          Nenhuma pendência por agora 🎉
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-50">
                          {pendentes.map(l => {
                            const mf = manualFollowups[l.id]
                            const isFollowup = mf && new Date(mf) <= now
                            const isCheckIn = !isFollowup && needsCheckIn(l)
                            return (
                              <button
                                key={l.id}
                                onClick={() => { setSelectedLead(l); setShowBell(false) }}
                                className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-medium text-slate-800 text-sm truncate">{l.name}</p>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${isFollowup ? 'bg-sky-100 text-sky-700' : isCheckIn ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {isFollowup ? '📅 Follow-up' : isCheckIn ? '⚠️ Verificar' : '⏰ Contato'}
                                  </span>
                                </div>
                                {l.phone && <p className="text-xs text-slate-400 mt-0.5">{l.phone}</p>}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })()}
          <button
            onClick={() => setShowLegend(true)}
            className="px-3 py-2 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors flex items-center gap-1.5"
            title="O que significa cada cor, badge e estágio"
          >
            <span>📖</span>
            <span className="hidden sm:inline">Como usar</span>
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="Configurações do CRM"
          >
            <Icon name="settings" className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowNewLead(true)}
            className="btn-primary w-auto px-4 flex items-center gap-2"
          >
            <Icon name="plus" className="w-4 h-4" />
            Novo Lead
          </button>
        </div>
      </div>

      {showLegend && <LegendModal onClose={() => setShowLegend(false)} evaActive={evaActive} />}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`card p-3 text-left transition-all ${filter === 'all' ? 'ring-2 ring-slate-400' : 'hover:bg-slate-50'}`}
        >
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          <p className="text-xs text-slate-500">Total Leads</p>
        </button>
        
        {evaActive && stats.humanReview > 0 && (
          <button
            onClick={() => setFilter(filter === 'human_review' ? 'all' : 'human_review')}
            className={`card p-3 text-left bg-gradient-to-br from-rose-50 to-pink-50 transition-all ${filter === 'human_review' ? 'ring-2 ring-rose-400' : 'hover:from-rose-100 hover:to-pink-100'}`}
            title="Eva escalou para humano. Clique para filtrar."
          >
            <p className="text-2xl font-bold text-rose-600">{stats.humanReview} 🚨</p>
            <p className="text-xs text-rose-600">Atendimento Humano</p>
          </button>
        )}

        {!evaActive && stats.checkInTotal > 0 && (
          <button
            onClick={() => setFilter(filter === 'checkin' ? 'all' : 'checkin')}
            className={`card p-3 text-left bg-gradient-to-br from-orange-50 to-amber-50 transition-all ${filter === 'checkin' ? 'ring-2 ring-orange-400' : 'hover:from-orange-100 hover:to-amber-100'}`}
            title="Conversas paradas há mais de 15min, sem follow-up agendado. Clique para filtrar."
          >
            <p className="text-2xl font-bold text-orange-600">{stats.checkInTotal} ⚠️</p>
            <p className="text-xs text-orange-600">Verificar</p>
          </button>
        )}

        {stats.followupTotal > 0 && (
          <button
            onClick={() => setFilter(isFollowupFilter(filter) ? 'all' : 'followup_all')}
            className={`card p-3 text-left bg-gradient-to-br from-orange-50 to-amber-50 transition-all ${isFollowupFilter(filter) ? 'ring-2 ring-orange-400' : 'hover:from-orange-100 hover:to-amber-100'}`}
            title="Leads que a Eva está aguardando resposta. Clique para abrir os filtros por tempo."
          >
            <p className="text-2xl font-bold text-orange-600">{stats.followupTotal} ⏰</p>
            <p className="text-xs text-orange-600">Em follow-up</p>
          </button>
        )}

        {stats.hotLeads > 0 && (
          <button
            onClick={() => setFilter(filter === 'hot' ? 'all' : 'hot')}
            className={`card p-3 text-left bg-gradient-to-br from-red-50 to-orange-50 transition-all ${filter === 'hot' ? 'ring-2 ring-red-400' : 'hover:from-red-100 hover:to-orange-100'}`}
            title="🔥 Lead QUENTE: alta intenção de compra (perguntou preço, agenda, formas de pagamento ou demonstrou urgência). Clique para filtrar."
          >
            <p className="text-2xl font-bold text-red-600">{stats.hotLeads} 🔥</p>
            <p className="text-xs text-red-600">Quentes</p>
          </button>
        )}

        {stats.warmLeads > 0 && (
          <button
            onClick={() => setFilter(filter === 'warm' ? 'all' : 'warm')}
            className={`card p-3 text-left bg-gradient-to-br from-amber-50 to-yellow-50 transition-all ${filter === 'warm' ? 'ring-2 ring-amber-400' : 'hover:from-amber-100 hover:to-yellow-100'}`}
            title="☀️ Lead MORNO: interesse demonstrado mas ainda explorando (pediu informações gerais, comparando opções, sem urgência clara). Clique para filtrar."
          >
            <p className="text-2xl font-bold text-amber-600">{stats.warmLeads} ☀️</p>
            <p className="text-xs text-amber-600">Mornos</p>
          </button>
        )}

        {stats.coldLeads > 0 && (
          <button
            onClick={() => setFilter(filter === 'cold' ? 'all' : 'cold')}
            className={`card p-3 text-left bg-gradient-to-br from-blue-50 to-cyan-50 transition-all ${filter === 'cold' ? 'ring-2 ring-blue-400' : 'hover:from-blue-100 hover:to-cyan-100'}`}
            title="❄️ Lead FRIO: pouca intenção no momento (curioso, sem urgência, fazendo pesquisa inicial ou só perguntas vagas). Vale nutrir com conteúdo. Clique para filtrar."
          >
            <p className="text-2xl font-bold text-blue-600">{stats.coldLeads} ❄️</p>
            <p className="text-xs text-blue-600">Frios</p>
          </button>
        )}
        
        {stats.pendingContact > 0 && (
          <button
            onClick={() => setFilter(filter === 'pending_contact' ? 'all' : 'pending_contact')}
            className={`card p-3 text-left bg-gradient-to-br from-amber-50 to-yellow-50 transition-all ${filter === 'pending_contact' ? 'ring-2 ring-amber-400' : 'ring-2 ring-amber-300 hover:from-amber-100 hover:to-yellow-100'}`}
            title="Leads com data de follow-up vencida. Clique para filtrar."
          >
            <p className="text-2xl font-bold text-amber-600">{stats.pendingContact}</p>
            <p className="text-xs text-amber-600">Contato Pendente</p>
          </button>
        )}
        
        {/* Filtros sem contato + modo manual */}
        <div className="col-span-full flex items-center gap-2 flex-wrap pt-1 border-t border-slate-100">
          <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Sem contato há:</span>
          {([['no_contact_7','7 dias'],['no_contact_14','14 dias'],['no_contact_30','30 dias']] as [string,string][]).map(([key, label]) => (
            <button key={key}
              onClick={() => setFilter(filter === key ? 'all' : key)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition border ${filter === key ? 'bg-orange-500 text-white border-orange-500' : 'border-slate-200 text-slate-600 hover:bg-orange-50 hover:border-orange-300'}`}>
              +{label}
            </button>
          ))}
          <button
            onClick={() => setFilter(filter === 'eva_paused' ? 'all' : 'eva_paused')}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition border ${filter === 'eva_paused' ? 'bg-violet-600 text-white border-violet-600' : 'border-slate-200 text-slate-600 hover:bg-violet-50 hover:border-violet-300'}`}>
            🙋 Modo manual
          </button>
        </div>

        <button
          onClick={() => setFilter(filter === 'new' ? 'all' : 'new')}
          className={`card p-3 text-left transition-all ${filter === 'new' ? 'ring-2 ring-violet-400' : 'hover:bg-slate-50'}`}
          title="Leads ainda não contatados. Clique para filtrar."
        >
          <p className="text-2xl font-bold text-slate-900">{stats.new}</p>
          <p className="text-xs text-slate-500">Novos</p>
        </button>
        
        <div
          className="card p-3 bg-gradient-to-br from-emerald-50 to-teal-50"
          title={`${stats.converted} de ${stats.total} leads viraram clientes (${stats.conversionRate}%).`}
        >
          <p className="text-2xl font-bold text-emerald-600">{stats.conversionRate}%</p>
          <p className="text-xs text-emerald-600">
            Conversão <span className="text-emerald-500">({stats.converted}/{stats.total})</span>
          </p>
        </div>
        
        {stats.estimatedValue > 0 && (
          <div className="card p-3 bg-gradient-to-br from-violet-50 to-purple-50">
            <p className="text-lg font-bold text-violet-600">R$ {stats.estimatedValue.toLocaleString('pt-BR')}</p>
            <p className="text-xs text-violet-600">Valor Estimado</p>
          </div>
        )}
      </div>

      {/* Sub-filtros de follow-up — aparecem so quando o filtro de followup
          esta ativo. Cada chip filtra por um bucket de tempo (2h/24h/48h/5d/10d).  */}
      {isFollowupFilter(filter) && (
        <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-orange-900">⏰ Filtrar por tempo de espera</span>
            <span className="text-xs text-orange-700">
              ({stats.followupTotal} {stats.followupTotal === 1 ? 'lead' : 'leads'} em follow-up)
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <FollowupChip
              active={filter === 'followup_all'}
              onClick={() => setFilter('followup_all')}
              label={`Todos (${stats.followupTotal})`}
              tone="amber"
            />
            <FollowupChip
              active={filter === 'fu_2h'}
              onClick={() => setFilter(filter === 'fu_2h' ? 'followup_all' : 'fu_2h')}
              label={`🟡 2h (${stats.followup2h})`}
              tone="amber"
              disabled={stats.followup2h === 0}
            />
            <FollowupChip
              active={filter === 'fu_4h'}
              onClick={() => setFilter(filter === 'fu_4h' ? 'followup_all' : 'fu_4h')}
              label={`🟠 4h (${stats.followup4h})`}
              tone="orange"
              disabled={stats.followup4h === 0}
            />
            <FollowupChip
              active={filter === 'fu_48h'}
              onClick={() => setFilter(filter === 'fu_48h' ? 'followup_all' : 'fu_48h')}
              label={`🟠 48h (${stats.followup48h})`}
              tone="orange"
              disabled={stats.followup48h === 0}
            />
            <FollowupChip
              active={filter === 'fu_5d'}
              onClick={() => setFilter(filter === 'fu_5d' ? 'followup_all' : 'fu_5d')}
              label={`🔴 5 dias (${stats.followup5d})`}
              tone="red"
              disabled={stats.followup5d === 0}
            />
            <FollowupChip
              active={filter === 'fu_10d'}
              onClick={() => setFilter(filter === 'fu_10d' ? 'followup_all' : 'fu_10d')}
              label={`⚫ Última chance · 10d (${stats.followup10d})`}
              tone="darkred"
              disabled={stats.followup10d === 0}
            />
          </div>
        </div>
      )}

      {/* View Toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('kanban')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              viewMode === 'kanban' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Icon name="grid" className="w-4 h-4" />
            Kanban
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              viewMode === 'list' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Icon name="list" className="w-4 h-4" />
            Lista
          </button>
          <button
            onClick={() => setViewMode('report')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              viewMode === 'report' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Icon name="barChart" className="w-4 h-4" />
            Relatório
          </button>
        </div>
        
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="input w-auto text-sm"
        >
          <option value="all">Todos os status</option>
          {STAGES.map(s => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
          {stats.followupTotal > 0 && (
            <optgroup label="Follow-up (Eva aguardando)">
              <option value="followup_all">Todos em follow-up ({stats.followupTotal})</option>
              {stats.followup2h > 0 && <option value="fu_2h">⏰ Aguardando 2h ({stats.followup2h})</option>}
              {stats.followup4h > 0 && <option value="fu_4h">⏰ Aguardando 4h ({stats.followup4h})</option>}
              {stats.followup48h > 0 && <option value="fu_48h">⏰ Aguardando 48h ({stats.followup48h})</option>}
              {stats.followup5d > 0 && <option value="fu_5d">⏰ Aguardando 5 dias ({stats.followup5d})</option>}
              {stats.followup10d > 0 && <option value="fu_10d">⏰ Última chance · 10d ({stats.followup10d})</option>}
            </optgroup>
          )}
          {stats.retornoAgendado > 0 && (
            <optgroup label="Retorno agendado">
              <option value="retorno_agendado">📅 Retorno agendado ({stats.retornoAgendado})</option>
            </optgroup>
          )}
        </select>
      </div>

      {/* Kanban View */}
      {viewMode === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-4 scroll-smooth snap-x snap-mandatory" style={{scrollbarWidth:"thin",WebkitOverflowScrolling:"touch"}}>
          {STAGES.map(stage => {
            const stageColor = STAGE_COLORS[stage.color] || STAGE_COLORS.slate
            const stageIcon = STAGE_ICONS[stage.id] || 'circle'
            
            const isHovering = hoverStage === stage.id && draggingFromStage !== stage.id
            return (
            <div key={stage.id} className="flex-shrink-0 w-72">
              <div className={`p-3 rounded-t-xl ${stageColor} flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                  <Icon name={stageIcon} className="w-4 h-4" />
                  <span className="font-semibold text-sm">{stage.label}</span>
                </div>
                <span className="text-xs font-bold bg-white/50 px-2 py-0.5 rounded-full">
                  {leadsByStage[stage.id]?.length || 0}
                </span>
              </div>
              <div
                className={`bg-slate-100 rounded-b-xl p-2 min-h-[400px] space-y-2 transition-colors duration-100 ${isHovering ? 'bg-violet-100 ring-2 ring-violet-400 ring-inset' : ''}`}
                onDragOver={(e) => handleDragOver(e, stage.id)}
                onDragLeave={() => handleDragLeave(stage.id)}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                {leadsByStage[stage.id]?.map(lead => {
                  const source = SOURCES.find(s => s.id === lead.source)
                  const tempKey = calcTemperatura(lead)
                  const aiPriority = tempKey ? AI_PRIORITY_CONFIG[tempKey as keyof typeof AI_PRIORITY_CONFIG] : null
                  const tempIsManual = !lead.ai_priority && !!tempKey
                  // "Contato pendente" = follow-up manual vencido e não concluído.
                  // (manualFollowups já vem filtrado por done_at IS NULL do servidor)
                  const mfDate = manualFollowups[lead.id]
                  const needsContact = mfDate ? new Date(mfDate) <= new Date() : false
                  const followup = evaActive ? getFollowupBadge(lead) : null
                  const retorno = getRetornoBadge(lead)
                  const manualFollowup = getManualFollowupBadge(manualFollowups[lead.id], lead.status)
                  const followupClass =
                    followup?.tone === 'darkred'
                      ? 'bg-red-200 text-red-900 border-red-300'
                      : followup?.tone === 'red'
                        ? 'bg-red-100 text-red-700 border-red-200'
                        : followup?.tone === 'orange'
                          ? 'bg-orange-100 text-orange-700 border-orange-200'
                          : 'bg-amber-100 text-amber-700 border-amber-200'
                  const followupEmoji =
                    followup?.tone === 'darkred' ? '⚫'
                      : followup?.tone === 'red' ? '🔴'
                        : followup?.tone === 'orange' ? '🟠'
                          : '🟡'

                  // Atendimento humano (Eva escalou). Se ativo, NAO mostra
                  // followup (humano cuida agora) — o getFollowupBadge ja
                  // retorna null nesse caso.
                  const humanReview = (evaActive && lead.needs_human_review)
                    ? HUMAN_REVIEW_REASONS[lead.human_review_reason ?? ''] ?? { label: 'Atendimento', emoji: '🚨' }
                    : null

                  // Conversa parada em clínica 100% manual (sem Eva): ninguém
                  // respondeu em 15min e não há follow-up agendado.
                  const checkIn = needsCheckIn(lead)

                  const cardRing = humanReview
                    ? 'ring-2 ring-rose-400'
                    : checkIn
                      ? 'ring-2 ring-orange-400'
                      : needsContact
                        ? 'ring-2 ring-amber-400'
                        : ''

                  const isDragging = draggingLeadId === lead.id
                  return (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, lead)}
                      onDragEnd={handleDragEnd}
                      onClick={() => setSelectedLead(lead)}
                      className={`bg-white p-3 rounded-xl shadow-sm hover:shadow-md transition-all duration-100 cursor-grab active:cursor-grabbing ${cardRing} ${isDragging ? 'opacity-40 scale-95' : ''}`}
                      title="Arraste para mover de coluna"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{lead.name}</p>
                          {aiPriority && (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${aiPriority.color}`} title={tempIsManual ? 'Temperatura automática (por atividade)' : 'Classificação Eva IA'}>
                              {tempKey === 'hot' ? '🔥' : tempKey === 'warm' ? '☀️' : '❄️'}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400 flex-shrink-0">{getTimeAgo(lead.created_at)}</span>
                      </div>
                      {lead.phone && (
                        <p className="text-xs text-slate-500 mb-1">{lead.phone}</p>
                      )}
                      {(lead as any).whatsapp_name && (lead as any).whatsapp_name !== lead.name && (
                        <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                          <span>📱</span>
                          <span className="truncate">{(lead as any).whatsapp_name}</span>
                        </p>
                      )}
                      {humanReview && (
                        <div
                          className="flex flex-col gap-0.5 text-xs px-2 py-1.5 rounded-md border bg-rose-50 text-rose-800 border-rose-200 mb-2"
                          title="Eva escalou para atendimento humano"
                        >
                          <div className="flex items-center gap-1 font-semibold">
                            <span>{humanReview.emoji}</span>
                            <span>{humanReview.label}</span>
                          </div>
                          {lead.human_review_details && (
                            <p className="text-[11px] text-rose-700 leading-snug line-clamp-2">
                              {lead.human_review_details}
                            </p>
                          )}
                        </div>
                      )}
                      {checkIn && (
                        <div
                          className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-md border bg-orange-50 text-orange-800 border-orange-200 mb-2"
                          title="Sem resposta do paciente nem do atendente há mais de 15min, e sem follow-up agendado"
                        >
                          <span>⚠️</span>
                          <span className="font-semibold">Verificar</span>
                        </div>
                      )}
                      {retorno && !followup && (
                        <div
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded-md border mb-2 bg-blue-50 text-blue-700 border-blue-200"
                          title="Paciente retorna nesta data — follow-ups pausados até lá"
                        >
                          <span>📅</span>
                          <span className="font-medium">{retorno.label}</span>
                        </div>
                      )}
                      {followup && (
                        <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border mb-2 ${followupClass}`} title="Eva está aguardando resposta da paciente">
                          <span>{followupEmoji}</span>
                          <span className="font-medium">{followup.label}</span>
                        </div>
                      )}
                      {manualFollowup && (
                        <div
                          className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border mb-2 ${
                            manualFollowup.overdue
                              ? 'bg-red-100 text-red-700 border-red-200'
                              : 'bg-sky-100 text-sky-700 border-sky-200'
                          }`}
                          title="Follow-up agendado manualmente"
                        >
                          <span>{manualFollowup.overdue ? '⏰' : '📅'}</span>
                          <span className="font-medium">{manualFollowup.label}</span>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1 mb-2">
                        {lead.interest && (
                          <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                            {lead.interest}
                          </span>
                        )}
                        {lead.estimated_value && (
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                            R$ {lead.estimated_value.toLocaleString('pt-BR')}
                          </span>
                        )}
                      </div>
                      {/* Eva IA suggestion */}
                      {lead.ai_suggested_action && (
                        <div className="mb-2 p-2 bg-violet-50 rounded-lg border border-violet-200">
                          <p className="text-xs text-violet-700 flex items-center gap-1">
                            <Icon name="sparkles" className="w-3 h-3" />
                            {lead.ai_suggested_action}
                          </p>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">
                          {source?.icon} {source?.label}
                        </span>
                        {stage.id !== 'converted' && (
                          <div className="flex gap-1">
                            {stage.id === 'new' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); updateLeadStatus(lead.id, 'contacted') }}
                                className="p-1 text-blue-500 hover:bg-blue-50 rounded"
                                title="Mover para Em Conversa"
                              >
                                <Icon name="phone" className="w-4 h-4" />
                              </button>
                            )}
                            {stage.id === 'contacted' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); updateLeadStatus(lead.id, 'scheduled') }}
                                className="p-1 text-amber-500 hover:bg-amber-50 rounded"
                                title="Mover para Agendado"
                              >
                                <Icon name="calendar" className="w-4 h-4" />
                              </button>
                            )}
                            {stage.id === 'scheduled' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); updateLeadStatus(lead.id, 'converted') }}
                                className="p-1 text-emerald-500 hover:bg-emerald-50 rounded"
                                title="Marcar como Cliente"
                              >
                                <Icon name="check" className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      {needsContact && (
                        <div className="mt-2 pt-2 border-t border-amber-200">
                          <p className="text-xs text-amber-600 flex items-center gap-1">
                            <Icon name="bell" className="w-3 h-3" />
                            Contato pendente!
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
                {(!leadsByStage[stage.id] || leadsByStage[stage.id].length === 0) && (
                  <div className="text-center py-8 text-slate-400">
                    <Icon name="inbox" className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Nenhum lead</p>
                  </div>
                )}
              </div>
            </div>
          )})}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="card overflow-hidden">
          {filteredLeads.length === 0 ? (
            <div className="p-12 text-center">
              <Icon name="users" className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Nenhum lead encontrado</p>
              <button
                onClick={() => setShowNewLead(true)}
                className="mt-4 text-violet-600 font-medium hover:underline"
              >
                Adicionar primeiro lead
              </button>
            </div>
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="md:hidden divide-y divide-slate-100">
                {filteredLeads.map(lead => {
                  const stage = STAGES.find(s => s.id === lead.status)
                  const source = SOURCES.find(s => s.id === lead.source)
                  return (
                    <div
                      key={lead.id}
                      className="p-4 hover:bg-slate-50 cursor-pointer active:bg-slate-100"
                      onClick={() => setSelectedLead(lead)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-slate-900">{lead.name}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stage?.color}`}>
                              {stage?.label}
                            </span>
                          </div>
                          {lead.phone && <p className="text-sm text-slate-500 mt-0.5">{lead.phone}</p>}
                          {(lead as any).whatsapp_name && (lead as any).whatsapp_name !== lead.name && (
                            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                              <span>📱</span>{(lead as any).whatsapp_name}
                            </p>
                          )}
                          {lead.interest && <p className="text-sm text-violet-600 mt-1 truncate">{lead.interest}</p>}
                          <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
                            <span>{source?.icon} {source?.label}</span>
                            <span>·</span>
                            <span>{getTimeAgo(lead.created_at)}</span>
                          </div>
                        </div>
                        <Icon name="chevronRight" className="w-4 h-4 text-slate-300 flex-shrink-0 mt-1" />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Desktop: tabela */}
              <table className="w-full hidden md:table">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Lead</th>
                  <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Contato</th>
                  <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Interesse</th>
                  <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Fonte</th>
                  <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Data</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLeads.map(lead => {
                  const stage = STAGES.find(s => s.id === lead.status)
                  const source = SOURCES.find(s => s.id === lead.source)
                  return (
                    <tr 
                      key={lead.id} 
                      className="hover:bg-slate-50 cursor-pointer"
                      onClick={() => setSelectedLead(lead)}
                    >
                      <td className="p-3">
                        <p className="font-medium text-slate-900">{lead.name}</p>
                      </td>
                      <td className="p-3">
                        <p className="text-sm text-slate-600">{lead.phone || '-'}</p>
                        <p className="text-xs text-slate-400">{lead.email || ''}</p>
                      </td>
                      <td className="p-3">
                        <span className="text-sm text-slate-600">{lead.interest || '-'}</span>
                      </td>
                      <td className="p-3">
                        <span className="text-sm">{source?.icon} {source?.label}</span>
                      </td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${stage?.color}`}>
                          {stage?.label}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-slate-500">
                        {getTimeAgo(lead.created_at)}
                      </td>
                      <td className="p-3">
                        <button className="p-2 text-slate-400 hover:text-slate-600">
                          <Icon name="chevronRight" className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </>
          )}
        </div>
      )}

      {/* New Lead Modal */}
      {showNewLead && (
        <NewLeadModal
          clinicId={clinicId}
          procedures={procedures}
          users={users}
          sources={SOURCES}
          onClose={() => setShowNewLead(false)}
          onSuccess={() => { setShowNewLead(false); router.refresh() }}
        />
      )}

      {/* Lead Detail Modal */}
      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          procedures={procedures}
          users={users}
          sources={SOURCES}
          stages={STAGES}
          onClose={() => setSelectedLead(null)}
          onUpdate={() => { setSelectedLead(null); router.refresh() }}
          onFollowupChange={() => router.refresh()}
          evaActive={evaActive}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <CRMSettingsModal
          clinicId={clinicId}
          whatsappInstance={hasMultiCrm ? (crmLine || null) : null}
          currentStages={STAGES}
          currentSources={SOURCES}
          onClose={() => setShowSettings(false)}
          onSave={() => { setShowSettings(false); router.refresh() }}
        />
      )}

      {/* Relatório */}
      {viewMode === 'report' && (
        <CrmReport clinicId={clinicId} stages={STAGES} />
      )}
    </div>
  )
}

// Modal de Novo Lead
function NewLeadModal({ clinicId, procedures, users, sources, onClose, onSuccess }: {
  clinicId: string
  procedures: { id: string; name: string }[]
  users: { id: string; name: string }[]
  sources: { id: string; label: string; icon: string }[]
  onClose: () => void
  onSuccess: () => void
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    source: 'whatsapp',
    interest: '',
    notes: ''
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return

    setLoading(true)
    await supabase.from('leads').insert({
      clinic_id: clinicId,
      name: form.name.trim(),
      phone: form.phone || null,
      email: form.email || null,
      source: form.source,
      interest: form.interest || null,
      notes: form.notes || null,
      status: 'new'
    })
    setLoading(false)
    onSuccess()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">Novo Lead</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="label">Nome *</label>
            <input
              type="text"
              className="input"
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Nome do lead"
              required
            />
          </div>
          <div>
            <label className="label">WhatsApp</label>
            <input
              type="tel"
              className="input"
              value={form.phone}
              onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="(00) 00000-0000"
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
              placeholder="email@exemplo.com"
            />
          </div>
          <div>
            <label className="label">Fonte</label>
            <select
              className="input"
              value={form.source}
              onChange={e => setForm(prev => ({ ...prev, source: e.target.value }))}
            >
              {sources.map(s => (
                <option key={s.id} value={s.id}>{s.icon} {s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Interesse (procedimento)</label>
            <input
              type="text"
              className="input"
              value={form.interest}
              onChange={e => setForm(prev => ({ ...prev, interest: e.target.value }))}
              placeholder="Ex: Botox, Preenchimento..."
              list="procedures-list"
            />
            <datalist id="procedures-list">
              {procedures.map(p => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label">Observações</label>
            <textarea
              className="input min-h-[80px]"
              value={form.notes}
              onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Anotações sobre o lead..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Salvando...' : 'Adicionar Lead'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Modal de Detalhes do Lead
function LeadDetailModal({ lead, procedures, users, sources, stages, onClose, onUpdate, onFollowupChange, evaActive = true }: {
  lead: Lead
  procedures: { id: string; name: string }[]
  users: { id: string; name: string }[]
  sources: { id: string; label: string; icon: string }[]
  stages: { id: string; label: string; color: string; order: number }[]
  onClose: () => void
  onUpdate: () => void
  onFollowupChange?: () => void
  evaActive?: boolean
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [interactionType, setInteractionType] = useState<'note' | 'call' | 'whatsapp' | 'email'>('note')
  const [tab, setTab] = useState<'info' | 'history'>('info')
  const [form, setForm] = useState({
    status: lead.status,
    source: lead.source || 'whatsapp',
    interest: lead.interest || '',
    next_contact_at: lead.next_contact_at?.split('T')[0] || '',
    lost_reason: lead.lost_reason || ''
  })

  // Calcular dias desde último contato
  const daysSinceContact = lead.last_contact_at 
    ? Math.floor((Date.now() - new Date(lead.last_contact_at).getTime()) / (1000 * 60 * 60 * 24))
    : Math.floor((Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24))

  // Verificar se precisa follow-up
  const needsFollowup = lead.next_contact_at && new Date(lead.next_contact_at) <= new Date()
  
  async function handleUpdate() {
    setLoading(true)
    const updateData: Record<string, string | null> = {
      status: form.status,
      source: form.source || null,
      interest: form.interest || null,
      next_contact_at: form.next_contact_at ? `${form.next_contact_at}T09:00:00` : null,
    }
    
    if (form.status === 'converted') {
      updateData.converted_at = new Date().toISOString()
    }
    if (form.status === 'lost') {
      updateData.lost_reason = form.lost_reason || null
    }

    await supabase.from('leads').update(updateData).eq('id', lead.id)
    setLoading(false)
    onUpdate()
  }

  async function addInteraction() {
    if (!newNote.trim()) return
    
    const typeEmoji = {
      note: '📝',
      call: '📞',
      whatsapp: '💬',
      email: '📧'
    }
    
    const typeLabel = {
      note: 'Nota',
      call: 'Ligação',
      whatsapp: 'WhatsApp',
      email: 'Email'
    }
    
    const timestamp = new Date().toLocaleString('pt-BR')
    const entry = `${typeEmoji[interactionType]} [${typeLabel[interactionType]} - ${timestamp}]\n${newNote}`
    const notes = lead.notes ? `${entry}\n\n${lead.notes}` : entry
    
    await supabase.from('leads').update({ 
      notes,
      last_contact_at: new Date().toISOString()
    }).eq('id', lead.id)
    
    // Se era uma interação de contato, atualizar status se for novo
    if (interactionType !== 'note' && lead.status === 'new') {
      await supabase.from('leads').update({ status: 'contacted' }).eq('id', lead.id)
    }
    
    setNewNote('')
    onUpdate()
  }

  async function quickFollowup(days: number) {
    const date = new Date()
    date.setDate(date.getDate() + days)
    setForm(prev => ({ ...prev, next_contact_at: date.toISOString().split('T')[0] }))
  }

  async function convertToPatient() {
    setLoading(true)
    // Buscar clinic_id do lead
    const { data: leadData } = await supabase
      .from('leads')
      .select('clinic_id')
      .eq('id', lead.id)
      .single()

    if (!leadData) {
      setLoading(false)
      return
    }

    const { data: patient, error } = await supabase.from('patients').insert({
      clinic_id: leadData.clinic_id,
      name: lead.name,
      phone: lead.phone,
      email: lead.email
    }).select().single()

    if (patient) {
      await supabase.from('leads').update({ 
        status: 'converted',
        converted_at: new Date().toISOString()
      }).eq('id', lead.id)
      onUpdate()
    }
    setLoading(false)
  }

  const stage = stages.find(s => s.id === lead.status)
  const source = sources.find(s => s.id === lead.source)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-[9999] md:p-4">
      <div className="bg-white md:rounded-2xl w-full md:max-w-lg h-[92dvh] md:max-h-[90vh] md:h-auto overflow-hidden flex flex-col rounded-t-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-100">
          {/* Handle mobile */}
          <div className="flex justify-center mb-2 md:hidden">
            <div className="w-10 h-1 rounded-full bg-slate-300" />
          </div>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-bold text-slate-900 flex items-center gap-2">
                {lead.name}
                {(() => {
                  const tp = calcTemperatura(lead)
                  return tp ? <span className="text-sm" title={lead.ai_priority ? 'Definido manualmente' : 'Automático por atividade'}>{tp === 'hot' ? '🔥' : tp === 'warm' ? '☀️' : '❄️'}</span> : null
                })()}
              </h2>
              <p className="text-sm text-slate-500">{source?.icon} {source?.label} • {new Date(lead.created_at).toLocaleDateString('pt-BR')}</p>
            </div>
            <button onClick={onClose} className="flex items-center gap-1 p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
              <Icon name="x" className="w-5 h-5" />
              <span className="text-sm font-medium md:hidden">Fechar</span>
            </button>
          </div>
          
          {/* Alertas */}
          {needsFollowup && (
            <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
              <span className="text-amber-500">⚠️</span>
              <p className="text-sm text-amber-700 font-medium">Follow-up pendente!</p>
            </div>
          )}
          {daysSinceContact > 7 && lead.status !== 'converted' && lead.status !== 'lost' && (
            <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <span className="text-red-500">⏰</span>
              <p className="text-sm text-red-700">{daysSinceContact} dias sem contato</p>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          <button
            onClick={() => setTab('info')}
            className={`flex-1 py-2 text-sm font-medium ${tab === 'info' ? 'text-violet-600 border-b-2 border-violet-600' : 'text-slate-500'}`}
          >
            Informações
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex-1 py-2 text-sm font-medium ${tab === 'history' ? 'text-violet-600 border-b-2 border-violet-600' : 'text-slate-500'}`}
          >
            Histórico
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {tab === 'info' ? (
            <>
              {/* Temperatura manual */}
              <div className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-200 dark:border-slate-600">
                <p className="text-xs text-slate-500 mb-2 font-medium">🌡️ Temperatura:</p>
                <div className="flex gap-2">
                  {(['hot', 'warm', 'cold'] as const).map(t => {
                    const cfg = AI_PRIORITY_CONFIG[t]
                    const isActive = lead.ai_priority === t
                    return (
                      <button key={t}
                        onClick={async () => {
                          const newPriority = isActive ? null : t
                          await supabase.from('leads').update({ ai_priority: newPriority }).eq('id', lead.id)
                          onUpdate()
                        }}
                        className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition border ${isActive ? cfg.color + ' border-transparent ring-2 ring-offset-1 ' + (t === 'hot' ? 'ring-red-400' : t === 'warm' ? 'ring-amber-400' : 'ring-blue-400') : 'border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                        {t === 'hot' ? '🔥 Quente' : t === 'warm' ? '☀️ Morno' : '❄️ Frio'}
                      </button>
                    )
                  })}
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  {lead.ai_priority ? '✏️ Definido manualmente · clique para remover' : `ℹ️ Automático — ${calcTemperatura(lead) === 'hot' ? 'ativo recentemente' : calcTemperatura(lead) === 'warm' ? 'algum tempo sem contato' : 'muito tempo sem contato'}`}
                </p>
              </div>

              {/* Follow-ups e Histórico de Contatos */}
              <LeadFollowupPanel leadId={lead.id} leadName={lead.name} evaNextFollowupAt={lead.eva_next_followup_at} evaFollowupCount={lead.eva_followup_count} evaPauseUntil={lead.eva_pause_until} evaActive={evaActive} onUpdate={onFollowupChange} />

              {/* Contato Rápido */}
              <div className="flex gap-2">
                {lead.phone && (
                  <Link
                    href={`/dashboard/whatsapp?phone=${encodeURIComponent(lead.phone.replace(/\D/g, ''))}`}
                    onClick={() => {
                      // Registrar interação no histórico do lead
                      const entry = `💬 [WhatsApp - ${new Date().toLocaleString('pt-BR')}]\nAbriu conversa pelo CRM`
                      const notes = lead.notes ? `${entry}\n\n${lead.notes}` : entry
                      supabase.from('leads').update({ notes, last_contact_at: new Date().toISOString() }).eq('id', lead.id)
                    }}
                    className="flex-1 py-2.5 px-4 bg-emerald-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-emerald-600 transition-colors"
                    title="Abrir conversa no WhatsApp do sistema"
                  >
                    <Icon name="message" className="w-4 h-4" />
                    WhatsApp
                  </Link>
                )}
                {lead.phone && (
                  <a
                    href={`tel:${lead.phone}`}
                    className="flex-1 py-2.5 px-4 bg-blue-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors"
                  >
                    <Icon name="phone" className="w-4 h-4" />
                    Ligar
                  </a>
                )}
              </div>

              {/* Status — coluna do Kanban */}
              <div>
                <label className="label">Coluna do CRM</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {stages.map(s => {
                    const isActive = form.status === s.id
                    const colorMap: Record<string, string> = {
                      slate:   isActive ? 'bg-slate-600 text-white border-slate-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50',
                      blue:    isActive ? 'bg-blue-500 text-white border-blue-500'   : 'border-blue-200 text-blue-500 hover:bg-blue-50',
                      amber:   isActive ? 'bg-amber-500 text-white border-amber-500' : 'border-amber-200 text-amber-600 hover:bg-amber-50',
                      emerald: isActive ? 'bg-emerald-500 text-white border-emerald-500' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50',
                      red:     isActive ? 'bg-red-500 text-white border-red-500'     : 'border-red-200 text-red-500 hover:bg-red-50',
                    }
                    const iconMap: Record<string, string> = {
                      new: '✨', contacted: '💬', scheduled: '📅', converted: '✅', lost: '❌',
                    }
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, status: s.id }))}
                        className={`text-left px-3 py-2 rounded-lg border font-medium text-xs transition flex items-center gap-1.5 ${isActive ? 'ring-2 ring-offset-1 ' + (s.color === 'red' ? 'ring-red-400' : s.color === 'emerald' ? 'ring-emerald-400' : s.color === 'amber' ? 'ring-amber-400' : s.color === 'blue' ? 'ring-blue-400' : 'ring-slate-400') : ''} ${colorMap[s.color] ?? ''}`}
                      >
                        <span>{iconMap[s.id]}</span>
                        <span className="truncate">{s.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {form.status === 'lost' && (
                <div>
                  <label className="label">Motivo da perda</label>
                  <input
                    type="text"
                    className="input"
                    value={form.lost_reason}
                    onChange={e => setForm(prev => ({ ...prev, lost_reason: e.target.value }))}
                    placeholder="Ex: Preço, concorrência, desistiu..."
                  />
                </div>
              )}

              {/* Origem do Lead */}
              <div>
                <label className="label">Origem do Lead</label>
                <select
                  className="input"
                  value={form.source}
                  onChange={e => setForm(prev => ({ ...prev, source: e.target.value }))}
                >
                  {sources.map(s => (
                    <option key={s.id} value={s.id}>{s.icon} {s.label}</option>
                  ))}
                </select>
              </div>

              {/* Interesse */}
              <div>
                <label className="label">Interesse</label>
                <input
                  type="text"
                  className="input"
                  value={form.interest}
                  onChange={e => setForm(prev => ({ ...prev, interest: e.target.value }))}
                  placeholder="Procedimento de interesse"
                />
              </div>

              {/* Follow-up */}
              <div>
                <label className="label">Próximo contato (Follow-up)</label>
                <input
                  type="date"
                  className="input mb-2"
                  value={form.next_contact_at}
                  onChange={e => setForm(prev => ({ ...prev, next_contact_at: e.target.value }))}
                />
                <div className="flex gap-2">
                  <button onClick={() => quickFollowup(1)} className="px-3 py-1 text-xs bg-slate-100 rounded-full hover:bg-slate-200">Amanhã</button>
                  <button onClick={() => quickFollowup(3)} className="px-3 py-1 text-xs bg-slate-100 rounded-full hover:bg-slate-200">3 dias</button>
                  <button onClick={() => quickFollowup(7)} className="px-3 py-1 text-xs bg-slate-100 rounded-full hover:bg-slate-200">1 semana</button>
                  <button onClick={() => quickFollowup(14)} className="px-3 py-1 text-xs bg-slate-100 rounded-full hover:bg-slate-200">2 semanas</button>
                </div>
              </div>

            </>
          ) : (
            <>
              {/* Adicionar Interação */}
              <div className="space-y-2">
                <div className="flex gap-1">
                  {(['note', 'call', 'whatsapp', 'email'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => setInteractionType(type)}
                      className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                        interactionType === type
                          ? 'bg-violet-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {type === 'note' && '📝 Nota'}
                      {type === 'call' && '📞 Ligação'}
                      {type === 'whatsapp' && '💬 WhatsApp'}
                      {type === 'email' && '📧 Email'}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="input flex-1"
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    placeholder={interactionType === 'note' ? 'Adicionar nota...' : 'Descreva o contato...'}
                    onKeyPress={e => e.key === 'Enter' && addInteraction()}
                  />
                  <button
                    onClick={addInteraction}
                    className="px-4 py-2 bg-violet-600 text-white rounded-xl hover:bg-violet-700"
                  >
                    <Icon name="plus" className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Histórico */}
              <div>
                <label className="label">Histórico de Interações</label>
                {lead.notes ? (
                  <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-600 whitespace-pre-wrap max-h-60 overflow-y-auto space-y-2">
                    {lead.notes.split('\n\n').map((entry, i) => (
                      <div key={i} className="pb-2 border-b border-slate-200 last:border-0">
                        {entry}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic">Nenhuma interação registrada</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 space-y-3">
          {lead.status !== 'converted' && lead.status !== 'lost' && (
            <button
              onClick={convertToPatient}
              disabled={loading}
              className="w-full py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 flex items-center justify-center gap-2"
            >
              <Icon name="userPlus" className="w-4 h-4" />
              Converter em Paciente
            </button>
          )}
          <div className="flex gap-3">
            <button onClick={handleUpdate} disabled={loading} className="btn-primary flex-1">
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
            {lead.status !== 'converted' && (
              <Link
                href={`/dashboard/agenda/novo?patient_name=${encodeURIComponent(lead.name)}&patient_phone=${encodeURIComponent(lead.phone || '')}`}
                className="btn-secondary flex items-center gap-2"
              >
                <Icon name="calendar" className="w-4 h-4" />
                Agendar
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Modal "Como usar o CRM" — referência visual de cores, badges e estágios.
 * Aparece quando o admin/secretaria clica no botao 📖 do header. Vale tanto
 * como onboarding pra membros novos quanto como cola pra quem esquece o
 * que cada termo significa.
 */
function LegendModal({ onClose, evaActive = true }: { onClose: () => void; evaActive?: boolean }) {
  const [tab, setTab] = useState<'inicio' | 'funil' | 'followup' | 'eva' | 'dicas'>('inicio')

  const tabs: { id: typeof tab; label: string; emoji: string }[] = [
    { id: 'inicio',   label: 'Início',    emoji: '🚀' },
    { id: 'funil',    label: 'Funil',     emoji: '🎯' },
    { id: 'followup', label: 'Follow-up', emoji: '⏰' },
    ...(evaActive ? [{ id: 'eva' as const, label: 'Eva IA', emoji: '🤖' }] : []),
    { id: 'dicas',    label: 'Dicas',     emoji: '💡' },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-0 md:p-4" onClick={onClose}>
      <div className="bg-white w-full md:max-w-2xl md:rounded-2xl rounded-t-2xl shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">📖 Manual do CRM</h2>
            <p className="text-xs text-slate-500 mt-0.5">Guia completo para a equipe da clínica</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-3 gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t.id ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              <span>{t.emoji}</span>{t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-5">

          {/* INÍCIO */}
          {tab === 'inicio' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-violet-50 border border-violet-100">
                <p className="text-sm font-semibold text-violet-900 mb-1">O que é o CRM?</p>
                <p className="text-xs text-violet-700 leading-relaxed">
                  O CRM é o <strong>controle de todos os leads</strong> da clínica — toda pessoa que entrou em contato e ainda não virou paciente. Aqui você acompanha em que etapa cada um está, agenda lembretes de contato (follow-ups), anota tudo e transforma leads em pacientes.
                </p>
              </div>

              <div className={`p-3 rounded-xl border text-xs leading-relaxed ${evaActive ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-sky-50 border-sky-100 text-sky-800'}`}>
                {evaActive
                  ? <><strong>🤖 Sua clínica usa a Eva.</strong> A recepcionista virtual responde os leads no WhatsApp automaticamente. Você entra quando ela pede ajuda (cards com borda rosa) e para acompanhar o funil.</>
                  : <><strong>✋ Atendimento manual.</strong> Nesta clínica, todo o atendimento aos leads é feito pela sua equipe. O CRM te ajuda a não esquecer ninguém: organiza os contatos, agenda follow-ups e avisa quando é hora de falar com cada lead.</>}
              </div>

              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">O passo a passo do dia</p>
              <div className="space-y-3">
                {[
                  { n: '1', t: 'Chegou um lead novo', d: evaActive ? 'Aparece na coluna Novo Lead. A Eva já responde automaticamente pelo WhatsApp.' : 'Aparece na coluna Novo Lead. Entre em contato pelo WhatsApp para iniciar o atendimento.' },
                  { n: '2', t: 'Conversa em andamento', d: evaActive ? 'Quando o lead responde, ele vai para Em Conversa. Fique de olho nos cards com borda rosa — esses a Eva pausou e precisam de você.' : 'Conforme você conversa, mova o lead para Em Conversa. Todo o atendimento é feito por você.' },
                  { n: '3', t: 'Agende um follow-up', d: 'Não conseguiu fechar na hora? Agende um lembrete de retorno (ex: "ligar amanhã às 14h"). O sistema te avisa quando chegar a hora.' },
                  { n: '4', t: 'Marcou consulta', d: 'Mova o card para Agendado quando marcar a consulta ou procedimento.' },
                  { n: '✓', t: 'Virou paciente!', d: 'Clique em Converter em Paciente dentro do card. O lead sai do funil e vira paciente da clínica.' },
                ].map(s => (
                  <div key={s.n} className="flex gap-3 items-start">
                    <span className={`flex-shrink-0 w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center ${s.n === '✓' ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-700'}`}>{s.n}</span>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{s.t}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{s.d}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-800">
                <strong>⚡ Rotina diária:</strong> abra o CRM toda manhã e confira o <strong>sininho 🔔</strong> no topo — ele mostra todos os follow-ups que estão na hora de fazer. Sino zerado = tudo em dia!
              </div>
            </div>
          )}

          {/* FUNIL */}
          {tab === 'funil' && (
            <div className="space-y-5">
              <p className="text-xs text-slate-500 leading-relaxed">O funil é o caminho que cada lead percorre até virar paciente. Cada coluna do quadro (Kanban) é uma etapa.</p>
              <div className="space-y-3">
                {[
                  { emoji: '📥', color: 'bg-slate-100 border-slate-200 text-slate-700', title: 'Novo Lead', desc: 'Acabou de entrar em contato. ' + (evaActive ? 'A Eva já recebeu e vai responder.' : 'Entre em contato para começar o atendimento.') },
                  { emoji: '💬', color: 'bg-blue-50 border-blue-200 text-blue-700', title: 'Em Conversa', desc: 'Trocando mensagens com o lead. ' + (evaActive ? 'Borda rosa = a Eva pausou e é a sua vez de atender.' : 'Todo o atendimento é manual aqui.') },
                  { emoji: '📅', color: 'bg-amber-50 border-amber-200 text-amber-700', title: 'Agendado', desc: 'Consulta ou procedimento marcado. Mova o card aqui ao confirmar o agendamento.' },
                  { emoji: '✅', color: 'bg-emerald-50 border-emerald-200 text-emerald-700', title: 'Cliente', desc: 'Paciente já atendido. Use "Converter em Paciente" para criar o cadastro completo.' },
                  { emoji: '❌', color: 'bg-red-50 border-red-200 text-red-700', title: 'Perdido', desc: 'Não respondeu mais ou desistiu. Fica registrado para histórico — não some do sistema.' },
                ].map(s => (
                  <div key={s.title} className={`flex gap-3 p-3 rounded-xl border ${s.color}`}>
                    <span className="text-xl flex-shrink-0">{s.emoji}</span>
                    <div><p className="text-sm font-semibold">{s.title}</p><p className="text-xs mt-0.5 opacity-80">{s.desc}</p></div>
                  </div>
                ))}
              </div>
              <div className="p-3 rounded-xl bg-violet-50 border border-violet-100 text-xs text-violet-800">
                💡 <strong>Dica:</strong> arraste qualquer card entre as colunas pra mudar de etapa. Ou clique no card e use a seção <em>Coluna do CRM</em>.
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-700">🌡️ Temperatura do lead</p>
                <p className="text-xs text-slate-500">{evaActive ? 'A Eva classifica a intenção de compra de cada lead.' : 'Você pode marcar a temperatura de cada lead manualmente.'} Use pra saber quem priorizar.</p>
                <div className="space-y-2">
                  {[
                    { emoji: '🔥', color: 'from-red-50 to-orange-50 border-red-100 text-red-700', title: 'Quente', desc: 'Pediu preço ou quer agendar logo. Atenda imediatamente.' },
                    { emoji: '☀️', color: 'from-amber-50 to-yellow-50 border-amber-100 text-amber-700', title: 'Morno', desc: 'Está pesquisando, ainda decidindo. Envie mais informações.' },
                    { emoji: '❄️', color: 'from-blue-50 to-cyan-50 border-blue-100 text-blue-700', title: 'Frio', desc: 'Só curiosidade por enquanto. Nutra o contato ao longo do tempo.' },
                  ].map(t => (
                    <div key={t.title} className={`flex gap-3 p-3 rounded-lg bg-gradient-to-br border ${t.color}`}>
                      <span className="text-lg flex-shrink-0">{t.emoji}</span>
                      <div><p className="text-xs font-semibold">{t.title}</p><p className="text-xs opacity-80">{t.desc}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* FOLLOW-UP */}
          {tab === 'followup' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-sky-50 border border-sky-100">
                <p className="text-sm font-semibold text-sky-900 mb-1">O que é follow-up?</p>
                <p className="text-xs text-sky-700 leading-relaxed">É o <strong>lembrete de voltar a falar com um lead</strong> num horário marcado. Por exemplo: "ligar para a Maria amanhã às 14h". O CRM guarda esse compromisso e te avisa na hora certa, pra você nunca esquecer de retornar um contato.</p>
              </div>

              {/* Ciclo visual */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-xs font-semibold text-slate-700 mb-3">🔄 O ciclo do follow-up</p>
                <div className="flex items-center justify-between gap-1 text-center">
                  {[
                    { e: '📅', t: 'Você agenda', c: 'text-violet-600' },
                    { e: '⏳', t: 'Aguarda a hora', c: 'text-slate-400' },
                    { e: '🔔', t: 'Vence: vira pendente', c: 'text-amber-600' },
                    { e: '✓', t: 'Você conclui', c: 'text-emerald-600' },
                  ].map((s, i, arr) => (
                    <div key={s.t} className="flex items-center flex-1">
                      <div className="flex flex-col items-center gap-1 flex-1">
                        <span className="text-xl">{s.e}</span>
                        <span className={`text-[10px] font-medium leading-tight ${s.c}`}>{s.t}</span>
                      </div>
                      {i < arr.length - 1 && <span className="text-slate-300 text-xs">→</span>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">📅 Como agendar um follow-up</p>
                {[
                  { n: '1', d: 'Clique no card do lead para abrir os detalhes.' },
                  { n: '2', d: 'Vá na aba Follow-ups e clique em + Agendar follow-up.' },
                  { n: '3', d: 'Escolha a data e a hora, o canal (WhatsApp, ligação, e-mail…) e escreva uma observação opcional (ex: "perguntar sobre o parcelamento"). Clique em Salvar.' },
                  { n: '4', d: 'Quando chegar a hora marcada, o lead aparece no sininho 🔔 e o card mostra "Contato pendente!" com a borda amarela.' },
                  { n: '5', d: 'Depois de falar com o lead, abra o card e marque o follow-up como concluído (✓). Ele some das pendências na hora.' },
                ].map(s => (
                  <div key={s.n} className="flex gap-2 items-start p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600">
                    <span className="font-bold text-violet-600 flex-shrink-0">{s.n}.</span><p>{s.d}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">🔔 O sininho de pendências</p>
                <p className="text-xs text-slate-500">No topo da tela, ao lado de "Como usar", o sino mostra o número de follow-ups que estão na hora de fazer. Clique nele para ver a lista e ir direto no lead.</p>
                <div className="flex gap-3 items-center p-3 bg-white rounded-lg border border-slate-200 text-xs">
                  <span className="text-base">⏰</span>
                  <div><span className="font-medium text-amber-600">Contato pendente!</span> — passou da hora marcada e ainda não foi feito. Aparece no card e conta no sino.</div>
                </div>
                <div className="flex gap-3 items-center p-3 bg-white rounded-lg border border-slate-200 text-xs">
                  <span className="text-base">✓</span>
                  <div><span className="font-medium text-emerald-600">Concluído</span> — você marcou como feito. Some do sino, do card e do contador automaticamente.</div>
                </div>
              </div>

              {evaActive && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">🤖 Follow-up automático (Eva)</p>
                  <p className="text-xs text-slate-500">Quando o lead para de responder, a Eva manda lembretes automáticos em sequência, sozinha. O card mostra quanto falta para o próximo: <em>"Followup Eva · em 3h"</em>. Você não precisa fazer nada — mas pode assumir quando quiser.</p>
                </div>
              )}

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-800">
                <strong>💡 Dica:</strong> o card <strong>"Em follow-up"</strong> no topo mostra todos os leads aguardando contato. Clique nele para filtrar e focar só nesses.
              </div>
            </div>
          )}

          {/* EVA (só se ativa) */}
          {tab === 'eva' && evaActive && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100">
                <p className="text-sm font-semibold text-violet-900 mb-1">🤖 O que a Eva faz?</p>
                <p className="text-xs text-violet-700 leading-relaxed">A Eva é a recepcionista virtual. Ela responde leads no WhatsApp <strong>automaticamente</strong>, tira dúvidas, mostra preços e tenta agendar — enquanto você cuida de outras coisas.</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">O que a Eva faz sozinha</p>
                {['✅ Responde as primeiras mensagens do lead','✅ Transcreve e responde áudios do WhatsApp','✅ Explica procedimentos e preços','✅ Envia fotos de resultados quando o lead pede','✅ Manda follow-ups automáticos quando o lead some','✅ Classifica o lead (quente/morno/frio)'].map(item => (
                  <div key={item} className="text-xs text-slate-700 p-2 bg-slate-50 rounded-lg">{item}</div>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">🚨 Quando a Eva chama você</p>
                <p className="text-xs text-slate-500 mb-2">O card fica com <strong>borda rosa</strong> quando a Eva precisa da sua ajuda:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { emoji: '🚫', label: 'Cancelamento', desc: 'Lead quer cancelar' },
                    { emoji: '🔄', label: 'Reagendamento', desc: 'Quer trocar data/horário' },
                    { emoji: '⚠️', label: 'Reclamação', desc: 'Está insatisfeito' },
                    { emoji: '❓', label: 'Dúvida clínica', desc: 'Pergunta técnica/médica' },
                    { emoji: '📷', label: 'Foto ou vídeo', desc: 'Enviou mídia que a Eva não vê' },
                    { emoji: '🔁', label: 'Situação incomum', desc: 'Algo fora do padrão' },
                  ].map(r => (
                    <div key={r.label} className="flex gap-2 items-start p-2.5 rounded-lg bg-rose-50 border border-rose-100 text-xs">
                      <span>{r.emoji}</span>
                      <div><p className="font-medium text-rose-700">{r.label}</p><p className="text-rose-500">{r.desc}</p></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1.5">
                <p className="font-semibold">Quando eu assumo, a Eva para?</p>
                <p className="text-slate-500">Sim. Quando você responde pelo WhatsApp da clínica, a Eva pausa para aquele lead. Ela volta a agir se o lead ficar sem resposta por um tempo, ou você pode pausar/reativar manualmente no card.</p>
              </div>
            </div>
          )}

          {/* DICAS */}
          {tab === 'dicas' && (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Dicas do dia a dia</p>
              {[
                { emoji: '🌅', title: 'Rotina matinal (5 minutos)', desc: 'Abra o CRM toda manhã e confira o sininho 🔔. Ele lista todos os follow-ups na hora de fazer.' },
                { emoji: '🔔', title: 'Confie no sininho', desc: 'O número vermelho no sino é quantos contatos estão te esperando. Zerou o sino = está tudo em dia.' },
                { emoji: '📝', title: 'Sempre anote observações', desc: 'Ao agendar um follow-up, use o campo de observação (ex: "perguntou sobre parcelamento"). Ajuda muito a retomar a conversa.' },
                { emoji: '✓', title: 'Marque como concluído', desc: 'Depois de falar com o lead, marque o follow-up como concluído. Some do sino e do card na hora.' },
                { emoji: '🔍', title: 'Filtre por temperatura', desc: 'Clique no card "Quentes" no topo para ver só os leads mais prontos pra fechar. Foque neles primeiro.' },
                { emoji: '↔️', title: 'Mantenha o funil atualizado', desc: 'Arraste os cards entre as colunas conforme o andamento. Toda a equipe enxerga o status de cada lead.' },
                { emoji: '📊', title: 'Acompanhe os números', desc: 'Na aba "Relatório" você vê quantos leads converteram, quantos foram perdidos e de onde vêm os melhores. Ótimo para reuniões.' },
              ].map(d => (
                <div key={d.title} className="flex gap-3 p-3 rounded-xl bg-white border border-slate-200">
                  <span className="text-2xl flex-shrink-0">{d.emoji}</span>
                  <div><p className="text-sm font-semibold text-slate-800">{d.title}</p><p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{d.desc}</p></div>
                </div>
              ))}
              <div className="p-3 rounded-xl bg-violet-50 border border-violet-100 text-xs text-violet-800 text-center">Dúvidas? Fale com o administrador da clínica ou o suporte do Clinike.</div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-3">
          <button onClick={onClose} className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium text-sm transition-colors">Fechar guia</button>
        </div>
      </div>
    </div>
  )
}


function LegendRow({ color, label, desc }: { color: string; label: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50">
      <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${color}`}>
        {label}
      </span>
      <span className="text-slate-600 flex-1">{desc}</span>
    </div>
  )
}

/**
 * Chip de filtro usado na barra de sub-filtros de follow-up.
 * Quando disabled fica visivel mas opaco — ajuda o usuario a ver "tem
 * 0 leads nesse bucket" sem ter que esconder o chip e mexer no layout.
 */
function FollowupChip({
  active,
  onClick,
  label,
  tone,
  disabled,
}: {
  active: boolean
  onClick: () => void
  label: string
  tone: 'amber' | 'orange' | 'red' | 'darkred'
  disabled?: boolean
}) {
  const palette =
    tone === 'darkred'
      ? { active: 'bg-red-700 text-white', idle: 'bg-red-100 text-red-900 hover:bg-red-200' }
      : tone === 'red'
        ? { active: 'bg-red-600 text-white', idle: 'bg-red-50 text-red-700 hover:bg-red-100' }
        : tone === 'orange'
          ? { active: 'bg-orange-500 text-white', idle: 'bg-orange-50 text-orange-700 hover:bg-orange-100' }
          : { active: 'bg-amber-500 text-white', idle: 'bg-amber-50 text-amber-700 hover:bg-amber-100' }

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
        active ? palette.active : palette.idle
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {label}
    </button>
  )
}
