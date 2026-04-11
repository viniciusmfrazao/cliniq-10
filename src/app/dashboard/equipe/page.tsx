import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InviteForm from './invite-form'
import TeamList from './team-list'

export default async function EquipePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: currentUser } = await supabase
    .from('users')
    .select('role, clinic_id')
    .eq('id', user.id)
    .single()

  // Apenas admin pode acessar
  if (currentUser?.role !== 'admin') {
    redirect('/dashboard')
  }

  // Buscar membros da equipe
  const { data: teamMembers } = await supabase
    .from('users')
    .select('id, name, email, role, permissions, created_at')
    .eq('clinic_id', currentUser.clinic_id)
    .order('created_at', { ascending: true })

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Equipe</h1>
        <p className="text-sm text-slate-500 mt-0.5">Gerencie os membros da sua clinica</p>
      </div>

      <div className="card p-6 mb-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Cadastrar membro</h2>
        <InviteForm clinicId={currentUser.clinic_id} />
      </div>

      <div className="card p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Membros ({teamMembers?.length || 0})</h2>
        <TeamList members={teamMembers || []} currentUserId={user.id} />
      </div>
    </div>
  )
}
