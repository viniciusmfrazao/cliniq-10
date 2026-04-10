'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function PatientSearchInjectable({ initialQuery }: { initialQuery: string }) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/dashboard/injetaveis?q=${encodeURIComponent(query)}`)
    } else {
      router.push('/dashboard/injetaveis')
    }
  }

  return (
    <form onSubmit={handleSearch} className="flex gap-3">
      <div className="relative flex-1">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          placeholder="Digite o nome ou telefone do paciente..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />
      </div>
      <button type="submit" className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-medium text-sm hover:from-purple-700 hover:to-pink-700 transition-all">
        Buscar
      </button>
    </form>
  )
}
