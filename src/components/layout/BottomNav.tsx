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
      className="md:hidden fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: 'linear-gradient(135deg, #7C3AED, #A78BFA)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-center justify-around px-1 py-0.5">
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
                active ? 'bg-white/20' : ''
              }`}>
                <Icon
                  name={item.icon}
                  className={`w-5 h-5 transition-colors ${active ? 'text-white' : 'text-white/80'}`}
                />
                {active && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white" />
                )}
              </div>
              <span className={`text-[10px] font-semibold mt-0.5 transition-colors ${
                active ? 'text-white' : 'text-white/80'
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

