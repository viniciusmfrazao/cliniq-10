'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'

export default function AnamnesePresencialButton({ patientId }: { patientId: string }) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch('/api/anamnese/presencial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId }),
      })
      const data = await res.json()
      if (data.ok && data.link) {
        window.open(data.link, '_blank', 'noopener,noreferrer')
      } else {
        alert('Erro ao abrir ficha: ' + (data.error || 'tente novamente'))
      }
    } catch {
      alert('Erro ao abrir ficha. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="btn-secondary w-auto px-4 py-2 text-sm flex items-center gap-1.5"
    >
      <Icon name="tablet" className="w-4 h-4" />
      {loading ? 'Abrindo...' : 'Preencher aqui'}
    </button>
  )
}
