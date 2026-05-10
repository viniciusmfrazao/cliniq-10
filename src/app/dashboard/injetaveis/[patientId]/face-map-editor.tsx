'use client'

import { useState, useRef } from 'react'
import FaceMap from '@/components/ui/FaceMap'
import Icon from '@/components/ui/Icon'

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
  { id: 'forehead', name: 'Testa / Frontal', muscles: ['Frontal'] },
  { id: 'glabella', name: 'Glabela', muscles: ['Corrugador', 'Procerus', 'Orbicular medial'] },
  { id: 'crow_feet', name: 'Pés de galinha', muscles: ['Orbicular lateral'] },
  { id: 'eyebrow', name: 'Sobrancelha', muscles: ['Orbicular', 'Frontal lateral', 'Depressor supercílio'] },
  { id: 'bunny_lines', name: 'Bunny lines', muscles: ['Nasal transverso'] },
  { id: 'nose', name: 'Nariz', muscles: ['Nasal', 'Depressor do septo', 'Dilatador da narina'] },
  { id: 'perioral_upper', name: 'Perioral superior', muscles: ['Orbicular da boca', 'Levantador do lábio'] },
  { id: 'perioral_lower', name: 'Perioral inferior', muscles: ['Depressor do lábio', 'Mentoniano'] },
  { id: 'lip', name: 'Lábios', muscles: ['Vermelhão superior', 'Vermelhão inferior', 'Comissura'] },
  { id: 'chin', name: 'Mento / Queixo', muscles: ['Mentoniano'] },
  { id: 'marionette', name: 'Marionete', muscles: ['DAO', 'Depressor do ângulo'] },
  { id: 'nasolabial', name: 'Sulco nasolabial', muscles: ['Zigomático maior', 'Levantador'] },
  { id: 'malar', name: 'Malar / Zigomático', muscles: ['Zigomático', 'Malar fat pad'] },
  { id: 'jawline', name: 'Mandíbula', muscles: ['Masseter', 'Ângulo mandibular'] },
  { id: 'submandibular', name: 'Submandibular', muscles: ['Platisma'] },
  { id: 'neck', name: 'Pescoço', muscles: ['Platisma', 'Bandas platismais'] },
  { id: 'temporal', name: 'Temporal', muscles: ['Temporal'] },
]

const DEPTHS = [
  { value: 'intradermica', label: 'Intradérmica', color: '#22c55e' },
  { value: 'subcutanea', label: 'Subcutânea', color: '#3b82f6' },
  { value: 'supraperiostal', label: 'Supraperiosteal', color: '#8b5cf6' },
  { value: 'intramuscular', label: 'Intramuscular', color: '#ef4444' },
]

const TECHNIQUES = [
  { value: 'bolus', label: 'Bolus', icon: '●' },
  { value: 'retroinjecao', label: 'Retroinjeção linear', icon: '━' },
  { value: 'leque', label: 'Leque', icon: '◥' },
  { value: 'serial', label: 'Pontos seriados', icon: '•••' },
  { value: 'canula', label: 'Cânula', icon: '⟿' },
  { value: 'cross', label: 'Cross-hatching', icon: '╳' },
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
  const [editingPoint, setEditingPoint] = useState<Point | null>(null)
  const [view, setView] = useState<'front' | 'side-left' | 'side-right'>('front')
  const [showMuscles, setShowMuscles] = useState(false)
  
  const isToxin = type === 'toxin'
  const baseColor = isToxin ? '#8B5CF6' : '#EC4899'
  const gradientFrom = isToxin ? '#8B5CF6' : '#EC4899'
  const gradientTo = isToxin ? '#6366F1' : '#F43F5E'

  function handleSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current) return
    
    const rect = svgRef.current.getBoundingClientRect()
    const viewBox = view === 'front' ? { w: 320, h: 420 } : { w: 280, h: 400 }
    const x = ((e.clientX - rect.left) / rect.width) * viewBox.w
    const y = ((e.clientY - rect.top) / rect.height) * viewBox.h

    const newPoint: Point = {
      id: Date.now().toString(),
      zone: 'forehead',
      muscle: '',
      side: x < viewBox.w / 2 ? 'left' : x > viewBox.w / 2 + 10 ? 'right' : 'center',
      x,
      y,
      units: isToxin ? 4 : 0.5,
      depth: isToxin ? 'intramuscular' : 'subcutanea',
      technique: 'bolus',
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

  function duplicatePointMirror(point: Point) {
    const viewBox = view === 'front' ? { w: 320, h: 420 } : { w: 280, h: 400 }
    const centerX = viewBox.w / 2
    const mirroredX = centerX + (centerX - point.x)
    
    const newPoint: Point = {
      ...point,
      id: Date.now().toString(),
      x: mirroredX,
      side: point.side === 'left' ? 'right' : point.side === 'right' ? 'left' : 'center',
    }
    
    setPoints([...points, newPoint])
  }

  const totalUnits = points.reduce((sum, p) => sum + (p.units || 0), 0)
  const pointsByZone = points.reduce((acc, p) => {
    acc[p.zone] = (acc[p.zone] || 0) + p.units
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      {/* Mapa - 3 colunas */}
      <div className="lg:col-span-3">
        <div className="bg-gradient-to-b from-slate-50 to-white rounded-2xl border border-slate-200 overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between p-3 border-b border-slate-100 bg-white">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Vista:</span>
              <div className="flex bg-slate-100 rounded-lg p-0.5">
                {[
                  { id: 'front', label: 'Frontal' },
                  { id: 'side-left', label: 'Esq' },
                  { id: 'side-right', label: 'Dir' },
                ].map(v => (
                  <button
                    key={v.id}
                    onClick={() => setView(v.id as typeof view)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      view === v.id 
                        ? 'bg-white text-slate-900 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => setShowMuscles(!showMuscles)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                showMuscles 
                  ? 'bg-violet-100 text-violet-700' 
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              <Icon name="layers" className="w-3.5 h-3.5" />
              Músculos
            </button>
          </div>

          {/* Face Map */}
          <div className="p-4 md:p-6">
            <p className="text-center text-xs text-slate-400 mb-3">
              Toque no rosto para adicionar pontos de aplicação
            </p>
            
            <FaceMap
              ref={svgRef}
              onClick={handleSvgClick}
              view={view}
              showRegions={true}
              showMuscles={showMuscles}
            >
              {/* Renderizar pontos */}
              {points.map((point) => {
                const isEditing = editingPoint?.id === point.id
                const depthColor = DEPTHS.find(d => d.value === point.depth)?.color || baseColor
                
                return (
                  <g 
                    key={point.id} 
                    onClick={(e) => { e.stopPropagation(); setEditingPoint(point) }}
                    className="cursor-pointer"
                    style={{ filter: isEditing ? 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.5))' : 'none' }}
                  >
                    {/* Área de clique expandida */}
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={20}
                      fill="transparent"
                    />
                    
                    {/* Círculo externo (halo) */}
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={isEditing ? 16 : 12}
                      fill={depthColor}
                      fillOpacity={0.15}
                      className="transition-all duration-200"
                    />
                    
                    {/* Círculo principal */}
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={10}
                      fill={depthColor}
                      stroke={isEditing ? '#fff' : depthColor}
                      strokeWidth={isEditing ? 3 : 2}
                      className="transition-all duration-200"
                    />
                    
                    {/* Texto das unidades */}
                    <text
                      x={point.x}
                      y={point.y + 3.5}
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="bold"
                      fill="white"
                      style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                    >
                      {isToxin ? point.units : point.units.toFixed(1)}
                    </text>
                  </g>
                )
              })}
            </FaceMap>
          </div>

          {/* Resumo */}
          <div className="p-4 border-t border-slate-100 bg-gradient-to-r from-slate-50 to-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">{points.length} pontos</p>
                <p className="text-xs text-slate-500">
                  {Object.entries(pointsByZone).slice(0, 2).map(([zone, units]) => 
                    `${ZONES.find(z => z.id === zone)?.name.split(' ')[0] || zone}: ${isToxin ? units + 'U' : units.toFixed(1) + 'ml'}`
                  ).join(' • ')}
                  {Object.keys(pointsByZone).length > 2 && ' ...'}
                </p>
              </div>
              <div className="text-right">
                <p 
                  className="text-3xl font-black"
                  style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                >
                  {isToxin ? totalUnits : totalUnits.toFixed(1)}
                </p>
                <p className="text-xs text-slate-500">{isToxin ? 'unidades' : 'ml total'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Editor - 2 colunas */}
      <div className="lg:col-span-2 space-y-4">
        {editingPoint ? (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-lg"
                  style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
                >
                  {isToxin ? editingPoint.units : editingPoint.units.toFixed(1)}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">
                    {ZONES.find(z => z.id === editingPoint.zone)?.name || 'Ponto'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {editingPoint.side === 'left' ? 'Lado esquerdo' : editingPoint.side === 'right' ? 'Lado direito' : 'Centro'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => duplicatePointMirror(editingPoint)}
                  className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                  title="Espelhar ponto"
                >
                  <Icon name="refresh" className="w-4 h-4" />
                </button>
                <button
                  onClick={() => removePoint(editingPoint.id)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Remover ponto"
                >
                  <Icon name="trash" className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Form */}
            <div className="p-4 space-y-4">
              {/* Zona e Músculo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Zona</label>
                  <select
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                    value={editingPoint.zone}
                    onChange={e => updatePoint(editingPoint.id, { zone: e.target.value, muscle: '' })}
                  >
                    {ZONES.map(z => (
                      <option key={z.id} value={z.id}>{z.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Músculo</label>
                  <select
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                    value={editingPoint.muscle}
                    onChange={e => updatePoint(editingPoint.id, { muscle: e.target.value })}
                  >
                    <option value="">Selecione</option>
                    {ZONES.find(z => z.id === editingPoint.zone)?.muscles.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Unidades/Volume */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">
                  {isToxin ? 'Unidades' : 'Volume (ml)'}
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updatePoint(editingPoint.id, { units: Math.max(0, editingPoint.units - (isToxin ? 1 : 0.1)) })}
                    className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-lg font-bold text-slate-600 hover:bg-slate-200 active:scale-95 transition-all"
                  >
                    -
                  </button>
                  <div className="flex-1 flex gap-1">
                    {(isToxin ? [2, 4, 6, 8, 10] : [0.1, 0.2, 0.3, 0.5, 1.0]).map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => updatePoint(editingPoint.id, { units: val })}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                          editingPoint.units === val
                            ? 'bg-violet-100 text-violet-700 ring-2 ring-violet-300'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {isToxin ? val : val.toFixed(1)}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => updatePoint(editingPoint.id, { units: editingPoint.units + (isToxin ? 1 : 0.1) })}
                    className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-lg font-bold text-slate-600 hover:bg-slate-200 active:scale-95 transition-all"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Profundidade */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Profundidade</label>
                <div className="grid grid-cols-2 gap-2">
                  {DEPTHS.map(d => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => updatePoint(editingPoint.id, { depth: d.value })}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        editingPoint.depth === d.value
                          ? 'ring-2 ring-offset-1'
                          : 'bg-slate-50 hover:bg-slate-100'
                      }`}
                      style={editingPoint.depth === d.value ? { 
                        backgroundColor: `${d.color}15`, 
                        color: d.color,
                        ringColor: d.color 
                      } : {}}
                    >
                      <span 
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: d.color }}
                      />
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Técnica */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Técnica</label>
                <div className="grid grid-cols-3 gap-2">
                  {TECHNIQUES.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => updatePoint(editingPoint.id, { technique: t.value })}
                      className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-[10px] font-medium transition-all ${
                        editingPoint.technique === t.value
                          ? 'bg-violet-100 text-violet-700 ring-2 ring-violet-300'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-base">{t.icon}</span>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingPoint(null)}
                className="w-full py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold text-sm hover:bg-slate-200 transition-colors"
              >
                Concluir edição
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
            <div 
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{ background: `linear-gradient(135deg, ${gradientFrom}20, ${gradientTo}20)` }}
            >
              <Icon name="plus" className="w-6 h-6" style={{ color: baseColor }} />
            </div>
            <p className="font-semibold text-slate-700 mb-1">Adicionar ponto</p>
            <p className="text-xs text-slate-500">
              Toque na área do rosto onde deseja marcar um ponto de aplicação
            </p>
          </div>
        )}

        {/* Lista de pontos */}
        {points.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
              <h4 className="text-sm font-semibold text-slate-900">Pontos ({points.length})</h4>
            </div>
            <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
              {points.map((point) => {
                const depthInfo = DEPTHS.find(d => d.value === point.depth)
                const isEditing = editingPoint?.id === point.id
                
                return (
                  <div
                    key={point.id}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                      isEditing ? 'bg-violet-50' : 'hover:bg-slate-50'
                    }`}
                    onClick={() => setEditingPoint(point)}
                  >
                    <div 
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-sm"
                      style={{ backgroundColor: depthInfo?.color || baseColor }}
                    >
                      {isToxin ? point.units : point.units.toFixed(1)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {ZONES.find(z => z.id === point.zone)?.name || point.zone}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {point.muscle || '—'} • {point.side === 'left' ? 'Esq' : point.side === 'right' ? 'Dir' : 'Centro'}
                        {point.technique && ` • ${TECHNIQUES.find(t => t.value === point.technique)?.label}`}
                      </p>
                    </div>
                    <Icon name="chevronRight" className="w-4 h-4 text-slate-300" />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Legenda de profundidade */}
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Legenda</p>
          <div className="flex flex-wrap gap-3">
            {DEPTHS.map(d => (
              <div key={d.value} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-[10px] text-slate-600">{d.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
