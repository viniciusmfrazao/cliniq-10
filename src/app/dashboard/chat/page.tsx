import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ChatRoom from './chat-room'

export default async function ChatPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('id, name, clinic_id, role')
    .eq('id', user.id)
    .single()

  // Buscar todos os usuários da clínica para a lista de contatos
  const { data: users } = await supabase
    .from('users')
    .select('id, name, role')
    .eq('clinic_id', userData?.clinic_id)
    .neq('id', user.id)
    .order('name')

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-140px)]">
      <ChatRoom 
        currentUser={{
          id: userData?.id || '',
          name: userData?.name || '',
          role: userData?.role || ''
        }}
        clinicId={userData?.clinic_id || ''}
        users={users || []}
      />
    </div>
  )
}
