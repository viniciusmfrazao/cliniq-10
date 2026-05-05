import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InviteForm from './invite-form'
import TeamList from './team-list'

export default async function EquipePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: currentUser } = await supabase
    .from('users')
    .select('role, clinic_id')
    .eq('id', user.id)
    .single()

  // Apenas admin/super_admin pode acessar
  if (currentUser?.role !== 'admin' && currentUser?.role !== 'super_admin') {
    redirect('/dashboard')
  }

  // Buscar membros da equipe (ativos e inativos)
  const { data: allMembers } = await supabase
    .from('users')
    .select('id, name, email, role, permissions, active, created_at')
    .eq('clinic_id', currentUser.clinic_id)
    .order('active', { ascending: false }) // Ativos primeiro
    .order('name')

  // Separar ativos e inativos
  const activeMembers = (allMembers || []).filter(m => m.active !== false)
  const inactiveMembers = (allMembers || []).filter(m => m.active === false)

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Equipe</h1>
        <p className="text-sm text-slate-500 mt-0.5">Gerencie os membros da sua clínica</p>
      </div>

      <div className="card p-6 mb-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Cadastrar membro</h2>
        <InviteForm clinicId={currentUser.clinic_id} />
      </div>

      <div className="card p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Membros ativos ({activeMembers.length})</h2>
        <TeamList members={activeMembers} currentUserId={user.id} clinicId={currentUser.clinic_id} />
      </div>

      {inactiveMembers.length > 0 && (
        <div className="card p-6 mt-6 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-500 mb-4">Membros desativados ({inactiveMembers.length})</h2>
          <TeamList members={inactiveMembers} currentUserId={user.id} clinicId={currentUser.clinic_id} showReactivate />
        </div>
      )}
    </div>
  )
}
