'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function PatientSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/dashboard/pacientes?q=${encodeURIComponent(query)}`)
    } else {
      router.push('/dashboard/pacientes')
    }
  }

  return (
    <form onSubmit={handleSearch} className="flex gap-2">
      <input
        type="text"
        className="input flex-1"
        placeholder="Buscar por nome, telefone ou email..."
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
      <button type="submit" className="btn-secondary w-auto px-4">
        Buscar
      </button>
    </form>
  )
}
