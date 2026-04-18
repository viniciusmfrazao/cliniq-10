import { getClinicDetails } from '@/lib/super-admin'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ClinicModulesEditor from './modules-editor'

export default async function ClinicDetailsPage({ params }: { params: { id: string } }) {
  const data = await getClinicDetails(params.id)
  
  if (!data?.clinic) {
    notFound()
  }

  const { clinic, users, stats } = data
  const activeModules = clinic.settings?.active_modules || [] = data

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/clinics"
          className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          ← Voltar
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{clinic.name}</h1>
          <p className="text-slate-500 dark:text-slate-400">
            {clinic.slug} • CNPJ: {clinic.cnpj || 'Não informado'}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition border border-slate-200 dark:border-slate-700">
            Editar
          </button>
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition">
            Acessar como Admin
          </button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">Plano</p>
          <p className="text-lg font-semibold text-slate-900 dark:text-white capitalize">{clinic.plan}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">Status</p>
          <p className="text-lg font-semibold">
            {new Date(clinic.trial_ends_at) > new Date() ? (
              <span className="text-amber-600 dark:text-amber-400">
                Trial até {new Date(clinic.trial_ends_at).toLocaleDateString('pt-BR')}
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400">Ativo</span>
            )}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">Criada em</p>
          <p className="text-lg font-semibold text-slate-900 dark:text-white">
            {new Date(clinic.created_at).toLocaleDateString('pt-BR')}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">Última atualização</p>
          <p className="text-lg font-semibold text-slate-900 dark:text-white">
            {new Date(clinic.updated_at).toLocaleDateString('pt-BR')}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 p-6">
          <p className="text-sm text-blue-600 dark:text-blue-400">Usuários</p>
          <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{stats.users}</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800 p-6">
          <p className="text-sm text-emerald-600 dark:text-emerald-400">Pacientes</p>
          <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">{stats.patients}</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-800 p-6">
          <p className="text-sm text-purple-600 dark:text-purple-400">Agendamentos</p>
          <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">{stats.appointments}</p>
        </div>
      </div>

      {/* Modules */}
      <ClinicModulesEditor clinicId={clinic.id} activeModules={activeModules} />

      {/* Users List */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Usuários da Clínica
        </h2>
        <div className="space-y-3">
          {users?.length === 0 ? (
            <p className="text-slate-500 text-center py-4">Nenhum usuário</p>
          ) : (
            users?.map((user: { id: string; name: string; email: string; role: string; active: boolean }) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 rounded-lg border border-slate-100 dark:border-slate-700"
              >
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">{user.name}</p>
                  <p className="text-sm text-slate-500">{user.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    user.role === 'admin' 
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                      : user.role === 'professional'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                  }`}>
                    {user.role}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    user.active
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {user.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-800 p-6">
        <h2 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-2">
          Zona de Perigo
        </h2>
        <p className="text-sm text-red-600 dark:text-red-400 mb-4">
          Ações irreversíveis. Tenha certeza antes de prosseguir.
        </p>
        <div className="flex gap-3">
          <button className="px-4 py-2 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition">
            Desativar Clínica
          </button>
          <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition">
            Excluir Clínica
          </button>
        </div>
      </div>
    </div>
  )
}
