'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { createClient } from '@/lib/supabase/client'
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
  if (count >= 4) return { label: 'Última chance · 10d', tone: 'darkred' }
  if (count === 3) return { label: 'Aguardando 5d', tone: 'red' }
  if (count === 2) return { label: 'Aguardando 48h', tone: 'orange' }
  if (count === 1) return { label: 'Aguardando 24h', tone: 'orange' }
  return { label: 'Aguardando 2h', tone: 'amber' }
}

const HUMAN_REVIEW_REASONS: Record<string, { label: string; emoji: string }> = {
  cancelamento: { label: 'Cancelamento', emoji: '🚫' },
  reagendamento: { label: 'Reagendamento', emoji: '🔄' },
  reclamacao: { label: 'Reclamação', emoji: '⚠️' },
  duvida_complexa: { label: 'Dúvida', emoji: '❓' },
}

type CRMSettings = {
  custom_stages: { id: string; label: string; color: string; order: number }[]
  custom_sources: { id: string; label: string; icon: string }[]
  whatsapp_auto_reply: boolean
  whatsapp_welcome_message: string | null
  eva_auto_analyze: boolean
  eva_auto_suggest: boolean
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
  templates: MessageTemplate[]
  /** Quando true, mostra banner indicando que a Eva está em modo manual. */
  evaPaused?: boolean
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

const AI_PRIORITY_CONFIG = {
  hot: { label: '🔥 Quente', color: 'bg-red-100 text-red-700' },
  warm: { label: '☀️ Morno', color: 'bg-amber-100 text-amber-700' },
  cold: { label: '❄️ Frio', color: 'bg-blue-100 text-blue-700' },
}

export default function CRMView({ leads, procedures, users, clinicId, settings, templates, evaPaused = false }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [showNewLead, setShowNewLead] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [showSettings, setShowSettings] = useState(false)
  // Drag & drop nativo HTML5 — usado pra mover lead entre colunas do Kanban
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null)
  const [draggingFromStage, setDraggingFromStage] = useState<string | null>(null)
  const [hoverStage, setHoverStage] = useState<string | null>(null)

  // Realtime: novos leads (Donna criando do WhatsApp) e mudancas de status
  // aparecem na hora em todos os usuarios da clinica.
  useRealtimeRefresh({
    table: 'leads',
    filter: { column: 'clinic_id', value: clinicId },
  })

  // Usar configurações customizadas ou padrão
  const STAGES = settings?.custom_stages || DEFAULT_STAGES
  const SOURCES = settings?.custom_sources || DEFAULT_SOURCES

  // ─── Helpers de followup ─────────────────────────────────────────────────
  // Um lead esta "em followup" quando a Eva ja agendou a proxima tentativa
  // E o lead nao virou cliente/perdido E nao foi escalado pra humano.
  // Os 5 estagios batem com o cron eva-followup:
  //   count 0 -> aguardando 1a resposta (~2h)
  //   count 1 -> ja mandou 1, proxima em 24h
  //   count 2 -> ja mandou 2, proxima em 48h
  //   count 3 -> ja mandou 3, proxima em 5d
  //   count 4 -> ultima chance (~10d)
  const isInFollowup = (l: Lead): boolean =>
    !!l.eva_next_followup_at &&
    l.status !== 'converted' &&
    l.status !== 'lost' &&
    !l.needs_human_review

  const getFollowupCount = (l: Lead): number => l.eva_followup_count ?? 0

  const followupBucket = (l: Lead): 'fu_2h' | 'fu_24h' | 'fu_48h' | 'fu_5d' | 'fu_10d' | null => {
    if (!isInFollowup(l)) return null
    const c = getFollowupCount(l)
    if (c >= 4) return 'fu_10d'
    if (c === 3) return 'fu_5d'
    if (c === 2) return 'fu_48h'
    if (c === 1) return 'fu_24h'
    return 'fu_2h'
  }

  // Stats
  const stats = {
    total: leads.length,
    new: leads.filter(l => l.status === 'new').length,
    contacted: leads.filter(l => l.status === 'contacted').length,
    scheduled: leads.filter(l => l.status === 'scheduled').length,
    converted: leads.filter(l => l.status === 'converted').length,
    lost: leads.filter(l => l.status === 'lost').length,
    conversionRate: leads.length > 0 
      ? Math.round((leads.filter(l => l.status === 'converted').length / leads.filter(l => ['converted', 'lost'].includes(l.status)).length) * 100) || 0
      : 0,
    // Eva IA stats — temperatura do lead (priority calculada pela IA)
    hotLeads: leads.filter(l => l.ai_priority === 'hot').length,
    warmLeads: leads.filter(l => l.ai_priority === 'warm').length,
    coldLeads: leads.filter(l => l.ai_priority === 'cold').length,
    estimatedValue: leads.filter(l => l.status !== 'lost').reduce((sum, l) => sum + (l.estimated_value || 0), 0),
    pendingContact: leads.filter(l => l.next_contact_at && new Date(l.next_contact_at) <= new Date()).length,
    // Atendimento humano (Eva escalou)
    humanReview: leads.filter(l => l.needs_human_review === true).length,
    // Followup buckets (Eva aguardando resposta) — 5 estagios
    followupTotal: leads.filter(isInFollowup).length,
    followup2h: leads.filter(l => followupBucket(l) === 'fu_2h').length,
    followup24h: leads.filter(l => followupBucket(l) === 'fu_24h').length,
    followup48h: leads.filter(l => followupBucket(l) === 'fu_48h').length,
    followup5d: leads.filter(l => followupBucket(l) === 'fu_5d').length,
    followup10d: leads.filter(l => followupBucket(l) === 'fu_10d').length,
  }

  const isFollowupFilter = (f: string) =>
    f === 'followup_all' || f === 'fu_2h' || f === 'fu_24h' || f === 'fu_48h' || f === 'fu_5d' || f === 'fu_10d'

  // Filtrar leads — alem dos status, tem filtros especiais:
  //   'human_review'        -> leads escalados pra atendimento humano
  //   'hot' / 'warm' / 'cold' -> filtra por temperatura (ai_priority)
  //   'pending_contact'      -> leads com next_contact_at vencido
  //   'followup_all'         -> qualquer lead em followup ativo
  //   'fu_2h' / 'fu_24h' / 'fu_48h' / 'fu_5d' / 'fu_10d' -> bucket especifico
  const filteredLeads =
    filter === 'all'
      ? leads
      : filter === 'human_review'
        ? leads.filter(l => l.needs_human_review === true)
        : filter === 'hot' || filter === 'warm' || filter === 'cold'
          ? leads.filter(l => l.ai_priority === filter)
          : filter === 'pending_contact'
            ? leads.filter(l => l.next_contact_at && new Date(l.next_contact_at) <= new Date())
            : filter === 'followup_all'
              ? leads.filter(isInFollowup)
              : isFollowupFilter(filter)
                ? leads.filter(l => followupBucket(l) === filter)
                : leads.filter(l => l.status === filter)

  // Agrupar por stage para Kanban (respeita os filtros especiais)
  const leadsForKanban =
    filter === 'human_review'
      ? leads.filter(l => l.needs_human_review === true)
      : filter === 'hot' || filter === 'warm' || filter === 'cold'
        ? leads.filter(l => l.ai_priority === filter)
        : filter === 'pending_contact'
          ? leads.filter(l => l.next_contact_at && new Date(l.next_contact_at) <= new Date())
          : filter === 'followup_all'
            ? leads.filter(isInFollowup)
            : isFollowupFilter(filter)
              ? leads.filter(l => followupBucket(l) === filter)
              : leads
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

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`card p-3 text-left transition-all ${filter === 'all' ? 'ring-2 ring-slate-400' : 'hover:bg-slate-50'}`}
        >
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          <p className="text-xs text-slate-500">Total Leads</p>
        </button>
        
        {stats.humanReview > 0 && (
          <button
            onClick={() => setFilter(filter === 'human_review' ? 'all' : 'human_review')}
            className={`card p-3 text-left bg-gradient-to-br from-rose-50 to-pink-50 transition-all ${filter === 'human_review' ? 'ring-2 ring-rose-400' : 'hover:from-rose-100 hover:to-pink-100'}`}
            title="Eva escalou para humano. Clique para filtrar."
          >
            <p className="text-2xl font-bold text-rose-600">{stats.humanReview} 🚨</p>
            <p className="text-xs text-rose-600">Atendimento Humano</p>
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
        
        <button
          onClick={() => setFilter(filter === 'new' ? 'all' : 'new')}
          className={`card p-3 text-left transition-all ${filter === 'new' ? 'ring-2 ring-violet-400' : 'hover:bg-slate-50'}`}
          title="Leads ainda não contatados. Clique para filtrar."
        >
          <p className="text-2xl font-bold text-slate-900">{stats.new}</p>
          <p className="text-xs text-slate-500">Novos</p>
        </button>
        
        <div className="card p-3 bg-gradient-to-br from-emerald-50 to-teal-50">
          <p className="text-2xl font-bold text-emerald-600">{stats.conversionRate}%</p>
          <p className="text-xs text-emerald-600">Conversão</p>
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
              active={filter === 'fu_24h'}
              onClick={() => setFilter(filter === 'fu_24h' ? 'followup_all' : 'fu_24h')}
              label={`🟠 24h (${stats.followup24h})`}
              tone="orange"
              disabled={stats.followup24h === 0}
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
              {stats.followup24h > 0 && <option value="fu_24h">⏰ Aguardando 24h ({stats.followup24h})</option>}
              {stats.followup48h > 0 && <option value="fu_48h">⏰ Aguardando 48h ({stats.followup48h})</option>}
              {stats.followup5d > 0 && <option value="fu_5d">⏰ Aguardando 5 dias ({stats.followup5d})</option>}
              {stats.followup10d > 0 && <option value="fu_10d">⏰ Última chance · 10d ({stats.followup10d})</option>}
            </optgroup>
          )}
        </select>
      </div>

      {/* Kanban View */}
      {viewMode === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.filter(s => s.id !== 'lost').map(stage => {
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
                className={`bg-slate-100 rounded-b-xl p-2 min-h-[400px] space-y-2 transition-colors ${isHovering ? 'bg-violet-100 ring-2 ring-violet-400 ring-inset' : ''}`}
                onDragOver={(e) => handleDragOver(e, stage.id)}
                onDragLeave={() => handleDragLeave(stage.id)}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                {leadsByStage[stage.id]?.map(lead => {
                  const source = SOURCES.find(s => s.id === lead.source)
                  const aiPriority = lead.ai_priority ? AI_PRIORITY_CONFIG[lead.ai_priority as keyof typeof AI_PRIORITY_CONFIG] : null
                  const needsContact = lead.next_contact_at && new Date(lead.next_contact_at) <= new Date()
                  const followup = getFollowupBadge(lead)
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
                  const humanReview = lead.needs_human_review
                    ? HUMAN_REVIEW_REASONS[lead.human_review_reason ?? ''] ?? { label: 'Atendimento', emoji: '🚨' }
                    : null

                  const cardRing = humanReview
                    ? 'ring-2 ring-rose-400'
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
                      className={`bg-white p-3 rounded-xl shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing ${cardRing} ${isDragging ? 'opacity-40 scale-95' : ''}`}
                      title="Arraste para mover de coluna"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{lead.name}</p>
                          {aiPriority && (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${aiPriority.color}`} title="Classificação Eva IA">
                              {lead.ai_priority === 'hot' ? '🔥' : lead.ai_priority === 'warm' ? '☀️' : '❄️'}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400 flex-shrink-0">{getTimeAgo(lead.created_at)}</span>
                      </div>
                      {lead.phone && (
                        <p className="text-xs text-slate-500 mb-1">{lead.phone}</p>
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
                      {followup && (
                        <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border mb-2 ${followupClass}`} title="Eva está aguardando resposta da paciente">
                          <span>{followupEmoji}</span>
                          <span className="font-medium">{followup.label}</span>
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
            <table className="w-full">
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
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <CRMSettingsModal
          clinicId={clinicId}
          currentStages={STAGES}
          currentSources={SOURCES}
          onClose={() => setShowSettings(false)}
          onSave={() => { setShowSettings(false); router.refresh() }}
        />
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
function LeadDetailModal({ lead, procedures, users, sources, stages, onClose, onUpdate }: {
  lead: Lead
  procedures: { id: string; name: string }[]
  users: { id: string; name: string }[]
  sources: { id: string; label: string; icon: string }[]
  stages: { id: string; label: string; color: string; order: number }[]
  onClose: () => void
  onUpdate: () => void
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [interactionType, setInteractionType] = useState<'note' | 'call' | 'whatsapp' | 'email'>('note')
  const [tab, setTab] = useState<'info' | 'history'>('info')
  const [form, setForm] = useState({
    status: lead.status,
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-bold text-slate-900 flex items-center gap-2">
                {lead.name}
                {lead.ai_priority && (
                  <span className="text-sm">
                    {lead.ai_priority === 'hot' ? '🔥' : lead.ai_priority === 'warm' ? '☀️' : '❄️'}
                  </span>
                )}
              </h2>
              <p className="text-sm text-slate-500">{source?.icon} {source?.label} • {new Date(lead.created_at).toLocaleDateString('pt-BR')}</p>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600">
              <Icon name="x" className="w-5 h-5" />
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

              {/* Status */}
              <div>
                <label className="label">Status</label>
                <select
                  className="input"
                  value={form.status}
                  onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))}
                >
                  {stages.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
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

              {/* Eva IA Sugestão */}
              {lead.ai_suggested_action && (
                <div className="p-3 bg-violet-50 rounded-xl">
                  <p className="text-xs font-medium text-violet-600 mb-1">💡 Sugestão Eva IA</p>
                  <p className="text-sm text-violet-900">{lead.ai_suggested_action}</p>
                </div>
              )}
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
