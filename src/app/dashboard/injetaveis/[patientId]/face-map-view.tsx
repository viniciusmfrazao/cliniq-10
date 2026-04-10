'use client'

type Point = {
  id: string
  zone: string
  muscle: string | null
  side: string | null
  x_position: number
  y_position: number
  units: number | null
}

const ZONE_COLORS: Record<string, string> = {
  forehead: '#8B5CF6',
  glabella: '#A855F7',
  crow_feet: '#EC4899',
  eyebrow: '#F472B6',
  nose: '#06B6D4',
  cheeks: '#F97316',
  nasolabial: '#EF4444',
  lips: '#EC4899',
  chin: '#8B5CF6',
  jawline: '#6366F1',
  neck: '#0EA5E9',
}

export default function FaceMapView({ points, type }: { points: Point[]; type: string }) {
  const baseColor = type === 'toxin' ? '#8B5CF6' : '#EC4899'

  return (
    <div className="relative flex justify-center">
      <svg 
        viewBox="0 0 300 400" 
        className="w-full max-w-md"
        style={{ filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))' }}
      >
        {/* Fundo */}
        <defs>
          <linearGradient id="skinGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FDE68A" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#FBBF24" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="hairGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#78350F" />
            <stop offset="100%" stopColor="#451A03" />
          </linearGradient>
        </defs>

        {/* Cabelo */}
        <ellipse cx="150" cy="80" rx="95" ry="70" fill="url(#hairGradient)" />
        
        {/* Formato do rosto */}
        <path
          d="M150 50 
             C210 50 240 100 240 150
             C240 220 220 280 200 320
             C180 360 160 380 150 380
             C140 380 120 360 100 320
             C80 280 60 220 60 150
             C60 100 90 50 150 50Z"
          fill="url(#skinGradient)"
          stroke="#D4A574"
          strokeWidth="2"
        />

        {/* Testa - zona */}
        <path
          d="M85 80 C85 60 215 60 215 80 C215 120 200 140 150 140 C100 140 85 120 85 80Z"
          fill="none"
          stroke="#E5E7EB"
          strokeWidth="1"
          strokeDasharray="4"
        />
        <text x="150" y="95" textAnchor="middle" fontSize="8" fill="#9CA3AF">TESTA</text>

        {/* Glabela */}
        <rect x="135" y="130" width="30" height="25" rx="5" fill="none" stroke="#E5E7EB" strokeWidth="1" strokeDasharray="4" />
        <text x="150" y="145" textAnchor="middle" fontSize="6" fill="#9CA3AF">GLABELA</text>

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

        {/* Pes de galinha - zonas */}
        <path d="M70 165 L85 170 L70 175" fill="none" stroke="#E5E7EB" strokeWidth="1" strokeDasharray="4" />
        <path d="M230 165 L215 170 L230 175" fill="none" stroke="#E5E7EB" strokeWidth="1" strokeDasharray="4" />

        {/* Nariz */}
        <path d="M150 160 L150 220 M140 230 Q150 240 160 230" fill="none" stroke="#D4A574" strokeWidth="2" strokeLinecap="round" />

        {/* Sulcos nasolabiais */}
        <path d="M125 230 Q120 260 115 290" fill="none" stroke="#E5E7EB" strokeWidth="1" strokeDasharray="4" />
        <path d="M175 230 Q180 260 185 290" fill="none" stroke="#E5E7EB" strokeWidth="1" strokeDasharray="4" />

        {/* Boca */}
        <path d="M120 300 Q150 320 180 300" fill="#E88B8B" stroke="#D4A574" strokeWidth="1" />
        <path d="M125 300 Q150 290 175 300" fill="none" stroke="#D4A574" strokeWidth="1" />

        {/* Labios - zona */}
        <ellipse cx="150" cy="305" rx="35" ry="20" fill="none" stroke="#E5E7EB" strokeWidth="1" strokeDasharray="4" />
        <text x="150" y="335" textAnchor="middle" fontSize="7" fill="#9CA3AF">LABIOS</text>

        {/* Queixo */}
        <ellipse cx="150" cy="360" rx="30" ry="15" fill="none" stroke="#E5E7EB" strokeWidth="1" strokeDasharray="4" />
        <text x="150" y="363" textAnchor="middle" fontSize="7" fill="#9CA3AF">QUEIXO</text>

        {/* Bochechas */}
        <ellipse cx="85" cy="230" rx="25" ry="30" fill="none" stroke="#E5E7EB" strokeWidth="1" strokeDasharray="4" />
        <ellipse cx="215" cy="230" rx="25" ry="30" fill="none" stroke="#E5E7EB" strokeWidth="1" strokeDasharray="4" />

        {/* Mandibula */}
        <path d="M70 280 Q60 320 100 360" fill="none" stroke="#E5E7EB" strokeWidth="1" strokeDasharray="4" />
        <path d="M230 280 Q240 320 200 360" fill="none" stroke="#E5E7EB" strokeWidth="1" strokeDasharray="4" />

        {/* Pontos de aplicacao */}
        {points.map((point, index) => (
          <g key={point.id}>
            {/* Circulo externo com pulse */}
            <circle
              cx={point.x_position * 3}
              cy={point.y_position * 4}
              r="12"
              fill={baseColor}
              fillOpacity="0.2"
              className="animate-pulse"
            />
            {/* Circulo principal */}
            <circle
              cx={point.x_position * 3}
              cy={point.y_position * 4}
              r="8"
              fill={baseColor}
              stroke="white"
              strokeWidth="2"
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))' }}
            />
            {/* Numero de unidades */}
            <text
              x={point.x_position * 3}
              y={point.y_position * 4 + 3}
              textAnchor="middle"
              fontSize="7"
              fontWeight="bold"
              fill="white"
            >
              {point.units || ''}
            </text>
          </g>
        ))}
      </svg>

      {/* Legenda de pontos */}
      {points.length > 0 && (
        <div className="absolute top-0 right-0 bg-white rounded-xl shadow-lg p-3 text-xs max-w-[150px]">
          <p className="font-semibold text-slate-700 mb-2">Pontos ({points.length})</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {points.map((point, i) => (
              <div key={point.id} className="flex items-center gap-2">
                <span 
                  className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                  style={{ backgroundColor: baseColor }}
                >
                  {point.units}
                </span>
                <span className="text-slate-600 truncate">
                  {point.zone} {point.side ? `(${point.side === 'left' ? 'E' : point.side === 'right' ? 'D' : 'C'})` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
