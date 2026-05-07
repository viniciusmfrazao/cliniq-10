import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CRMView from './crm-view'

// CRM eh tempo real (leads via webhook/realtime). Nunca cacheia.
export const dynamic = 'force-dynamic'
export const revalidate = 0

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
    .single()

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
  const evaPaused = waInstance?.auto_reply_enabled === false

  return (
    <CRMView
      leads={leads || []}
      procedures={procedures || []}
      users={users || []}
      clinicId={userData?.clinic_id || ''}
      settings={settings}
      templates={templates || []}
      evaPaused={evaPaused}
    />
  )
}
