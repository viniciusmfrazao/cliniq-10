import { redirect } from 'next/navigation'
import { isSuperAdmin, getSuperAdminData } from '@/lib/super-admin'
import Link from 'next/link'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const isAdmin = await isSuperAdmin()
  
  if (!isAdmin) {
    redirect('/dashboard')
  }
  
  const adminData = await getSuperAdminData()

  return (
    <div className="h-screen flex flex-col bg-slate-100 dark:bg-slate-900 overflow-hidden">
      {/* Top Bar */}
      <header className="flex-shrink-0 bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-xl font-bold">
            🛡️ Super Admin
          </Link>
          <span className="text-slate-400">|</span>
          <span className="text-slate-300">Clinike Admin</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-300">{adminData?.name}</span>
          <Link 
            href="/dashboard" 
            className="text-sm bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg transition"
          >
            Voltar ao Sistema
          </Link>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 p-4 overflow-y-auto flex-shrink-0">
          <nav className="space-y-2">
            <Link 
              href="/admin"
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              <span>📊</span>
              <span>Dashboard</span>
            </Link>
            <Link 
              href="/admin/clinics"
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              <span>🏥</span>
              <span>Clínicas</span>
            </Link>
            <Link 
              href="/admin/plans"
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              <span>📦</span>
              <span>Planos</span>
            </Link>
            <Link 
              href="/admin/users"
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              <span>👥</span>
              <span>Usuários</span>
            </Link>
            <Link 
              href="/admin/subscriptions"
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              <span>💳</span>
              <span>Assinaturas</span>
            </Link>
            <Link 
              href="/admin/logs"
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              <span>📋</span>
              <span>Logs em Tempo Real</span>
            </Link>
            <Link 
              href="/admin/evolution"
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              <span>🔌</span>
              <span>Evolution</span>
            </Link>
            <Link
              href="/admin/config"
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors text-sm"
            >
              <span>⚙️</span>
              <span>Config Clinike</span>
            </Link>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
