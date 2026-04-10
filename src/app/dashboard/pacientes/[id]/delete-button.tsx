'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function DeletePatientButton({ patientId }: { patientId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (!confirm('Tem certeza que deseja excluir este paciente? Esta acao nao pode ser desfeita.')) {
      return
    }

    setLoading(true)
    await supabase.from('patients').delete().eq('id', patientId)
    router.push('/dashboard/pacientes')
    router.refresh()
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="text-sm text-red-500 hover:text-red-700 px-4 py-2"
    >
      {loading ? '...' : 'Excluir'}
    </button>
  )
}
