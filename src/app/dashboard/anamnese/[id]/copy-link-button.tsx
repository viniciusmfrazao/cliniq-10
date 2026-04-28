'use client'

import Icon from '@/components/ui/Icon'

/**
 * Botão pra copiar link público da anamnese pendente.
 *
 * Foi extraído pro client porque a página /dashboard/anamnese/[id] é Server
 * Component e React não permite passar `onClick` direto em server. Antes,
 * quando o user abria uma anamnese ainda *pendente* (status !== 'completed'),
 * a página quebrava com "Event handlers cannot be passed to Client Component
 * props".
 */
export default function CopyAnamneseLink({ token }: { token: string }) {
  return (
    <button
      onClick={() => {
        const url = `${window.location.origin}/anamnese/${token}`
        navigator.clipboard.writeText(url)
        alert('Link copiado!')
      }}
      className="btn-secondary inline-flex items-center gap-2"
    >
      <Icon name="clipboard" className="w-4 h-4" />
      Copiar link novamente
    </button>
  )
}
