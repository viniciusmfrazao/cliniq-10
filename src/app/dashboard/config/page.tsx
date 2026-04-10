import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ClinicSettings from './clinic-settings'
import PermissionsSettings from './permissions-settings'

export default async function ConfigPage() {
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

  // Buscar dados da clinica
  const { data: clinic } = await supabase
    .from('clinics')
    .select('*')
    .eq('id', currentUser.clinic_id)
    .single()

  // Buscar permissoes (se existir tabela roles_permissions)
  const { data: permissions } = await supabase
    .from('roles_permissions')
    .select('*')
    .eq('clinic_id', currentUser.clinic_id)

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Configuracoes</h1>
        <p className="text-sm text-slate-500 mt-0.5">Gerencie sua clinica e permissoes</p>
      </div>

      <div className="space-y-6">
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Dados da clinica</h2>
          <ClinicSettings clinic={clinic} />
        </div>

        <div className="card p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Permissoes por funcao</h2>
          <PermissionsSettings clinicId={currentUser.clinic_id} permissions={permissions || []} />
        </div>
      </div>
    </div>
  )
}
