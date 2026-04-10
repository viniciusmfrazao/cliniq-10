import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CRMView from './crm-view'

export default async function CRMPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('clinic_id, role')
    .eq('id', user.id)
    .single()

  // Buscar leads
  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .eq('clinic_id', userData?.clinic_id)
    .order('created_at', { ascending: false })

  // Buscar procedimentos para o select
  const { data: procedures } = await supabase
    .from('procedures')
    .select('id, name')
    .eq('clinic_id', userData?.clinic_id)
    .order('name')

  // Buscar usuários para atribuir
  const { data: users } = await supabase
    .from('users')
    .select('id, name')
    .eq('clinic_id', userData?.clinic_id)
    .order('name')

  return (
    <CRMView 
      leads={leads || []}
      procedures={procedures || []}
      users={users || []}
      clinicId={userData?.clinic_id || ''}
    />
  )
}
