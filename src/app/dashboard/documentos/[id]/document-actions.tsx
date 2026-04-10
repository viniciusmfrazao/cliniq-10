'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'

export default function DocumentActions({ docId, status }: { docId: string; status: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const cancelDocument = async () => {
    if (!confirm('Tem certeza que deseja cancelar este documento?')) return
    setLoading(true)

    await supabase
      .from('documents_sent')
      .update({ status: 'cancelled' })
      .eq('id', docId)

    router.refresh()
    setLoading(false)
  }

  const resendDocument = async () => {
    const newToken = Array.from({ length: 32 }, () => Math.random().toString(36).charAt(2)).join('')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    setLoading(true)

    await supabase
      .from('documents_sent')
      .update({
        status: 'pending',
        sign_token: newToken,
        expires_at: expiresAt.toISOString(),
        viewed_at: null,
      })
      .eq('id', docId)

    router.refresh()
    setLoading(false)

    const signUrl = `${window.location.origin}/assinar/${newToken}`
    alert(`Novo link gerado:\n${signUrl}`)
  }

  if (status === 'signed') {
    return (
      <div className="flex justify-center">
        <button className="btn-secondary w-auto px-6 flex items-center gap-2">
          <Icon name="download" className="w-4 h-4" />
          Baixar PDF
        </button>
      </div>
    )
  }

  return (
    <div className="flex gap-3 justify-center">
      {status === 'pending' && (
        <button
          onClick={cancelDocument}
          disabled={loading}
          className="btn-secondary w-auto px-6 flex items-center gap-2"
        >
          <Icon name="x" className="w-4 h-4" />
          Cancelar documento
        </button>
      )}
      {(status === 'expired' || status === 'cancelled') && (
        <button
          onClick={resendDocument}
          disabled={loading}
          className="btn-primary w-auto px-6 flex items-center gap-2"
        >
          <Icon name="refresh" className="w-4 h-4" />
          Reenviar documento
        </button>
      )}
    </div>
  )
}
