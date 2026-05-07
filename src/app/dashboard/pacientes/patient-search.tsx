'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { sanitizeSearchTerm } from '@/lib/search'

type Patient = {
  id: string
  name: string
  phone?: string
  email?: string
  cpf?: string
}

export default function PatientSearch({ initialQuery, clinicId }: { initialQuery: string; clinicId: string }) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<Patient[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Busca em tempo real
  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setIsOpen(false)
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      const supabase = createClient()
      const safeQuery = sanitizeSearchTerm(query)
      if (!safeQuery) {
        setResults([])
        setLoading(false)
        return
      }
      
      const { data } = await supabase
        .from('patients')
        .select('id, name, phone, email, cpf')
        .eq('clinic_id', clinicId)
        .or(`name.ilike.%${safeQuery}%,phone.ilike.%${safeQuery}%,email.ilike.%${safeQuery}%,cpf.ilike.%${safeQuery}%`)
        .order('name')
        .limit(10)

      setResults(data || [])
      setIsOpen(true)
      setHighlightIndex(0)
      setLoading(false)
    }, 300) // Debounce de 300ms

    return () => clearTimeout(timer)
  }, [query, clinicId])

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Navegação por teclado
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex(prev => (prev + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex(prev => (prev - 1 + results.length) % results.length)
    } else if (e.key === 'Enter' && results[highlightIndex]) {
      e.preventDefault()
      router.push(`/dashboard/pacientes/${results[highlightIndex].id}`)
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  // Busca tradicional (Enter ou botão)
  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setIsOpen(false)
    if (query.trim()) {
      router.push(`/dashboard/pacientes?q=${encodeURIComponent(query)}`)
    } else {
      router.push('/dashboard/pacientes')
    }
  }

  function clearSearch() {
    setQuery('')
    setResults([])
    setIsOpen(false)
    router.push('/dashboard/pacientes')
    inputRef.current?.focus()
  }

  return (
    <div ref={wrapperRef} className="relative">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            className="input pl-10 pr-10"
            placeholder="Digite para buscar paciente..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => query.length >= 2 && results.length > 0 && setIsOpen(true)}
          />
          {query && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <Icon name="x" className="w-4 h-4" />
            </button>
          )}
          {loading && (
            <div className="absolute right-10 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        <button type="submit" className="btn-secondary w-auto px-4">
          Buscar
        </button>
      </form>

      {/* Dropdown de resultados */}
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-xl border border-slate-200 shadow-xl max-h-80 overflow-y-auto">
          <div className="p-2 text-xs text-slate-500 border-b border-slate-100">
            {results.length} resultado{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}
          </div>
          {results.map((patient, idx) => (
            <Link
              key={patient.id}
              href={`/dashboard/pacientes/${patient.id}`}
              className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                idx === highlightIndex ? 'bg-violet-50' : 'hover:bg-slate-50'
              }`}
              onClick={() => setIsOpen(false)}
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                {patient.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 truncate">{patient.name}</p>
                <p className="text-xs text-slate-500 truncate">
                  {patient.phone && <span>{patient.phone}</span>}
                  {patient.phone && patient.email && <span> • </span>}
                  {patient.email && <span>{patient.email}</span>}
                </p>
              </div>
              <Icon name="chevronRight" className="w-4 h-4 text-slate-400 flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}

      {/* Sem resultados */}
      {isOpen && query.length >= 2 && results.length === 0 && !loading && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-xl border border-slate-200 shadow-xl p-6 text-center">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Icon name="search" className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-600 font-medium">Nenhum paciente encontrado</p>
          <p className="text-sm text-slate-500 mt-1">Tente buscar por outro termo</p>
          <Link 
            href="/dashboard/pacientes/novo" 
            className="inline-flex items-center gap-2 text-violet-600 font-semibold text-sm mt-3 hover:text-violet-700"
          >
            <Icon name="plus" className="w-4 h-4" />
            Cadastrar novo paciente
          </Link>
        </div>
      )}
    </div>
  )
}
