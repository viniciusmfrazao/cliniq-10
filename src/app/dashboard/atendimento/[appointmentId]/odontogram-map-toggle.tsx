'use client'

import { useState, Suspense } from 'react'
import InjectableMapSection from './injectable-map-section'
import OdontogramClient from '@/components/odontogram/OdontogramClient'

type Props = {
  hasOdontogram: boolean
  patientId: string
  clinicId: string
  appointmentId: string
  patient: any
  productsForMap: any[]
  currentInjections: any[]
}

export default function OdontogramMapToggle({
  patientId,
  clinicId,
  appointmentId,
  patient,
  productsForMap,
  currentInjections,
}: Props) {
  const [activeMap, setActiveMap] = useState<'injetaveis' | 'odontograma'>('injetaveis')

  return (
    <div className="space-y-3">
      {/* Toggle */}
      <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1">
        <button
          onClick={() => setActiveMap('injetaveis')}
          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
            activeMap === 'injetaveis'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          💉 Mapa de Injetáveis
        </button>
        <button
          onClick={() => setActiveMap('odontograma')}
          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
            activeMap === 'odontograma'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          🦷 Odontograma
        </button>
      </div>

      {/* Conteúdo */}
      {activeMap === 'injetaveis' ? (
        <InjectableMapSection
          patient={patient}
          appointmentId={appointmentId}
          products={productsForMap}
          currentInjections={currentInjections}
          clinicId={clinicId}
        />
      ) : (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Odontograma</h3>
          <OdontogramClient
            patientId={patientId}
            clinicId={clinicId}
            appointmentId={appointmentId}
            initialData={null}
          />
        </div>
      )}
    </div>
  )
}
