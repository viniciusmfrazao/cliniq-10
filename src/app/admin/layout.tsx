'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/admin',              icon: '📊', label: 'Dashboard' },
  { href: '/admin/clinics',      icon: '🏥', label: 'Clínicas' },
  { href: '/admin/plans',        icon: '📦', label: 'Planos' },
  { href: '/admin/users',        icon: '👥', label: 'Usuários' },
  { href: '/admin/subscriptions',icon: '💳', label: 'Assinaturas' },
  { href: '/admin/logs',         icon: '📋', label: 'Logs' },
  { href: '/admin/eva-logs',     icon: '🤖', label: 'Eva Logs' },
  { href: '/admin/evolution',    icon: '🔌', label: 'Evolution' },
  { href: '/admin/config',       icon: '⚙️', label: 'Config' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()

  // Fechar menu ao navegar
  useEffect(() => { setMenuOpen(false) }, [pathname])

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-900">

      {/* Top Bar */}
      <header className="sticky top-0 z-40 flex-shrink-0 bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Hambúrguer mobile */}
          <button
            onClick={() => setMenuOpen(p => !p)}
            className="md:hidden p-1.5 rounded-lg hover:bg-slate-700 transition"
          >
            <span className="block w-5 h-0.5 bg-white mb-1" />
            <span className="block w-5 h-0.5 bg-white mb-1" />
            <span className="block w-5 h-0.5 bg-white" />
          </button>
          <Link href="/admin" className="text-lg font-bold flex items-center gap-2">
            🛡️ <span>Super Admin</span>
          </Link>
        </div>
        <Link
          href="/dashboard"
          className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg transition whitespace-nowrap"
        >
          ← Sistema
        </Link>
      </header>

      <div className="flex flex-1 min-h-0 relative">

        {/* Sidebar — desktop: sempre visível | mobile: overlay */}
        <>
          {/* Overlay mobile */}
          {menuOpen && (
            <div
              className="fixed inset-0 z-30 bg-black/50 md:hidden"
              onClick={() => setMenuOpen(false)}
            />
          )}

          <aside className={`
            fixed md:sticky top-0 md:top-0 z-40 md:z-auto
            h-full md:h-auto
            w-64 bg-white dark:bg-slate-800
            border-r border-slate-200 dark:border-slate-700
            flex-shrink-0 overflow-y-auto
            transition-transform duration-200
            ${menuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}
            style={{ height: '100vh', position: 'sticky', top: 0 }}
          >
            <nav className="p-3 space-y-1">
              {NAV.map(item => {
                const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                      active
                        ? 'bg-violet-50 text-violet-700 font-semibold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>
          </aside>
        </>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 min-w-0">
          {children}
        </main>
      </div>
    </div>
  )
}
