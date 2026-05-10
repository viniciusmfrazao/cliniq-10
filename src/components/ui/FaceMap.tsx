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
      ? { s0: '#F2D9C6', s1: '#E8C9AF', s2: '#D4AD91', s3: '#C49A7E', shadow: '#B8896D' }
      : { s0: '#FCE8D5', s1: '#F5D5BC', s2: '#E8C4A8', s3: '#D9AE90', shadow: '#CCAA8A' }
    const hair = isMale ? '#2C1E14' : '#3D2B1F'
    const hairMid = isMale ? '#3D2B1F' : '#5C3D28'
    const lip = isMale ? { t: '#C9958A', b: '#BD8278' } : { t: '#E8A59E', b: '#D4908A' }
    const iris = isMale ? '#5C4A35' : '#6B5240'

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
            <radialGradient id="sg-side" cx="40%" cy="35%" r="65%">
              <stop offset="0%" stopColor={skin.s0} />
              <stop offset="50%" stopColor={skin.s1} />
              <stop offset="100%" stopColor={skin.s2} />
            </radialGradient>
            <linearGradient id="hair-side" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={hairMid} />
              <stop offset="100%" stopColor={hair} />
            </linearGradient>
            <radialGradient id="cheek-side" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#E8A090" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#E8A090" stopOpacity="0" />
            </radialGradient>
          </defs>

          <path
            d={isMale
              ? 'M120 355 Q130 390 140 410 L175 410 Q185 390 195 355'
              : 'M115 350 Q125 385 135 405 L170 405 Q180 385 190 350'}
            fill="url(#sg-side)" stroke={skin.s2} strokeWidth="0.5"
          />
          <path
            d={isMale
              ? `M70 110 C68 80 80 50 110 35 C140 22 180 22 215 40 C245 55 260 85 260 120
                 L258 200 C255 240 248 275 235 295 Q220 315 200 325
                 L175 330 Q155 335 140 330 Q125 325 115 318
                 Q95 305 85 280 Q72 255 70 210 Z`
              : `M75 120 C73 88 85 55 115 38 C143 24 178 24 208 40 C235 55 248 82 248 115
                 L246 195 C243 235 237 265 225 285 Q212 305 194 315
                 L170 320 Q152 325 138 320 Q125 315 115 308
                 Q98 296 90 272 Q78 248 75 205 Z`}
            fill="url(#sg-side)" stroke={skin.s2} strokeWidth="0.8"
          />
          <ellipse cx={isMale ? '165' : '158'} cy="195" rx="35" ry="28" fill="url(#cheek-side)" />
          
          {isMale ? (
            <g>
              <path
                d={`M70 115 C70 68 95 35 140 25 C180 18 220 28 248 55 C258 68 262 88 260 110
                    L252 108 C250 88 243 70 230 55 C205 32 168 25 135 30 C100 36 80 60 80 110 Z`}
                fill="url(#hair-side)"
              />
            </g>
          ) : (
            <g>
              <path
                d={`M75 118 C74 72 98 40 143 28 C180 20 218 30 244 56 C254 68 250 88 248 112
                    L240 110 C238 90 230 72 215 58 C192 36 158 28 130 32 C96 38 84 65 85 118 Z`}
                fill="url(#hair-side)"
              />
              <path
                d="M75 115 Q68 165 70 220 Q72 270 80 320 Q85 355 95 380 Q88 345 84 300 Q80 255 80 215 Q80 168 80 118"
                fill="url(#hair-side)"
              />
            </g>
          )}

          <path
            d={isMale
              ? 'M68 168 Q50 178 48 195 Q50 215 68 225 Q78 228 82 220 Q75 210 72 195 Q75 178 82 170 Z'
              : '72 162 Q54 173 52 190 Q54 210 72 220 Q82 223 86 215 Q79 205 76 190 Q79 174 86 164 Z'}
            fill="url(#sg-side)" stroke={skin.s2} strokeWidth="0.6"
          />

          <path
            d={isMale ? 'M130 118 Q155 108 195 112' : 'M128 122 Q150 113 184 118'}
            stroke={hair} strokeWidth={isMale ? 5.5 : 3.5}
            strokeLinecap="round" fill="none"
          />

          <g>
            <path d="M145 158 Q168 144 192 156 Q168 170 145 158" fill="white" />
            <path d="M145 158 Q168 144 192 156" stroke={hair} strokeWidth="1.5" fill="none" />
            <ellipse cx="168" cy="157" rx="10" ry="9" fill={iris} />
            <circle cx="168" cy="157" r="6" fill="#1a1410" />
            <circle cx="171" cy="154" r="2" fill="white" opacity="0.85" />
          </g>

          <path
            d={isMale
              ? 'M148 262 Q158 252 168 255 Q178 252 185 262'
              : 'M143 255 Q153 244 163 248 Q173 244 180 255'}
            fill={lip.t} stroke={lip.b} strokeWidth="0.5"
          />
          <path
            d={isMale
              ? 'M148 262 Q158 272 168 270 Q178 272 185 262'
              : 'M143 255 Q153 265 163 263 Q173 265 180 255'}
            fill={lip.b}
          />

          {showRegions && (
            <g opacity="0.15" pointerEvents="none">
              <ellipse cx={isMale ? '170' : '162'} cy="155" rx="30" ry="20" fill="#8B5CF6" />
              <ellipse cx={isMale ? '168' : '160'} cy="215" rx="20" ry="15" fill="#8B5CF6" />
            </g>
          )}
          {children}
        </svg>
      )
    }

    return (
      <svg
        ref={ref}
        viewBox="0 0 320 440"
        className="w-full max-w-[380px] mx-auto cursor-crosshair select-none"
        onClick={onClick}
      >
        <defs>
          <radialGradient id="sg-base" cx="50%" cy="35%" r="65%">
            <stop offset="0%" stopColor={skin.s0} />
            <stop offset="55%" stopColor={skin.s1} />
            <stop offset="100%" stopColor={skin.s2} />
          </radialGradient>
          <radialGradient id="sg-neck" cx="50%" cy="20%" r="70%">
            <stop offset="0%" stopColor={skin.s1} />
            <stop offset="100%" stopColor={skin.s2} />
          </radialGradient>
          <radialGradient id="shadow-l" cx="0%" cy="50%" r="100%">
            <stop offset="0%" stopColor={skin.s3} stopOpacity="0.45" />
            <stop offset="100%" stopColor={skin.s3} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="shadow-r" cx="100%" cy="50%" r="100%">
            <stop offset="0%" stopColor={skin.s3} stopOpacity="0.45" />
            <stop offset="100%" stopColor={skin.s3} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="shadow-jaw" cx="50%" cy="100%" r="60%">
            <stop offset="0%" stopColor={skin.shadow} stopOpacity="0.4" />
            <stop offset="100%" stopColor={skin.shadow} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="blush-l" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#E8A090" stopOpacity={isMale ? '0.10' : '0.20'} />
            <stop offset="100%" stopColor="#E8A090" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="blush-r" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#E8A090" stopOpacity={isMale ? '0.10' : '0.20'} />
            <stop offset="100%" stopColor="#E8A090" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="hair-top" x1="20%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%" stopColor={hairMid} />
            <stop offset="60%" stopColor={hair} />
            <stop offset="100%" stopColor="#1a0e08" />
          </linearGradient>
          <linearGradient id="hair-hi" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={hairMid} stopOpacity="0.6" />
            <stop offset="100%" stopColor={hairMid} stopOpacity="0" />
          </linearGradient>
          <radialGradient id="iris-l" cx="38%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#8B7055" />
            <stop offset="40%" stopColor={iris} />
            <stop offset="100%" stopColor="#2a1e10" />
          </radialGradient>
          <radialGradient id="iris-r" cx="62%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#8B7055" />
            <stop offset="40%" stopColor={iris} />
            <stop offset="100%" stopColor="#2a1e10" />
          </radialGradient>
          <linearGradient id="lip-top" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={lip.t} />
            <stop offset="100%" stopColor={lip.b} />
          </linearGradient>
          <linearGradient id="lip-bot" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={lip.b} />
            <stop offset="100%" stopColor="#A0706A" />
          </linearGradient>
          <linearGradient id="eyebrow-g" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={hair} stopOpacity="0.5" />
            <stop offset="30%" stopColor={hair} />
            <stop offset="100%" stopColor={hair} stopOpacity="0.6" />
          </linearGradient>
          <filter id="soft" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="0.8" />
          </filter>
        </defs>

        {/* Pescoço */}
        <path
          d={isMale
            ? 'M128 368 Q132 400 138 420 L182 420 Q188 400 192 368 Q175 378 160 378 Q145 378 128 368'
            : 'M132 362 Q136 395 142 415 L178 415 Q184 395 188 362 Q173 372 160 372 Q147 372 132 362'}
          fill="url(#sg-neck)"
        />

        {/* Rosto */}
        <path
          d={isMale
            ? `M160 35 C230 35 278 82 278 152 L276 225 C274 268 265 302 248 325
               Q232 348 210 360 Q185 372 160 372 Q135 372 110 360 Q88 348 72 325
               C55 302 46 268 44 225 L42 152 C42 82 90 35 160 35 Z`
            : `M160 40 C225 40 268 84 268 148 L266 220 C264 260 256 292 241 313
               Q226 334 206 346 Q184 358 160 358 Q136 358 114 346 Q94 334 79 313
               C64 292 56 260 54 220 L52 148 C52 84 95 40 160 40 Z`}
          fill="url(#sg-base)" stroke={skin.s2} strokeWidth="0.5"
        />
        <path
          d={isMale ? 'M42 152 C42 82 90 35 160 35 L42 152' : 'M52 148 C52 84 95 40 160 40 L52 148'}
          fill="url(#shadow-l)"
        />
        <path
          d={isMale ? 'M278 152 C278 82 230 35 160 35 L278 152' : 'M268 148 C268 84 225 40 160 40 L268 148'}
          fill="url(#shadow-r)"
        />
        <ellipse cx="160" cy={isMale ? '360' : '345'} rx={isMale ? '80' : '72'} ry="22" fill="url(#shadow-jaw)" />

        {/* Bochechas */}
        <ellipse cx={isMale ? '92' : '96'} cy={isMale ? '222' : '215'} rx="42" ry="30" fill="url(#blush-l)" />
        <ellipse cx={isMale ? '228' : '224'} cy={isMale ? '222' : '215'} rx="42" ry="30" fill="url(#blush-r)" />

        {isMale && <g opacity="0.10"><ellipse cx="160" cy="340" rx="65" ry="38" fill="#7a6a5a" /><ellipse cx="160" cy="318" rx="52" ry="28" fill="#7a6a5a" /></g>}

        {/* Orelhas */}
        <path
          d={isMale
            ? 'M42 168 Q24 178 22 198 Q22 220 40 232 Q50 238 55 230 Q46 218 44 198 Q46 178 55 168 Z'
            : 'M52 165 Q36 175 34 193 Q34 213 50 224 Q59 230 64 222 Q56 212 54 193 Q56 175 64 165 Z'}
          fill="url(#sg-base)" stroke={skin.s2} strokeWidth="0.5"
        />
        <path d={isMale ? 'M34 180 Q28 198 34 218' : 'M42 177 Q36 193 42 211'} stroke={skin.s3} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.55" />
        <path
          d={isMale
            ? 'M278 168 Q296 178 298 198 Q298 220 280 232 Q270 238 265 230 Q274 218 276 198 Q274 178 265 168 Z'
            : 'M268 165 Q284 175 286 193 Q286 213 270 224 Q261 230 256 222 Q264 212 266 193 Q264 175 256 165 Z'}
          fill="url(#sg-base)" stroke={skin.s2} strokeWidth="0.5"
        />
        <path d={isMale ? 'M286 180 Q292 198 286 218' : 'M278 177 Q284 193 278 211'} stroke={skin.s3} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.55" />

        {/* Cabelo */}
        {isMale ? (
          <g>
            <path
              d="M160 28 C240 28 292 78 294 155 Q292 118 272 84 C248 46 208 28 160 28 C112 28 72 46 48 84 Q28 118 26 155 C28 78 80 28 160 28 Z"
              fill="url(#hair-top)"
            />
          </g>
        ) : (
          <g>
            <path
              d="M160 32 C235 32 278 80 278 148 Q275 112 258 82 C238 48 202 32 160 32 C118 32 82 48 62 82 Q45 112 42 148 C42 80 85 32 160 32 Z"
              fill="url(#hair-top)"
            />
            <path
              d="M42 148 Q36 190 34 240 Q32 295 38 340 Q44 370 55 390 Q46 358 44 318 Q40 270 42 225 Q44 190 48 158"
              fill="url(#hair-top)"
            />
            <path
              d="M278 148 Q284 190 286 240 Q288 295 282 340 Q276 370 265 390 Q274 358 276 318 Q280 270 278 225 Q276 190 272 158"
              fill="url(#hair-top)"
            />
            <path
              d="M88 68 Q110 52 140 48 Q160 46 180 48 Q210 52 232 68 Q212 58 180 55 Q160 53 140 55 Q108 58 88 68"
              fill="url(#hair-top)" opacity="0.9"
            />
          </g>
        )}

        {/* Sobrancelhas */}
        {isMale ? (
          <g>
            <path d="M84 118 Q100 108 128 108 Q148 109 158 115" stroke="url(#eyebrow-g)" strokeWidth="6.5" strokeLinecap="round" fill="none" />
            <path d="M162 115 Q172 109 192 108 Q220 108 236 118" stroke="url(#eyebrow-g)" strokeWidth="6.5" strokeLinecap="round" fill="none" />
          </g>
        ) : (
          <g>
            <path d="M90 122 Q108 110 135 108 Q152 108 162 114" stroke="url(#eyebrow-g)" strokeWidth="4" strokeLinecap="round" fill="none" />
            <path d="M158 114 Q168 108 185 108 Q212 110 230 122" stroke="url(#eyebrow-g)" strokeWidth="4" strokeLinecap="round" fill="none" />
          </g>
        )}

        {/* Olhos */}
        <g>
          <ellipse cx="120" cy="155" rx="26" ry="12" fill={skin.s2} filter="url(#soft)" opacity="0.5" />
          <path d="M94 155 Q120 138 146 155 Q120 172 94 155" fill="white" />
          <path d="M94 155 Q120 138 146 155" stroke={hair} strokeWidth={isMale ? '1.8' : '1.5'} fill="none" />
          <path d="M94 155 Q120 168 146 155" stroke={skin.s3} strokeWidth="0.7" fill="none" />
          <clipPath id="eye-clip-l"><path d="M94 155 Q120 138 146 155 Q120 172 94 155" /></clipPath>
          <g clipPath="url(#eye-clip-l)">
            <circle cx="120" cy="155" r="12" fill="url(#iris-l)" />
            <circle cx="120" cy="155" r="7.5" fill="#1a1410" />
            <circle cx="123" cy="151" r="2.8" fill="white" opacity="0.9" />
          </g>
          {!isMale && (
            <g stroke={hair} strokeWidth="1" fill="none" strokeLinecap="round">
              <path d="M98 152 Q96 145 95 140" /><path d="M108 146 Q108 139 108 134" />
              <path d="M120 143 Q121 136 121 131" /><path d="M132 146 Q133 139 135 134" />
              <path d="M142 152 Q144 145 145 140" />
            </g>
          )}
        </g>
        <g>
          <ellipse cx="200" cy="155" rx="26" ry="12" fill={skin.s2} filter="url(#soft)" opacity="0.5" />
          <path d="M174 155 Q200 138 226 155 Q200 172 174 155" fill="white" />
          <path d="M174 155 Q200 138 226 155" stroke={hair} strokeWidth={isMale ? '1.8' : '1.5'} fill="none" />
          <path d="M174 155 Q200 168 226 155" stroke={skin.s3} strokeWidth="0.7" fill="none" />
          <clipPath id="eye-clip-r"><path d="M174 155 Q200 138 226 155 Q200 172 174 155" /></clipPath>
          <g clipPath="url(#eye-clip-r)">
            <circle cx="200" cy="155" r="12" fill="url(#iris-r)" />
            <circle cx="200" cy="155" r="7.5" fill="#1a1410" />
            <circle cx="203" cy="151" r="2.8" fill="white" opacity="0.9" />
          </g>
          {!isMale && (
            <g stroke={hair} strokeWidth="1" fill="none" strokeLinecap="round">
              <path d="M178 152 Q176 145 175 140" /><path d="M188 146 Q188 139 188 134" />
              <path d="M200 143 Q201 136 201 131" /><path d="M212 146 Q213 139 215 134" />
              <path d="M222 152 Q224 145 225 140" />
            </g>
          )}
        </g>

        {/* Nariz */}
        <path
          d={isMale ? 'M152 122 Q148 158 148 188 Q150 205 160 215 Q170 205 172 188 Q172 158 168 122' : 'M155 120 Q152 155 153 182 Q156 198 160 207 Q164 198 167 182 Q168 155 165 120'}
          stroke={skin.s2} strokeWidth={isMale ? '1.2' : '0.8'} fill="none" opacity="0.7"
        />
        <ellipse cx={isMale ? '148' : '151'} cy={isMale ? '218' : '213'} rx={isMale ? '9' : '7'} ry={isMale ? '5' : '4'} fill={skin.s3} opacity="0.55" />
        <ellipse cx={isMale ? '172' : '169'} cy={isMale ? '218' : '213'} rx={isMale ? '9' : '7'} ry={isMale ? '5' : '4'} fill={skin.s3} opacity="0.55" />
        <ellipse cx="160" cy={isMale ? '215' : '210'} rx={isMale ? '14' : '11'} ry={isMale ? '6' : '5'} fill={skin.s2} opacity="0.4" />

        {/* Lábios */}
        <path
          d={isMale
            ? 'M120 258 Q135 248 148 252 Q160 248 172 252 Q185 248 200 258 Q185 255 160 255 Q135 255 120 258'
            : 'M118 252 Q133 240 147 244 Q160 240 173 244 Q187 240 202 252 Q187 249 160 249 Q133 249 118 252'}
          fill="url(#lip-top)"
        />
        <path
          d={isMale
            ? 'M120 258 Q160 280 200 258 Q185 275 160 278 Q135 275 120 258'
            : 'M118 252 Q160 272 202 252 Q188 268 160 272 Q132 268 118 252'}
          fill="url(#lip-bot)"
        />
        <path
          d={isMale ? 'M120 258 Q160 262 200 258' : 'M118 252 Q160 256 202 252'}
          stroke={lip.b} strokeWidth="0.8" fill="none"
        />
        <path
          d={isMale ? 'M142 270 Q160 276 178 270' : 'M142 263 Q160 268 178 263'}
          stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" fill="none"
        />

        {/* Nasolabial */}
        <path
          d={isMale ? 'M138 220 Q128 240 122 260 M182 220 Q192 240 198 260' : 'M140 215 Q132 232 127 252 M180 215 Q188 232 193 252'}
          stroke={skin.s3} strokeWidth="0.8" fill="none" opacity="0.4" strokeLinecap="round"
        />

        {/* Regiões */}
        {showRegions && (
          <g opacity="0" pointerEvents="none">
            <ellipse cx="160" cy="88" rx="65" ry="38" fill="#8B5CF6" />
            <ellipse cx="160" cy="118" rx="22" ry="12" fill="#8B5CF6" />
            <ellipse cx="105" cy="155" rx="35" ry="22" fill="#8B5CF6" />
            <ellipse cx="215" cy="155" rx="35" ry="22" fill="#8B5CF6" />
            <ellipse cx="160" cy="185" rx="22" ry="32" fill="#8B5CF6" />
            <ellipse cx="92" cy="205" rx="35" ry="25" fill="#8B5CF6" />
            <ellipse cx="228" cy="205" rx="35" ry="25" fill="#8B5CF6" />
            <ellipse cx="160" cy="248" rx="45" ry="16" fill="#8B5CF6" />
            <ellipse cx="160" cy="268" rx="42" ry="15" fill="#8B5CF6" />
            <ellipse cx="160" cy="320" rx="40" ry="28" fill="#8B5CF6" />
            <ellipse cx="90" cy="295" rx="32" ry="40" fill="#8B5CF6" />
            <ellipse cx="230" cy="295" rx="32" ry="40" fill="#8B5CF6" />
          </g>
        )}

        {showMuscles && (
          <g opacity="0.12" pointerEvents="none">
            <path d="M110 55 Q160 48 210 55 Q210 85 160 82 Q110 85 110 55" fill="#C0392B" />
            <ellipse cx="120" cy="155" rx="30" ry="20" fill="#2980B9" />
            <ellipse cx="200" cy="155" rx="30" ry="20" fill="#2980B9" />
            <path d="M72 210 Q120 225 148 255" stroke="#27AE60" strokeWidth="12" fill="none" strokeLinecap="round" />
            <path d="M248 210 Q200 225 172 255" stroke="#27AE60" strokeWidth="12" fill="none" strokeLinecap="round" />
            <ellipse cx="160" cy="260" rx="45" ry="22" fill="#E67E22" />
          </g>
        )}

        {children}
      </svg>
    )
  }
)

FaceMap.displayName = 'FaceMap'
export default FaceMap
