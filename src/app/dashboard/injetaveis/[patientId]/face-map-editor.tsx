'use client'

import { useState, useRef } from 'react'

type Point = {
  id: string
  zone: string
  muscle: string
  side: string
  x: number
  y: number
  units: number
  depth: string
  technique: string
}

const ZONES = [
  { id: 'forehead', name: 'Testa', muscles: ['Frontal'] },
  { id: 'glabella', name: 'Glabela', muscles: ['Corrugador', 'Procerus'] },
  { id: 'crow_feet', name: 'Pes de galinha', muscles: ['Orbicular dos olhos'] },
  { id: 'eyebrow', name: 'Sobrancelha', muscles: ['Orbicular', 'Frontal lateral'] },
  { id: 'bunny_lines', name: 'Bunny lines', muscles: ['Nasal'] },
  { id: 'nose', name: 'Nariz', muscles: ['Nasal', 'Depressor do septo'] },
  { id: 'upper_lip', name: 'Labio superior', muscles: ['Orbicular da boca'] },
  { id: 'lower_lip', name: 'Labio inferior', muscles: ['Depressor do labio'] },
  { id: 'chin', name: 'Queixo', muscles: ['Mentual'] },
  { id: 'marionette', name: 'Marionete', muscles: ['DAO'] },
  { id: 'jawline', name: 'Mandibula', muscles: ['Masseter'] },
  { id: 'neck', name: 'Pescoco', muscles: ['Platisma'] },
]

export default function FaceMapEditor({ 
  points, 
  setPoints, 
  type 
}: { 
  points: Point[]
  setPoints: (points: Point[]) => void
  type: string
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [selectedPoint, setSelectedPoint] = useState<Point | null>(null)
  const [editingPoint, setEditingPoint] = useState<Point | null>(null)
  const baseColor = type === 'toxin' ? '#8B5CF6' : '#EC4899'

  function handleSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current) return
    
    const rect = svgRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    const newPoint: Point = {
      id: Date.now().toString(),
      zone: 'forehead',
      muscle: '',
      side: 'center',
      x,
      y,
      units: type === 'toxin' ? 4 : 0.5,
      depth: '',
      technique: '',
    }

    setPoints([...points, newPoint])
    setEditingPoint(newPoint)
  }

  function updatePoint(id: string, updates: Partial<Point>) {
    setPoints(points.map(p => p.id === id ? { ...p, ...updates } : p))
    if (editingPoint?.id === id) {
      setEditingPoint({ ...editingPoint, ...updates })
    }
  }

  function removePoint(id: string) {
    setPoints(points.filter(p => p.id !== id))
    setEditingPoint(null)
  }

  const totalUnits = points.reduce((sum, p) => sum + (p.units || 0), 0)

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Mapa */}
      <div className="relative">
        <div className="bg-gradient-to-b from-slate-50 to-slate-100 rounded-2xl p-4">
          <p className="text-center text-sm text-slate-500 mb-4">
            Clique no rosto para adicionar pontos de aplicacao
          </p>
          
          <svg 
            ref={svgRef}
            viewBox="0 0 300 400" 
            className="w-full cursor-crosshair"
            onClick={handleSvgClick}
          >
            {/* Fundo */}
            <defs>
              <linearGradient id="skinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FDE68A" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#FBBF24" stopOpacity="0.1" />
              </linearGradient>
              <linearGradient id="hairGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#78350F" />
                <stop offset="100%" stopColor="#451A03" />
              </linearGradient>
            </defs>

            {/* Cabelo */}
            <ellipse cx="150" cy="80" rx="95" ry="70" fill="url(#hairGrad)" />
            
            {/* Rosto */}
            <path
              d="M150 50 
                 C210 50 240 100 240 150
                 C240 220 220 280 200 320
                 C180 360 160 380 150 380
                 C140 380 120 360 100 320
                 C80 280 60 220 60 150
                 C60 100 90 50 150 50Z"
              fill="url(#skinGrad)"
              stroke="#D4A574"
              strokeWidth="2"
            />

            {/* Zonas com hover */}
            {/* Testa */}
            <path
              d="M85 80 C85 60 215 60 215 80 C215 120 200 140 150 140 C100 140 85 120 85 80Z"
              fill="transparent"
              stroke="#CBD5E1"
              strokeWidth="1"
              strokeDasharray="4"
              className="hover:fill-purple-100 hover:fill-opacity-50 transition-colors"
            />

            {/* Glabela */}
            <rect x="135" y="130" width="30" height="25" rx="5" 
              fill="transparent" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="4"
              className="hover:fill-purple-100 hover:fill-opacity-50 transition-colors"
            />

            {/* Olhos */}
            <ellipse cx="110" cy="170" rx="25" ry="12" fill="white" stroke="#D4A574" strokeWidth="1" />
            <ellipse cx="190" cy="170" rx="25" ry="12" fill="white" stroke="#D4A574" strokeWidth="1" />
            <circle cx="110" cy="170" r="8" fill="#4B5563" />
            <circle cx="190" cy="170" r="8" fill="#4B5563" />
            <circle cx="112" cy="168" r="3" fill="white" />
            <circle cx="192" cy="168" r="3" fill="white" />

            {/* Sobrancelhas */}
            <path d="M80 155 Q95 145 130 150" fill="none" stroke="#78350F" strokeWidth="3" strokeLinecap="round" />
            <path d="M220 155 Q205 145 170 150" fill="none" stroke="#78350F" strokeWidth="3" strokeLinecap="round" />

            {/* Nariz */}
            <path d="M150 160 L150 220 M140 230 Q150 240 160 230" fill="none" stroke="#D4A574" strokeWidth="2" strokeLinecap="round" />

            {/* Boca */}
            <path d="M120 300 Q150 320 180 300" fill="#E88B8B" stroke="#D4A574" strokeWidth="1" />
            <path d="M125 300 Q150 290 175 300" fill="none" stroke="#D4A574" strokeWidth="1" />

            {/* Pontos */}
            {points.map((point) => (
              <g 
                key={point.id} 
                onClick={(e) => { e.stopPropagation(); setEditingPoint(point) }}
                className="cursor-pointer"
              >
                <circle
                  cx={point.x * 3}
                  cy={point.y * 4}
                  r={editingPoint?.id === point.id ? 14 : 10}
                  fill={baseColor}
                  fillOpacity={editingPoint?.id === point.id ? 0.3 : 0.2}
                  className="transition-all"
                />
                <circle
                  cx={point.x * 3}
                  cy={point.y * 4}
                  r="8"
                  fill={baseColor}
                  stroke={editingPoint?.id === point.id ? '#FFF' : baseColor}
                  strokeWidth={editingPoint?.id === point.id ? 3 : 2}
                  className="transition-all"
                />
                <text
                  x={point.x * 3}
                  y={point.y * 4 + 3}
                  textAnchor="middle"
                  fontSize="7"
                  fontWeight="bold"
                  fill="white"
                >
                  {point.units}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* Total */}
        <div className="mt-4 p-4 bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">{points.length} pontos marcados</p>
            <p className="text-xs text-slate-600">Clique em um ponto para editar</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-purple-700">{totalUnits}</p>
            <p className="text-xs text-slate-600">{type === 'toxin' ? 'unidades' : 'ml total'}</p>
          </div>
        </div>
      </div>

      {/* Editor de ponto */}
      <div>
        {editingPoint ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-slate-900">Editar ponto</h3>
              <button
                onClick={() => removePoint(editingPoint.id)}
                className="text-red-500 hover:text-red-700 text-sm font-medium"
              >
                Remover
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">Zona</label>
                <select
                  className="input"
                  value={editingPoint.zone}
                  onChange={e => updatePoint(editingPoint.id, { zone: e.target.value })}
                >
                  {ZONES.map(z => (
                    <option key={z.id} value={z.id}>{z.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Musculo</label>
                <select
                  className="input"
                  value={editingPoint.muscle}
                  onChange={e => updatePoint(editingPoint.id, { muscle: e.target.value })}
                >
                  <option value="">Selecione</option>
                  {ZONES.find(z => z.id === editingPoint.zone)?.muscles.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Lado</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'left', label: 'Esquerdo' },
                    { value: 'center', label: 'Centro' },
                    { value: 'right', label: 'Direito' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updatePoint(editingPoint.id, { side: opt.value })}
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                        editingPoint.side === opt.value
                          ? 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                          : 'bg-slate-100 text-slate-600 border-2 border-transparent'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">{type === 'toxin' ? 'Unidades' : 'Volume (ml)'}</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => updatePoint(editingPoint.id, { units: Math.max(0, editingPoint.units - (type === 'toxin' ? 1 : 0.1)) })}
                    className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-lg font-bold text-slate-600 hover:bg-slate-200"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    className="input text-center text-lg font-bold w-24"
                    value={editingPoint.units}
                    onChange={e => updatePoint(editingPoint.id, { units: parseFloat(e.target.value) || 0 })}
                    step={type === 'toxin' ? 1 : 0.1}
                    min={0}
                  />
                  <button
                    type="button"
                    onClick={() => updatePoint(editingPoint.id, { units: editingPoint.units + (type === 'toxin' ? 1 : 0.1) })}
                    className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-lg font-bold text-slate-600 hover:bg-slate-200"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="label">Profundidade</label>
                <select
                  className="input"
                  value={editingPoint.depth}
                  onChange={e => updatePoint(editingPoint.id, { depth: e.target.value })}
                >
                  <option value="">Selecione</option>
                  <option value="superficial">Superficial</option>
                  <option value="medio">Medio</option>
                  <option value="profundo">Profundo</option>
                </select>
              </div>

              <div>
                <label className="label">Tecnica</label>
                <select
                  className="input"
                  value={editingPoint.technique}
                  onChange={e => updatePoint(editingPoint.id, { technique: e.target.value })}
                >
                  <option value="">Selecione</option>
                  <option value="bolus">Bolus</option>
                  <option value="retroinjecao">Retroinjecao</option>
                  <option value="leque">Leque</option>
                  <option value="canula">Canula</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => setEditingPoint(null)}
                className="w-full btn-secondary"
              >
                Concluir edicao
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">👆</span>
            </div>
            <p className="font-semibold text-slate-700 mb-2">Clique no mapa</p>
            <p className="text-sm text-slate-500">
              Clique na area do rosto onde deseja marcar um ponto de aplicacao
            </p>
          </div>
        )}

        {/* Lista de pontos */}
        {points.length > 0 && !editingPoint && (
          <div className="mt-4 bg-white border border-slate-200 rounded-2xl p-4">
            <h4 className="text-sm font-semibold text-slate-900 mb-3">Pontos adicionados</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {points.map((point, i) => (
                <div
                  key={point.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100"
                  onClick={() => setEditingPoint(point)}
                >
                  <div className="flex items-center gap-3">
                    <span 
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                      style={{ backgroundColor: baseColor }}
                    >
                      {point.units}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {ZONES.find(z => z.id === point.zone)?.name || point.zone}
                      </p>
                      <p className="text-xs text-slate-500">
                        {point.muscle || 'Sem musculo'} • {point.side === 'left' ? 'Esq' : point.side === 'right' ? 'Dir' : 'Centro'}
                      </p>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
