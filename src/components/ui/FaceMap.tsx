'use client'

import { forwardRef } from 'react'

type FaceMapProps = {
  onClick?: (e: React.MouseEvent<SVGSVGElement>) => void
  children?: React.ReactNode
  showRegions?: boolean
  view?: 'front' | 'side' | 'both'
}

export const FaceMap = forwardRef<SVGSVGElement, FaceMapProps>(
  ({ onClick, children, showRegions = true, view = 'front' }, ref) => {
    return (
      <svg
        ref={ref}
        viewBox="0 0 300 400"
        className="w-full max-w-[320px] mx-auto cursor-crosshair"
        onClick={onClick}
        style={{ filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.05))' }}
      >
        <defs>
          {/* Gradientes para pele realista */}
          <linearGradient id="skinGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fce8d5" />
            <stop offset="50%" stopColor="#f5dcc8" />
            <stop offset="100%" stopColor="#ecd1be" />
          </linearGradient>
          
          <linearGradient id="shadowGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#e8c4ad" stopOpacity="0" />
            <stop offset="100%" stopColor="#d4a989" stopOpacity="0.3" />
          </linearGradient>

          <linearGradient id="lipGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#e8a5a0" />
            <stop offset="100%" stopColor="#d4918a" />
          </linearGradient>

          <linearGradient id="hairGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4a3728" />
            <stop offset="100%" stopColor="#2d1f16" />
          </linearGradient>

          {/* Filtro de suavização */}
          <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Fundo do pescoço */}
        <ellipse cx="150" cy="380" rx="55" ry="30" fill="url(#skinGradient)" />
        
        {/* Pescoço */}
        <path
          d="M105 340 L95 400 L205 400 L195 340"
          fill="url(#skinGradient)"
        />

        {/* Contorno do rosto - formato oval anatômico */}
        <path
          d="M150 45
             C210 45 250 90 250 150
             C250 200 245 250 230 290
             C215 330 185 355 150 360
             C115 355 85 330 70 290
             C55 250 50 200 50 150
             C50 90 90 45 150 45"
          fill="url(#skinGradient)"
          stroke="#d4b896"
          strokeWidth="1"
        />

        {/* Sombra lateral esquerda */}
        <path
          d="M50 150 C50 200 55 250 70 290 C60 270 55 230 55 180 C55 130 70 90 90 70"
          fill="url(#shadowGradient)"
          opacity="0.4"
        />

        {/* Cabelo */}
        <path
          d="M150 30
             C220 30 260 70 260 120
             C260 90 240 60 200 50
             C240 75 255 110 255 150
             L250 150
             C250 90 210 45 150 45
             C90 45 50 90 50 150
             L45 150
             C45 110 60 75 100 50
             C60 60 40 90 40 120
             C40 70 80 30 150 30"
          fill="url(#hairGradient)"
        />

        {/* Orelha esquerda */}
        <ellipse cx="48" cy="175" rx="12" ry="25" fill="url(#skinGradient)" stroke="#d4b896" strokeWidth="0.5" />
        <path d="M42 165 Q38 175 42 185" stroke="#d4b896" strokeWidth="1" fill="none" />
        
        {/* Orelha direita */}
        <ellipse cx="252" cy="175" rx="12" ry="25" fill="url(#skinGradient)" stroke="#d4b896" strokeWidth="0.5" />
        <path d="M258 165 Q262 175 258 185" stroke="#d4b896" strokeWidth="1" fill="none" />

        {/* Sobrancelhas */}
        <path
          d="M85 118 Q105 108 130 115"
          stroke="#5c4a3a"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M170 115 Q195 108 215 118"
          stroke="#5c4a3a"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />

        {/* Olho esquerdo */}
        <g>
          {/* Cavidade do olho */}
          <ellipse cx="110" cy="145" rx="28" ry="15" fill="#f0e6dc" />
          {/* Branco do olho */}
          <ellipse cx="110" cy="145" rx="22" ry="12" fill="white" />
          {/* Íris */}
          <circle cx="110" cy="145" r="9" fill="#6b5344" />
          {/* Pupila */}
          <circle cx="110" cy="145" r="4" fill="#1a1a1a" />
          {/* Brilho */}
          <circle cx="107" cy="142" r="2" fill="white" opacity="0.8" />
          {/* Pálpebra superior */}
          <path d="M85 140 Q110 130 135 140" stroke="#8b7355" strokeWidth="1.5" fill="none" />
          {/* Cílios */}
          <path d="M88 138 Q110 128 132 138" stroke="#4a3728" strokeWidth="0.8" fill="none" />
        </g>

        {/* Olho direito */}
        <g>
          {/* Cavidade do olho */}
          <ellipse cx="190" cy="145" rx="28" ry="15" fill="#f0e6dc" />
          {/* Branco do olho */}
          <ellipse cx="190" cy="145" rx="22" ry="12" fill="white" />
          {/* Íris */}
          <circle cx="190" cy="145" r="9" fill="#6b5344" />
          {/* Pupila */}
          <circle cx="190" cy="145" r="4" fill="#1a1a1a" />
          {/* Brilho */}
          <circle cx="187" cy="142" r="2" fill="white" opacity="0.8" />
          {/* Pálpebra superior */}
          <path d="M165 140 Q190 130 215 140" stroke="#8b7355" strokeWidth="1.5" fill="none" />
          {/* Cílios */}
          <path d="M168 138 Q190 128 212 138" stroke="#4a3728" strokeWidth="0.8" fill="none" />
        </g>

        {/* Nariz */}
        <g>
          {/* Ponte do nariz */}
          <path
            d="M150 125 L150 195"
            stroke="#d4b896"
            strokeWidth="1"
            fill="none"
          />
          {/* Sombra lateral */}
          <path
            d="M145 130 Q140 160 138 190"
            stroke="#e0c9b5"
            strokeWidth="2"
            fill="none"
            opacity="0.5"
          />
          <path
            d="M155 130 Q160 160 162 190"
            stroke="#e0c9b5"
            strokeWidth="2"
            fill="none"
            opacity="0.5"
          />
          {/* Ponta do nariz */}
          <ellipse cx="150" cy="200" rx="12" ry="8" fill="url(#skinGradient)" />
          {/* Narinas */}
          <ellipse cx="140" cy="205" rx="6" ry="4" fill="#d4a989" opacity="0.6" />
          <ellipse cx="160" cy="205" rx="6" ry="4" fill="#d4a989" opacity="0.6" />
          {/* Base do nariz */}
          <path d="M130 208 Q150 218 170 208" stroke="#d4b896" strokeWidth="1" fill="none" />
        </g>

        {/* Boca */}
        <g>
          {/* Filtro labial */}
          <path d="M145 215 L150 225 L155 215" stroke="#d4b896" strokeWidth="0.8" fill="none" />
          
          {/* Lábio superior */}
          <path
            d="M115 245
               Q125 238 140 240
               Q150 235 160 240
               Q175 238 185 245
               Q175 248 160 247
               Q150 252 140 247
               Q125 248 115 245"
            fill="url(#lipGradient)"
          />
          
          {/* Linha da boca */}
          <path
            d="M118 248 Q150 255 182 248"
            stroke="#c88880"
            strokeWidth="1"
            fill="none"
          />
          
          {/* Lábio inferior */}
          <path
            d="M118 248
               Q125 252 140 253
               Q150 258 160 253
               Q175 252 182 248
               Q175 268 150 272
               Q125 268 118 248"
            fill="url(#lipGradient)"
          />
          
          {/* Brilho do lábio */}
          <ellipse cx="150" cy="260" rx="15" ry="5" fill="white" opacity="0.15" />
        </g>

        {/* Queixo */}
        <ellipse cx="150" cy="320" rx="25" ry="15" fill="url(#shadowGradient)" opacity="0.2" />

        {/* Maçãs do rosto */}
        <ellipse cx="85" cy="190" rx="20" ry="12" fill="#f5c4b8" opacity="0.25" />
        <ellipse cx="215" cy="190" rx="20" ry="12" fill="#f5c4b8" opacity="0.25" />

        {/* Regiões de referência para injetáveis */}
        {showRegions && (
          <g opacity="0.4">
            {/* Linhas guia horizontais */}
            <line x1="60" y1="100" x2="240" y2="100" stroke="#94a3b8" strokeWidth="0.5" strokeDasharray="4 4" />
            <line x1="60" y1="145" x2="240" y2="145" stroke="#94a3b8" strokeWidth="0.5" strokeDasharray="4 4" />
            <line x1="60" y1="200" x2="240" y2="200" stroke="#94a3b8" strokeWidth="0.5" strokeDasharray="4 4" />
            <line x1="60" y1="245" x2="240" y2="245" stroke="#94a3b8" strokeWidth="0.5" strokeDasharray="4 4" />
            <line x1="60" y1="290" x2="240" y2="290" stroke="#94a3b8" strokeWidth="0.5" strokeDasharray="4 4" />
            
            {/* Linha central vertical */}
            <line x1="150" y1="50" x2="150" y2="360" stroke="#94a3b8" strokeWidth="0.5" strokeDasharray="4 4" />

            {/* Labels das regiões */}
            <text x="150" y="75" textAnchor="middle" fontSize="8" fill="#64748b" fontFamily="system-ui">TESTA</text>
            <text x="150" y="125" textAnchor="middle" fontSize="8" fill="#64748b" fontFamily="system-ui">GLABELA</text>
            <text x="75" y="145" textAnchor="middle" fontSize="7" fill="#64748b" fontFamily="system-ui">PERIORBITAL</text>
            <text x="225" y="145" textAnchor="middle" fontSize="7" fill="#64748b" fontFamily="system-ui">PERIORBITAL</text>
            <text x="75" y="195" textAnchor="middle" fontSize="7" fill="#64748b" fontFamily="system-ui">ZIGOMÁTICO</text>
            <text x="225" y="195" textAnchor="middle" fontSize="7" fill="#64748b" fontFamily="system-ui">ZIGOMÁTICO</text>
            <text x="150" y="230" textAnchor="middle" fontSize="8" fill="#64748b" fontFamily="system-ui">NASOLABIAL</text>
            <text x="150" y="280" textAnchor="middle" fontSize="8" fill="#64748b" fontFamily="system-ui">LÁBIOS</text>
            <text x="75" y="310" textAnchor="middle" fontSize="7" fill="#64748b" fontFamily="system-ui">MANDÍBULA</text>
            <text x="225" y="310" textAnchor="middle" fontSize="7" fill="#64748b" fontFamily="system-ui">MANDÍBULA</text>
            <text x="150" y="340" textAnchor="middle" fontSize="8" fill="#64748b" fontFamily="system-ui">MENTO</text>
          </g>
        )}

        {/* Pontos de injeção renderizados aqui */}
        {children}
      </svg>
    )
  }
)

FaceMap.displayName = 'FaceMap'

export default FaceMap
