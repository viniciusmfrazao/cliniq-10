'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { NAV_ITEMS } from '@/lib/nav'
import Icon from '@/components/ui/Icon'
import { createClient } from '@/lib/supabase/client'

type Props = { clinicName: string; userName: string; userRole: string; trialDaysLeft: number }

export default function Sidebar({ clinicName, userName, userRole, trialDaysLeft }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const nav = NAV_ITEMS.filter(i => i.roles.includes(userRole))
  const isActive = (href: string) => href === '/dashboard' ? pathname === href : pathname.startsWith(href)

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-100 h-screen flex-shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 gradient-bg rounded-xl flex items-center justify-center shadow-lg shadow-purple-200">
            <span className="text-white text-lg font-bold">C</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">{clinicName}</p>
            <p className="text-xs text-slate-400 font-medium">Cliniq Pro</p>
          </div>
        </div>
      </div>

      {/* Trial Banner */}
      {trialDaysLeft > 0 && trialDaysLeft <= 14 && (
        <div className="mx-3 mt-3 px-4 py-3 gradient-bg rounded-xl text-white">
          <div className="flex items-center gap-2">
            <Icon name="zap" className="w-4 h-4" />
            <span className="text-sm font-semibold">{trialDaysLeft} dias restantes</span>
          </div>
          <Link href="/planos" className="text-xs text-white/80 hover:text-white underline mt-1 inline-block">
            Fazer upgrade →
          </Link>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
        {nav.map(item => {
          const active = isActive(item.href)
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                active 
                  ? 'gradient-bg text-white shadow-lg shadow-purple-200' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon 
                name={item.icon} 
                className={`w-5 h-5 flex-shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} 
              />
              <span>{item.label}</span>
              {item.label === 'Eva IA' && (
                <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  active ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-600'
                }`}>
                  IA
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User Section */}
      <div className="px-3 py-4 border-t border-slate-100">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-10 h-10 gradient-bg rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-bold">{userName.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{userName}</p>
            <p className="text-xs text-slate-400 capitalize">{userRole}</p>
          </div>
          <button 
            onClick={logout} 
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" 
            title="Sair"
          >
            <Icon name="logout" className="w-5 h-5" />
          </button>
        </div>
      </div>
    </aside>
  )
}
