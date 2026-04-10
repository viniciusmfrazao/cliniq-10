'use client'

import { useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'

type Application = {
  id: string
  product_name: string
  total_units: number
  created_at: string
  notes: string | null
  injectable_points: {
    zone: string
    units: number
  }[]
}

type Props = {
  patient: { id: string; name: string }
  applications: Application[]
  appointmentId: string
  clinicId: string
}

export default function InjectablesSection({ patient, applications, appointmentId, clinicId }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
            <Icon name="syringe" className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Mapa de Injetaveis</h3>
            <p className="text-xs text-slate-500">Aplicacoes e pontos</p>
          </div>
        </div>
        <Link
          href={`/dashboard/injetaveis/${patient.id}?appointment=${appointmentId}`}
          className="btn-primary w-auto px-4 py-2 text-sm flex items-center gap-2"
        >
          <Icon name="plus" className="w-4 h-4" />
          Nova aplicacao
        </Link>
      </div>

      <div className="divide-y divide-slate-50 max-h-[300px] overflow-y-auto">
        {applications.length === 0 ? (
          <div className="p-8 text-center">
            <Icon name="syringe" className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Nenhuma aplicacao registrada</p>
            <Link
              href={`/dashboard/injetaveis/${patient.id}`}
              className="text-sm gradient-text font-medium inline-flex items-center gap-1 mt-2"
            >
              Abrir mapa de injetaveis
              <Icon name="arrowRight" className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          applications.map(app => (
            <div key={app.id} className="p-4">
              <button
                onClick={() => setExpanded(expanded === app.id ? null : app.id)}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center">
                    <span className="text-pink-600 font-bold text-sm">{app.total_units}U</span>
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-slate-900 text-sm">{app.product_name}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(app.created_at).toLocaleDateString('pt-BR')} • {app.injectable_points?.length || 0} pontos
                    </p>
                  </div>
                </div>
                <Icon 
                  name={expanded === app.id ? 'chevronUp' : 'chevronDown'} 
                  className="w-5 h-5 text-slate-400" 
                />
              </button>

              {expanded === app.id && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className="flex flex-wrap gap-2">
                    {app.injectable_points?.map((point, idx) => (
                      <span 
                        key={idx}
                        className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-lg"
                      >
                        {point.zone}: {point.units}U
                      </span>
                    ))}
                  </div>
                  {app.notes && (
                    <p className="text-xs text-slate-500 mt-2">{app.notes}</p>
                  )}
                  <Link
                    href={`/dashboard/injetaveis/${patient.id}`}
                    className="text-xs gradient-text font-medium inline-flex items-center gap-1 mt-2"
                  >
                    Ver mapa completo
                    <Icon name="arrowRight" className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
