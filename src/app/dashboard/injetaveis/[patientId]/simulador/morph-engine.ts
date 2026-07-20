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

// Suavização local (para "smooth": rugas / sulcos) — blur mascarado radial.
// Kernel maior + preservação parcial de bordas fortes pra não "derreter" sobrancelha/cabelo.
function applySmooth(src: ImageData, op: WarpOp, amount: number): ImageData {
  const w = src.width
  const h = src.height
  const out = new ImageData(new Uint8ClampedArray(src.data), w, h)
  const r = op.radius
  const r2 = r * r
  const x0 = clamp(Math.floor(op.cx - r), 2, w - 3)
  const x1 = clamp(Math.ceil(op.cx + r), 2, w - 3)
  const y0 = clamp(Math.floor(op.cy - r), 2, h - 3)
  const y1 = clamp(Math.ceil(op.cy + r), 2, h - 3)
  const k = 4 // meia-janela do blur (maior = rugas mais apagadas)
  const d = src.data

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const vx = x - op.cx
      const vy = y - op.cy
      const d2 = vx * vx + vy * vy
      if (d2 >= r2) continue
      const t = 1 - d2 / r2
      let mix = clamp(amount * (t * t * 0.6 + t * 0.4), 0, 0.95)
      if (mix <= 0.01) continue

      const idx = (y * w + x) * 4
      // Preservação de borda: se o pixel é muito mais escuro que a média local
      // (sobrancelha, cílios, cabelo), reduz o blur pra não borrar traços fortes
      let sum0 = 0, sum1 = 0, sum2 = 0, n = 0
      for (let yy = -k; yy <= k; yy++) {
        const py = clamp(y + yy, 0, h - 1)
        for (let xx = -k; xx <= k; xx++) {
          const px = clamp(x + xx, 0, w - 1)
          const pi = (py * w + px) * 4
          sum0 += d[pi]; sum1 += d[pi + 1]; sum2 += d[pi + 2]
          n++
        }
      }
      const avg0 = sum0 / n, avg1 = sum1 / n, avg2 = sum2 / n
      const lumPix = (d[idx] + d[idx + 1] + d[idx + 2]) / 3
      const lumAvg = (avg0 + avg1 + avg2) / 3
      const diff = Math.abs(lumPix - lumAvg)
      if (diff > 45) mix *= 0.25 // borda forte (sobrancelha/olho): preserva

      out.data[idx] = d[idx] * (1 - mix) + avg0 * mix
      out.data[idx + 1] = d[idx + 1] * (1 - mix) + avg1 * mix
      out.data[idx + 2] = d[idx + 2] * (1 - mix) + avg2 * mix
    }
  }
  return out
}

// Realce labial: leve aumento de saturação/vermelho apenas em pixels já
// labiais (R dominante), pra dar o aspecto "preenchido" além do volume.
function applyLipEnhance(src: ImageData, op: WarpOp, amount: number): ImageData {
  const w = src.width
  const h = src.height
  const out = new ImageData(new Uint8ClampedArray(src.data), w, h)
  const r = op.radius
  const r2 = r * r
  const x0 = clamp(Math.floor(op.cx - r), 0, w - 1)
  const x1 = clamp(Math.ceil(op.cx + r), 0, w - 1)
  const y0 = clamp(Math.floor(op.cy - r), 0, h - 1)
  const y1 = clamp(Math.ceil(op.cy + r), 0, h - 1)
  const d = src.data

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const vx = x - op.cx
      const vy = y - op.cy
      const d2 = vx * vx + vy * vy
      if (d2 >= r2) continue
      const idx = (y * w + x) * 4
      const R = d[idx], G = d[idx + 1], B = d[idx + 2]
      // heurística de pixel labial: vermelho dominante e não muito claro (dente)
      if (!(R > G + 12 && R > B + 8 && R < 235)) continue
      const t = 1 - d2 / r2
      const f = clamp(amount * t * t, 0, 0.5)
      out.data[idx] = clamp(R + (255 - R) * f * 0.35, 0, 255)
      out.data[idx + 1] = clamp(G - G * f * 0.25, 0, 255)
      out.data[idx + 2] = clamp(B - B * f * 0.1, 0, 255)
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
    const unitFactor = type === 'toxin' ? units / 8 : units
    const mag = eff.base * unitFactor * intensity

    if (eff.kind === 'bulge') {
      const isLip = p.zone === 'lip'
      img = applyOp(img, {
        cx: p.x, cy: p.y,
        radius: baseRadius * (isLip ? 0.8 : 1),
        bulge: clamp(mag * 0.07, 0, 0.4),
      })
      if (isLip) {
        // aspecto "preenchido": leve realce de cor além do volume
        img = applyLipEnhance(img, { cx: p.x, cy: p.y, radius: baseRadius * 0.9 }, clamp(mag * 0.35, 0, 1))
      }
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
      // smooth: suaviza rugas/sulcos — passe duplo pra rugas marcadas
      const smoothOp = { cx: p.x, cy: p.y, radius: baseRadius * 1.15 }
      const amt = clamp(mag * 0.7, 0, 1)
      img = applySmooth(img, smoothOp, amt)
      if (amt > 0.45) img = applySmooth(img, smoothOp, amt * 0.6)
    }
  }
  return img
}
