import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AutomacoesClient from './automacoes-client'

export const dynamic = 'force-dynamic'

export default async function AutomacoesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userRow } = await supabase
    .from('users')
    .select('clinic_id, role')
    .eq('id', user.id)
    .single()

  if (!userRow?.clinic_id) redirect('/dashboard')
  if (!['admin', 'manager'].includes(userRow.role)) {
    redirect('/dashboard/config')
  }

  const clinicId = userRow.clinic_id

  const [{ data: automation }, { data: whatsapp }, { data: clinic }] = await Promise.all([
    supabase.from('clinic_automations').select('*').eq('clinic_id', clinicId).maybeSingle(),
    supabase
      .from('clinic_whatsapp')
      .select('status, phone_number')
      .eq('clinic_id', clinicId)
      .maybeSingle(),
    supabase.from('clinics').select('id, name').eq('id', clinicId).maybeSingle(),
  ])

  return (
    <AutomacoesClient
      clinicId={clinicId}
      clinicName={clinic?.name || 'Clínica'}
      auto={automation}
      whatsappConnected={whatsapp?.status === 'connected'}
    />
  )
}
