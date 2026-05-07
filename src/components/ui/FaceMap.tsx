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
    const isMale = gender === 'male'
    
    // Cores de pele (levemente diferente para masculino - menos rosado)
    const skinColors = isMale 
      ? { base: '#f0d9c8', mid: '#e8ccb8', shadow: '#d4a989' }
      : { base: '#fce8d8', mid: '#f5dcc8', shadow: '#e8ccb8' }
    
    // Cor dos lábios (masculino mais neutro)
    const lipColors = isMale
      ? { top: '#d4a090', bottom: '#c99585' }
      : { top: '#e8a5a0', bottom: '#d4918a' }
    
    // Cabelo
    const hairColor = isMale ? '#2a1d14' : '#3d2b1f'
    
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
              <stop offset="0%" stopColor={skinColors.base} />
              <stop offset="40%" stopColor={skinColors.mid} />
              <stop offset="100%" stopColor={skinColors.shadow} />
            </linearGradient>
            <linearGradient id="shadowSide" x1="100%" y1="0%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#d4a989" stopOpacity="0" />
              <stop offset="100%" stopColor="#c99b7a" stopOpacity="0.4" />
            </linearGradient>
            <linearGradient id="lipSide" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={lipColors.top} />
              <stop offset="100%" stopColor={lipColors.bottom} />
            </linearGradient>
            <linearGradient id="hairSide" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={hairColor} />
              <stop offset="100%" stopColor="#1a1208" />
            </linearGradient>
          </defs>

          {/* Pescoço - mais largo para masculino */}
          <path 
            d={isMale 
              ? "M130 340 Q105 360 100 400 L195 400 Q185 365 175 340" 
              : "M140 340 Q120 360 115 400 L185 400 Q175 370 165 340"
            } 
            fill="url(#skinSide)" 
          />
          
          {/* Contorno do rosto - perfil mais angular para masculino */}
          <path
            d={isMale
              ? `M70 110
                 C70 70 105 40 150 35
                 L185 40
                 C210 50 225 75 225 110
                 L225 145
                 Q230 165 225 185
                 L200 190
                 Q185 200 180 220
                 L180 235
                 Q195 245 188 265
                 Q180 275 168 278
                 L158 280
                 Q148 290 145 310
                 Q140 340 150 355
                 Q125 360 95 330
                 Q65 290 60 235
                 Q55 175 65 110
                 Z`
              : `M70 120
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
                 Q65 180 70 120`
            }
            fill="url(#skinSide)"
            stroke="#d4b896"
            strokeWidth="1"
          />

          {/* Sombra da bochecha */}
          <path
            d="M75 180 Q85 220 100 260 Q80 240 75 200 Q72 180 75 160"
            fill="url(#shadowSide)"
          />

          {/* Cabelo perfil - curto para masculino */}
          {isMale ? (
            <g>
              <path
                d="M65 110
                   C65 55 115 25 170 25
                   C215 25 240 50 245 95
                   L235 100
                   C230 60 200 40 165 40
                   C120 40 85 70 80 115
                   L65 110"
                fill="url(#hairSide)"
              />
              <path
                d="M80 110 Q70 85 85 55 Q105 35 140 30"
                fill="url(#hairSide)"
              />
              {/* Barba/Sombra de barba opcional */}
              <path
                d="M95 320 Q80 300 75 270 Q80 290 95 305"
                fill="#d4a989"
                opacity="0.15"
              />
            </g>
          ) : (
            <g>
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
            </g>
          )}

          {/* Orelha */}
          <ellipse cx="75" cy="175" rx="15" ry="30" fill="url(#skinSide)" stroke="#d4b896" strokeWidth="0.5" />
          <path d="M68 160 Q60 175 68 190" stroke="#d4a989" strokeWidth="1.5" fill="none" opacity="0.6" />

          {/* Sobrancelha - mais grossa para masculino */}
          <path
            d={isMale ? "M135 110 Q160 98 195 108" : "M130 115 Q150 105 180 115"}
            stroke="#4a3728"
            strokeWidth={isMale ? 5 : 3}
            strokeLinecap="round"
            fill="none"
          />

          {/* Olho perfil */}
          <g>
            <path d="M140 150 Q165 138 190 150 Q165 162 140 150" fill="white" stroke="#8b7355" strokeWidth="0.5" />
            <ellipse cx="165" cy="150" rx="10" ry="8" fill="#6b5344" />
            <circle cx="167" cy="150" r="4" fill="#1a1a1a" />
            <circle cx="165" cy="148" r="1.5" fill="white" opacity="0.8" />
            {!isMale && (
              <path d="M140 148 Q165 136 188 148" stroke="#4a3728" strokeWidth="0.8" fill="none" />
            )}
          </g>

          {/* Nariz perfil - mais proeminente para masculino */}
          <path
            d={isMale
              ? `M185 125
                 Q215 150 210 185
                 Q205 205 185 220
                 L172 215
                 Q185 200 190 185
                 Q195 165 185 145`
              : `M175 130
                 Q200 150 195 180
                 Q190 195 175 210
                 L165 205
                 Q175 195 178 185
                 Q180 170 175 155`
            }
            fill="url(#skinSide)"
            stroke="#d4b896"
            strokeWidth="0.5"
          />
          <circle cx={isMale ? 190 : 178} cy={isMale ? 210 : 200} r="8" fill="url(#skinSide)" />

          {/* Boca perfil - menos volumosa para masculino */}
          <path
            d={isMale ? "M135 265 Q160 260 180 265" : "M130 250 Q155 245 175 250"}
            stroke="url(#lipSide)"
            strokeWidth={isMale ? 6 : 8}
            strokeLinecap="round"
            fill="none"
          />
          <path 
            d={isMale ? "M135 265 Q155 270 175 265" : "M130 250 Q150 255 170 250"} 
            stroke={lipColors.bottom} 
            strokeWidth="1" 
            fill="none" 
          />
          <path
            d={isMale ? "M135 267 Q155 275 170 270" : "M130 252 Q150 262 165 255"}
            stroke="url(#lipSide)"
            strokeWidth={isMale ? 5 : 6}
            strokeLinecap="round"
            fill="none"
          />

          {/* Queixo/Mandíbula - mais forte para masculino */}
          <path
            d={isMale
              ? "M145 310 Q170 320 175 278"
              : "M140 285 Q160 290 165 260"
            }
            stroke="#d4b896"
            strokeWidth="0.5"
            fill="none"
          />
          <path
            d={isMale
              ? "M95 330 Q70 305 65 255"
              : "M100 320 Q80 300 75 250"
            }
            stroke="#d4b896"
            strokeWidth="0.5"
            fill="none"
          />

          {showRegions && (
            <g opacity="0.5">
              <text x="150" y="70" fontSize="7" fill="#64748b" fontFamily="system-ui">TEMPORAL</text>
              <text x="165" y="120" fontSize="7" fill="#64748b" fontFamily="system-ui">FRONTAL</text>
              <text x="170" y="170" fontSize="7" fill="#64748b" fontFamily="system-ui">PERIORBITAL</text>
              <text x="100" y="220" fontSize="7" fill="#64748b" fontFamily="system-ui">ZIGOMÁTICO</text>
              <text x="120" y={isMale ? 285 : 270} fontSize="7" fill="#64748b" fontFamily="system-ui">LABIAL</text>
              <text x="95" y={isMale ? 320 : 310} fontSize="7" fill="#64748b" fontFamily="system-ui">MANDÍBULA</text>
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
          {/* Gradientes para pele */}
          <radialGradient id="skinBase" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor={skinColors.base} />
            <stop offset="50%" stopColor={skinColors.mid} />
            <stop offset="100%" stopColor={skinColors.shadow} />
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
            <stop offset="0%" stopColor={lipColors.top} />
            <stop offset="50%" stopColor={lipColors.bottom} />
            <stop offset="100%" stopColor={isMale ? '#c08575' : '#d08580'} />
          </linearGradient>
          
          <linearGradient id="lipHighlight" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="50%" stopColor="white" stopOpacity={isMale ? 0.1 : 0.2} />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="hairGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={hairColor} />
            <stop offset="100%" stopColor="#1a1208" />
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

          {/* Gradiente para barba/sombra masculina */}
          {isMale && (
            <radialGradient id="beardShadow" cx="50%" cy="80%" r="50%">
              <stop offset="0%" stopColor="#8a7a6a" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#8a7a6a" stopOpacity="0" />
            </radialGradient>
          )}
        </defs>

        {/* Fundo suave */}
        <rect x="0" y="0" width="320" height="420" fill="#fafafa" />

        {/* Pescoço - mais largo para masculino */}
        <path
          d={isMale
            ? "M105 355 Q85 380 80 420 L240 420 Q235 380 215 355"
            : "M115 355 Q100 380 95 420 L225 420 Q220 380 205 355"
          }
          fill="url(#skinBase)"
        />
        <ellipse cx="160" cy="395" rx={isMale ? 75 : 60} ry="25" fill="url(#skinBase)" />

        {/* Sombra do pescoço */}
        <path
          d={isMale
            ? "M105 355 Q140 368 160 370 Q180 368 215 355"
            : "M115 355 Q130 365 160 368 Q190 365 205 355"
          }
          fill="#d4a989"
          opacity="0.3"
        />

        {/* Contorno do rosto - mais angular/quadrado para masculino */}
        <path
          d={isMale
            ? `M160 45
               C240 45 285 100 285 170
               C285 225 280 275 260 318
               C240 360 205 385 160 390
               C115 385 80 360 60 318
               C40 275 35 225 35 170
               C35 100 80 45 160 45`
            : `M160 50
               C230 50 270 100 270 165
               C270 220 265 270 248 310
               C230 350 198 375 160 380
               C122 375 90 350 72 310
               C55 270 50 220 50 165
               C50 100 90 50 160 50`
          }
          fill="url(#skinBase)"
          stroke="#d4b896"
          strokeWidth="0.5"
        />

        {/* Highlight central */}
        <ellipse cx="160" cy="180" rx="80" ry="120" fill="url(#skinHighlight)" />

        {/* Sombras laterais */}
        <path
          d={isMale
            ? "M35 170 C35 225 40 275 60 318 Q45 285 40 235 Q35 180 45 135 Q55 100 85 75"
            : "M50 165 C50 220 55 270 72 310 Q60 280 55 230 Q50 180 55 140 Q60 110 80 85"
          }
          fill="url(#shadowLeft)"
        />
        <path
          d={isMale
            ? "M285 170 C285 225 280 275 260 318 Q275 285 280 235 Q285 180 275 135 Q265 100 235 75"
            : "M270 165 C270 220 265 270 248 310 Q260 280 265 230 Q270 180 265 140 Q260 110 240 85"
          }
          fill="url(#shadowRight)"
        />

        {/* Sombra de barba para masculino */}
        {isMale && (
          <g opacity="0.12">
            <ellipse cx="160" cy="320" rx="70" ry="50" fill="#8a7a6a" />
            <ellipse cx="160" cy="290" rx="55" ry="30" fill="#8a7a6a" />
            <path
              d="M85 250 Q90 290 100 320 Q120 350 160 360 Q200 350 220 320 Q230 290 235 250"
              fill="#8a7a6a"
            />
          </g>
        )}

        {/* Cabelo - curto para masculino, longo para feminino */}
        {isMale ? (
          <g>
            {/* Cabelo curto masculino */}
            <path
              d="M160 28
                 C250 28 300 85 300 165
                 Q300 120 280 85
                 C255 45 210 30 160 30
                 C110 30 65 45 40 85
                 Q20 120 20 165
                 C20 85 70 28 160 28"
              fill="url(#hairGradient)"
            />
            {/* Linha do cabelo mais definida */}
            <path
              d="M70 75 Q100 50 160 48 Q220 50 250 75"
              fill="url(#hairGradient)"
            />
          </g>
        ) : (
          <g>
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
          </g>
        )}

        {/* Orelhas */}
        <g>
          {/* Orelha esquerda */}
          <ellipse cx={isMale ? 33 : 48} cy="185" rx="14" ry="28" fill="url(#skinBase)" stroke="#d4b896" strokeWidth="0.3" />
          <path d={`M${isMale ? 25 : 40} 172 Q${isMale ? 19 : 34} 185 ${isMale ? 25 : 40} 198`} stroke="#d4a989" strokeWidth="1.5" fill="none" opacity="0.6" />
          
          {/* Orelha direita */}
          <ellipse cx={isMale ? 287 : 272} cy="185" rx="14" ry="28" fill="url(#skinBase)" stroke="#d4b896" strokeWidth="0.3" />
          <path d={`M${isMale ? 295 : 280} 172 Q${isMale ? 301 : 286} 185 ${isMale ? 295 : 280} 198`} stroke="#d4a989" strokeWidth="1.5" fill="none" opacity="0.6" />
        </g>

        {/* Sobrancelhas - mais grossas e retas para masculino */}
        <g>
          {isMale ? (
            <>
              {/* Sobrancelha esquerda masculina */}
              <path
                d="M80 122 Q95 112 125 112 Q150 113 158 118"
                stroke="url(#eyebrowGrad)"
                strokeWidth="7"
                strokeLinecap="round"
                fill="none"
              />
              {/* Sobrancelha direita masculina */}
              <path
                d="M162 118 Q170 113 195 112 Q225 112 240 122"
                stroke="url(#eyebrowGrad)"
                strokeWidth="7"
                strokeLinecap="round"
                fill="none"
              />
            </>
          ) : (
            <>
              {/* Sobrancelha esquerda feminina */}
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
              {/* Sobrancelha direita feminina */}
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
            </>
          )}
        </g>

        {/* Olhos */}
        <g>
          {/* Olho esquerdo */}
          <g>
            <ellipse cx="118" cy="152" rx="32" ry="18" fill="#f0e6dc" opacity="0.5" />
            <path
              d={isMale 
                ? "M86 155 Q103 142 118 142 Q133 142 150 155 Q133 166 118 166 Q103 166 86 155"
                : "M88 155 Q105 140 118 140 Q131 140 148 155 Q131 168 118 168 Q105 168 88 155"
              }
              fill="white"
              stroke="#c9b8a8"
              strokeWidth="0.5"
            />
            <circle cx="118" cy="154" r="13" fill="url(#irisGrad)" />
            <circle cx="118" cy="154" r="13" fill="none" stroke="#4a3828" strokeWidth="1" opacity="0.3" />
            <circle cx="118" cy="154" r="5" fill="#0a0a0a" />
            <circle cx="114" cy="150" r="3" fill="white" opacity="0.9" />
            <circle cx="122" cy="157" r="1.5" fill="white" opacity="0.5" />
            <path
              d={isMale
                ? "M86 155 Q103 140 118 140 Q133 140 150 155"
                : "M88 155 Q105 138 118 138 Q131 138 148 155"
              }
              stroke="#9a8878"
              strokeWidth="2"
              fill="none"
            />
            {/* Cílios - mais sutis para masculino */}
            {!isMale && (
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
            )}
            <path
              d="M92 158 Q105 166 118 166 Q131 166 144 158"
              stroke="#c9b8a8"
              strokeWidth="0.8"
              fill="none"
            />
          </g>

          {/* Olho direito */}
          <g>
            <ellipse cx="202" cy="152" rx="32" ry="18" fill="#f0e6dc" opacity="0.5" />
            <path
              d={isMale
                ? "M170 155 Q187 142 202 142 Q217 142 234 155 Q217 166 202 166 Q187 166 170 155"
                : "M172 155 Q189 140 202 140 Q215 140 232 155 Q215 168 202 168 Q189 168 172 155"
              }
              fill="white"
              stroke="#c9b8a8"
              strokeWidth="0.5"
            />
            <circle cx="202" cy="154" r="13" fill="url(#irisGrad)" />
            <circle cx="202" cy="154" r="13" fill="none" stroke="#4a3828" strokeWidth="1" opacity="0.3" />
            <circle cx="202" cy="154" r="5" fill="#0a0a0a" />
            <circle cx="198" cy="150" r="3" fill="white" opacity="0.9" />
            <circle cx="206" cy="157" r="1.5" fill="white" opacity="0.5" />
            <path
              d={isMale
                ? "M170 155 Q187 140 202 140 Q217 140 234 155"
                : "M172 155 Q189 138 202 138 Q215 138 232 155"
              }
              stroke="#9a8878"
              strokeWidth="2"
              fill="none"
            />
            {!isMale && (
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
            )}
            <path
              d="M176 158 Q189 166 202 166 Q215 166 228 158"
              stroke="#c9b8a8"
              strokeWidth="0.8"
              fill="none"
            />
          </g>
        </g>

        {/* Nariz - mais proeminente para masculino */}
        <g>
          <path
            d={isMale ? "M153 135 Q148 170 144 210" : "M155 135 Q152 170 148 205"}
            stroke="#dcc4b0"
            strokeWidth="3"
            fill="none"
            opacity="0.4"
          />
          <path
            d={isMale ? "M167 135 Q172 170 176 210" : "M165 135 Q168 170 172 205"}
            stroke="#dcc4b0"
            strokeWidth="3"
            fill="none"
            opacity="0.3"
          />
          <path
            d="M160 130 L160 205"
            stroke="#d4b896"
            strokeWidth="0.5"
            fill="none"
            opacity="0.5"
          />
          <ellipse cx="160" cy={isMale ? 218 : 212} rx={isMale ? 18 : 15} ry={isMale ? 12 : 10} fill="url(#skinBase)" />
          <ellipse cx="160" cy={isMale ? 215 : 210} rx="10" ry="6" fill="#fff5ee" opacity="0.3" />
          <ellipse cx={isMale ? 145 : 148} cy={isMale ? 225 : 218} rx={isMale ? 10 : 8} ry={isMale ? 6 : 5} fill="#d4a989" opacity="0.5" />
          <ellipse cx={isMale ? 175 : 172} cy={isMale ? 225 : 218} rx={isMale ? 10 : 8} ry={isMale ? 6 : 5} fill="#d4a989" opacity="0.5" />
          <ellipse cx={isMale ? 145 : 148} cy={isMale ? 225 : 218} rx="5" ry="3" fill="#c49a7a" opacity="0.4" />
          <ellipse cx={isMale ? 175 : 172} cy={isMale ? 225 : 218} rx="5" ry="3" fill="#c49a7a" opacity="0.4" />
          <path
            d={isMale ? "M132 232 Q160 245 188 232" : "M138 222 Q160 232 182 222"}
            stroke="#d4b896"
            strokeWidth="1"
            fill="none"
            opacity="0.6"
          />
        </g>

        {/* Filtro labial */}
        <path
          d={isMale ? "M155 238 L160 252 L165 238" : "M155 228 L160 240 L165 228"}
          stroke="#d4b896"
          strokeWidth="0.8"
          fill="none"
          opacity="0.5"
        />

        {/* Boca - menos volumosa para masculino */}
        <g>
          {isMale ? (
            <>
              {/* Lábio superior masculino */}
              <path
                d="M125 272
                   Q138 266 152 268
                   Q160 262 168 268
                   Q182 266 195 272
                   Q182 276 168 274
                   Q160 280 152 274
                   Q138 276 125 272"
                fill="url(#lipGradient)"
              />
              <path d="M152 268 Q157 264 160 260 Q163 264 168 268" fill="url(#lipGradient)" />
              <path d="M128 274 Q160 282 192 274" stroke="#b08070" strokeWidth="1" fill="none" />
              {/* Lábio inferior masculino */}
              <path
                d="M128 274
                   Q140 279 152 281
                   Q160 285 168 281
                   Q180 279 192 274
                   Q182 292 160 296
                   Q138 292 128 274"
                fill="url(#lipGradient)"
              />
            </>
          ) : (
            <>
              {/* Lábio superior feminino */}
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
              <path d="M150 255 Q155 252 160 248 Q165 252 170 255" fill="url(#lipGradient)" />
              <path d="M145 255 Q160 250 175 255" stroke="white" strokeWidth="1.5" fill="none" opacity="0.2" />
              <path d="M125 262 Q160 270 195 262" stroke="#c88880" strokeWidth="1.2" fill="none" />
              {/* Lábio inferior feminino */}
              <path
                d="M125 262
                   Q135 268 150 270
                   Q160 275 170 270
                   Q185 268 195 262
                   Q185 285 160 290
                   Q135 285 125 262"
                fill="url(#lipGradient)"
              />
              <ellipse cx="160" cy="275" rx="20" ry="8" fill="url(#lipHighlight)" />
            </>
          )}
          {/* Sombra abaixo do lábio */}
          <path
            d={isMale ? "M145 300 Q160 308 175 300" : "M140 292 Q160 298 180 292"}
            stroke="#d4a989"
            strokeWidth="2"
            fill="none"
            opacity="0.3"
          />
        </g>

        {/* Maçãs do rosto (blush) - só para feminino */}
        {!isMale && (
          <>
            <ellipse cx="88" cy="200" rx="25" ry="15" fill="#f5c4b8" opacity="0.2" />
            <ellipse cx="232" cy="200" rx="25" ry="15" fill="#f5c4b8" opacity="0.2" />
          </>
        )}

        {/* Queixo/Mandíbula */}
        <ellipse cx="160" cy={isMale ? 355 : 340} rx={isMale ? 35 : 30} ry={isMale ? 20 : 18} fill="#d4a989" opacity="0.15" />
        <path
          d={isMale
            ? "M60 318 Q85 345 130 365"
            : "M72 310 Q90 330 120 345"
          }
          stroke="#d4b896"
          strokeWidth="0.5"
          fill="none"
          opacity="0.4"
        />
        <path
          d={isMale
            ? "M260 318 Q235 345 190 365"
            : "M248 310 Q230 330 200 345"
          }
          stroke="#d4b896"
          strokeWidth="0.5"
          fill="none"
          opacity="0.4"
        />

        {/* Regiões de injetáveis */}
        {showRegions && (
          <g>
            <g stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.4">
              <line x1="60" y1="105" x2="260" y2="105" />
              <line x1="60" y1="155" x2="260" y2="155" />
              <line x1="60" y1={isMale ? 220 : 210} x2="260" y2={isMale ? 220 : 210} />
              <line x1="60" y1={isMale ? 275 : 265} x2="260" y2={isMale ? 275 : 265} />
              <line x1="60" y1={isMale ? 325 : 310} x2="260" y2={isMale ? 325 : 310} />
              <line x1="160" y1="55" x2="160" y2={isMale ? 390 : 375} />
            </g>

            <g fontFamily="system-ui, -apple-system, sans-serif" fontSize="9" fontWeight="500">
              <text x="160" y="82" textAnchor="middle" fill="#475569">FRONTAL</text>
              <text x="160" y="135" textAnchor="middle" fill="#475569">GLABELA</text>
              <text x="78" y="155" textAnchor="middle" fill="#475569" fontSize="8">PERIORBITAL</text>
              <text x="242" y="155" textAnchor="middle" fill="#475569" fontSize="8">PERIORBITAL</text>
              <text x="78" y="200" textAnchor="middle" fill="#475569" fontSize="8">ZIGOMÁTICO</text>
              <text x="242" y="200" textAnchor="middle" fill="#475569" fontSize="8">ZIGOMÁTICO</text>
              <text x="160" y={isMale ? 255 : 245} textAnchor="middle" fill="#475569">NASOLABIAL</text>
              <text x="160" y={isMale ? 310 : 300} textAnchor="middle" fill="#475569">LABIAL</text>
              <text x="78" y={isMale ? 340 : 325} textAnchor="middle" fill="#475569" fontSize="8">MANDÍBULA</text>
              <text x="242" y={isMale ? 340 : 325} textAnchor="middle" fill="#475569" fontSize="8">MANDÍBULA</text>
              <text x="160" y={isMale ? 375 : 360} textAnchor="middle" fill="#475569">MENTO</text>
            </g>
          </g>
        )}

        {/* Camada de músculos */}
        {showMuscles && (
          <g opacity="0.15" stroke="#8b5cf6" strokeWidth="1" fill="none">
            <path d={isMale 
              ? "M95 65 Q160 55 225 65 Q225 100 160 95 Q95 100 95 65" 
              : "M100 70 Q160 60 220 70 Q220 100 160 95 Q100 100 100 70"
            } />
            <ellipse cx="130" cy={isMale ? 118 : 120} rx="20" ry="8" />
            <ellipse cx="190" cy={isMale ? 118 : 120} rx="20" ry="8" />
            <ellipse cx="118" cy="154" rx="35" ry="22" />
            <ellipse cx="202" cy="154" rx="35" ry="22" />
            <path d={isMale ? "M70 195 Q100 230 135 270" : "M75 190 Q100 220 130 250"} />
            <path d={isMale ? "M250 195 Q220 230 185 270" : "M245 190 Q220 220 190 250"} />
            <ellipse cx="160" cy={isMale ? 280 : 268} rx={isMale ? 45 : 40} ry={isMale ? 28 : 25} />
            <ellipse cx="160" cy={isMale ? 345 : 330} rx={isMale ? 30 : 25} ry={isMale ? 18 : 15} />
          </g>
        )}

        {children}
      </svg>
    )
  }
)

FaceMap.displayName = 'FaceMap'

export default FaceMap
