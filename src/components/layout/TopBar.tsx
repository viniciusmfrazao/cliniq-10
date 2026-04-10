'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_ITEMS } from '@/lib/nav'
import Icon from '@/components/ui/Icon'
import NotificationBell from '@/components/ui/NotificationBell'

type Props = { clinicName: string; userName: string; trialDaysLeft: number; userId?: string }

export default function TopBar({ clinicName, userName, trialDaysLeft, userId }: Props) {
  const pathname = usePathname()
  const current = NAV_ITEMS.find(i => i.href === '/dashboard' ? pathname === i.href : pathname.startsWith(i.href))

  return (
    <header className="md:hidden flex items-center justify-between px-4 py-4 glass flex-shrink-0 sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 gradient-bg rounded-2xl flex items-center justify-center shadow-lg animate-pulse-glow">
          <span className="text-white text-sm font-black">C</span>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">{current?.label || clinicName}</p>
          {trialDaysLeft > 0 && trialDaysLeft <= 14 && (
            <Link href="/planos" className="flex items-center gap-1">
              <span className="text-xs gradient-text font-semibold flex items-center gap-1">
                <Icon name="zap" className="w-3 h-3" />
                {trialDaysLeft} dias
              </span>
            </Link>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {userId && <NotificationBell userId={userId} />}
        <Link 
          href="/dashboard/config" 
          className="w-10 h-10 gradient-bg rounded-2xl flex items-center justify-center shadow-lg"
        >
          <span className="text-white text-sm font-bold">{userName.charAt(0).toUpperCase()}</span>
        </Link>
      </div>
    </header>
  )
}
