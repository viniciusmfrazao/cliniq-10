import { getAdminMetrics, getAllClinics } from '@/lib/super-admin'
import Link from 'next/link'

export default async function AdminDashboard() {
  const metrics = await getAdminMetrics()
  const clinics = await getAllClinics()

  const recentClinics = clinics?.slice(0, 5) || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400">Visão geral do sistema</p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Clínicas Ativas"
          value={metrics?.total_clinics || 0}
          icon="🏥"
          color="blue"
        />
        <MetricCard
          title="Em Trial"
          value={metrics?.clinics_on_trial || 0}
          icon="⏳"
          color="amber"
        />
        <MetricCard
          title="Usuários"
          value={metrics?.total_users || 0}
          icon="👥"
          color="emerald"
        />
        <MetricCard
          title="Pacientes"
          value={metrics?.total_patients || 0}
          icon="🧑‍⚕️"
          color="purple"
        />
      </div>

      {/* Activity Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MetricCard
          title="Agendamentos Hoje"
          value={metrics?.appointments_today || 0}
          icon="📅"
          color="rose"
        />
        <MetricCard
          title="Leads este Mês"
          value={metrics?.leads_this_month || 0}
          icon="📈"
          color="cyan"
        />
      </div>

      {/* Recent Clinics */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Clínicas Recentes
          </h2>
          <Link 
            href="/admin/clinics"
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Ver todas →
          </Link>
        </div>
        
        <div className="space-y-3">
          {recentClinics.length === 0 ? (
            <p className="text-slate-500 text-center py-8">Nenhuma clínica cadastrada</p>
          ) : (
            recentClinics.map((clinic: { id: string; name: string; plan: string; trial_ends_at: string; created_at: string }) => (
              <Link
                key={clinic.id}
                href={`/admin/clinics/${clinic.id}`}
                className="flex items-center justify-between p-4 rounded-lg border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition"
              >
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">{clinic.name}</p>
                  <p className="text-sm text-slate-500">
                    Plano: {clinic.plan} • Criada em {new Date(clinic.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="text-right">
                  {new Date(clinic.trial_ends_at) > new Date() ? (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                      Trial até {new Date(clinic.trial_ends_at).toLocaleDateString('pt-BR')}
                    </span>
                  ) : (
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                      Ativo
                    </span>
                  )}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function MetricCard({ 
  title, 
  value, 
  icon, 
  color 
}: { 
  title: string
  value: number
  icon: string
  color: 'blue' | 'amber' | 'emerald' | 'purple' | 'rose' | 'cyan'
}) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800',
    amber: 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800',
    purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800',
    rose: 'bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800',
    cyan: 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-100 dark:border-cyan-800',
  }

  return (
    <div className={`rounded-xl border p-6 ${colorClasses[color]}`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-sm text-slate-600 dark:text-slate-400">{title}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {value.toLocaleString('pt-BR')}
          </p>
        </div>
      </div>
    </div>
  )
}
