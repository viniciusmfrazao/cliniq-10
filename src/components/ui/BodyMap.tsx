'use client'

import { forwardRef } from 'react'

type BodyMapProps = {
  onClick?: (e: React.MouseEvent<SVGSVGElement>) => void
  children?: React.ReactNode
  showRegions?: boolean
  view?: 'front' | 'back'
}

// viewBox comum às duas vistas — mantém coordenadas (x,y) compatíveis entre frente/costas
export const BODY_VIEWBOX = { w: 300, h: 620 }

export const BodyMap = forwardRef<SVGSVGElement, BodyMapProps>(
  ({ onClick, children, showRegions = true, view = 'front' }, ref) => {
    const isBack = view === 'back'
    const skin = 'url(#bodySkin)'
    const stroke = '#c9a780'

    return (
      <svg
        ref={ref}
        viewBox={`0 0 ${BODY_VIEWBOX.w} ${BODY_VIEWBOX.h}`}
        className="w-full max-w-[300px] mx-auto cursor-crosshair select-none"
        onClick={onClick}
      >
        <defs>
          <linearGradient id="bodySkin" x1="30%" y1="0%" x2="70%" y2="100%">
            <stop offset="0%" stopColor="#f5dcc8" />
            <stop offset="100%" stopColor="#e8ccb8" />
          </linearGradient>
        </defs>

        {/* Pernas (atrás do tronco) */}
        <line x1="128" y1="300" x2="112" y2="600" stroke={skin} strokeWidth="46" strokeLinecap="round" />
        <line x1="172" y1="300" x2="188" y2="600" stroke={skin} strokeWidth="46" strokeLinecap="round" />
        <ellipse cx="106" cy="608" rx="20" ry="12" fill={skin} stroke={stroke} strokeWidth="1" />
        <ellipse cx="194" cy="608" rx="20" ry="12" fill={skin} stroke={stroke} strokeWidth="1" />

        {/* Braços */}
        <path d="M96 112 Q60 180 58 320" stroke={skin} strokeWidth="38" strokeLinecap="round" fill="none" />
        <path d="M204 112 Q240 180 242 320" stroke={skin} strokeWidth="38" strokeLinecap="round" fill="none" />
        <ellipse cx="57" cy="336" rx="15" ry="19" fill={skin} stroke={stroke} strokeWidth="1" />
        <ellipse cx="243" cy="336" rx="15" ry="19" fill={skin} stroke={stroke} strokeWidth="1" />

        {/* Tronco */}
        <path
          d="M108 108 Q150 96 192 108 L200 150 Q206 200 190 250 Q198 270 195 300 L105 300 Q102 270 110 250 Q94 200 100 150 Z"
          fill={skin}
          stroke={stroke}
          strokeWidth="1.2"
        />

        {/* Pescoço + cabeça */}
        <path d="M136 68 L136 94 Q150 102 164 94 L164 68 Z" fill={skin} stroke={stroke} strokeWidth="0.6" />
        <ellipse cx="150" cy="40" rx="27" ry="32" fill={skin} stroke={stroke} strokeWidth="1.2" />

        {!isBack ? (
          <>
            <ellipse cx="150" cy="272" rx="2.5" ry="3.5" fill={stroke} opacity="0.6" />
            <path d="M120 145 Q150 155 180 145" stroke={stroke} strokeWidth="0.7" fill="none" opacity="0.5" />
            <line x1="150" y1="108" x2="150" y2="298" stroke={stroke} strokeWidth="0.6" opacity="0.35" />
          </>
        ) : (
          <>
            <line x1="150" y1="108" x2="150" y2="298" stroke={stroke} strokeWidth="0.6" strokeDasharray="2 3" opacity="0.4" />
            <path d="M118 255 Q150 268 182 255" stroke={stroke} strokeWidth="0.7" fill="none" opacity="0.4" />
          </>
        )}

        {/* Labels das regiões */}
        {showRegions && !isBack && (
          <g fontFamily="system-ui, -apple-system, sans-serif" fontSize="8" fontWeight="500" fill="#475569" opacity="0.8">
            <text x="150" y="130" textAnchor="middle">TÓRAX</text>
            <text x="150" y="235" textAnchor="middle">ABDÔMEN</text>
            <text x="70" y="180" textAnchor="middle">FLANCO</text>
            <text x="230" y="180" textAnchor="middle">FLANCO</text>
            <text x="45" y="250" textAnchor="middle">BRAÇO</text>
            <text x="255" y="250" textAnchor="middle">BRAÇO</text>
            <text x="115" y="420" textAnchor="middle">COXA INT.</text>
            <text x="185" y="420" textAnchor="middle">COXA EXT.</text>
          </g>
        )}
        {showRegions && isBack && (
          <g fontFamily="system-ui, -apple-system, sans-serif" fontSize="8" fontWeight="500" fill="#475569" opacity="0.8">
            <text x="150" y="130" textAnchor="middle">COSTAS SUP.</text>
            <text x="150" y="235" textAnchor="middle">LOMBAR</text>
            <text x="45" y="250" textAnchor="middle">BRAÇO</text>
            <text x="255" y="250" textAnchor="middle">BRAÇO</text>
            <text x="115" y="330" textAnchor="middle">GLÚTEO</text>
            <text x="185" y="330" textAnchor="middle">GLÚTEO</text>
            <text x="115" y="450" textAnchor="middle">COXA POST.</text>
            <text x="185" y="450" textAnchor="middle">COXA POST.</text>
          </g>
        )}

        {/* Pontos de aplicação renderizados */}
        {children}
      </svg>
    )
  }
)

BodyMap.displayName = 'BodyMap'

export default BodyMap
