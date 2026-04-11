'use client'

import { useState } from 'react'
import Link from 'next/link'
import FaceMapView from './face-map-view'

type Point = {
  id: string
  zone: string
  muscle: string | null
  side: string | null
  x_position: number
  y_position: number
  units: number | null
  depth: string | null
  technique: string | null
}

type Application = {
  id: string
  application_date: string
  type: string
  product_name: string
  product_brand: string | null
  lot_number: string | null
  total_units: number | null
  notes: string | null
  users: { name: string } | null
  injectable_points: Point[]
}

export default function ApplicationHistory({ 
  applications, 
  patientId,
  patientGender = 'female'
}: { 
  applications: Application[]
  patientId: string
  patientGender?: 'female' | 'male'
}) {
  const [selectedApp, setSelectedApp] = useState<Application | null>(applications[0] || null)
  const [viewMode, setViewMode] = useState<'list' | 'compare'>('list')

  if (applications.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-pink-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">💉</span>
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Nenhuma aplicacao registrada</h3>
        <p className="text-sm text-slate-500 mb-6">Clique em "Nova aplicacao" para criar o primeiro mapa de injetaveis</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Lista de aplicacoes */}
      <div className="lg:col-span-1">
        <div className="card overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">Historico</h2>
            <p className="text-xs text-slate-500">{applications.length} aplicacoes</p>
          </div>
          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {applications.map(app => (
              <button
                key={app.id}
                onClick={() => setSelectedApp(app)}
                className={`w-full text-left p-4 transition-colors ${
                  selectedApp?.id === app.id 
                    ? 'bg-purple-50 border-l-4 border-purple-500' 
                    : 'hover:bg-slate-50 border-l-4 border-transparent'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    app.type === 'toxin' ? 'bg-purple-100' : 'bg-pink-100'
                  }`}>
                    <span className="text-sm">{app.type === 'toxin' ? '💉' : '✨'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{app.product_name}</p>
                    <p className="text-xs text-slate-500">
                      {app.total_units} {app.type === 'toxin' ? 'U' : 'ml'} • {app.injectable_points.length} pontos
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(app.application_date).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Visualizacao do mapa */}
      <div className="lg:col-span-2">
        {selectedApp && (
          <div className="card overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">{selectedApp.product_name}</h2>
                  <p className="text-xs text-slate-500">
                    {new Date(selectedApp.application_date).toLocaleDateString('pt-BR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${selectedApp.type === 'toxin' ? 'text-purple-600' : 'text-pink-600'}`}>
                    {selectedApp.total_units} {selectedApp.type === 'toxin' ? 'U' : 'ml'}
                  </p>
                  <p className="text-xs text-slate-500">{selectedApp.injectable_points.length} pontos</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <FaceMapView points={selectedApp.injectable_points} type={selectedApp.type} gender={patientGender} />
            </div>

            {/* Detalhes */}
            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                <div>
                  <p className="text-xs text-slate-400">Produto</p>
                  <p className="font-medium text-slate-900">{selectedApp.product_name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Marca</p>
                  <p className="font-medium text-slate-900">{selectedApp.product_brand || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Lote</p>
                  <p className="font-medium text-slate-900">{selectedApp.lot_number || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Profissional</p>
                  <p className="font-medium text-slate-900">{selectedApp.users?.name || '-'}</p>
                </div>
              </div>
              {selectedApp.notes && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-xs text-slate-400 mb-1">Observacoes</p>
                  <p className="text-sm text-slate-600">{selectedApp.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
