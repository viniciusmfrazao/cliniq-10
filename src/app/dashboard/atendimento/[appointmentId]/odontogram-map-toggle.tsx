'use client'

import { useState, Suspense } from 'react'
import InjectableMapSection from './injectable-map-section'
import OdontogramClient from '@/components/odontogram/OdontogramClient'
import BodyMapSection from './body-map-section'

type Props = {
  hasOdontogram: boolean
  hasBodyMap?: boolean
  patientId: string
  clinicId: string
  appointmentId: string
  patient: any
  productsForMap: any[]
  currentInjections: any[]
  currentBodyApplications?: any[]
}

export default function OdontogramMapToggle({
  patientId,
  clinicId,
  appointmentId,
  patient,
  productsForMap,
  currentInjections,
  hasOdontogram,
  hasBodyMap = false,
  currentBodyApplications = [],
}: Props) {
  const [activeMap, setActiveMap] = useState<'injetaveis' | 'odontograma' | 'corporal'>('injetaveis')

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
          💉 Injetáveis
        </button>
        {hasOdontogram && (
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
        )}
        {hasBodyMap && (
          <button
            onClick={() => setActiveMap('corporal')}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
              activeMap === 'corporal'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            🧍 Mapa Corporal
          </button>
        )}
      </div>

      {/* Conteúdo */}
      {activeMap === 'injetaveis' && (
        <InjectableMapSection
          patient={patient}
          appointmentId={appointmentId}
          products={productsForMap}
          currentInjections={currentInjections}
          clinicId={clinicId}
        />
      )}
      {activeMap === 'odontograma' && (
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
      {activeMap === 'corporal' && (
        <BodyMapSection
          patient={patient}
          appointmentId={appointmentId}
          products={productsForMap}
          currentBodyApplications={currentBodyApplications}
          clinicId={clinicId}
        />
      )}
    </div>
  )
}
