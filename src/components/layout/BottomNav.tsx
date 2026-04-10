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
      className="md:hidden fixed bottom-0 left-0 right-0 glass z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around px-2 py-2">
        {items.map(item => {
          const active = isActive(item.href)
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all"
            >
              <div className={`p-2.5 rounded-2xl transition-all duration-300 ${
                active 
                  ? 'gradient-bg shadow-lg scale-110' 
                  : 'bg-transparent hover:bg-slate-100'
              }`}
              style={active ? { boxShadow: '0 4px 15px color-mix(in srgb, var(--primary) 40%, transparent)' } : {}}
              >
                <Icon 
                  name={item.icon} 
                  className={`w-5 h-5 ${active ? 'text-white' : 'text-slate-400'}`} 
                />
              </div>
              <span className={`text-[10px] font-bold transition-colors ${
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
