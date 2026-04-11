'use client'

import FaceMap from '@/components/ui/FaceMap'

type Point = {
  id: string
  zone: string
  muscle: string | null
  side: string | null
  x_position: number
  y_position: number
  units: number | null
  depth?: string | null
  technique?: string | null
}

const ZONE_LABELS: Record<string, string> = {
  forehead: 'Testa',
  glabella: 'Glabela',
  crow_feet: 'Pés de galinha',
  eyebrow: 'Sobrancelha',
  bunny_lines: 'Bunny lines',
  nose: 'Nariz',
  perioral_upper: 'Perioral sup.',
  perioral_lower: 'Perioral inf.',
  lip: 'Lábios',
  chin: 'Mento',
  marionette: 'Marionete',
  nasolabial: 'Nasolabial',
  malar: 'Malar',
  jawline: 'Mandíbula',
  submandibular: 'Submand.',
  neck: 'Pescoço',
  temporal: 'Temporal',
}

const DEPTH_COLORS: Record<string, string> = {
  intradermica: '#22c55e',
  subcutanea: '#3b82f6',
  supraperiostal: '#8b5cf6',
  intramuscular: '#ef4444',
}

export default function FaceMapView({ points, type, gender = 'female' }: { points: Point[]; type: string; gender?: 'female' | 'male' }) {
  const isToxin = type === 'toxin'
  const baseColor = isToxin ? '#8B5CF6' : '#EC4899'
  const totalUnits = points.reduce((sum, p) => sum + (p.units || 0), 0)

  return (
    <div className="space-y-4">
      {/* Mapa */}
      <div className="bg-gradient-to-b from-slate-50 to-white rounded-2xl p-4 border border-slate-100">
        <FaceMap showRegions={false} gender={gender}>
          {points.map((point) => {
            const depthColor = point.depth ? DEPTH_COLORS[point.depth] || baseColor : baseColor
            
            return (
              <g key={point.id}>
                {/* Halo */}
                <circle
                  cx={point.x_position}
                  cy={point.y_position}
                  r="14"
                  fill={depthColor}
                  fillOpacity="0.15"
                />
                
                {/* Círculo principal */}
                <circle
                  cx={point.x_position}
                  cy={point.y_position}
                  r="10"
                  fill={depthColor}
                  stroke="white"
                  strokeWidth="2"
                  style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.15))' }}
                />
                
                {/* Unidades */}
                <text
                  x={point.x_position}
                  y={point.y_position + 3.5}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="bold"
                  fill="white"
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                >
                  {isToxin ? point.units : (point.units || 0).toFixed(1)}
                </text>
              </g>
            )
          })}
        </FaceMap>
      </div>

      {/* Resumo */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-semibold text-slate-900">{points.length} pontos</p>
            <p className="text-xs text-slate-500">aplicados nesta sessão</p>
          </div>
          <div className="text-right">
            <p 
              className="text-2xl font-black"
              style={{ color: baseColor }}
            >
              {isToxin ? totalUnits : totalUnits.toFixed(1)}
            </p>
            <p className="text-xs text-slate-500">{isToxin ? 'unidades' : 'ml total'}</p>
          </div>
        </div>

        {/* Lista de pontos */}
        {points.length > 0 && (
          <div className="pt-3 border-t border-slate-100">
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {points.map((point) => {
                const depthColor = point.depth ? DEPTH_COLORS[point.depth] || baseColor : baseColor
                
                return (
                  <div 
                    key={point.id} 
                    className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg"
                  >
                    <span 
                      className="w-7 h-7 rounded-md flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: depthColor }}
                    >
                      {isToxin ? point.units : (point.units || 0).toFixed(1)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-900 truncate">
                        {ZONE_LABELS[point.zone] || point.zone}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {point.muscle || '—'} {point.side === 'left' ? '(E)' : point.side === 'right' ? '(D)' : ''}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Legenda de cores */}
        {points.some(p => p.depth) && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Profundidade</p>
            <div className="flex flex-wrap gap-3">
              {Object.entries(DEPTH_COLORS).map(([key, color]) => (
                points.some(p => p.depth === key) && (
                  <div key={key} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-[10px] text-slate-600 capitalize">
                      {key.replace('_', ' ')}
                    </span>
                  </div>
                )
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
