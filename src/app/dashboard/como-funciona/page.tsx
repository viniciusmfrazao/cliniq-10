import { createClient } from '@/lib/supabase/server'
import { defaultGuideForRole } from '@/lib/guides'
import GuideView from './guide-view'

export const metadata = {
  title: 'Como funciona — Clinike',
  description: 'Guia visual do dia-a-dia da clínica, separado por papel.',
}

export default async function ComoFuncionaPage({
  searchParams,
}: {
  searchParams: { papel?: string }
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: userData } = await supabase
    .from('users')
    .select('role, name')
    .eq('id', user!.id)
    .single()

  const initial =
    searchParams.papel ||
    defaultGuideForRole(userData?.role || null).id

  return <GuideView initialRoleId={initial} userName={userData?.name?.split(' ')[0] || ''} />
}
