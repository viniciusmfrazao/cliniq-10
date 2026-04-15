import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import ClinicSettings from './clinic-settings'
import PermissionsSettings from './permissions-settings'
import ThemeSelector from './theme-selector'

export default async function ConfigPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: currentUser, error: userError } = await supabase
    .from('users')
    .select('role, clinic_id')
    .eq('id', user.id)
    .single()

  // Debug: se não encontrou usuário
  if (userError || !currentUser) {
    console.error('Erro ao buscar usuário:', userError)
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card p-6 bg-red-50 border border-red-200">
          <h2 className="font-semibold text-red-800">Erro ao carregar configurações</h2>
          <p className="text-sm text-red-600 mt-2">
            Não foi possível encontrar seus dados. Verifique se você está cadastrado na tabela users.
          </p>
          <pre className="text-xs bg-red-100 p-2 rounded mt-2 overflow-auto">
            {JSON.stringify(userError, null, 2)}
          </pre>
        </div>
      </div>
    )
  }

  // Apenas admin pode acessar configurações completas
  const isAdmin = currentUser?.role === 'admin'

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
        <p className="text-sm text-slate-500 mt-0.5">
          {isAdmin ? 'Gerencie sua clinica e personalize o sistema' : 'Personalize suas preferencias'}
        </p>
      </div>

      <div className="space-y-6">
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">🎨 Tema do sistema</h2>
          <ThemeSelector />
        </div>

        {isAdmin && (
          <>
            <div className="card p-6">
              <h2 className="text-sm font-semibold text-slate-900 mb-4">🏥 Dados da clinica</h2>
              <ClinicSettings clinic={clinic} />
            </div>

            <div className="card p-6">
              <h2 className="text-sm font-semibold text-slate-900 mb-4">🔐 Permissoes por funcao</h2>
              <PermissionsSettings clinicId={currentUser.clinic_id} permissions={permissions || []} />
            </div>
          </>
        )}

        {!isAdmin && (
          <div className="card p-6 bg-amber-50 border border-amber-200">
            <p className="text-sm text-amber-800">
              Apenas administradores podem acessar as configurações da clínica.
              <br />
              Seu papel atual: <strong>{currentUser.role}</strong>
            </p>
          </div>
        )}

        {/* Links de ferramentas - apenas admin */}
        {isAdmin && (
          <div className="card p-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">🛠️ Ferramentas</h2>
            <div className="grid gap-3">
              <Link 
                href="/dashboard/config/logs"
                className="flex items-center gap-4 p-4 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Icon name="activity" className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">Logs do Sistema</p>
                  <p className="text-xs text-slate-500">Ver histórico de ações e erros</p>
                </div>
                <Icon name="chevronRight" className="w-5 h-5 text-slate-400" />
              </Link>

              <Link 
                href="/dashboard/estoque"
                className="flex items-center gap-4 p-4 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Icon name="box" className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">Gestão de Estoque</p>
                  <p className="text-xs text-slate-500">Produtos, lotes e movimentações</p>
                </div>
                <Icon name="chevronRight" className="w-5 h-5 text-slate-400" />
              </Link>

              <Link 
                href="/dashboard/documentos/templates"
                className="flex items-center gap-4 p-4 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                  <Icon name="file" className="w-5 h-5 text-violet-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">Templates de Documentos</p>
                  <p className="text-xs text-slate-500">Termos e contratos para assinatura</p>
                </div>
                <Icon name="chevronRight" className="w-5 h-5 text-slate-400" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
