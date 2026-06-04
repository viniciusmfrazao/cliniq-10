import { getAdminMetrics, getAllClinics } from '@/lib/super-admin'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  const [metrics, clinics] = await Promise.all([
    getAdminMetrics(),
    getAllClinics(),
  ])

  const recentClinics = clinics?.slice(0, 8) || []

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-slate-500">Visão geral do sistema Clinike</p>
      </div>

      {/* Alertas */}
      {metrics.trial_expiring_soon.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-800 mb-2">
            ⚠️ {metrics.trial_expiring_soon.length} clínica{metrics.trial_expiring_soon.length > 1 ? 's' : ''} com trial expirando em 7 dias
          </p>
          <div className="space-y-1">
            {metrics.trial_expiring_soon.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between text-xs text-amber-700">
                <Link href={`/admin/clinics/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                <span>Expira {new Date(c.trial_ends_at).toLocaleDateString('pt-BR')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Métricas principais */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Geral</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <Metric icon="🏥" label="Clínicas ativas" value={metrics.total_clinics} color="blue" />
          <Metric icon="⏳" label="Em trial" value={metrics.clinics_on_trial} color="amber" />
          <Metric icon="✨" label="Novas este mês" value={metrics.new_clinics_month} color="violet" />
          <Metric icon="👥" label="Usuários ativos" value={metrics.total_users} color="emerald" />
          <Metric icon="🧑‍⚕️" label="Pacientes" value={metrics.total_patients} color="purple" />
          <Metric icon="💬" label="WhatsApp conectado" value={metrics.whatsapp_connected} color="green" />
          <Metric icon="🤖" label="Eva ativa" value={metrics.eva_active} color="pink" />
          <Metric icon="📈" label="Leads este mês" value={metrics.leads_this_month} color="rose" />
        </div>
      </div>

      {/* Atividade */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Atividade</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Metric icon="📅" label="Agendamentos hoje" value={metrics.appointments_today} color="cyan" />
          <Metric icon="📅" label="Agendamentos no mês" value={metrics.appointments_month} color="blue" />
          <Metric icon="🤖" label="Conversas Eva (mês)" value={metrics.eva_conversations_month} color="violet" />
        </div>
      </div>

      {/* Clínicas recentes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Clínicas</p>
          <Link href="/admin/clinics" className="text-xs text-violet-600 hover:underline">Ver todas →</Link>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden">
          {recentClinics.length === 0 ? (
            <p className="text-slate-500 text-center py-8 text-sm">Nenhuma clínica</p>
          ) : (
            recentClinics.map((clinic: any) => {
              const isTrial = clinic.trial_ends_at && new Date(clinic.trial_ends_at) > new Date()
              const usersCount = clinic.users?.[0]?.count ?? '–'
              const patientsCount = clinic.patients?.[0]?.count ?? '–'
              const apptCount = clinic.appointments?.[0]?.count ?? '–'
              return (
                <Link
                  key={clinic.id}
                  href={`/admin/clinics/${clinic.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition"
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {clinic.name?.charAt(0)?.toUpperCase()}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{clinic.name}</p>
                    <p className="text-xs text-slate-500">
                      {usersCount} usuários · {patientsCount} pacientes · {apptCount} agendamentos
                    </p>
                  </div>
                  {/* Badge */}
                  <div className="flex-shrink-0">
                    {isTrial ? (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                        Trial
                      </span>
                    ) : (
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                        Ativo
                      </span>
                    )}
                  </div>
                </Link>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

function Metric({ icon, label, value, color }: {
  icon: string
  label: string
  value: number
  color: string
}) {
  const colors: Record<string, string> = {
    blue:   'bg-blue-50 dark:bg-blue-900/20',
    amber:  'bg-amber-50 dark:bg-amber-900/20',
    violet: 'bg-violet-50 dark:bg-violet-900/20',
    emerald:'bg-emerald-50 dark:bg-emerald-900/20',
    purple: 'bg-purple-50 dark:bg-purple-900/20',
    green:  'bg-green-50 dark:bg-green-900/20',
    pink:   'bg-pink-50 dark:bg-pink-900/20',
    rose:   'bg-rose-50 dark:bg-rose-900/20',
    cyan:   'bg-cyan-50 dark:bg-cyan-900/20',
  }
  return (
    <div className={`rounded-xl p-4 ${colors[color] || colors.blue}`}>
      <div className="text-2xl mb-1">{icon}</div>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value.toLocaleString('pt-BR')}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
    </div>
  )
}
