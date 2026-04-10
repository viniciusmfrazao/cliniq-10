'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BOTTOM_NAV } from '@/lib/nav'
import Icon from '@/components/ui/Icon'

export default function BottomNav({ userRole }: { userRole: string }) {
  const pathname = usePathname()
  const items = BOTTOM_NAV.filter(i => i.roles.includes(userRole))
  const isActive = (href: string) => href === '/dashboard' ? pathname === href : pathname.startsWith(href)

  return (
    <nav 
      className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-100 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around px-2 py-1">
        {items.map(item => {
          const active = isActive(item.href)
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-all"
            >
              <div className={`p-2 rounded-xl transition-all ${
                active 
                  ? 'gradient-bg shadow-lg shadow-purple-200' 
                  : 'bg-transparent'
              }`}>
                <Icon 
                  name={item.icon} 
                  className={`w-5 h-5 ${active ? 'text-white' : 'text-slate-400'}`} 
                />
              </div>
              <span className={`text-[10px] font-semibold ${
                active ? 'gradient-text' : 'text-slate-400'
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
