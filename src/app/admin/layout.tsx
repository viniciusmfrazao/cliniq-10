'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href: '/admin',               icon: '📊', label: 'Dashboard' },
  { href: '/admin/clinics',       icon: '🏥', label: 'Clínicas' },
  { href: '/admin/contratos',     icon: '📄', label: 'Contratos' },
  { href: '/admin/plans',         icon: '📦', label: 'Planos' },
  { href: '/admin/users',         icon: '👥', label: 'Usuários' },
  { href: '/admin/subscriptions', icon: '💳', label: 'Assinaturas' },
  { href: '/admin/logs',          icon: '📋', label: 'Logs' },
  { href: '/admin/eva-logs',      icon: '🤖', label: 'Eva Logs' },
  { href: '/admin/evolution',     icon: '🔌', label: 'Evolution' },
  { href: '/admin/config',        icon: '⚙️', label: 'Config' },
]

function SidebarContent({ pathname, onClose }: { pathname: string; onClose?: () => void }) {
  return (
    <nav className="p-3 space-y-1">
      {NAV.map(item => {
        const active = pathname === item.href ||
          (item.href !== '/admin' && pathname.startsWith(item.href))
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-colors ${
              active
                ? 'bg-violet-50 text-violet-700 font-semibold'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

// admin=0 bypassa o redirect automático para /admin no dashboard layout
const CLINIKE_DASHBOARD = '/dashboard?admin=0'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="h-screen bg-slate-100 dark:bg-slate-900 flex flex-col overflow-hidden">

      {/* Top Bar — padding-top respeita safe area do iPhone (notch/Dynamic Island) */}
      <header
        className="flex-shrink-0 text-white px-4 pb-3 flex items-center justify-between z-50"
        style={{
          background: 'linear-gradient(135deg, #7C3AED, #A78BFA)',
          paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMenuOpen(p => !p)}
            className="md:hidden w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center active:scale-95 transition-transform"
            aria-label="Menu"
          >
            <div className="w-5 space-y-1">
              <span className="block h-0.5 bg-white rounded" />
              <span className="block h-0.5 bg-white rounded" />
              <span className="block h-0.5 bg-white rounded" />
            </div>
          </button>
          <Link href="/admin" className="text-base font-bold flex items-center gap-2">
            🛡️ Super Admin
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={CLINIKE_DASHBOARD}
            className="text-xs bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition whitespace-nowrap"
          >
            ← Sistema
          </Link>
          <button
            onClick={handleLogout}
            className="text-xs bg-white/15 hover:bg-red-500/80 px-3 py-1.5 rounded-lg transition whitespace-nowrap"
            title="Sair"
          >
            Sair
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Mobile overlay sidebar */}
        {menuOpen && (
          <div className="md:hidden fixed inset-0 z-40 flex">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setMenuOpen(false)}
            />
            <div className="relative z-50 w-72 bg-white dark:bg-slate-800 shadow-2xl h-full overflow-y-auto">
              <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-800 dark:text-white">Menu Admin</span>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500"
                >
                  ✕
                </button>
              </div>
              <SidebarContent pathname={pathname} onClose={() => setMenuOpen(false)} />
            </div>
          </div>
        )}

        {/* Desktop sidebar */}
        <aside className="hidden md:flex md:flex-col md:w-64 md:flex-shrink-0 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 overflow-y-auto">
          <SidebarContent pathname={pathname} />
        </aside>

        {/* Conteúdo principal */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
