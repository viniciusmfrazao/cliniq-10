'use client'

import { forwardRef } from 'react'

type FaceMapProps = {
  onClick?: (e: React.MouseEvent<SVGSVGElement>) => void
  children?: React.ReactNode
  showRegions?: boolean
  showMuscles?: boolean
  view?: 'front' | 'side-left' | 'side-right'
  gender?: 'female' | 'male'
}

export const FaceMap = forwardRef<SVGSVGElement, FaceMapProps>(
  ({ onClick, children, showRegions = true, showMuscles = false, view = 'front', gender = 'female' }, ref) => {
    
    if (view === 'side-left' || view === 'side-right') {
      const isLeft = view === 'side-left'
      return (
        <svg
          ref={ref}
          viewBox="0 0 280 400"
          className="w-full max-w-[280px] mx-auto cursor-crosshair select-none"
          onClick={onClick}
          style={{ transform: isLeft ? 'scaleX(-1)' : 'none' }}
        >
          <defs>
            <linearGradient id="skinSide" x1="0%" y1="0%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="#fce4d6" />
              <stop offset="40%" stopColor="#f5d5c8" />
              <stop offset="100%" stopColor="#e8c4b8" />
            </linearGradient>
            <linearGradient id="shadowSide" x1="100%" y1="0%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#d4a989" stopOpacity="0" />
              <stop offset="100%" stopColor="#c99b7a" stopOpacity="0.4" />
            </linearGradient>
            <linearGradient id="lipSide" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#e8a5a0" />
              <stop offset="100%" stopColor="#d4918a" />
            </linearGradient>
            <linearGradient id="hairSide" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3d2b1f" />
              <stop offset="100%" stopColor="#2a1d14" />
            </linearGradient>
          </defs>

          {/* Pescoço */}
          <path d="M140 340 Q120 360 115 400 L185 400 Q175 370 165 340" fill="url(#skinSide)" />
          
          {/* Contorno do rosto - perfil */}
          <path
            d="M70 120
               C70 80 100 45 140 40
               L180 45
               C200 50 210 70 210 100
               L210 140
               Q215 160 210 180
               L190 185
               Q180 195 175 210
               L175 225
               Q185 235 180 250
               Q175 258 165 260
               L155 262
               Q145 270 140 285
               Q130 320 140 340
               Q120 345 100 320
               Q75 280 70 230
               Q65 180 70 120"
            fill="url(#skinSide)"
            stroke="#d4b896"
            strokeWidth="1"
          />

          {/* Sombra da bochecha */}
          <path
            d="M75 180 Q85 220 100 260 Q80 240 75 200 Q72 180 75 160"
            fill="url(#shadowSide)"
          />

          {/* Cabelo perfil */}
          <path
            d="M70 120
               C70 70 110 30 160 30
               C200 30 220 50 225 90
               L215 100
               C210 70 190 50 160 50
               C120 50 90 80 85 120
               L70 120"
            fill="url(#hairSide)"
          />
          <path
            d="M85 120 Q75 100 80 70 Q90 50 120 45"
            fill="url(#hairSide)"
          />

          {/* Orelha */}
          <ellipse cx="75" cy="175" rx="15" ry="30" fill="url(#skinSide)" stroke="#d4b896" strokeWidth="0.5" />
          <path d="M68 160 Q60 175 68 190" stroke="#d4a989" strokeWidth="1.5" fill="none" />
          <path d="M72 165 Q65 175 72 185" stroke="#d4a989" strokeWidth="1" fill="none" />

          {/* Sobrancelha */}
          <path
            d="M130 115 Q150 105 180 115"
            stroke="#4a3728"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />

          {/* Olho perfil */}
          <g>
            <path d="M135 145 Q160 135 180 145 Q160 155 135 145" fill="white" stroke="#8b7355" strokeWidth="0.5" />
            <ellipse cx="158" cy="145" rx="10" ry="8" fill="#6b5344" />
            <circle cx="160" cy="145" r="4" fill="#1a1a1a" />
            <circle cx="158" cy="143" r="1.5" fill="white" opacity="0.8" />
            <path d="M135 143 Q160 133 182 143" stroke="#4a3728" strokeWidth="0.8" fill="none" />
          </g>

          {/* Nariz perfil */}
          <path
            d="M175 130
               Q200 150 195 180
               Q190 195 175 210
               L165 205
               Q175 195 178 185
               Q180 170 175 155"
            fill="url(#skinSide)"
            stroke="#d4b896"
            strokeWidth="0.5"
          />
          <circle cx="178" cy="200" r="8" fill="url(#skinSide)" />

          {/* Boca perfil */}
          <path
            d="M130 250 Q155 245 175 250"
            stroke="url(#lipSide)"
            strokeWidth="8"
            strokeLinecap="round"
            fill="none"
          />
          <path d="M130 250 Q150 255 170 250" stroke="#c88880" strokeWidth="1" fill="none" />
          <path
            d="M130 252 Q150 262 165 255"
            stroke="url(#lipSide)"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />

          {/* Queixo */}
          <path
            d="M140 285 Q160 290 165 260"
            stroke="#d4b896"
            strokeWidth="0.5"
            fill="none"
          />

          {/* Mandíbula */}
          <path
            d="M100 320 Q80 300 75 250"
            stroke="#d4b896"
            strokeWidth="0.5"
            fill="none"
          />

          {showRegions && (
            <g opacity="0.5">
              <text x="150" y="70" fontSize="7" fill="#64748b" fontFamily="system-ui">TEMPORAL</text>
              <text x="160" y="120" fontSize="7" fill="#64748b" fontFamily="system-ui">FRONTAL</text>
              <text x="165" y="170" fontSize="7" fill="#64748b" fontFamily="system-ui">PERIORBITAL</text>
              <text x="100" y="220" fontSize="7" fill="#64748b" fontFamily="system-ui">ZIGOMÁTICO</text>
              <text x="120" y="270" fontSize="7" fill="#64748b" fontFamily="system-ui">LABIAL</text>
              <text x="95" y="310" fontSize="7" fill="#64748b" fontFamily="system-ui">MANDÍBULA</text>
            </g>
          )}

          {children}
        </svg>
      )
    }
    
    // Vista frontal
    return (
      <svg
        ref={ref}
        viewBox="0 0 320 420"
        className="w-full max-w-[340px] mx-auto cursor-crosshair select-none"
        onClick={onClick}
      >
        <defs>
          {/* Gradientes para pele realista */}
          <radialGradient id="skinBase" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#fce8d8" />
            <stop offset="50%" stopColor="#f5dcc8" />
            <stop offset="100%" stopColor="#e8ccb8" />
          </radialGradient>
          
          <linearGradient id="skinHighlight" x1="30%" y1="0%" x2="70%" y2="100%">
            <stop offset="0%" stopColor="#fff5ee" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#fff5ee" stopOpacity="0" />
            <stop offset="100%" stopColor="#d4a989" stopOpacity="0.2" />
          </linearGradient>

          <linearGradient id="shadowLeft" x1="100%" y1="0%" x2="0%" y2="50%">
            <stop offset="0%" stopColor="#d4a989" stopOpacity="0" />
            <stop offset="100%" stopColor="#c99b7a" stopOpacity="0.35" />
          </linearGradient>
          
          <linearGradient id="shadowRight" x1="0%" y1="0%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#d4a989" stopOpacity="0" />
            <stop offset="100%" stopColor="#c99b7a" stopOpacity="0.25" />
          </linearGradient>

          <linearGradient id="lipGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#e8a5a0" />
            <stop offset="50%" stopColor="#dc918a" />
            <stop offset="100%" stopColor="#d08580" />
          </linearGradient>
          
          <linearGradient id="lipHighlight" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="50%" stopColor="white" stopOpacity="0.2" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="hairGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3d2b1f" />
            <stop offset="100%" stopColor="#2a1d14" />
          </linearGradient>
          
          <linearGradient id="hairHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5c4030" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#2a1d14" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="eyebrowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4a3728" />
            <stop offset="100%" stopColor="#3d2b1f" />
          </linearGradient>

          <linearGradient id="irisGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7a6350" />
            <stop offset="50%" stopColor="#5c4a3a" />
            <stop offset="100%" stopColor="#4a3828" />
          </linearGradient>

          <filter id="softBlur" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="0.5" />
          </filter>
          
          <filter id="innerShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feOffset dx="0" dy="2" />
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Fundo suave */}
        <rect x="0" y="0" width="320" height="420" fill="#fafafa" />

        {/* Pescoço */}
        <path
          d="M115 355 Q100 380 95 420 L225 420 Q220 380 205 355"
          fill="url(#skinBase)"
        />
        <ellipse cx="160" cy="395" rx="60" ry="25" fill="url(#skinBase)" />

        {/* Sombra do pescoço */}
        <path
          d="M115 355 Q130 365 160 368 Q190 365 205 355"
          fill="#d4a989"
          opacity="0.3"
        />

        {/* Contorno do rosto - formato oval anatômico feminino */}
        <path
          d="M160 50
             C230 50 270 100 270 165
             C270 220 265 270 248 310
             C230 350 198 375 160 380
             C122 375 90 350 72 310
             C55 270 50 220 50 165
             C50 100 90 50 160 50"
          fill="url(#skinBase)"
          stroke="#d4b896"
          strokeWidth="0.5"
        />

        {/* Highlight central */}
        <ellipse cx="160" cy="180" rx="80" ry="120" fill="url(#skinHighlight)" />

        {/* Sombras laterais */}
        <path
          d="M50 165 C50 220 55 270 72 310 Q60 280 55 230 Q50 180 55 140 Q60 110 80 85"
          fill="url(#shadowLeft)"
        />
        <path
          d="M270 165 C270 220 265 270 248 310 Q260 280 265 230 Q270 180 265 140 Q260 110 240 85"
          fill="url(#shadowRight)"
        />

        {/* Cabelo */}
        <path
          d="M160 32
             C240 32 285 85 285 155
             Q285 120 270 90
             C250 55 210 38 160 38
             C110 38 70 55 50 90
             Q35 120 35 155
             C35 85 80 32 160 32"
          fill="url(#hairGradient)"
        />
        <path
          d="M160 38
             C210 38 250 55 270 90
             Q255 70 230 55
             C200 40 160 38 160 38"
          fill="url(#hairHighlight)"
        />
        
        {/* Franja sutil */}
        <path
          d="M80 70 Q100 55 130 52 Q160 50 190 52 Q220 55 240 70
             Q220 65 190 60 Q160 58 130 60 Q100 65 80 70"
          fill="url(#hairGradient)"
        />

        {/* Orelhas */}
        <g>
          {/* Orelha esquerda */}
          <ellipse cx="48" cy="185" rx="14" ry="28" fill="url(#skinBase)" stroke="#d4b896" strokeWidth="0.3" />
          <path d="M40 172 Q34 185 40 198" stroke="#d4a989" strokeWidth="1.5" fill="none" opacity="0.6" />
          <path d="M44 176 Q38 185 44 194" stroke="#d4a989" strokeWidth="1" fill="none" opacity="0.4" />
          
          {/* Orelha direita */}
          <ellipse cx="272" cy="185" rx="14" ry="28" fill="url(#skinBase)" stroke="#d4b896" strokeWidth="0.3" />
          <path d="M280 172 Q286 185 280 198" stroke="#d4a989" strokeWidth="1.5" fill="none" opacity="0.6" />
          <path d="M276 176 Q282 185 276 194" stroke="#d4a989" strokeWidth="1" fill="none" opacity="0.4" />
        </g>

        {/* Sobrancelhas */}
        <g>
          {/* Sobrancelha esquerda */}
          <path
            d="M88 125 Q95 117 115 115 Q135 114 148 120"
            stroke="url(#eyebrowGrad)"
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M90 124 Q100 118 120 117 Q140 117 147 121"
            stroke="#5c4a3a"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
            opacity="0.5"
          />
          
          {/* Sobrancelha direita */}
          <path
            d="M172 120 Q185 114 205 115 Q225 117 232 125"
            stroke="url(#eyebrowGrad)"
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M173 121 Q180 117 200 117 Q220 118 230 124"
            stroke="#5c4a3a"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
            opacity="0.5"
          />
        </g>

        {/* Olhos */}
        <g>
          {/* Olho esquerdo */}
          <g>
            {/* Sombra da cavidade */}
            <ellipse cx="118" cy="152" rx="32" ry="18" fill="#f0e6dc" opacity="0.5" />
            
            {/* Forma do olho */}
            <path
              d="M88 155 Q105 140 118 140 Q131 140 148 155 Q131 168 118 168 Q105 168 88 155"
              fill="white"
              stroke="#c9b8a8"
              strokeWidth="0.5"
            />
            
            {/* Íris */}
            <circle cx="118" cy="154" r="13" fill="url(#irisGrad)" />
            
            {/* Anel da íris */}
            <circle cx="118" cy="154" r="13" fill="none" stroke="#4a3828" strokeWidth="1" opacity="0.3" />
            
            {/* Pupila */}
            <circle cx="118" cy="154" r="5" fill="#0a0a0a" />
            
            {/* Reflexos */}
            <circle cx="114" cy="150" r="3" fill="white" opacity="0.9" />
            <circle cx="122" cy="157" r="1.5" fill="white" opacity="0.5" />
            
            {/* Pálpebra superior */}
            <path
              d="M88 155 Q105 138 118 138 Q131 138 148 155"
              stroke="#9a8878"
              strokeWidth="2"
              fill="none"
            />
            
            {/* Linha dos cílios */}
            <path
              d="M90 153 Q105 140 118 140 Q131 140 146 153"
              stroke="#3d2b1f"
              strokeWidth="1.5"
              fill="none"
            />
            
            {/* Cílios */}
            <g stroke="#2a1d14" strokeWidth="0.8" fill="none">
              <path d="M92 152 Q90 148 88 145" />
              <path d="M98 148 Q96 143 94 140" />
              <path d="M105 145 Q104 140 103 136" />
              <path d="M112 143 Q112 138 112 134" />
              <path d="M118 142 Q118 137 118 133" />
              <path d="M124 143 Q124 138 124 134" />
              <path d="M131 145 Q132 140 133 136" />
              <path d="M138 148 Q140 143 142 140" />
              <path d="M144 152 Q146 148 148 145" />
            </g>
            
            {/* Pálpebra inferior sutil */}
            <path
              d="M92 158 Q105 166 118 166 Q131 166 144 158"
              stroke="#c9b8a8"
              strokeWidth="0.8"
              fill="none"
            />
          </g>

          {/* Olho direito */}
          <g>
            {/* Sombra da cavidade */}
            <ellipse cx="202" cy="152" rx="32" ry="18" fill="#f0e6dc" opacity="0.5" />
            
            {/* Forma do olho */}
            <path
              d="M172 155 Q189 140 202 140 Q215 140 232 155 Q215 168 202 168 Q189 168 172 155"
              fill="white"
              stroke="#c9b8a8"
              strokeWidth="0.5"
            />
            
            {/* Íris */}
            <circle cx="202" cy="154" r="13" fill="url(#irisGrad)" />
            
            {/* Anel da íris */}
            <circle cx="202" cy="154" r="13" fill="none" stroke="#4a3828" strokeWidth="1" opacity="0.3" />
            
            {/* Pupila */}
            <circle cx="202" cy="154" r="5" fill="#0a0a0a" />
            
            {/* Reflexos */}
            <circle cx="198" cy="150" r="3" fill="white" opacity="0.9" />
            <circle cx="206" cy="157" r="1.5" fill="white" opacity="0.5" />
            
            {/* Pálpebra superior */}
            <path
              d="M172 155 Q189 138 202 138 Q215 138 232 155"
              stroke="#9a8878"
              strokeWidth="2"
              fill="none"
            />
            
            {/* Linha dos cílios */}
            <path
              d="M174 153 Q189 140 202 140 Q215 140 230 153"
              stroke="#3d2b1f"
              strokeWidth="1.5"
              fill="none"
            />
            
            {/* Cílios */}
            <g stroke="#2a1d14" strokeWidth="0.8" fill="none">
              <path d="M176 152 Q174 148 172 145" />
              <path d="M182 148 Q180 143 178 140" />
              <path d="M189 145 Q188 140 187 136" />
              <path d="M196 143 Q196 138 196 134" />
              <path d="M202 142 Q202 137 202 133" />
              <path d="M208 143 Q208 138 208 134" />
              <path d="M215 145 Q216 140 217 136" />
              <path d="M222 148 Q224 143 226 140" />
              <path d="M228 152 Q230 148 232 145" />
            </g>
            
            {/* Pálpebra inferior sutil */}
            <path
              d="M176 158 Q189 166 202 166 Q215 166 228 158"
              stroke="#c9b8a8"
              strokeWidth="0.8"
              fill="none"
            />
          </g>
        </g>

        {/* Nariz */}
        <g>
          {/* Ponte do nariz - sombras sutis */}
          <path
            d="M155 135 Q152 170 148 205"
            stroke="#dcc4b0"
            strokeWidth="3"
            fill="none"
            opacity="0.4"
          />
          <path
            d="M165 135 Q168 170 172 205"
            stroke="#dcc4b0"
            strokeWidth="3"
            fill="none"
            opacity="0.3"
          />
          
          {/* Linha central do nariz */}
          <path
            d="M160 130 L160 205"
            stroke="#d4b896"
            strokeWidth="0.5"
            fill="none"
            opacity="0.5"
          />
          
          {/* Ponta do nariz */}
          <ellipse cx="160" cy="212" rx="15" ry="10" fill="url(#skinBase)" />
          <ellipse cx="160" cy="210" rx="10" ry="6" fill="#fff5ee" opacity="0.3" />
          
          {/* Narinas */}
          <ellipse cx="148" cy="218" rx="8" ry="5" fill="#d4a989" opacity="0.5" />
          <ellipse cx="172" cy="218" rx="8" ry="5" fill="#d4a989" opacity="0.5" />
          
          {/* Sombra interna narinas */}
          <ellipse cx="148" cy="218" rx="5" ry="3" fill="#c49a7a" opacity="0.4" />
          <ellipse cx="172" cy="218" rx="5" ry="3" fill="#c49a7a" opacity="0.4" />
          
          {/* Base do nariz */}
          <path
            d="M138 222 Q160 232 182 222"
            stroke="#d4b896"
            strokeWidth="1"
            fill="none"
            opacity="0.6"
          />
        </g>

        {/* Filtro labial */}
        <path
          d="M155 228 L160 240 L165 228"
          stroke="#d4b896"
          strokeWidth="0.8"
          fill="none"
          opacity="0.5"
        />

        {/* Boca */}
        <g>
          {/* Lábio superior */}
          <path
            d="M122 260
               Q135 252 150 255
               Q160 248 170 255
               Q185 252 198 260
               Q185 265 170 263
               Q160 270 150 263
               Q135 265 122 260"
            fill="url(#lipGradient)"
          />
          
          {/* Arco do cupido */}
          <path
            d="M150 255 Q155 252 160 248 Q165 252 170 255"
            fill="url(#lipGradient)"
          />
          
          {/* Highlight lábio superior */}
          <path
            d="M145 255 Q160 250 175 255"
            stroke="white"
            strokeWidth="1.5"
            fill="none"
            opacity="0.2"
          />
          
          {/* Linha da boca */}
          <path
            d="M125 262 Q160 270 195 262"
            stroke="#c88880"
            strokeWidth="1.2"
            fill="none"
          />
          
          {/* Lábio inferior */}
          <path
            d="M125 262
               Q135 268 150 270
               Q160 275 170 270
               Q185 268 195 262
               Q185 285 160 290
               Q135 285 125 262"
            fill="url(#lipGradient)"
          />
          
          {/* Highlight lábio inferior */}
          <ellipse cx="160" cy="275" rx="20" ry="8" fill="url(#lipHighlight)" />
          
          {/* Sombra abaixo do lábio */}
          <path
            d="M140 292 Q160 298 180 292"
            stroke="#d4a989"
            strokeWidth="2"
            fill="none"
            opacity="0.3"
          />
        </g>

        {/* Maçãs do rosto (blush sutil) */}
        <ellipse cx="88" cy="200" rx="25" ry="15" fill="#f5c4b8" opacity="0.2" />
        <ellipse cx="232" cy="200" rx="25" ry="15" fill="#f5c4b8" opacity="0.2" />

        {/* Queixo - sombra sutil */}
        <ellipse cx="160" cy="340" rx="30" ry="18" fill="#d4a989" opacity="0.15" />

        {/* Linha da mandíbula */}
        <path
          d="M72 310 Q90 330 120 345"
          stroke="#d4b896"
          strokeWidth="0.5"
          fill="none"
          opacity="0.4"
        />
        <path
          d="M248 310 Q230 330 200 345"
          stroke="#d4b896"
          strokeWidth="0.5"
          fill="none"
          opacity="0.4"
        />

        {/* Regiões de injetáveis */}
        {showRegions && (
          <g>
            {/* Grid sutil */}
            <g stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.4">
              <line x1="60" y1="105" x2="260" y2="105" />
              <line x1="60" y1="155" x2="260" y2="155" />
              <line x1="60" y1="210" x2="260" y2="210" />
              <line x1="60" y1="265" x2="260" y2="265" />
              <line x1="60" y1="310" x2="260" y2="310" />
              <line x1="160" y1="55" x2="160" y2="375" />
            </g>

            {/* Labels das regiões */}
            <g fontFamily="system-ui, -apple-system, sans-serif" fontSize="9" fontWeight="500">
              <text x="160" y="82" textAnchor="middle" fill="#475569">FRONTAL</text>
              <text x="160" y="135" textAnchor="middle" fill="#475569">GLABELA</text>
              <text x="78" y="155" textAnchor="middle" fill="#475569" fontSize="8">PERIORBITAL</text>
              <text x="242" y="155" textAnchor="middle" fill="#475569" fontSize="8">PERIORBITAL</text>
              <text x="78" y="200" textAnchor="middle" fill="#475569" fontSize="8">ZIGOMÁTICO</text>
              <text x="242" y="200" textAnchor="middle" fill="#475569" fontSize="8">ZIGOMÁTICO</text>
              <text x="160" y="245" textAnchor="middle" fill="#475569">NASOLABIAL</text>
              <text x="160" y="300" textAnchor="middle" fill="#475569">LABIAL</text>
              <text x="78" y="325" textAnchor="middle" fill="#475569" fontSize="8">MANDÍBULA</text>
              <text x="242" y="325" textAnchor="middle" fill="#475569" fontSize="8">MANDÍBULA</text>
              <text x="160" y="360" textAnchor="middle" fill="#475569">MENTO</text>
            </g>
          </g>
        )}

        {/* Camada de músculos (opcional) */}
        {showMuscles && (
          <g opacity="0.15" stroke="#8b5cf6" strokeWidth="1" fill="none">
            {/* Frontal */}
            <path d="M100 70 Q160 60 220 70 Q220 100 160 95 Q100 100 100 70" />
            {/* Corrugador */}
            <ellipse cx="130" cy="120" rx="20" ry="8" />
            <ellipse cx="190" cy="120" rx="20" ry="8" />
            {/* Orbicular dos olhos */}
            <ellipse cx="118" cy="154" rx="35" ry="22" />
            <ellipse cx="202" cy="154" rx="35" ry="22" />
            {/* Zigomático */}
            <path d="M75 190 Q100 220 130 250" />
            <path d="M245 190 Q220 220 190 250" />
            {/* Orbicular da boca */}
            <ellipse cx="160" cy="268" rx="40" ry="25" />
            {/* Mentoniano */}
            <ellipse cx="160" cy="330" rx="25" ry="15" />
          </g>
        )}

        {/* Pontos de injeção renderizados */}
        {children}
      </svg>
    )
  }
)

FaceMap.displayName = 'FaceMap'

export default FaceMap
