'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_ITEMS } from '@/lib/nav'

type Props = { clinicName: string; userName: string; trialDaysLeft: number }

export default function TopBar({ clinicName, userName, trialDaysLeft }: Props) {
  const pathname = usePathname()
  const current = NAV_ITEMS.find(i => i.href === '/dashboard' ? pathname === i.href : pathname.startsWith(i.href))

  return (
    <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100 flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 bg-brand-600 rounded-lg flex items-center justify-center">
          <span className="text-white text-xs font-bold">C</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">{current?.label || clinicName}</p>
          {trialDaysLeft > 0 && trialDaysLeft <= 14 && (
            <Link href="/planos" className="text-xs text-amber-600">Trial: {trialDaysLeft} dias</Link>
          )}
        </div>
      </div>
      <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center">
        <span className="text-brand-700 text-sm font-semibold">{userName.charAt(0).toUpperCase()}</span>
      </div>
    </header>
  )
}
