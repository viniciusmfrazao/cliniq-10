import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function ConfigLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const ADMIN_ROLES = ['admin', 'super_admin']
  if (!userData?.role || !ADMIN_ROLES.includes(userData.role)) {
    redirect('/dashboard')
  }

  return <>{children}</>
}
