'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import ImportarClient from './importar-client'
import ImportarExperteClient from './importar-experte-client'

type Clinic = { id: string; name: string }

const SOURCES = [
  { key: 'clinicorp', label: 'Clinicorp' },
  { key: 'experte', label: 'Experte' },
] as const

export default function ImportSourceTabs({ clinics }: { clinics: Clinic[] }) {
  const [source, setSource] = useState<'clinicorp' | 'experte'>('clinicorp')

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Icon name="upload" className="w-5 h-5" />
          Importar dados
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Migração de sistemas externos com mapeamento revisável e possibilidade de desfazer.
        </p>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {SOURCES.map(s => (
          <button
            key={s.key}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              source === s.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setSource(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {source === 'clinicorp' ? (
        <ImportarClient clinics={clinics} />
      ) : (
        <ImportarExperteClient clinics={clinics} />
      )}
    </div>
  )
}
