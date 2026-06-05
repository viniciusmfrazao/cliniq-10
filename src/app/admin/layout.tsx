'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/admin',               icon: '📊', label: 'Dashboard' },
  { href: '/admin/clinics',       icon: '🏥', label: 'Clínicas' },
  { href: '/admin/plans',         icon: '📦', label: 'Planos' },
  { href: '/admin/users',         icon: '👥', label: 'Usuários' },
  { href: '/admin/subscriptions', icon: '💳', label: 'Assinaturas' },
  { href: '/admin/logs',          icon: '📋', label: 'Logs' },
  { href: '/admin/eva-logs',      icon: '🤖', label: 'Eva Logs' },
  { href: '/admin/evolution',     icon: '🔌', label: 'Evolution' },
  { href: '/admin/config',        icon: '⚙️', label: 'Config' },
]

function SidebarContent({ pathname }: { pathname: string }) {
  return (
    <nav className="p-3 space-y-1">
      {NAV.map(item => {
        const active = pathname === item.href ||
          (item.href !== '/admin' && pathname.startsWith(item.href))
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
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
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex flex-col">

      {/* Top Bar */}
      <header className="sticky top-0 z-50 flex-shrink-0 bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMenuOpen(p => !p)}
            className="md:hidden p-2 rounded-lg hover:bg-slate-700 transition"
            aria-label="Menu"
          >
            <div className="w-5 space-y-1">
              <span className="block h-0.5 bg-white" />
              <span className="block h-0.5 bg-white" />
              <span className="block h-0.5 bg-white" />
            </div>
          </button>
          <Link href="/admin" className="text-base font-bold flex items-center gap-2">
            🛡️ Super Admin
          </Link>
        </div>
        <Link
          href="/dashboard"
          className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg transition whitespace-nowrap"
        >
          ← Sistema
        </Link>
      </header>

      <div className="flex flex-1 min-h-0">

        {/* Mobile overlay sidebar */}
        {menuOpen && (
          <div className="md:hidden fixed inset-0 z-40 flex">
            <div
              className="fixed inset-0 bg-black/50"
              onClick={() => setMenuOpen(false)}
            />
            <div className="relative z-50 w-64 bg-white dark:bg-slate-800 shadow-xl h-full overflow-y-auto">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                <span className="font-semibold text-slate-700 text-sm">Menu</span>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                >
                  ✕
                </button>
              </div>
              <SidebarContent pathname={pathname} />
            </div>
          </div>
        )}

        {/* Desktop sidebar — sempre visível, fora do fluxo do main */}
        <aside className="hidden md:flex md:flex-col md:w-64 md:flex-shrink-0 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 overflow-y-auto">
          <SidebarContent pathname={pathname} />
        </aside>

        {/* Conteúdo principal — ocupa 100% da largura em mobile */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
