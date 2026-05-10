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

    const skin = isMale
      ? { s0: '#F0D5BC', s1: '#E0C0A0', s2: '#C8A882', s3: '#B09070', hi: '#F8E8D8' }
      : { s0: '#F8E0CC', s1: '#F0CEBC', s2: '#DEB898', s3: '#C8A07A', hi: '#FFF0E8' }
    const hair   = isMale ? '#3A2818' : '#C8A060'
    const hairDk = isMale ? '#1E1208' : '#8B6830'
    const hairHi = isMale ? '#5A4030' : '#E8C880'
    const lip    = isMale ? { t: '#C08878', b: '#A87060' } : { t: '#D4807A', b: '#B86860' }
    const eyeCol = '#7AACCF'   // olhos claros azul-acinzentado (como na referência)

    // ── Vista lateral ────────────────────────────────────────────────────────
    if (view === 'side-left' || view === 'side-right') {
      const flip = view === 'side-left'
      return (
        <svg
          ref={ref}
          viewBox="0 0 300 420"
          className="w-full max-w-[300px] mx-auto cursor-crosshair select-none"
          onClick={onClick}
          style={{ transform: flip ? 'scaleX(-1)' : 'none' }}
        >
          <defs>
            <radialGradient id="skinS" cx="38%" cy="30%" r="70%">
              <stop offset="0%" stopColor={skin.hi} />
              <stop offset="45%" stopColor={skin.s0} />
              <stop offset="100%" stopColor={skin.s2} />
            </radialGradient>
            <linearGradient id="hairSide" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={hairHi} />
              <stop offset="50%" stopColor={hair} />
              <stop offset="100%" stopColor={hairDk} />
            </linearGradient>
          </defs>

          {/* Pescoço */}
          <path d={isMale ? 'M115 348 Q125 385 135 410 L175 410 Q183 385 188 348' : 'M118 342 Q127 378 136 405 L170 405 Q178 378 185 342'}
            fill="url(#skinS)" stroke={skin.s2} strokeWidth="0.5" />

          {/* Rosto */}
          <path d={isMale
            ? `M72 115 C70 78 84 48 116 32 C148 18 186 20 218 40 C246 58 258 90 258 125
               L256 205 C252 248 244 282 228 302 Q210 322 188 330 L165 334
               Q145 338 130 332 Q114 326 102 316 Q82 300 74 272 Q68 248 70 210 Z`
            : `M78 118 C76 84 90 52 120 36 C150 22 182 24 210 42 C236 58 246 88 246 120
               L244 198 C240 238 234 268 220 288 Q205 308 186 318 L165 322
               Q146 326 132 320 Q118 314 108 306 Q90 292 82 268 Q76 246 76 208 Z`}
            fill="url(#skinS)" stroke={skin.s2} strokeWidth="0.7" />

          {/* Sombra lateral */}
          <path d={isMale
            ? 'M238 130 Q252 175 248 228 Q244 262 228 302 Q244 265 246 228 Q250 178 242 132'
            : 'M228 128 Q240 168 236 218 Q232 252 220 288 Q234 255 236 220 Q240 174 232 130'}
            fill={skin.s2} opacity="0.3" />

          {/* Bochecha rosada */}
          <ellipse cx={isMale ? '168' : '162'} cy={isMale ? '192' : '188'} rx="38" ry="28" fill="#E89888" opacity={isMale ? '0.08' : '0.14'} />

          {/* Cabelo lateral */}
          {isMale ? (
            <g>
              <path d={`M72 118 C71 72 96 38 142 26 C185 16 222 28 250 56 C260 70 262 92 260 118
                        L252 116 C250 94 244 74 230 58 C205 32 170 24 138 30 C102 38 84 65 84 118 Z`}
                fill="url(#hairSide)" />
            </g>
          ) : (
            <g>
              {/* Cabelo base lateral */}
              <path d={`M78 118 C76 74 100 40 146 28 C185 18 220 30 246 56 C256 70 254 90 252 116
                        L244 114 C242 92 234 72 218 58 C194 34 158 26 130 32 C96 40 88 68 88 118 Z`}
                fill="url(#hairSide)" />
              {/* Coque */}
              <ellipse cx="190" cy="45" rx="35" ry="28" fill="url(#hairSide)" />
              <ellipse cx="190" cy="48" rx="28" ry="22" fill={hairHi} opacity="0.3" />
              <path d="M160 35 Q175 28 190 26 Q205 28 218 38" stroke={hairDk} strokeWidth="1.5" fill="none" opacity="0.5" />
              {/* Cabelo longo caindo */}
              <path d="M78 118 Q70 168 72 222 Q74 272 82 322 Q78 285 78 245 Q77 198 80 158"
                fill="url(#hairSide)" />
            </g>
          )}

          {/* Orelha */}
          <path d={isMale
            ? 'M70 168 Q52 178 50 196 Q52 216 70 226 Q80 230 84 222 Q76 212 74 196 Q76 180 84 170 Z'
            : '74 164 Q56 174 54 192 Q56 212 74 222 Q83 226 87 218 Q80 208 78 192 Q80 176 87 166 Z'}
            fill="url(#skinS)" stroke={skin.s2} strokeWidth="0.6" />
          <path d={isMale ? 'M61 180 Q55 196 61 213' : 'M63 176 Q57 192 63 210'}
            stroke={skin.s3} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.5" />

          {/* Sobrancelha */}
          <path d={isMale ? 'M132 116 Q158 106 196 110' : 'M130 120 Q154 110 188 114'}
            stroke={hairDk} strokeWidth={isMale ? 5 : 3.5} strokeLinecap="round" fill="none" />

          {/* Olho */}
          <g>
            <path d="M148 155 Q170 141 194 153 Q170 167 148 155" fill="white" />
            <path d="M148 155 Q170 141 194 153" stroke={hairDk} strokeWidth="1.5" fill="none" />
            <path d="M148 155 Q170 167 194 155" stroke={skin.s2} strokeWidth="0.8" fill="none" />
            <clipPath id="eyeS"><path d="M148 155 Q170 141 194 153 Q170 167 148 155" /></clipPath>
            <g clipPath="url(#eyeS)">
              <circle cx="170" cy="154" r="11" fill={eyeCol} opacity="0.9" />
              <circle cx="170" cy="154" r="7" fill="#2a4860" />
              <circle cx="173" cy="151" r="2.5" fill="white" opacity="0.9" />
            </g>
            {!isMale && (
              <path d="M148 152 Q170 139 192 151" stroke={hairDk} strokeWidth="1" fill="none" opacity="0.7" />
            )}
          </g>

          {/* Nariz */}
          <path d={isMale
            ? 'M190 130 Q212 155 207 186 Q202 206 184 218 L172 214 Q182 203 186 186 Q190 166 183 148'
            : 'M180 134 Q200 156 196 183 Q192 200 176 212 L165 208 Q174 198 177 182 Q180 164 174 148'}
            fill="url(#skinS)" stroke={skin.s2} strokeWidth="0.6" />
          <path d={isMale
            ? 'M184 214 Q180 224 172 226 Q164 225 160 220'
            : '176 209 Q172 218 165 220 Q158 219 154 215'}
            stroke={skin.s3} strokeWidth="1.5" fill="none" strokeLinecap="round" />

          {/* Lábios */}
          <path d={isMale
            ? 'M148 262 Q158 252 168 255 Q177 252 184 262 Q177 268 168 267 Q158 268 148 262'
            : 'M144 255 Q154 244 164 248 Q173 244 180 255 Q173 261 164 260 Q154 261 144 255'}
            fill={lip.t} />
          <path d={isMale
            ? 'M148 262 Q168 272 184 262'
            : 'M144 255 Q164 265 180 255'}
            stroke={lip.b} strokeWidth="0.8" fill="none" />

          {showRegions && (
            <g opacity="0.12" pointerEvents="none">
              <ellipse cx={isMale ? '172' : '165'} cy="152" rx="28" ry="18" fill="#7B5CF5" />
              <ellipse cx={isMale ? '170' : '163'} cy="212" rx="20" ry="14" fill="#7B5CF5" />
            </g>
          )}
          {children}
        </svg>
      )
    }

    // ── Vista frontal ────────────────────────────────────────────────────────
    return (
      <svg
        ref={ref}
        viewBox="0 0 340 480"
        className="w-full max-w-[380px] mx-auto cursor-crosshair select-none"
        onClick={onClick}
      >
        <defs>
          <radialGradient id="skinF" cx="50%" cy="32%" r="62%">
            <stop offset="0%" stopColor={skin.hi} />
            <stop offset="40%" stopColor={skin.s0} />
            <stop offset="100%" stopColor={skin.s2} />
          </radialGradient>
          <radialGradient id="skinNeck" cx="50%" cy="25%" r="70%">
            <stop offset="0%" stopColor={skin.s0} />
            <stop offset="100%" stopColor={skin.s2} />
          </radialGradient>
          <radialGradient id="sdwL" cx="0%" cy="50%" r="100%">
            <stop offset="0%" stopColor={skin.s3} stopOpacity="0.38" />
            <stop offset="100%" stopColor={skin.s3} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sdwR" cx="100%" cy="50%" r="100%">
            <stop offset="0%" stopColor={skin.s3} stopOpacity="0.38" />
            <stop offset="100%" stopColor={skin.s3} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sdwJaw" cx="50%" cy="100%" r="55%">
            <stop offset="0%" stopColor={skin.s3} stopOpacity="0.35" />
            <stop offset="100%" stopColor={skin.s3} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="blushL" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#E89888" stopOpacity={isMale ? '0.09' : '0.22'} />
            <stop offset="100%" stopColor="#E89888" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="blushR" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#E89888" stopOpacity={isMale ? '0.09' : '0.22'} />
            <stop offset="100%" stopColor="#E89888" stopOpacity="0" />
          </radialGradient>
          {/* Cabelo */}
          <linearGradient id="hairG" x1="15%" y1="0%" x2="85%" y2="100%">
            <stop offset="0%" stopColor={hairHi} />
            <stop offset="35%" stopColor={hair} />
            <stop offset="100%" stopColor={hairDk} />
          </linearGradient>
          <radialGradient id="hairBun" cx="45%" cy="35%" r="60%">
            <stop offset="0%" stopColor={hairHi} />
            <stop offset="60%" stopColor={hair} />
            <stop offset="100%" stopColor={hairDk} />
          </radialGradient>
          {/* Iris azul */}
          <radialGradient id="irisL" cx="38%" cy="32%" r="65%">
            <stop offset="0%" stopColor="#C8E4F4" />
            <stop offset="35%" stopColor={eyeCol} />
            <stop offset="100%" stopColor="#3A6888" />
          </radialGradient>
          <radialGradient id="irisR" cx="62%" cy="32%" r="65%">
            <stop offset="0%" stopColor="#C8E4F4" />
            <stop offset="35%" stopColor={eyeCol} />
            <stop offset="100%" stopColor="#3A6888" />
          </radialGradient>
          {/* Lábios */}
          <linearGradient id="lipT" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isMale ? '#CC9080' : '#DC8880'} />
            <stop offset="100%" stopColor={lip.t} />
          </linearGradient>
          <linearGradient id="lipB" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={lip.b} />
            <stop offset="100%" stopColor={isMale ? '#906050' : '#985858'} />
          </linearGradient>
          <linearGradient id="brow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={hairDk} stopOpacity="0.4" />
            <stop offset="25%" stopColor={hairDk} />
            <stop offset="100%" stopColor={hairDk} stopOpacity="0.5" />
          </linearGradient>
          <filter id="glow" x="-15%" y="-15%" width="130%" height="130%">
            <feGaussianBlur stdDeviation="1.2" />
          </filter>
          <filter id="sofBlur" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="0.7" />
          </filter>
        </defs>

        {/* ── Pescoço e ombros ── */}
        <path
          d={isMale
            ? 'M130 390 Q128 425 132 455 L208 455 Q212 425 210 390 Q190 404 170 404 Q150 404 130 390'
            : 'M136 382 Q134 415 138 448 L202 448 Q206 415 204 382 Q186 396 170 396 Q154 396 136 382'}
          fill="url(#skinNeck)" />
        {/* clavícula */}
        <path
          d={isMale
            ? 'M80 455 Q130 435 170 432 Q210 435 260 455'
            : 'M88 448 Q135 430 170 428 Q205 430 252 448'}
          stroke={skin.s2} strokeWidth="1.5" fill="none" opacity="0.5" />

        {/* ── Rosto base ── */}
        <path
          d={isMale
            ? `M170 36 C248 36 298 88 298 165 L296 242
               C294 288 284 322 265 346 Q246 370 222 382
               Q196 394 170 394 Q144 394 118 382
               Q94 370 75 346 C56 322 46 288 44 242 L42 165
               C42 88 92 36 170 36 Z`
            : `M170 42 C242 42 286 90 286 162 L284 236
               C282 278 274 310 257 332 Q240 354 218 366
               Q194 378 170 378 Q146 378 122 366
               Q100 354 83 332 C66 310 58 278 56 236 L54 162
               C54 90 98 42 170 42 Z`}
          fill="url(#skinF)" stroke={skin.s2} strokeWidth="0.5" />

        {/* Sombras */}
        <path d={isMale ? 'M42 165 C42 88 92 36 170 36 L42 165' : 'M54 162 C54 90 98 42 170 42 L54 162'} fill="url(#sdwL)" />
        <path d={isMale ? 'M298 165 C298 88 248 36 170 36 L298 165' : 'M286 162 C286 90 242 42 170 42 L286 162'} fill="url(#sdwR)" />
        <ellipse cx="170" cy={isMale ? '388' : '372'} rx={isMale ? '85' : '75'} ry="20" fill="url(#sdwJaw)" />

        {/* Bochechas */}
        <ellipse cx={isMale ? '96' : '100'} cy={isMale ? '238' : '230'} rx="52" ry="36" fill="url(#blushL)" />
        <ellipse cx={isMale ? '244' : '240'} cy={isMale ? '238' : '230'} rx="52" ry="36" fill="url(#blushR)" />

        {/* Sombra barba masculina */}
        {isMale && <g opacity="0.09"><ellipse cx="170" cy="362" rx="72" ry="42" fill="#7A6A5A" /><ellipse cx="170" cy="338" rx="58" ry="30" fill="#7A6A5A" /></g>}

        {/* ── Orelhas ── */}
        {[
          { side: 'l', ex: isMale ? 42 : 54, ey: isMale ? 185 : 180 },
          { side: 'r', ex: isMale ? 298 : 286, ey: isMale ? 185 : 180 },
        ].map(({ side, ex, ey }) => {
          const isL = side === 'l'
          const r = isL ? { rx: isMale ? 16 : 14, ry: isMale ? 30 : 28 } : { rx: isMale ? 16 : 14, ry: isMale ? 30 : 28 }
          return (
            <g key={side}>
              <ellipse cx={ex} cy={ey} rx={r.rx} ry={r.ry} fill="url(#skinF)" stroke={skin.s2} strokeWidth="0.5" />
              <path
                d={isL
                  ? `M${ex - 6} ${ey - 14} Q${ex - 12} ${ey} ${ex - 6} ${ey + 14}`
                  : `M${ex + 6} ${ey - 14} Q${ex + 12} ${ey} ${ex + 6} ${ey + 14}`}
                stroke={skin.s3} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.5" />
            </g>
          )
        })}

        {/* ── Cabelo ── */}
        {isMale ? (
          <g>
            <path d={`M170 30 C255 30 308 84 310 165
                       Q308 126 285 90 C260 50 218 30 170 30
                       C122 30 80 50 55 90 Q32 126 30 165
                       C32 84 85 30 170 30 Z`}
              fill="url(#hairG)" />
            <path d="M170 30 Q128 35 96 55" stroke={hairHi} strokeWidth="1" fill="none" opacity="0.25" />
            <path d="M170 30 Q212 35 244 55" stroke={hairHi} strokeWidth="1" fill="none" opacity="0.25" />
          </g>
        ) : (
          <g>
            {/* Coque principal */}
            <ellipse cx="170" cy="22" rx="42" ry="32" fill="url(#hairBun)" />
            <ellipse cx="168" cy="20" rx="32" ry="24" fill={hairHi} opacity="0.25" />
            <path d="M135 28 Q152 18 170 16 Q188 18 205 28" stroke={hairDk} strokeWidth="2" fill="none" opacity="0.4" strokeLinecap="round" />
            <path d="M130 32 Q148 22 170 20 Q192 22 210 32" stroke={hairHi} strokeWidth="1" fill="none" opacity="0.35" strokeLinecap="round" />
            {/* Base cabelo envolvendo rosto */}
            <path d={`M170 42 C240 42 278 86 278 156
                       Q274 118 255 88 C234 54 204 42 170 42
                       C136 42 106 54 85 88 Q66 118 62 156
                       C62 86 100 42 170 42 Z`}
              fill="url(#hairG)" />
            {/* Mechão direito descendo */}
            <path d="M280 158 Q288 200 288 250 Q286 298 278 340 Q282 300 282 258 Q282 208 278 165"
              fill="url(#hairG)" />
            {/* Mechão esquerdo descendo */}
            <path d="M60 158 Q52 200 52 250 Q54 298 62 340 Q58 300 58 258 Q58 208 62 165"
              fill="url(#hairG)" />
            {/* Franja sutil */}
            <path d="M96 68 Q118 52 148 48 Q170 46 192 48 Q222 52 244 68
                     Q222 60 192 57 Q170 55 148 57 Q118 60 96 68"
              fill="url(#hairG)" opacity="0.85" />
            {/* Detalhe mechas */}
            <path d="M170 42 Q148 46 122 60" stroke={hairHi} strokeWidth="0.8" fill="none" opacity="0.3" />
            <path d="M170 42 Q192 46 218 60" stroke={hairHi} strokeWidth="0.8" fill="none" opacity="0.3" />
            {/* Haste do coque */}
            <path d="M158 38 Q163 28 170 24 Q177 28 182 38" stroke={hairDk} strokeWidth="2" fill="none" strokeLinecap="round" />
          </g>
        )}

        {/* ── Sobrancelhas ── */}
        {isMale ? (
          <g>
            {/* Sobrancelha esquerda - mais espessa e reta */}
            <path d="M88 128 Q106 116 138 115 Q158 116 166 122" stroke="url(#brow)" strokeWidth="7.5" strokeLinecap="round" fill="none" />
            <path d="M88 128 Q106 116 138 115 Q158 116 166 122" stroke={hairDk} strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.3" />
            {/* Sobrancelha direita */}
            <path d="M174 122 Q182 116 202 115 Q234 116 252 128" stroke="url(#brow)" strokeWidth="7.5" strokeLinecap="round" fill="none" />
            <path d="M174 122 Q182 116 202 115 Q234 116 252 128" stroke={hairDk} strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.3" />
          </g>
        ) : (
          <g>
            {/* Sobrancelha esquerda - arqueada fina */}
            <path d="M95 130 Q115 116 142 114 Q158 115 168 120" stroke="url(#brow)" strokeWidth="4.5" strokeLinecap="round" fill="none" />
            <path d="M95 130 Q115 116 142 114 Q158 115 168 120" stroke={hairDk} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.25" />
            {/* Sobrancelha direita */}
            <path d="M172 120 Q182 115 198 114 Q225 116 245 130" stroke="url(#brow)" strokeWidth="4.5" strokeLinecap="round" fill="none" />
            <path d="M172 120 Q182 115 198 114 Q225 116 245 130" stroke={hairDk} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.25" />
          </g>
        )}

        {/* ── Olhos ── */}
        {[
          { cx: 128, clipId: 'eyeL', irisId: 'irisL' },
          { cx: 212, clipId: 'eyeR', irisId: 'irisR' },
        ].map(({ cx, clipId, irisId }) => (
          <g key={clipId}>
            {/* Sombra orbital */}
            <ellipse cx={cx} cy={isMale ? '165' : '162'} rx="30" ry="14" fill={skin.s2} filter="url(#sofBlur)" opacity="0.4" />
            {/* Branco */}
            <path d={`M${cx - 30} ${isMale ? 165 : 162} Q${cx} ${(isMale ? 165 : 162) - 20} ${cx + 30} ${isMale ? 165 : 162} Q${cx} ${(isMale ? 165 : 162) + 16} ${cx - 30} ${isMale ? 165 : 162}`} fill="white" />
            {/* Pálpebra superior */}
            <path d={`M${cx - 30} ${isMale ? 165 : 162} Q${cx} ${(isMale ? 165 : 162) - 20} ${cx + 30} ${isMale ? 165 : 162}`}
              stroke={isMale ? '#5A4030' : hairDk} strokeWidth={isMale ? '2' : '1.8'} fill="none" />
            {/* Pálpebra inferior */}
            <path d={`M${cx - 30} ${isMale ? 165 : 162} Q${cx} ${(isMale ? 165 : 162) + 16} ${cx + 30} ${isMale ? 165 : 162}`}
              stroke={skin.s3} strokeWidth="0.8" fill="none" />
            {/* Íris */}
            <clipPath id={clipId}>
              <path d={`M${cx - 30} ${isMale ? 165 : 162} Q${cx} ${(isMale ? 165 : 162) - 20} ${cx + 30} ${isMale ? 165 : 162} Q${cx} ${(isMale ? 165 : 162) + 16} ${cx - 30} ${isMale ? 165 : 162}`} />
            </clipPath>
            <g clipPath={`url(#${clipId})`}>
              <circle cx={cx} cy={isMale ? '165' : '162'} r="13" fill={`url(#${irisId})`} />
              {/* Anel limbo */}
              <circle cx={cx} cy={isMale ? '165' : '162'} r="13" fill="none" stroke="#2A4860" strokeWidth="1.5" />
              {/* Pupila */}
              <circle cx={cx} cy={isMale ? '165' : '162'} r="7.5" fill="#0A1820" />
              {/* Reflexo principal */}
              <circle cx={cx + 3} cy={(isMale ? 165 : 162) - 4} r="3.2" fill="white" opacity="0.9" />
              {/* Reflexo secundário */}
              <circle cx={cx - 3} cy={(isMale ? 165 : 162) + 4} r="1.5" fill="white" opacity="0.4" />
            </g>
            {/* Cílios femininos */}
            {!isMale && (
              <g stroke={hairDk} strokeWidth="1.1" fill="none" strokeLinecap="round">
                {[cx - 22, cx - 12, cx, cx + 12, cx + 22].map((x, i) => (
                  <path key={i} d={`M${x} ${162 - 18} Q${x + (i < 2 ? -2 : i > 2 ? 2 : 0)} ${162 - 26} ${x + (i < 2 ? -3 : i > 2 ? 3 : 0)} ${162 - 30}`} />
                ))}
              </g>
            )}
          </g>
        ))}

        {/* ── Nariz ── */}
        <g>
          {/* Ponte */}
          <path
            d={isMale
              ? 'M162 128 Q158 165 158 198 Q160 218 170 228 Q180 218 182 198 Q182 165 178 128'
              : 'M164 125 Q161 160 162 190 Q165 208 170 218 Q175 208 178 190 Q179 160 176 125'}
            stroke={skin.s2} strokeWidth={isMale ? '1.3' : '0.9'} fill="none" opacity="0.65" />
          {/* Sombras laterais nariz */}
          <path d={isMale ? 'M158 195 Q150 208 146 224' : 'M162 188 Q156 200 154 215'}
            stroke={skin.s3} strokeWidth="1.2" fill="none" opacity="0.55" strokeLinecap="round" />
          <path d={isMale ? 'M182 195 Q190 208 194 224' : 'M178 188 Q184 200 186 215'}
            stroke={skin.s3} strokeWidth="1.2" fill="none" opacity="0.55" strokeLinecap="round" />
          {/* Narinas */}
          <ellipse cx={isMale ? '155' : '158'} cy={isMale ? '228' : '220'} rx={isMale ? '10' : '8'} ry={isMale ? '6' : '5'} fill={skin.s3} opacity="0.5" />
          <ellipse cx={isMale ? '185' : '182'} cy={isMale ? '228' : '220'} rx={isMale ? '10' : '8'} ry={isMale ? '6' : '5'} fill={skin.s3} opacity="0.5" />
          {/* Ponta */}
          <ellipse cx="170" cy={isMale ? '225' : '218'} rx={isMale ? '16' : '12'} ry={isMale ? '7' : '6'} fill={skin.s2} opacity="0.35" />
          {/* Philtrum */}
          <path d={isMale ? 'M162 233 Q170 244 178 233' : 'M163 226 Q170 236 177 226'}
            stroke={skin.s3} strokeWidth="1" fill="none" opacity="0.4" strokeLinecap="round" />
        </g>

        {/* ── Sulcos nasolabiais ── */}
        <path
          d={isMale
            ? 'M144 230 Q133 252 128 274 M196 230 Q207 252 212 274'
            : 'M148 222 Q138 242 134 264 M192 222 Q202 242 206 264'}
          stroke={skin.s3} strokeWidth="0.9" fill="none" opacity="0.38" strokeLinecap="round" />

        {/* ── Lábios ── */}
        <g>
          {/* Lábio superior + cupido */}
          <path d={isMale
            ? `M126 272 Q144 260 156 264 Q170 258 184 264 Q196 260 214 272
               Q196 268 170 268 Q144 268 126 272`
            : `M124 264 Q140 250 154 255 Q170 249 186 255 Q200 250 216 264
               Q198 260 170 260 Q142 260 124 264`}
            fill="url(#lipT)" />
          {/* Linha de Cupido */}
          <path d={isMale
            ? 'M142 263 Q156 256 170 260 Q184 256 198 263'
            : 'M140 256 Q155 249 170 253 Q185 249 200 256'}
            stroke={lip.b} strokeWidth="0.6" fill="none" />
          {/* Lábio inferior */}
          <path d={isMale
            ? 'M126 272 Q170 296 214 272 Q196 292 170 296 Q144 292 126 272'
            : 'M124 264 Q170 288 216 264 Q198 282 170 286 Q142 282 124 264'}
            fill="url(#lipB)" />
          {/* Linha da boca */}
          <path d={isMale ? 'M126 272 Q170 276 214 272' : 'M124 264 Q170 268 216 264'}
            stroke={lip.b} strokeWidth="0.9" fill="none" />
          {/* Highlight */}
          <path d={isMale ? 'M148 284 Q170 291 192 284' : 'M148 276 Q170 283 192 276'}
            stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </g>

        {/* ── Queixo ── */}
        <path
          d={isMale
            ? 'M136 362 Q170 378 204 362 Q192 374 170 378 Q148 374 136 362'
            : 'M138 352 Q170 368 202 352 Q190 364 170 368 Q150 364 138 352'}
          fill={skin.s2} opacity="0.3" />

        {/* ── Regiões interativas ── */}
        {showRegions && (
          <g opacity="0" pointerEvents="none">
            {/* Fronte */}
            <ellipse cx="170" cy="88" rx="72" ry="42" fill="#7B5CF5" />
            {/* Glabela */}
            <ellipse cx="170" cy="125" rx="24" ry="14" fill="#7B5CF5" />
            {/* Periorbital esq */}
            <ellipse cx="110" cy="165" rx="38" ry="24" fill="#7B5CF5" />
            {/* Periorbital dir */}
            <ellipse cx="230" cy="165" rx="38" ry="24" fill="#7B5CF5" />
            {/* Nariz */}
            <ellipse cx="170" cy="192" rx="24" ry="36" fill="#7B5CF5" />
            {/* Zigomático esq */}
            <ellipse cx="95" cy="218" rx="38" ry="28" fill="#7B5CF5" />
            {/* Zigomático dir */}
            <ellipse cx="245" cy="218" rx="38" ry="28" fill="#7B5CF5" />
            {/* Lábio sup */}
            <ellipse cx="170" cy="262" rx="48" ry="18" fill="#7B5CF5" />
            {/* Lábio inf */}
            <ellipse cx="170" cy="282" rx="46" ry="18" fill="#7B5CF5" />
            {/* Mento */}
            <ellipse cx="170" cy="334" rx="44" ry="30" fill="#7B5CF5" />
            {/* Mandíbula esq */}
            <ellipse cx="90" cy="310" rx="35" ry="44" fill="#7B5CF5" />
            {/* Mandíbula dir */}
            <ellipse cx="250" cy="310" rx="35" ry="44" fill="#7B5CF5" />
          </g>
        )}

        {/* Músculos */}
        {showMuscles && (
          <g opacity="0.13" pointerEvents="none">
            <path d="M115 55 Q170 46 225 55 Q226 88 170 84 Q114 88 115 55" fill="#C0392B" />
            <ellipse cx="128" cy="165" rx="32" ry="22" fill="#2980B9" />
            <ellipse cx="212" cy="165" rx="32" ry="22" fill="#2980B9" />
            <path d="M74 220 Q125 238 152 268" stroke="#27AE60" strokeWidth="14" fill="none" strokeLinecap="round" />
            <path d="M266 220 Q215 238 188 268" stroke="#27AE60" strokeWidth="14" fill="none" strokeLinecap="round" />
            <ellipse cx="170" cy="272" rx="50" ry="24" fill="#E67E22" />
          </g>
        )}

        {children}
      </svg>
    )
  }
)

FaceMap.displayName = 'FaceMap'
export default FaceMap
