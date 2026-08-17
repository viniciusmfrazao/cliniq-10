import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NovaVendaClient from './nova-venda-client'

export const dynamic = 'force-dynamic'

export default async function NovaEntradaPage() {
  const supabase = await createClient()
  const user = await getCachedUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users').select('clinic_id').eq('id', user.id).single()

  if (!userData?.clinic_id) redirect('/dashboard/financeiro/entradas')

  return <NovaVendaClient clinicId={userData.clinic_id} userId={user.id} />
}
