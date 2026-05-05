import { isSuperAdmin } from '@/lib/super-admin'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type UserRow = {
  id: string
  email: string | null
  name: string | null
  role: string | null
  active: boolean | null
  created_at: string
  last_login_at: string | null
  clinic_id: string | null
  clinic: { id: string; name: string; slug: string | null } | null
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; status?: string; clinic?: string }>
}) {
  const ok = await isSuperAdmin()
  if (!ok) redirect('/dashboard')

  const params = await searchParams
  const q = (params.q ?? '').trim()
  const role = (params.role ?? '').trim()
  const status = (params.status ?? '').trim() // active | inactive | ''
  const clinic = (params.clinic ?? '').trim()

  const svc = createServiceClient()
  let query = svc
    .from('users')
    .select(
      'id, email, name, role, active, created_at, last_login_at, clinic_id, clinic:clinics(id, name, slug)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .limit(200)

  if (q) {
    // Filtro: nome OU email contendo `q`
    query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%`)
  }
  if (role) query = query.eq('role', role)
  if (status === 'active') query = query.eq('active', true)
  if (status === 'inactive') query = query.eq('active', false)
  if (clinic) query = query.eq('clinic_id', clinic)

  const { data, count } = await query
  const users = (data as unknown as UserRow[] | null) ?? []

  // Lista de clinicas pra dropdown
  const { data: clinicsData } = await svc
    .from('clinics')
    .select('id, name')
    .is('deleted_at', null)
    .order('name')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Usuários</h1>
        <p className="text-slate-500 dark:text-slate-400">
          {count ?? users.length} usuários no sistema
        </p>
      </div>

      <form className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-slate-500">Buscar</label>
          <input
            name="q"
            defaultValue={q}
            placeholder="Nome ou email..."
            className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500">Papel</label>
          <select
            name="role"
            defaultValue={role}
            className="mt-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          >
            <option value="">Todos</option>
            <option value="admin">Admin</option>
            <option value="manager">Gerente</option>
            <option value="doctor">Médico</option>
            <option value="biomedic">Biomédico</option>
            <option value="nurse">Enfermeiro</option>
            <option value="esthetician">Esteticista</option>
            <option value="receptionist">Recepcionista</option>
            <option value="financial">Financeiro</option>
            <option value="assistant">Assistente</option>
            <option value="viewer">Visualizador</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500">Status</label>
          <select
            name="status"
            defaultValue={status}
            className="mt-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          >
            <option value="">Todos</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500">Clínica</label>
          <select
            name="clinic"
            defaultValue={clinic}
            className="mt-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          >
            <option value="">Todas</option>
            {(clinicsData as Array<{ id: string; name: string }> | null)?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
        >
          Filtrar
        </button>
      </form>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-700/50">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">
                Usuário
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">
                Clínica
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">
                Papel
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">
                Status
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">
                Último login
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">
                Criado em
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                  Nenhum usuário encontrado
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {u.name || '(sem nome)'}
                      </p>
                      <p className="text-sm text-slate-500">{u.email || '—'}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {u.clinic ? (
                      <Link
                        href={`/admin/clinics/${u.clinic.id}`}
                        className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      >
                        {u.clinic.name}
                      </Link>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                      {u.role || '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {u.active ? (
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        Ativo
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        Inativo
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-sm">
                    {u.last_login_at
                      ? new Date(u.last_login_at).toLocaleString('pt-BR', {
                          timeZone: 'America/Sao_Paulo',
                        })
                      : '—'}
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-sm">
                    {new Date(u.created_at).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {users.length === 200 && (
        <p className="text-xs text-slate-500 text-center">
          Mostrando apenas os 200 mais recentes. Use os filtros pra refinar.
        </p>
      )}
    </div>
  )
}
