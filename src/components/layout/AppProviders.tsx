'use client'

import ToastProvider from '@/components/ui/Toast'
import CommandPaletteProvider from '@/components/ui/CommandPalette'
import { WaLineProvider } from '@/contexts/WaLineContext'
import { NotificationsProvider } from '@/contexts/NotificationsContext'
import { WhatsappUnreadProvider } from '@/contexts/WhatsappUnreadContext'
import type { ModuleId } from '@/lib/modules'

type Props = {
  userRole: string
  activeModules: ModuleId[]
  clinicId: string
  userId: string
  comissaoAtiva?: boolean
  children: React.ReactNode
}

export default function AppProviders({
  userRole,
  activeModules,
  clinicId,
  userId,
  comissaoAtiva = false,
  children,
}: Props) {
  return (
    <ToastProvider>
      <WaLineProvider clinicId={clinicId}>
        <NotificationsProvider userId={userId}>
          <WhatsappUnreadProvider clinicId={clinicId}>
            <CommandPaletteProvider
              userRole={userRole}
              activeModules={activeModules}
              clinicId={clinicId}
              comissaoAtiva={comissaoAtiva}
            >
              {children}
            </CommandPaletteProvider>
          </WhatsappUnreadProvider>
        </NotificationsProvider>
      </WaLineProvider>
    </ToastProvider>
  )
}
