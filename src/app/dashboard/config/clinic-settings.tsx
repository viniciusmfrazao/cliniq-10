'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Clinic = {
  id: string
  name: string
  slug: string
  trial_ends_at: string
}

export default function ClinicSettings({ clinic }: { clinic: Clinic | null }) {
  const router = useRouter()
  const supabase = createClient()
  const [name, setName] = useState(clinic?.name || '')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setSuccess(false)

    await supabase
      .from('clinics')
      .update({ name })
      .eq('id', clinic?.id)

    setLoading(false)
    setSuccess(true)
    router.refresh()
    
    setTimeout(() => setSuccess(false), 3000)
  }

  const trialEndsAt = clinic?.trial_ends_at 
    ? new Date(clinic.trial_ends_at).toLocaleDateString('pt-BR')
    : '-'

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div>
        <label className="label">Nome da clinica</label>
        <input
          className="input"
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="label">Slug (URL)</label>
        <input
          className="input bg-slate-50"
          type="text"
          value={clinic?.slug || ''}
          disabled
        />
        <p className="text-xs text-slate-400 mt-1">O slug nao pode ser alterado</p>
      </div>

      <div>
        <label className="label">Trial expira em</label>
        <input
          className="input bg-slate-50"
          type="text"
          value={trialEndsAt}
          disabled
        />
      </div>

      {success && (
        <p className="text-sm text-green-600 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
          Alteracoes salvas!
        </p>
      )}

      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? 'Salvando...' : 'Salvar alteracoes'}
      </button>
    </form>
  )
}
