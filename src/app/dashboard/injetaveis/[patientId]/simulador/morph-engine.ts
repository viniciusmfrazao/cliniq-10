// Motor de morphing 2D por deformação local (backward mapping + bilinear).
// Sem IA, sem servidor: roda 100% no browser via canvas ImageData.

export type WarpOp = {
  cx: number       // centro X (px na imagem)
  cy: number       // centro Y
  radius: number   // raio de influência (px)
  // shift: desloca pixels na direção (dx,dy) — efeito "lift" / "slim"
  dx?: number
  dy?: number
  // bulge: >0 expande radialmente (volume), <0 contrai (afinamento)
  bulge?: number
}

// Efeito visual por zona anatomica. strength será multiplicado pelas
// unidades/ml do ponto e pela intensidade global escolhida pelo usuário.
export type ZoneEffect = {
  kind: 'bulge' | 'lift' | 'slim' | 'smooth'
  base: number // magnitude base por unidade
}

export function zoneEffect(zone: string, type: string): ZoneEffect {
  const isToxin = type === 'toxin'
  if (isToxin) {
    switch (zone) {
      case 'forehead':
      case 'glabella':
      case 'crow_feet':
        return { kind: 'smooth', base: 0.9 }
      case 'eyebrow':
      case 'temporal':
        return { kind: 'lift', base: 0.5 }
      case 'jawline':
      case 'submandibular':
        return { kind: 'slim', base: 0.5 } // masseter/platisma
      default:
        return { kind: 'smooth', base: 0.5 }
    }
  }
  // filler
  switch (zone) {
    case 'lip':
      return { kind: 'bulge', base: 3.2 }
    case 'malar':
    case 'chin':
      return { kind: 'bulge', base: 2.4 }
    case 'jawline':
      return { kind: 'bulge', base: 1.8 }
    case 'nasolabial':
    case 'marionette':
      return { kind: 'smooth', base: 1.6 }
    case 'nose':
      return { kind: 'lift', base: 1.2 }
    default:
      return { kind: 'bulge', base: 1.6 }
  }
}

function clamp(v: number, min: number, max: number) {
  return v < min ? min : v > max ? max : v
}

// Amostragem bilinear de um ImageData fonte
function sampleBilinear(src: ImageData, x: number, y: number, out: Uint8ClampedArray, oi: number) {
  const w = src.width
  const h = src.height
  const x0 = clamp(Math.floor(x), 0, w - 1)
  const y0 = clamp(Math.floor(y), 0, h - 1)
  const x1 = clamp(x0 + 1, 0, w - 1)
  const y1 = clamp(y0 + 1, 0, h - 1)
  const fx = x - x0
  const fy = y - y0
  const d = src.data
  for (let c = 0; c < 4; c++) {
    const p00 = d[(y0 * w + x0) * 4 + c]
    const p10 = d[(y0 * w + x1) * 4 + c]
    const p01 = d[(y1 * w + x0) * 4 + c]
    const p11 = d[(y1 * w + x1) * 4 + c]
    out[oi + c] =
      p00 * (1 - fx) * (1 - fy) +
      p10 * fx * (1 - fy) +
      p01 * (1 - fx) * fy +
      p11 * fx * fy
  }
}

// Aplica uma operação de warp sobre um ImageData e retorna um novo ImageData
function applyOp(src: ImageData, op: WarpOp): ImageData {
  const w = src.width
  const h = src.height
  const out = new ImageData(new Uint8ClampedArray(src.data), w, h)
  const r = op.radius
  const r2 = r * r
  const x0 = clamp(Math.floor(op.cx - r), 0, w - 1)
  const x1 = clamp(Math.ceil(op.cx + r), 0, w - 1)
  const y0 = clamp(Math.floor(op.cy - r), 0, h - 1)
  const y1 = clamp(Math.ceil(op.cy + r), 0, h - 1)

  const dx = op.dx || 0
  const dy = op.dy || 0
  const bulge = op.bulge || 0

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const vx = x - op.cx
      const vy = y - op.cy
      const d2 = vx * vx + vy * vy
      if (d2 >= r2) continue
      // falloff suave (smoothstep-like)
      const t = 1 - d2 / r2
      const f = t * t
      let sx = x
      let sy = y
      if (dx || dy) {
        // shift: pixel destino puxa da posição oposta ao deslocamento
        sx -= dx * f
        sy -= dy * f
      }
      if (bulge) {
        // bulge > 0: expande — destino amostra mais perto do centro
        const scale = 1 - bulge * f
        sx = op.cx + (sx - op.cx) * scale
        sy = op.cy + (sy - op.cy) * scale
      }
      sampleBilinear(src, sx, sy, out.data, (y * w + x) * 4)
    }
  }
  return out
}

// Suavização local (para "smooth": rugas / sulcos) — box blur mascarado radial
function applySmooth(src: ImageData, op: WarpOp, amount: number): ImageData {
  const w = src.width
  const h = src.height
  const out = new ImageData(new Uint8ClampedArray(src.data), w, h)
  const r = op.radius
  const r2 = r * r
  const x0 = clamp(Math.floor(op.cx - r), 1, w - 2)
  const x1 = clamp(Math.ceil(op.cx + r), 1, w - 2)
  const y0 = clamp(Math.floor(op.cy - r), 1, h - 2)
  const y1 = clamp(Math.ceil(op.cy + r), 1, h - 2)
  const k = 2 // meia-janela do blur
  const d = src.data

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const vx = x - op.cx
      const vy = y - op.cy
      const d2 = vx * vx + vy * vy
      if (d2 >= r2) continue
      const t = 1 - d2 / r2
      const mix = clamp(amount * t * t, 0, 0.85)
      if (mix <= 0.01) continue
      for (let c = 0; c < 3; c++) {
        let sum = 0
        let n = 0
        for (let yy = -k; yy <= k; yy++) {
          for (let xx = -k; xx <= k; xx++) {
            const px = clamp(x + xx, 0, w - 1)
            const py = clamp(y + yy, 0, h - 1)
            sum += d[(py * w + px) * 4 + c]
            n++
          }
        }
        const orig = d[(y * w + x) * 4 + c]
        out.data[(y * w + x) * 4 + c] = orig * (1 - mix) + (sum / n) * mix
      }
    }
  }
  return out
}

export type MorphPoint = {
  x: number      // px na imagem
  y: number
  zone: string
  units: number
  side?: string | null
}

// Constrói e aplica todos os efeitos. `intensity` é o slider global (0–2).
// `faceScale` ~ largura do rosto em px na foto (define raios).
export function renderMorph(
  source: ImageData,
  points: MorphPoint[],
  type: string,
  intensity: number,
  faceScale: number,
  faceCenterX: number
): ImageData {
  let img = source
  const baseRadius = faceScale * 0.13

  for (const p of points) {
    const eff = zoneEffect(p.zone, type)
    const units = Math.max(p.units || (type === 'toxin' ? 4 : 0.5), 0.1)
    // toxina em U (2–30), filler em ml (0.3–2) — normalizar magnitude
    const unitFactor = type === 'toxin' ? units / 10 : units
    const mag = eff.base * unitFactor * intensity

    if (eff.kind === 'bulge') {
      img = applyOp(img, {
        cx: p.x, cy: p.y,
        radius: baseRadius * (p.zone === 'lip' ? 0.75 : 1),
        bulge: clamp(mag * 0.06, 0, 0.35),
      })
    } else if (eff.kind === 'slim') {
      // puxa em direção ao centro do rosto (afinamento de masseter)
      const dir = p.x < faceCenterX ? 1 : -1
      img = applyOp(img, {
        cx: p.x, cy: p.y,
        radius: baseRadius * 1.2,
        dx: dir * mag * faceScale * 0.015,
      })
    } else if (eff.kind === 'lift') {
      img = applyOp(img, {
        cx: p.x, cy: p.y,
        radius: baseRadius,
        dy: -mag * faceScale * 0.012,
      })
    } else {
      // smooth: suaviza rugas/sulcos + micro-lift
      img = applySmooth(img, { cx: p.x, cy: p.y, radius: baseRadius }, clamp(mag * 0.5, 0, 1))
    }
  }
  return img
}
