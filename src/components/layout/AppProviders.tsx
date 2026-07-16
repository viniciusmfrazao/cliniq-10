'use client'

import ToastProvider from '@/components/ui/Toast'
import CommandPaletteProvider from '@/components/ui/CommandPalette'
import { WaLineProvider } from '@/contexts/WaLineContext'
import { NotificationsProvider } from '@/contexts/NotificationsContext'
import type { ModuleId } from '@/lib/modules'

type Props = {
  userRole: string
  activeModules: ModuleId[]
  clinicId: string
  userId: string
  children: React.ReactNode
}

export default function AppProviders({
  userRole,
  activeModules,
  clinicId,
  userId,
  children,
}: Props) {
  return (
    <ToastProvider>
      <WaLineProvider clinicId={clinicId}>
        <NotificationsProvider userId={userId}>
          <CommandPaletteProvider
            userRole={userRole}
            activeModules={activeModules}
            clinicId={clinicId}
          >
            {children}
          </CommandPaletteProvider>
        </NotificationsProvider>
      </WaLineProvider>
    </ToastProvider>
  )
}
