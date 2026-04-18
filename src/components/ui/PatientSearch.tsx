'use client'

import { useState, useRef, useEffect } from 'react'
import Icon from './Icon'

type Patient = {
  id: string
  name: string
}

type Props = {
  patients: Patient[]
  value: string
  onChange: (patientId: string) => void
  placeholder?: string
  required?: boolean
}

export default function PatientSearch({ patients, value, onChange, placeholder = 'Digite para buscar...', required }: Props) {
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Encontrar paciente selecionado
  const selectedPatient = patients.find(p => p.id === value)

  // Filtrar pacientes baseado na busca
  const filteredPatients = search.length > 0
    ? patients.filter(p => 
        p.name.toLowerCase().includes(search.toLowerCase())
      )
    : patients

  // Reset highlight quando lista muda
  useEffect(() => {
    setHighlightIndex(0)
  }, [filteredPatients.length])

  // Scroll para item highlighted
  useEffect(() => {
    if (listRef.current && isOpen) {
      const item = listRef.current.children[highlightIndex] as HTMLLIElement
      if (item) {
        item.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [highlightIndex, isOpen])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true)
        e.preventDefault()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightIndex(prev => 
          prev < filteredPatients.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightIndex(prev => prev > 0 ? prev - 1 : 0)
        break
      case 'Enter':
        e.preventDefault()
        if (filteredPatients[highlightIndex]) {
          selectPatient(filteredPatients[highlightIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        setSearch('')
        break
    }
  }

  const selectPatient = (patient: Patient) => {
    onChange(patient.id)
    setSearch('')
    setIsOpen(false)
  }

  const clearSelection = () => {
    onChange('')
    setSearch('')
    inputRef.current?.focus()
  }

  return (
    <div className="relative">
      {/* Campo de entrada */}
      <div className="relative">
        {selectedPatient ? (
          // Paciente selecionado
          <div className="input flex items-center justify-between bg-violet-50 border-violet-200">
            <span className="text-slate-900 font-medium">{selectedPatient.name}</span>
            <button
              type="button"
              onClick={clearSelection}
              className="p-1 hover:bg-violet-100 rounded-full transition-colors"
            >
              <Icon name="x" className="w-4 h-4 text-violet-500" />
            </button>
          </div>
        ) : (
          // Campo de busca
          <>
            <Icon 
              name="search" 
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" 
            />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setIsOpen(true)
              }}
              onFocus={() => setIsOpen(true)}
              onBlur={() => setTimeout(() => setIsOpen(false), 200)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              required={required && !value}
              className="input pl-10"
            />
          </>
        )}
      </div>

      {/* Lista de resultados */}
      {isOpen && !selectedPatient && (
        <ul
          ref={listRef}
          className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto"
        >
          {filteredPatients.length === 0 ? (
            <li className="p-3 text-sm text-slate-500 text-center">
              {search ? 'Nenhum paciente encontrado' : 'Digite para buscar...'}
            </li>
          ) : (
            filteredPatients.slice(0, 50).map((patient, idx) => (
              <li
                key={patient.id}
                onClick={() => selectPatient(patient)}
                className={`px-4 py-2.5 cursor-pointer transition-colors ${
                  idx === highlightIndex 
                    ? 'bg-violet-50 text-violet-900' 
                    : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-slate-500">
                      {patient.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm font-medium">{patient.name}</span>
                </div>
              </li>
            ))
          )}
          {filteredPatients.length > 50 && (
            <li className="px-4 py-2 text-xs text-slate-400 text-center border-t border-slate-100">
              Mostrando 50 de {filteredPatients.length} resultados. Digite mais para filtrar.
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
