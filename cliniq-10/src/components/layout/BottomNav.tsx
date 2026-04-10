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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center justify-around px-2 py-2">
        {items.map(item => {
          const active = isActive(item.href)
          return (
            <Link key={item.href} href={item.href}
              className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${active ? 'text-brand-600' : 'text-slate-400'}`}>
              <div className="relative">
                <Icon name={item.icon} className={`w-5 h-5 ${active ? 'text-brand-600' : 'text-slate-400'}`} />
                {active && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-brand-600 rounded-full" />}
              </div>
              <span className={`text-[10px] font-medium ${active ? 'text-brand-600' : 'text-slate-400'}`}>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
