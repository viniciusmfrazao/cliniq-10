'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BOTTOM_NAV } from '@/lib/nav'
import Icon from '@/components/ui/Icon'
import { isRouteEnabled, type ModuleId } from '@/lib/modules'

type Props = {
  userRole: string
  activeModules?: ModuleId[]
  userPermissions?: string[]
}

export default function BottomNav({ userRole, activeModules = [], userPermissions = [] }: Props) {
  const pathname = usePathname()
  const items = BOTTOM_NAV.filter(i => {
    if (!i.roles.includes(userRole)) return false
    if (activeModules.length === 0) return true
    return isRouteEnabled(i.href, activeModules)
  })
  const isActive = (href: string) => href === '/dashboard' ? pathname === href : pathname.startsWith(href)

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-700"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around px-1 py-1">
        {items.map(item => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center flex-1 min-h-[48px] py-1.5 active:scale-95 active:opacity-80 transition-all"
              style={{ touchAction: 'manipulation' }}
            >
              <div className={`relative flex items-center justify-center w-12 h-10 rounded-2xl transition-all duration-200 ${
                active ? 'bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/30' : ''
              }`}>
                <Icon
                  name={item.icon}
                  className={`w-5 h-5 transition-colors ${active ? 'text-white' : 'text-slate-400'}`}
                />
              </div>
              <span className={`text-[10px] font-semibold mt-0.5 transition-colors ${
                active ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400'
              }`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
