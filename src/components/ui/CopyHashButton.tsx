'use client'

import Icon from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'

/**
 * Botão pra copiar o hash de integridade (SHA-256) de uma assinatura eletrônica.
 * Extraído pro client pelo mesmo motivo do CopyAnamneseLink: as páginas de
 * detalhe de anamnese/documento são Server Components.
 */
export default function CopyHashButton({ hash }: { hash: string }) {
  const toast = useToast()

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(hash)
        toast.success('Hash copiado')
      }}
      className="text-slate-400 hover:text-violet-600 transition flex-shrink-0"
      title="Copiar hash"
    >
      <Icon name="clipboard" className="w-3.5 h-3.5" />
    </button>
  )
}
