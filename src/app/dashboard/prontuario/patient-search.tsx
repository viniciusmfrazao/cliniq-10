'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function PatientSearchProntuario({ initialQuery }: { initialQuery: string }) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/dashboard/prontuario?q=${encodeURIComponent(query)}`)
    } else {
      router.push('/dashboard/prontuario')
    }
  }

  return (
    <form onSubmit={handleSearch} className="flex gap-2">
      <input
        type="text"
        className="input flex-1"
        placeholder="Buscar paciente por nome ou telefone..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        autoFocus
      />
      <button type="submit" className="btn-primary w-auto px-6">
        Buscar
      </button>
    </form>
  )
}
