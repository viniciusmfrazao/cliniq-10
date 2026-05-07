'use client'

import ToastProvider from '@/components/ui/Toast'
import CommandPaletteProvider from '@/components/ui/CommandPalette'
import { WaLineProvider } from '@/contexts/WaLineContext'
import type { ModuleId } from '@/lib/modules'

type Props = {
  userRole: string
  activeModules: ModuleId[]
  clinicId: string
  children: React.ReactNode
}

export default function AppProviders({
  userRole,
  activeModules,
  clinicId,
  children,
}: Props) {
  return (
    <ToastProvider>
      <WaLineProvider clinicId={clinicId}>
        <CommandPaletteProvider
          userRole={userRole}
          activeModules={activeModules}
          clinicId={clinicId}
        >
          {children}
        </CommandPaletteProvider>
      </WaLineProvider>
    </ToastProvider>
  )
}
