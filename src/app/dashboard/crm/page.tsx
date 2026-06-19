import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CRMView from './crm-view'

// CRM eh tempo real (leads via webhook/realtime). Nunca cacheia.
export const dynamic = 'force-dynamic'
export const revalidate = 0

const STATUS_ALIASES: Record<string, string> = {
  novo: 'new',
  novo_lead: 'new',
  lead_novo: 'new',
  contacted: 'contacted',
  em_conversa: 'contacted',
  conversa: 'contacted',
  in_conversation: 'contacted',
  conversation: 'contacted',
  agendado: 'scheduled',
  agendada: 'scheduled',
  scheduled: 'scheduled',
  cliente: 'converted',
  client: 'converted',
  convertido: 'converted',
  converted: 'converted',
  perdido: 'lost',
  lost: 'lost',
}

function normalizeCRMStatus(status: string | null | undefined) {
  const normalized = (status || '').toLowerCase().trim()
  return STATUS_ALIASES[normalized] || normalized || 'new'
}

function normalizeCRMSettings(settings: any) {
  if (!settings?.custom_stages) return settings

  return {
    ...settings,
    custom_stages: settings.custom_stages.map((stage: any) => ({
      ...stage,
      id: normalizeCRMStatus(stage.id),
    })),
  }
}

export default async function CRMPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('clinic_id, role')
    .eq('id', user.id)
    .single()

  // Buscar leads com interações recentes
  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .eq('clinic_id', userData?.clinic_id)
    .order('created_at', { ascending: false })

  const normalizedLeads = (leads || []).map(lead => ({
    ...lead,
    status: normalizeCRMStatus(lead.status),
  }))

  // Follow-up MANUAL pendente (agendado pela secretaria, ainda não concluído).
  // Mapa lead_id -> data do próximo follow-up (o mais cedo). Alimenta o card/filtro
  // "Em follow-up" e o badge de prazo no card do funil.
  const { data: pendingFollowups } = await supabase
    .from('lead_followups')
    .select('lead_id, scheduled_at')
    .eq('clinic_id', userData?.clinic_id || '')
    .is('done_at', null)
    .order('scheduled_at', { ascending: true })
  const manualFollowups: Record<string, string> = {}
  for (const f of pendingFollowups || []) {
    if (!manualFollowups[f.lead_id]) manualFollowups[f.lead_id] = f.scheduled_at
  }

  // Buscar procedimentos para o select
  const { data: procedures } = await supabase
    .from('procedures')
    .select('id, name, price')
    .eq('clinic_id', userData?.clinic_id)
    .order('name')

  // Buscar usuários para atribuir
  const { data: users } = await supabase
    .from('users')
    .select('id, name')
    .eq('clinic_id', userData?.clinic_id)
    .order('name')

  // Buscar configurações do CRM
  const { data: settings } = await supabase
    .from('crm_settings')
    .select('*')
    .eq('clinic_id', userData?.clinic_id)
    .maybeSingle()

  const normalizedSettings = normalizeCRMSettings(settings)

  // Buscar templates de mensagens
  const { data: templates } = await supabase
    .from('crm_message_templates')
    .select('*')
    .eq('clinic_id', userData?.clinic_id)
    .eq('active', true)

  // Status da Eva (toggle auto/manual) — usado pra mostrar banner "Eva pausada"
  // no topo do CRM quando a clínica desligou as respostas automáticas.
  // Multi-numero: pega a instance default (ou a primeira inbound).
  const { data: waList } = await supabase
    .from('clinic_whatsapp')
    .select('auto_reply_enabled, is_default, role_inbound')
    .eq('clinic_id', userData?.clinic_id)
  const waInstance = waList?.length
    ? (waList.find(w => w.is_default && w.role_inbound !== false) ??
       waList.find(w => w.role_inbound !== false) ??
       waList[0])
    : null
  // Banner só aparece se clínica tem módulo eva_ia E Eva está em modo manual
  const clinicModules: string[] = (await supabase.from('clinics').select('settings').eq('id', userData?.clinic_id || '').single()).data?.settings?.active_modules || []
  const hasEvaModule = clinicModules.length === 0 || clinicModules.includes('eva_ia')
  const evaPaused = hasEvaModule && waInstance?.auto_reply_enabled === false
  // Eva "ativa" = tem módulo E existe instância WhatsApp com auto-resposta LIGADA.
  // Sem instância configurada (auto_reply_enabled null) a Eva não age → tratamos como inativa.
  // Quando inativa, não anunciamos followup automático da Eva nem o card de atendimento humano.
  const evaActive = hasEvaModule && waInstance?.auto_reply_enabled === true

  return (
    <CRMView
      leads={normalizedLeads}
      procedures={procedures || []}
      users={users || []}
      clinicId={userData?.clinic_id || ''}
      settings={normalizedSettings}
      templates={templates || []}
      evaPaused={evaPaused}
      evaActive={evaActive}
      manualFollowups={manualFollowups}
    />
  )
}
