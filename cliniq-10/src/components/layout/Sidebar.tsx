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
    <aside className="hidden md:flex flex-col w-60 bg-white border-r border-slate-100 h-screen flex-shrink-0">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
        <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-white text-sm font-bold">C</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{clinicName}</p>
          <p className="text-xs text-slate-400">Cliniq</p>
        </div>
      </div>

      {trialDaysLeft > 0 && trialDaysLeft <= 14 && (
        <div className="mx-3 mt-3 px-3 py-2 bg-amber-50 border border-amber-100 rounded-xl">
          <p className="text-xs text-amber-700 font-medium">{trialDaysLeft} dias restantes</p>
          <Link href="/planos" className="text-xs text-amber-600 underline">Ver planos</Link>
        </div>
      )}

      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-0.5">
        {nav.map(item => (
          <Link key={item.href} href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              isActive(item.href) ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}>
            <Icon name={item.icon} className={`w-4 h-4 flex-shrink-0 ${isActive(item.href) ? 'text-brand-600' : 'text-slate-400'}`} />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-slate-100">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-7 h-7 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-brand-700 text-xs font-semibold">{userName.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-900 truncate">{userName}</p>
            <p className="text-xs text-slate-400 capitalize">{userRole}</p>
          </div>
          <button onClick={logout} className="text-slate-400 hover:text-slate-600 transition-colors" title="Sair">
            <Icon name="logout" className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
