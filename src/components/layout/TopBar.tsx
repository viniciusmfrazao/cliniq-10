'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { NAV_ITEMS } from '@/lib/nav'
import Icon from '@/components/ui/Icon'
import NotificationBell from '@/components/ui/NotificationBell'
import { createClient } from '@/lib/supabase/client'
import { useCommandPalette } from '@/components/ui/CommandPalette'
import { useWhatsappUnread } from '@/contexts/WhatsappUnreadContext'

type Props = { 
  clinicName: string
  userName: string
  userRole?: string
  trialDaysLeft: number
  userId?: string 
}

import { useTheme } from '@/contexts/ThemeContext'

export default function TopBar({ clinicName, userName, userRole = 'viewer', trialDaysLeft, userId }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const { mode, setMode } = useTheme()
  const current = NAV_ITEMS.find(i => i.href === '/dashboard' ? pathname === i.href : pathname.startsWith(i.href))
  const supabase = createClient()
  const nav = NAV_ITEMS.filter(i => i.roles.includes(userRole))
  const { unreadCount: waUnreadCount } = useWhatsappUnread()
  const cmd = useCommandPalette()

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      <header
        className="md:hidden flex items-center justify-between px-4 flex-shrink-0 sticky top-0 z-40"
        style={{
          background: 'linear-gradient(135deg, var(--gradient-from, #7C3AED), var(--gradient-to, #A78BFA))',
          paddingTop: 'calc(env(safe-area-inset-top) + 0.25rem)',
          paddingBottom: '0.35rem',
        }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMenuOpen(true)}
            className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center active:scale-95 transition-transform"
          >
            <Icon name="menu" className="w-5 h-5 text-white" />
          </button>
          <div>
            <p className="text-base font-bold text-white">{current?.label || 'Dashboard'}</p>
            <p className="text-xs text-white/70">{clinicName}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={cmd.open}
            className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center active:scale-95 transition-transform"
            title="Busca rapida"
            aria-label="Busca rapida"
          >
            <Icon name="search" className="w-5 h-5 text-white" />
          </button>
          <Link
            href="/dashboard/como-funciona"
            className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center active:scale-95 transition-transform"
            title="Como funciona"
            aria-label="Como funciona"
          >
            <Icon name="info" className="w-5 h-5 text-white" />
          </Link>
          {userId && <NotificationBell userId={userId} />}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(p => !p)}
              className="w-10 h-10 bg-white/25 border border-white/40 rounded-xl flex items-center justify-center active:scale-95 transition-transform"
            >
              <span className="text-white text-sm font-bold">{userName.charAt(0).toUpperCase()}</span>
            </button>
            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 top-12 z-50 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 w-44">
                  <Link
                    href="/dashboard/config"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    <Icon name="settings" className="w-4 h-4" />
                    Configurações
                  </Link>
                  <button
                    onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 w-full text-left"
                  >
                    <span className="text-base">{mode === 'light' ? '🌙' : '☀️'}</span>
                    {mode === 'light' ? 'Modo escuro' : 'Modo claro'}
                  </button>
                  <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
                  <button
                    onClick={() => { setUserMenuOpen(false); logout() }}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                  >
                    <Icon name="logout" className="w-4 h-4" />
                    Sair da conta
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          
          <div className="absolute left-0 top-0 bottom-0 w-[85%] max-w-xs sidebar-gradient animate-slide-in-left overflow-hidden" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-20 left-0 w-32 h-32 bg-white/10 rounded-full -translate-x-1/2" />
            
            <div className="relative px-5 py-6 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-3">
                <img src="/logo.svg" alt="Clinike" className="w-12 h-12 rounded-xl" />
                <div>
                  <p className="text-white font-bold">{clinicName}</p>
                  <p className="text-white/60 text-xs">Clinike</p>
                </div>
              </div>
              <button 
                onClick={() => setMenuOpen(false)}
                className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center"
              >
                <Icon name="x" className="w-5 h-5 text-white" />
              </button>
            </div>

            {trialDaysLeft > 0 && trialDaysLeft <= 14 && (
              <div className="mx-4 mt-4 px-4 py-3 bg-white/10 backdrop-blur rounded-xl">
                <div className="flex items-center gap-2 text-white">
                  <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center">
                    <Icon name="zap" className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{trialDaysLeft} dias restantes</p>
                    <Link href="/planos" onClick={() => setMenuOpen(false)} className="text-xs text-white/70">
                      Fazer upgrade →
                    </Link>
                  </div>
                </div>
              </div>
            )}

            <nav className="relative px-4 py-4 space-y-1 overflow-y-auto max-h-[60vh]">
              {nav.map((item) => {
                const active = item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href)
                return (
                  <Link 
                    key={item.href} 
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all ${
                      active 
                        ? 'bg-white text-slate-900 shadow-lg' 
                        : 'text-white/80 active:bg-white/10'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      active 
                        ? 'bg-gradient-to-br from-violet-500 to-purple-600 shadow-md' 
                        : 'bg-white/10'
                    }`}>
                      <Icon 
                        name={item.icon} 
                        className={`w-5 h-5 ${active ? 'text-white' : 'text-white/80'}`} 
                      />
                    </div>
                    <span className="flex-1">{item.label}</span>
                    {item.label === 'Eva IA' && (
                      <span className={`text-[10px] font-bold px-2 py-1 rounded ${
                        active ? 'bg-purple-100 text-purple-700' : 'bg-white/20 text-white'
                      }`}>
                        IA
                      </span>
                    )}
                    {item.label === 'WhatsApp' && waUnreadCount > 0 && (
                      <span className="min-w-[20px] h-5 px-1 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {waUnreadCount > 9 ? '9+' : waUnreadCount}
                      </span>
                    )}
                  </Link>
                )
              })}
            </nav>

            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10 bg-black/10">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-gradient-to-br from-violet-400 to-purple-500 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold">{userName.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{userName}</p>
                  <p className="text-xs text-white/60 capitalize">{userRole}</p>
                </div>
                <button 
                  onClick={logout}
                  className="p-2.5 text-white/60 hover:text-white active:bg-white/10 rounded-xl transition-colors"
                >
                  <Icon name="logout" className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-in-left {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-left {
          animation: slide-in-left 0.25s ease-out;
        }
      `}</style>
    </>
  )
}





