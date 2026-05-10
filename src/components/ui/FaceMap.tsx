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

    if (view === 'side-left' || view === 'side-right') {
      const flip = view === 'side-left'
      return (
        <svg ref={ref} viewBox="0 0 300 430" className="w-full cursor-crosshair select-none" onClick={onClick} style={{ transform: flip ? 'scaleX(-1)' : 'none' }}>
          <defs>
            <radialGradient id="sSide" cx="38%" cy="30%" r="70%">
              <stop offset="0%" stopColor={isMale ? '#F8E8D8' : '#FFF0E8'} />
              <stop offset="45%" stopColor={isMale ? '#EDD0B0' : '#F5D8C0'} />
              <stop offset="100%" stopColor={isMale ? '#D0A878' : '#DEB898'} />
            </radialGradient>
            <linearGradient id="hSide" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={isMale ? '#6A5040' : '#E8C870'} />
              <stop offset="50%" stopColor={isMale ? '#3A2818' : '#C8A040'} />
              <stop offset="100%" stopColor={isMale ? '#1E1208' : '#8B6820'} />
            </linearGradient>
          </defs>
          <path d={isMale ? 'M118 352 Q128 386 136 408 L172 408 Q180 386 188 352' : 'M120 348 Q129 380 136 405 L168 405 Q176 380 183 348'} fill="url(#sSide)" stroke="#DEB898" strokeWidth="0.5" />
          <path d={isMale
            ? `M72 115 C70 78 85 46 118 30 C150 16 188 18 220 38 C248 56 260 88 260 124 L258 204 C254 248 246 284 228 305 Q210 325 188 334 L164 338 Q144 342 128 336 Q112 330 100 318 Q80 302 72 272 Q66 246 68 208 Z`
            : `M78 118 C76 82 90 50 122 34 C152 20 186 22 214 42 C240 58 250 90 250 124 L248 202 C244 244 238 278 222 298 Q206 318 186 326 L163 330 Q144 334 130 328 Q116 322 106 312 Q88 296 80 268 Q74 244 76 206 Z`}
            fill="url(#sSide)" stroke="#DEB898" strokeWidth="0.7" />
          <path d={isMale ? 'M240 132 Q254 175 250 228 Q244 265 228 305 Q246 268 248 228 Q252 178 244 135' : 'M232 130 Q244 170 240 220 Q236 255 222 298 Q238 258 240 220 Q244 175 236 132'} fill="#D0A878" opacity="0.28" />
          <ellipse cx={isMale ? '168' : '162'} cy={isMale ? '194' : '190'} rx="36" ry="26" fill="#E89888" opacity={isMale ? '0.08' : '0.16'} />
          {isMale ? (
            <g>
              <path d={`M72 118 C71 72 96 38 142 25 C185 14 224 26 252 55 C262 70 264 92 262 118 L254 116 C252 94 245 74 230 57 C204 30 168 22 136 28 C100 36 84 65 84 118 Z`} fill="url(#hSide)" />
            </g>
          ) : (
            <g>
              <path d={`M78 118 C76 74 100 40 146 28 C185 18 220 30 246 56 C256 70 254 90 252 116 L244 114 C242 92 234 72 218 57 C194 33 158 25 130 30 C96 38 88 67 88 118 Z`} fill="url(#hSide)" />
              <path d="M78 116 Q70 168 72 224 Q74 274 84 324 Q78 286 78 248 Q77 200 80 160" fill="url(#hSide)" />
              <ellipse cx="194" cy="48" rx="34" ry="26" fill="url(#hSide)" />
              <ellipse cx="192" cy="46" rx="25" ry="18" fill="#F0D888" opacity="0.25" />
              <path d="M165 38 Q178 28 194 26 Q208 28 220 40" stroke="#8B6820" strokeWidth="1.8" fill="none" opacity="0.4" strokeLinecap="round" />
              <path d="M160 40 Q175 32 194 30 Q210 32 222 42" stroke="#F0D888" strokeWidth="1" fill="none" opacity="0.28" strokeLinecap="round" />
            </g>
          )}
          <path d={isMale ? 'M70 170 Q52 180 50 198 Q52 218 70 228 Q80 232 84 224 Q76 214 74 198 Q76 182 84 172 Z' : '74 165 Q56 175 54 193 Q56 213 74 223 Q83 227 87 219 Q80 209 78 193 Q80 177 87 167 Z'} fill="url(#sSide)" stroke="#DEB898" strokeWidth="0.6" />
          <path d={isMale ? 'M60 182 Q55 198 60 215' : 'M63 177 Q57 193 63 210'} stroke="#C8A07A" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.5" />
          <path d={isMale ? 'M133 116 Q158 105 198 110' : 'M131 120 Q154 110 190 114'} stroke={isMale ? '#3A2818' : '#8B6820'} strokeWidth={isMale ? 5 : 3.5} strokeLinecap="round" fill="none" />
          <g>
            <path d="M150 157 Q172 143 196 155 Q172 169 150 157" fill="white" />
            <path d="M150 157 Q172 143 196 155" stroke={isMale ? '#5A4020' : '#5A3010'} strokeWidth="1.6" fill="none" />
            <path d="M150 157 Q172 169 196 157" stroke="#C8A07A" strokeWidth="0.8" fill="none" />
            <clipPath id="eyeSide"><path d="M150 157 Q172 143 196 155 Q172 169 150 157" /></clipPath>
            <g clipPath="url(#eyeSide)">
              <circle cx="172" cy="156" r="12" fill="#7AACCF" />
              <circle cx="172" cy="156" r="12" fill="none" stroke="#2A5878" strokeWidth="1.5" />
              <circle cx="172" cy="156" r="7" fill="#0A1820" />
              <circle cx="175" cy="152" r="2.8" fill="white" opacity="0.92" />
            </g>
            {!isMale && (
              <g stroke="#5A3010" strokeWidth="1.1" fill="none" strokeLinecap="round">
                <path d="M154 153 Q152 146 150 142" />
                <path d="M163 147 Q163 140 162 136" />
                <path d="M172 144 Q172 137 172 133" />
                <path d="M181 147 Q182 140 183 136" />
                <path d="M190 153 Q192 146 194 142" />
              </g>
            )}
          </g>
          <path d={isMale ? 'M188 132 Q209 156 204 186 Q200 206 183 218 L171 214 Q181 203 184 186 Q188 165 181 148' : 'M180 135 Q200 157 196 184 Q192 202 177 213 L165 209 Q174 199 177 183 Q180 163 174 148'} fill="url(#sSide)" stroke="#DEB898" strokeWidth="0.6" />
          <path d={isMale ? 'M183 215 Q180 224 172 227 Q165 226 161 221' : '177 210 Q174 219 167 221 Q160 220 156 216'} stroke="#C8A07A" strokeWidth="1.4" fill="none" strokeLinecap="round" />
          <path d={isMale ? 'M148 264 Q158 253 168 256 Q177 253 184 264' : 'M144 256 Q154 245 164 249 Q173 245 180 256'} fill={isMale ? '#CC9080' : '#E89090'} />
          <path d={isMale ? 'M148 264 Q168 275 184 264' : 'M144 256 Q164 268 180 256'} fill={isMale ? '#B07060' : '#C87070'} />
          <path d={isMale ? 'M148 264 Q168 267 184 264' : 'M144 256 Q164 259 180 256'} stroke={isMale ? '#B07060' : '#C87070'} strokeWidth="0.9" fill="none" />
          {showRegions && (
            <g opacity="0.12" pointerEvents="none">
              <ellipse cx={isMale ? '173' : '165'} cy="155" rx="28" ry="18" fill="#7B5CF5" />
              <ellipse cx={isMale ? '171' : '163'} cy="212" rx="20" ry="13" fill="#7B5CF5" />
              <ellipse cx={isMale ? '165' : '158'} cy="255" rx="22" ry="11" fill="#7B5CF5" />
            </g>
          )}
          {children}
        </svg>
      )
    }

    return (
      <svg ref={ref} viewBox="0 0 680 540" className="w-full cursor-crosshair select-none" onClick={onClick}>
        <defs>
          <radialGradient id="skinFront" cx="50%" cy="30%" r="65%">
            <stop offset="0%" stopColor={isMale ? '#F8E8D8' : '#FFF0E8'} />
            <stop offset="45%" stopColor={isMale ? '#EDD0B0' : '#F5D8C0'} />
            <stop offset="100%" stopColor={isMale ? '#D0A878' : '#DEB898'} />
          </radialGradient>
          <radialGradient id="skinNeck" cx="50%" cy="20%" r="70%">
            <stop offset="0%" stopColor={isMale ? '#EDD0B0' : '#F5D8C0'} />
            <stop offset="100%" stopColor={isMale ? '#D0A878' : '#DEB898'} />
          </radialGradient>
          <radialGradient id="sdwLeft" cx="0%" cy="50%" r="100%">
            <stop offset="0%" stopColor={isMale ? '#C09060' : '#C8A07A'} stopOpacity="0.35" />
            <stop offset="100%" stopColor="#C8A07A" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sdwRight" cx="100%" cy="50%" r="100%">
            <stop offset="0%" stopColor={isMale ? '#C09060' : '#C8A07A'} stopOpacity="0.35" />
            <stop offset="100%" stopColor="#C8A07A" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sdwJaw" cx="50%" cy="100%" r="55%">
            <stop offset="0%" stopColor={isMale ? '#C09060' : '#C8A07A'} stopOpacity="0.32" />
            <stop offset="100%" stopColor="#C8A07A" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="blushLeft" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#E89888" stopOpacity={isMale ? '0.09' : '0.26'} />
            <stop offset="100%" stopColor="#E89888" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="blushRight" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#E89888" stopOpacity={isMale ? '0.09' : '0.26'} />
            <stop offset="100%" stopColor="#E89888" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="hairFront" x1="15%" y1="0%" x2="85%" y2="100%">
            <stop offset="0%" stopColor={isMale ? '#6A5040' : '#E8C870'} />
            <stop offset="40%" stopColor={isMale ? '#3A2818' : '#C8A040'} />
            <stop offset="100%" stopColor={isMale ? '#1E1208' : '#8B6820'} />
          </linearGradient>
          <radialGradient id="hairBun" cx="42%" cy="32%" r="62%">
            <stop offset="0%" stopColor="#F0D888" />
            <stop offset="55%" stopColor="#C8A040" />
            <stop offset="100%" stopColor="#7A5818" />
          </radialGradient>
          <radialGradient id="irisLeft" cx="38%" cy="32%" r="65%">
            <stop offset="0%" stopColor="#D8EEF8" />
            <stop offset="35%" stopColor="#7AACCF" />
            <stop offset="100%" stopColor="#2A5878" />
          </radialGradient>
          <radialGradient id="irisRight" cx="62%" cy="32%" r="65%">
            <stop offset="0%" stopColor="#D8EEF8" />
            <stop offset="35%" stopColor="#7AACCF" />
            <stop offset="100%" stopColor="#2A5878" />
          </radialGradient>
          <linearGradient id="lipTop" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isMale ? '#CC9080' : '#E89090'} />
            <stop offset="100%" stopColor={isMale ? '#B07060' : '#C87070'} />
          </linearGradient>
          <linearGradient id="lipBot" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isMale ? '#B07060' : '#C87070'} />
            <stop offset="100%" stopColor={isMale ? '#8A5040' : '#A05050'} />
          </linearGradient>
          <linearGradient id="browGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={isMale ? '#3A2818' : '#8B6820'} stopOpacity="0.5" />
            <stop offset="25%" stopColor={isMale ? '#2A1808' : '#7A5818'} />
            <stop offset="100%" stopColor={isMale ? '#3A2818' : '#8B6820'} stopOpacity="0.5" />
          </linearGradient>
        </defs>

        {/* Neck */}
        <path d={isMale
          ? 'M298 392 Q294 425 296 455 L364 455 Q366 425 362 392 Q346 404 330 404 Q314 404 298 392'
          : 'M310 385 Q306 418 308 448 L352 448 Q354 418 350 385 Q340 396 330 396 Q320 396 310 385'}
          fill="url(#skinNeck)" />
        <path d={isMale
          ? 'M260 455 Q298 440 330 437 Q362 440 400 455'
          : 'M278 448 Q310 436 330 434 Q350 436 382 448'}
          stroke={isMale ? '#D0A878' : '#DEB898'} strokeWidth="1.2" fill="none" opacity="0.55" />

        {/* Face */}
        <path d={isMale
          ? `M330 44
             C400 44 448 96 448 168 L446 248
             C444 294 435 330 416 354
             Q396 378 368 390
             Q350 398 330 398
             Q310 398 292 390
             Q264 378 244 354
             C225 330 216 294 214 248 L212 168
             C212 96 260 44 330 44 Z`
          : `M330 44
             C394 44 436 90 436 156 L434 228
             C432 268 426 298 413 318
             Q399 338 380 349
             Q357 359 330 359
             Q303 359 280 349
             Q261 338 247 318
             C234 298 228 268 226 228 L224 156
             C224 90 266 44 330 44 Z`}
          fill="url(#skinFront)" stroke={isMale ? '#D0A878' : '#DEB898'} strokeWidth="0.8" />

        {/* Shadows */}
        <path d={isMale ? 'M212 168 C212 96 260 44 330 44 L212 168' : 'M224 156 C224 90 266 44 330 44 L224 156'} fill="url(#sdwLeft)" />
        <path d={isMale ? 'M448 168 C448 96 400 44 330 44 L448 168' : 'M436 156 C436 90 394 44 330 44 L436 156'} fill="url(#sdwRight)" />
        <ellipse cx="330" cy={isMale ? '394' : '353'} rx={isMale ? '88' : '65'} ry={isMale ? '18' : '14'} fill="url(#sdwJaw)" />

        {/* Blush */}
        <ellipse cx={isMale ? '244' : '252'} cy={isMale ? '248' : '234'} rx={isMale ? '46' : '42'} ry={isMale ? '32' : '28'} fill="url(#blushLeft)" />
        <ellipse cx={isMale ? '416' : '408'} cy={isMale ? '248' : '234'} rx={isMale ? '46' : '42'} ry={isMale ? '32' : '28'} fill="url(#blushRight)" />

        {/* Male beard shadow */}
        {isMale && (
          <g opacity="0.09">
            <ellipse cx="330" cy="370" rx="76" ry="44" fill="#7A6A5A" />
            <ellipse cx="330" cy="345" rx="62" ry="30" fill="#7A6A5A" />
          </g>
        )}

        {/* Ears */}
        <path d={isMale
          ? 'M212 186 Q194 196 192 215 Q194 235 212 246 Q222 250 227 242 Q218 231 216 215 Q218 198 227 188 Z'
          : 'M224 182 Q208 191 206 208 Q208 226 224 236 Q233 240 238 232 Q230 222 228 208 Q230 192 238 183 Z'}
          fill="url(#skinFront)" stroke={isMale ? '#D0A878' : '#DEB898'} strokeWidth="0.6" />
        <path d={isMale ? 'M202 198 Q196 215 202 233' : 'M215 194 Q209 208 215 224'} stroke={isMale ? '#C09060' : '#C8A07A'} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.5" />

        <path d={isMale
          ? 'M448 186 Q466 196 468 215 Q466 235 448 246 Q438 250 433 242 Q442 231 444 215 Q442 198 433 188 Z'
          : 'M436 182 Q452 191 454 208 Q452 226 436 236 Q427 240 422 232 Q430 222 432 208 Q430 192 422 183 Z'}
          fill="url(#skinFront)" stroke={isMale ? '#D0A878' : '#DEB898'} strokeWidth="0.6" />
        <path d={isMale ? 'M458 198 Q464 215 458 233' : 'M445 194 Q451 208 445 224'} stroke={isMale ? '#C09060' : '#C8A07A'} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.5" />

        {/* Hair */}
        {isMale ? (
          <g>
            <path d="M330 38 C412 38 462 94 464 172 Q460 132 438 96 C412 56 374 38 330 38 C286 38 248 56 222 96 Q200 132 196 172 C198 94 248 38 330 38 Z" fill="url(#hairFront)" />
            <path d="M330 38 Q290 44 260 64" stroke="#6A5040" strokeWidth="1" fill="none" opacity="0.25" />
            <path d="M330 38 Q370 44 400 64" stroke="#6A5040" strokeWidth="1" fill="none" opacity="0.25" />
          </g>
        ) : (
          <g>
            <path d="M330 44 C396 44 434 88 434 152 Q428 114 410 84 C388 50 360 40 330 40 C300 40 272 50 250 84 Q232 114 226 152 C226 88 264 44 330 44 Z" fill="url(#hairFront)" />
            <path d="M226 150 Q220 193 220 244 Q222 292 230 336 Q224 294 224 254 Q222 207 226 166" fill="url(#hairFront)" />
            <path d="M434 150 Q440 193 440 244 Q438 292 430 336 Q436 294 436 254 Q438 207 434 166" fill="url(#hairFront)" />
            <path d="M264 70 Q286 54 312 50 Q330 48 348 50 Q374 54 396 70 Q374 62 348 59 Q330 57 312 59 Q286 62 264 70" fill="url(#hairFront)" opacity="0.85" />
            <ellipse cx="330" cy="24" rx="38" ry="28" fill="url(#hairBun)" />
            <ellipse cx="328" cy="22" rx="28" ry="20" fill="#F0D888" opacity="0.22" />
            <path d="M302 28 Q316 18 330 16 Q344 18 358 28" stroke="#7A5818" strokeWidth="1.8" fill="none" opacity="0.4" strokeLinecap="round" />
            <path d="M320 42 Q325 32 330 28 Q335 32 340 42" stroke="#7A5818" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          </g>
        )}

        {/* Eyebrows */}
        {isMale ? (
          <g>
            <path d="M238 140 Q258 127 286 125 Q308 125 320 132" stroke="url(#browGrad)" strokeWidth="7.5" strokeLinecap="round" fill="none" />
            <path d="M340 132 Q352 125 374 125 Q402 127 422 140" stroke="url(#browGrad)" strokeWidth="7.5" strokeLinecap="round" fill="none" />
          </g>
        ) : (
          <g>
            <path d="M248 132 Q267 120 292 118 Q310 118 322 124" stroke="url(#browGrad)" strokeWidth="4.5" strokeLinecap="round" fill="none" />
            <path d="M338 124 Q350 118 368 118 Q393 120 412 132" stroke="url(#browGrad)" strokeWidth="4.5" strokeLinecap="round" fill="none" />
          </g>
        )}

        {/* Eyes */}
        {[
          { cx: isMale ? 284 : 286, clipId: 'eyeFL', irisId: 'irisLeft', cy: isMale ? 170 : 166 },
          { cx: isMale ? 376 : 374, clipId: 'eyeFR', irisId: 'irisRight', cy: isMale ? 170 : 166 },
        ].map(({ cx, clipId, irisId, cy }) => (
          <g key={clipId}>
            <ellipse cx={cx} cy={cy} rx={isMale ? 30 : 27} ry={isMale ? 14 : 13} fill={isMale ? '#D0A878' : '#C8A07A'} opacity="0.28" />
            <path d={`M${cx-30} ${cy} Q${cx} ${cy-(isMale?22:20)} ${cx+30} ${cy} Q${cx} ${cy+(isMale?18:16)} ${cx-30} ${cy}`} fill="white" />
            <path d={`M${cx-30} ${cy} Q${cx} ${cy-(isMale?22:20)} ${cx+30} ${cy}`} stroke={isMale ? '#5A4020' : '#5A3010'} strokeWidth={isMale ? '2.2' : '1.8'} fill="none" />
            <path d={`M${cx-30} ${cy} Q${cx} ${cy+(isMale?18:16)} ${cx+30} ${cy}`} stroke={isMale ? '#D0A878' : '#C8A07A'} strokeWidth="0.9" fill="none" />
            <clipPath id={clipId}>
              <path d={`M${cx-30} ${cy} Q${cx} ${cy-(isMale?22:20)} ${cx+30} ${cy} Q${cx} ${cy+(isMale?18:16)} ${cx-30} ${cy}`} />
            </clipPath>
            <g clipPath={`url(#${clipId})`}>
              <circle cx={cx} cy={cy-1} r="14" fill={`url(#${irisId})`} />
              <circle cx={cx} cy={cy-1} r="14" fill="none" stroke="#2A5878" strokeWidth="1.5" />
              <circle cx={cx} cy={cy-1} r="8" fill="#0A1820" />
              <circle cx={cx+4} cy={cy-5} r="3.5" fill="white" opacity="0.92" />
              <circle cx={cx-3} cy={cy+3} r="1.5" fill="white" opacity="0.4" />
            </g>
            {!isMale && (
              <g stroke="#5A3010" strokeWidth="1.1" fill="none" strokeLinecap="round">
                {[cx-22, cx-11, cx, cx+11, cx+22].map((x, i) => (
                  <path key={i} d={`M${x} ${cy-17} Q${x+(i<2?-2:i>2?2:0)} ${cy-25} ${x+(i<2?-3:i>2?3:0)} ${cy-29}`} />
                ))}
              </g>
            )}
          </g>
        ))}

        {/* Nose */}
        <path d={isMale
          ? 'M322 148 Q317 178 318 208 Q321 226 330 236 Q339 226 342 208 Q343 178 338 148'
          : 'M324 130 Q321 158 322 184 Q325 200 330 209 Q335 200 338 184 Q339 158 336 130'}
          stroke={isMale ? '#D0A878' : '#DEB898'} strokeWidth={isMale ? '1.3' : '1.1'} fill="none" opacity="0.6" />
        <ellipse cx="330" cy={isMale ? '234' : '208'} rx={isMale ? '14' : '12'} ry={isMale ? '7' : '6'} fill={isMale ? '#D0A878' : '#DEB898'} opacity="0.35" />
        <ellipse cx={isMale ? '316' : '318'} cy={isMale ? '238' : '212'} rx={isMale ? '10' : '8'} ry={isMale ? '6' : '5'} fill={isMale ? '#C09060' : '#C8A07A'} opacity="0.5" />
        <ellipse cx={isMale ? '344' : '342'} cy={isMale ? '238' : '212'} rx={isMale ? '10' : '8'} ry={isMale ? '6' : '5'} fill={isMale ? '#C09060' : '#C8A07A'} opacity="0.5" />
        <path d={isMale ? 'M318 206 Q310 218 308 232' : 'M322 192 Q315 204 313 216'} stroke={isMale ? '#C09060' : '#C8A07A'} strokeWidth="1.1" fill="none" opacity="0.5" strokeLinecap="round" />
        <path d={isMale ? 'M342 206 Q350 218 352 232' : 'M338 192 Q345 204 347 216'} stroke={isMale ? '#C09060' : '#C8A07A'} strokeWidth="1.1" fill="none" opacity="0.5" strokeLinecap="round" />

        {/* Nasolabial */}
        <path d={isMale ? 'M308 240 Q295 260 290 282' : 'M313 218 Q303 236 299 256'} stroke={isMale ? '#C09060' : '#C8A07A'} strokeWidth="0.9" fill="none" opacity="0.4" strokeLinecap="round" />
        <path d={isMale ? 'M352 240 Q365 260 370 282' : 'M347 218 Q357 236 361 256'} stroke={isMale ? '#C09060' : '#C8A07A'} strokeWidth="0.9" fill="none" opacity="0.4" strokeLinecap="round" />

        {/* Lips */}
        <path d={isMale
          ? 'M292 284 Q310 270 322 275 Q330 270 338 275 Q350 270 368 284 Q350 278 330 278 Q310 278 292 284'
          : 'M298 260 Q315 247 323 251 Q330 246 337 251 Q345 247 362 260 Q345 255 330 255 Q315 255 298 260'}
          fill="url(#lipTop)" />
        <path d={isMale
          ? 'M300 275 Q315 268 330 272 Q345 268 360 275'
          : 'M307 249 Q320 243 330 247 Q340 243 353 249'}
          stroke={isMale ? '#B07060' : '#C87070'} strokeWidth="0.7" fill="none" />
        <path d={isMale
          ? 'M292 284 Q330 308 368 284 Q354 302 330 306 Q306 302 292 284'
          : 'M298 260 Q330 282 362 260 Q348 276 330 280 Q312 276 298 260'}
          fill="url(#lipBot)" />
        <path d={isMale ? 'M292 284 Q330 288 368 284' : 'M298 260 Q330 264 362 260'} stroke={isMale ? '#B07060' : '#C87070'} strokeWidth="1.0" fill="none" />
        <path d={isMale ? 'M314 296 Q330 303 346 296' : 'M315 269 Q330 276 345 269'} stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round" fill="none" />

        {/* Chin */}
        <path d={isMale
          ? 'M304 370 Q330 386 356 370 Q345 380 330 384 Q315 380 304 370'
          : 'M310 338 Q330 352 350 338 Q341 348 330 350 Q319 348 310 338'}
          fill={isMale ? '#D0A878' : '#DEB898'} opacity="0.28" />

        {/* Regions */}
        {showRegions && (
          <g opacity="0" pointerEvents="none">
            <ellipse cx="330" cy={isMale ? '98' : '90'} rx={isMale ? '78' : '72'} ry={isMale ? '46' : '40'} fill="#7B5CF5" />
            <ellipse cx="330" cy={isMale ? '138' : '126'} rx="26" ry="15" fill="#7B5CF5" />
            <ellipse cx={isMale ? '278' : '280'} cy={isMale ? '172' : '167'} rx="38" ry="24" fill="#7B5CF5" />
            <ellipse cx={isMale ? '382' : '380'} cy={isMale ? '172' : '167'} rx="38" ry="24" fill="#7B5CF5" />
            <ellipse cx="330" cy={isMale ? '200' : '178'} rx="26" ry="38" fill="#7B5CF5" />
            <ellipse cx={isMale ? '246' : '252'} cy={isMale ? '238' : '222'} rx="38" ry="28" fill="#7B5CF5" />
            <ellipse cx={isMale ? '414' : '408'} cy={isMale ? '238' : '222'} rx="38" ry="28" fill="#7B5CF5" />
            <ellipse cx="330" cy={isMale ? '278' : '253'} rx="50" ry="18" fill="#7B5CF5" />
            <ellipse cx="330" cy={isMale ? '300' : '272'} rx="48" ry="18" fill="#7B5CF5" />
            <ellipse cx="330" cy={isMale ? '348' : '320'} rx="46" ry="30" fill="#7B5CF5" />
            <ellipse cx={isMale ? '246' : '254'} cy={isMale ? '322' : '305'} rx="38" ry="44" fill="#7B5CF5" />
            <ellipse cx={isMale ? '414' : '406'} cy={isMale ? '322' : '305'} rx="38" ry="44" fill="#7B5CF5" />
          </g>
        )}

        {showMuscles && (
          <g opacity="0.12" pointerEvents="none">
            <path d={isMale ? 'M260 65 Q330 54 400 65 Q400 100 330 96 Q260 100 260 65' : 'M264 62 Q330 52 396 62 Q396 95 330 91 Q264 95 264 62'} fill="#C0392B" />
            <ellipse cx={isMale ? '284' : '286'} cy={isMale ? '172' : '167'} rx="32" ry="22" fill="#2980B9" />
            <ellipse cx={isMale ? '376' : '374'} cy={isMale ? '172' : '167'} rx="32" ry="22" fill="#2980B9" />
            <path d={isMale ? 'M218 245 Q270 264 300 296' : 'M224 232 Q272 250 298 278'} stroke="#27AE60" strokeWidth="14" fill="none" strokeLinecap="round" />
            <path d={isMale ? 'M442 245 Q390 264 360 296' : 'M436 232 Q388 250 362 278'} stroke="#27AE60" strokeWidth="14" fill="none" strokeLinecap="round" />
            <ellipse cx="330" cy={isMale ? '294' : '270'} rx="52" ry="24" fill="#E67E22" />
          </g>
        )}

        {children}
      </svg>
    )
  }
)

FaceMap.displayName = 'FaceMap'
export default FaceMap
