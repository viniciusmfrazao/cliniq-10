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

// Paths gerados via suavização Catmull-Rom sobre pontos-âncora anatômicos
// (ombro, cotovelo, punho, quadril, joelho, tornozelo) — dá o afunilamento
// natural dos membros em vez de um "cano" de largura uniforme.
const TORSO_PATH =
  'M118.0,108.0 C127.2,104.0 139.3,96.0 150.0,96.0 C160.7,96.0 172.8,104.0 182.0,108.0 C191.2,112.0 200.3,113.0 205.0,120.0 C209.7,127.0 209.8,140.0 210.0,150.0 C210.2,160.0 207.7,166.7 206.0,180.0 C204.3,193.3 200.7,215.8 200.0,230.0 C199.3,244.2 202.7,253.3 202.0,265.0 C201.3,276.7 204.7,293.2 196.0,300.0 C187.3,306.8 165.3,306.0 150.0,306.0 C134.7,306.0 112.7,306.8 104.0,300.0 C95.3,293.2 98.7,276.7 98.0,265.0 C97.3,253.3 100.7,244.2 100.0,230.0 C99.3,215.8 95.7,193.3 94.0,180.0 C92.3,166.7 89.8,160.0 90.0,150.0 C90.2,140.0 90.3,127.0 95.0,120.0 C99.7,113.0 108.8,112.0 118.0,108.0 Z'

const ARM_R_PATH =
  'M206.0,110.0 C211.7,114.7 221.3,126.7 226.0,140.0 C230.7,153.3 233.3,173.3 234.0,190.0 C234.7,206.7 232.0,224.2 230.0,240.0 C228.0,255.8 224.7,272.0 222.0,285.0 C219.3,298.0 214.3,310.2 214.0,318.0 C213.7,325.8 220.3,327.7 220.0,332.0 C219.7,336.3 215.0,341.7 212.0,344.0 C209.0,346.3 204.3,348.3 202.0,346.0 C199.7,343.7 198.0,340.2 198.0,330.0 C198.0,319.8 201.0,300.0 202.0,285.0 C203.0,270.0 204.0,255.8 204.0,240.0 C204.0,224.2 203.0,205.8 202.0,190.0 C201.0,174.2 199.7,158.0 198.0,145.0 C196.3,132.0 190.7,117.8 192.0,112.0 C193.3,106.2 200.3,105.3 206.0,110.0 Z'

const ARM_L_PATH =
  'M94.0,110.0 C88.3,114.7 78.7,126.7 74.0,140.0 C69.3,153.3 66.7,173.3 66.0,190.0 C65.3,206.7 68.0,224.2 70.0,240.0 C72.0,255.8 75.3,272.0 78.0,285.0 C80.7,298.0 85.7,310.2 86.0,318.0 C86.3,325.8 79.7,327.7 80.0,332.0 C80.3,336.3 85.0,341.7 88.0,344.0 C91.0,346.3 95.7,348.3 98.0,346.0 C100.3,343.7 102.0,340.2 102.0,330.0 C102.0,319.8 99.0,300.0 98.0,285.0 C97.0,270.0 96.0,255.8 96.0,240.0 C96.0,224.2 97.0,205.8 98.0,190.0 C99.0,174.2 100.3,158.0 102.0,145.0 C103.7,132.0 109.3,117.8 108.0,112.0 C106.7,106.2 99.7,105.3 94.0,110.0 Z'

const LEG_R_PATH =
  'M192.0,300.0 C200.0,308.0 197.3,333.3 198.0,350.0 C198.7,366.7 197.7,383.3 196.0,400.0 C194.3,416.7 190.3,433.3 188.0,450.0 C185.7,466.7 184.0,482.5 182.0,500.0 C180.0,517.5 174.3,541.7 176.0,555.0 C177.7,568.3 188.0,575.0 192.0,580.0 C196.0,585.0 201.2,583.7 200.0,585.0 C198.8,586.3 190.3,593.0 185.0,588.0 C179.7,583.0 170.5,569.7 168.0,555.0 C165.5,540.3 169.3,517.5 170.0,500.0 C170.7,482.5 172.3,466.7 172.0,450.0 C171.7,433.3 170.0,416.7 168.0,400.0 C166.0,383.3 163.0,366.3 160.0,350.0 C157.0,333.7 144.7,310.3 150.0,302.0 C155.3,293.7 184.0,292.0 192.0,300.0 Z'

const LEG_L_PATH =
  'M108.0,300.0 C100.0,308.0 102.7,333.3 102.0,350.0 C101.3,366.7 102.3,383.3 104.0,400.0 C105.7,416.7 109.7,433.3 112.0,450.0 C114.3,466.7 116.0,482.5 118.0,500.0 C120.0,517.5 125.7,541.7 124.0,555.0 C122.3,568.3 112.0,575.0 108.0,580.0 C104.0,585.0 98.8,583.7 100.0,585.0 C101.2,586.3 109.7,593.0 115.0,588.0 C120.3,583.0 129.5,569.7 132.0,555.0 C134.5,540.3 130.7,517.5 130.0,500.0 C129.3,482.5 127.7,466.7 128.0,450.0 C128.3,433.3 130.0,416.7 132.0,400.0 C134.0,383.3 137.0,366.3 140.0,350.0 C143.0,333.7 155.3,310.3 150.0,302.0 C144.7,293.7 116.0,292.0 108.0,300.0 Z'

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
          <linearGradient id="bodySkin" x1="25%" y1="0%" x2="75%" y2="100%">
            <stop offset="0%" stopColor="#f8e0c9" />
            <stop offset="100%" stopColor="#e6c6a8" />
          </linearGradient>
          <linearGradient id="bodyShadowL" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#c9a780" stopOpacity="0" />
            <stop offset="100%" stopColor="#b98f68" stopOpacity="0.28" />
          </linearGradient>
          <linearGradient id="bodyShadowR" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#c9a780" stopOpacity="0" />
            <stop offset="100%" stopColor="#b98f68" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* Pernas (atrás do tronco) */}
        <path d={LEG_R_PATH} fill={skin} stroke={stroke} strokeWidth="1.2" strokeLinejoin="round" />
        <path d={LEG_L_PATH} fill={skin} stroke={stroke} strokeWidth="1.2" strokeLinejoin="round" />
        {/* pés */}
        <ellipse cx="192" cy="586" rx="17" ry="10" fill={skin} stroke={stroke} strokeWidth="1" />
        <ellipse cx="108" cy="586" rx="17" ry="10" fill={skin} stroke={stroke} strokeWidth="1" />

        {/* Braços */}
        <path d={ARM_R_PATH} fill={skin} stroke={stroke} strokeWidth="1.2" strokeLinejoin="round" />
        <path d={ARM_L_PATH} fill={skin} stroke={stroke} strokeWidth="1.2" strokeLinejoin="round" />

        {/* Tronco (por cima, esconde as junções com braços/pernas) */}
        <path d={TORSO_PATH} fill={skin} stroke={stroke} strokeWidth="1.3" strokeLinejoin="round" />

        {/* Sombras laterais sutis para dar volume */}
        <path d="M96 160 Q90 230 98 295" stroke="url(#bodyShadowL)" strokeWidth="12" fill="none" opacity="0.6" />
        <path d="M204 160 Q210 230 202 295" stroke="url(#bodyShadowR)" strokeWidth="12" fill="none" opacity="0.6" />
        <path d="M170 340 Q178 420 172 500" stroke="url(#bodyShadowR)" strokeWidth="10" fill="none" opacity="0.4" />
        <path d="M130 340 Q122 420 128 500" stroke="url(#bodyShadowL)" strokeWidth="10" fill="none" opacity="0.4" />

        {/* Pescoço + cabeça */}
        <path d="M136 66 L136 96 Q150 104 164 96 L164 66 Z" fill={skin} stroke={stroke} strokeWidth="0.6" />
        <ellipse cx="150" cy="38" rx="27" ry="33" fill={skin} stroke={stroke} strokeWidth="1.3" />

        {!isBack ? (
          <>
            <ellipse cx="150" cy="272" rx="2.5" ry="3.5" fill={stroke} opacity="0.6" />
            <path d="M120 143 Q150 153 180 143" stroke={stroke} strokeWidth="0.7" fill="none" opacity="0.5" />
            <line x1="150" y1="106" x2="150" y2="300" stroke={stroke} strokeWidth="0.6" opacity="0.3" />
            {/* joelhos */}
            <path d="M180 452 Q186 458 180 464" stroke={stroke} strokeWidth="0.6" fill="none" opacity="0.35" />
            <path d="M120 452 Q114 458 120 464" stroke={stroke} strokeWidth="0.6" fill="none" opacity="0.35" />
          </>
        ) : (
          <>
            <line x1="150" y1="106" x2="150" y2="300" stroke={stroke} strokeWidth="0.6" strokeDasharray="2 3" opacity="0.4" />
            <path d="M116 258 Q150 270 184 258" stroke={stroke} strokeWidth="0.7" fill="none" opacity="0.4" />
          </>
        )}

        {/* Labels das regiões */}
        {showRegions && !isBack && (
          <g fontFamily="system-ui, -apple-system, sans-serif" fontSize="8" fontWeight="500" fill="#475569" opacity="0.8">
            <text x="150" y="130" textAnchor="middle">TÓRAX</text>
            <text x="150" y="235" textAnchor="middle">ABDÔMEN</text>
            <text x="60" y="180" textAnchor="middle">FLANCO</text>
            <text x="240" y="180" textAnchor="middle">FLANCO</text>
            <text x="40" y="250" textAnchor="middle">BRAÇO</text>
            <text x="260" y="250" textAnchor="middle">BRAÇO</text>
            <text x="112" y="420" textAnchor="middle">COXA INT.</text>
            <text x="188" y="420" textAnchor="middle">COXA EXT.</text>
          </g>
        )}
        {showRegions && isBack && (
          <g fontFamily="system-ui, -apple-system, sans-serif" fontSize="8" fontWeight="500" fill="#475569" opacity="0.8">
            <text x="150" y="130" textAnchor="middle">COSTAS SUP.</text>
            <text x="150" y="235" textAnchor="middle">LOMBAR</text>
            <text x="40" y="250" textAnchor="middle">BRAÇO</text>
            <text x="260" y="250" textAnchor="middle">BRAÇO</text>
            <text x="115" y="330" textAnchor="middle">GLÚTEO</text>
            <text x="185" y="330" textAnchor="middle">GLÚTEO</text>
            <text x="112" y="450" textAnchor="middle">COXA POST.</text>
            <text x="188" y="450" textAnchor="middle">COXA POST.</text>
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
