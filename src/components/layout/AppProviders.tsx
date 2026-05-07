'use client'

import ToastProvider from '@/components/ui/Toast'
import CommandPaletteProvider from '@/components/ui/CommandPalette'
import type { ModuleId } from '@/lib/modules'

type Props = {
  userRole: string
  activeModules: ModuleId[]
  clinicId: string
  children: React.ReactNode
}

/**
 * Wrapper unico de providers globais do app autenticado.
 * Encapsula:
 *  - ToastProvider (toasts + undo via useToast())
 *  - CommandPaletteProvider (busca rapida Ctrl/Cmd+K e "/")
 *
 * Vive dentro do dashboard layout (que ja eh client-side seguro
 * porque so renderiza pra usuarios autenticados).
 */
export default function AppProviders({
  userRole,
  activeModules,
  clinicId,
  children,
}: Props) {
  return (
    <ToastProvider>
      <CommandPaletteProvider
        userRole={userRole}
        activeModules={activeModules}
        clinicId={clinicId}
      >
        {children}
      </CommandPaletteProvider>
    </ToastProvider>
  )
}
