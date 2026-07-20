// Motor de morphing 2D por deformação local (backward mapping + bilinear).
// Sem IA, sem servidor: roda 100% no browser via canvas ImageData.
//
// Filosofia de calibração: PISO PERCEPTUAL. Qualquer dose marcada já produz
// efeito claramente visível; a dose escala a intensidade a partir do piso.
//   filler:  0.5ml = contorno leve | 1ml = aumento nítido | 2ml+ = volume forte
//   toxina:  ~10U = suaviza | 20U+ = região lisa

export type WarpOp = {
  cx: number
  cy: number
  radius: number
  dx?: number
  dy?: number
  bulge?: number // >0 expande radialmente, <0 contrai
}

export type MorphPoint = {
  x: number
  y: number
  zone: string
  units: number
  side?: string | null
}

function clamp(v: number, min: number, max: number) {
  return v < min ? min : v > max ? max : v
}

// ── Curvas dose → intensidade (0..1), com piso perceptual ────────────────────
function fillerCurve(ml: number) {
  // 0.25ml→0.45 | 0.5ml→0.55 | 1ml→0.70 | 2ml→0.95 | 3ml+→1
  return clamp(0.38 + 0.3 * ml, 0, 1)
}
function toxinCurve(units: number) {
  // 4U→0.45 | 10U→0.63 | 20U→0.90 | 30U+→1
  return clamp(0.33 + units * 0.028, 0, 1)
}

// ── Primitivas de pixel ──────────────────────────────────────────────────────
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
      const t = 1 - d2 / r2
      const f = t * t
      let sx = x
      let sy = y
      if (dx || dy) {
        sx -= dx * f
        sy -= dy * f
      }
      if (bulge) {
        const scale = 1 - bulge * f
        sx = op.cx + (sx - op.cx) * scale
        sy = op.cy + (sy - op.cy) * scale
      }
      sampleBilinear(src, sx, sy, out.data, (y * w + x) * 4)
    }
  }
  return out
}

// Alisamento elíptico de REGIÃO (rugas): blur forte com preservação de bordas
// fortes (sobrancelha/olho/cabelo não derretem).
function applySmoothEllipse(
  src: ImageData,
  cx: number, cy: number, rx: number, ry: number,
  amount: number
): ImageData {
  const w = src.width
  const h = src.height
  const out = new ImageData(new Uint8ClampedArray(src.data), w, h)
  const x0 = clamp(Math.floor(cx - rx), 2, w - 3)
  const x1 = clamp(Math.ceil(cx + rx), 2, w - 3)
  const y0 = clamp(Math.floor(cy - ry), 2, h - 3)
  const y1 = clamp(Math.ceil(cy + ry), 2, h - 3)
  const k = 5
  const d = src.data

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const nx = (x - cx) / rx
      const ny = (y - cy) / ry
      const e = nx * nx + ny * ny
      if (e >= 1) continue
      const t = 1 - e
      let mix = clamp(amount * (0.3 + 0.7 * t), 0, 0.97)
      if (mix <= 0.02) continue

      const idx = (y * w + x) * 4
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
      // borda muito forte (sobrancelha, olho, cabelo): preserva
      if (diff > 55) mix *= 0.15
      else if (diff > 35) mix *= 0.55
      // rugas são pixels um pouco mais ESCUROS que a média — nesses, alisar mais
      else if (lumPix < lumAvg - 6) mix = clamp(mix * 1.25, 0, 0.97)

      out.data[idx] = d[idx] * (1 - mix) + avg0 * mix
      out.data[idx + 1] = d[idx + 1] * (1 - mix) + avg1 * mix
      out.data[idx + 2] = d[idx + 2] * (1 - mix) + avg2 * mix
    }
  }
  return out
}

// Preenchimento de olheira: clareia pixels mais escuros que a PELE AO REDOR
// (anel externo ao raio), então a sombra inteira clareia — não só as bordas.
function applyDarkCircleFill(src: ImageData, op: WarpOp, amount: number): ImageData {
  const w = src.width
  const h = src.height
  const out = new ImageData(new Uint8ClampedArray(src.data), w, h)
  const r = op.radius
  const r2 = r * r
  const d = src.data

  // 1) referência: luminância média da pele num anel r..1.5r ao redor
  let refSum = 0, refN = 0
  const rOut = r * 1.5
  const rOut2 = rOut * rOut
  const rx0 = clamp(Math.floor(op.cx - rOut), 0, w - 1)
  const rx1 = clamp(Math.ceil(op.cx + rOut), 0, w - 1)
  const ry0 = clamp(Math.floor(op.cy - rOut), 0, h - 1)
  const ry1 = clamp(Math.ceil(op.cy + rOut), 0, h - 1)
  for (let y = ry0; y <= ry1; y += 2) {
    for (let x = rx0; x <= rx1; x += 2) {
      const vx = x - op.cx
      const vy = y - op.cy
      const d2 = vx * vx + vy * vy
      if (d2 <= r2 || d2 > rOut2) continue
      const pi = (y * w + x) * 4
      refSum += (d[pi] + d[pi + 1] + d[pi + 2]) / 3
      refN++
    }
  }
  if (refN === 0) return out
  const ref = refSum / refN

  // 2) clarear pixels da região que estão abaixo da referência
  const x0 = clamp(Math.floor(op.cx - r), 0, w - 1)
  const x1 = clamp(Math.ceil(op.cx + r), 0, w - 1)
  const y0 = clamp(Math.floor(op.cy - r), 0, h - 1)
  const y1 = clamp(Math.ceil(op.cy + r), 0, h - 1)
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const vx = x - op.cx
      const vy = y - op.cy
      const d2 = vx * vx + vy * vy
      if (d2 >= r2) continue
      const t = 1 - d2 / r2
      const idx = (y * w + x) * 4
      const lumPix = (d[idx] + d[idx + 1] + d[idx + 2]) / 3
      const darkness = ref - lumPix
      if (darkness <= 5 || darkness > 90) continue // >90 = provável olho/cílio, não tocar
      const lift = clamp(darkness * amount * (0.35 + 0.65 * t), 0, 45)
      out.data[idx] = clamp(d[idx] + lift * 1.05, 0, 255)
      out.data[idx + 1] = clamp(d[idx + 1] + lift * 0.95, 0, 255)
      out.data[idx + 2] = clamp(d[idx + 2] + lift * 0.8, 0, 255)
    }
  }
  return out
}

// Realce labial: saturação/cor apenas em pixels labiais (R dominante)
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
      if (!(R > G + 12 && R > B + 8 && R < 235)) continue
      const t = 1 - d2 / r2
      const f = clamp(amount * (0.4 + 0.6 * t), 0, 0.6)
      out.data[idx] = clamp(R + (255 - R) * f * 0.4, 0, 255)
      out.data[idx + 1] = clamp(G - G * f * 0.3, 0, 255)
      out.data[idx + 2] = clamp(B - B * f * 0.12, 0, 255)
    }
  }
  return out
}

// ── Orquestração ─────────────────────────────────────────────────────────────
const SMOOTH_ZONES_TOXIN = new Set(['forehead', 'glabella', 'crow_feet', 'bunny_lines', 'perioral_upper', 'perioral_lower', 'neck'])
const SMOOTH_ZONES_FILLER = new Set(['nasolabial', 'marionette'])
const LIFT_ZONES = new Set(['eyebrow', 'temporal'])
const SLIM_ZONES = new Set(['jawline', 'submandibular']) // toxina (masseter/platisma)

export function renderMorph(
  source: ImageData,
  points: MorphPoint[],
  type: string,
  intensity: number,
  faceScale: number,
  faceCenterX: number
): ImageData {
  let img = source
  const baseRadius = faceScale * 0.14
  const isToxin = type === 'toxin'

  // 1) Zonas de ALISAMENTO agrupadas por região (testa lisa inteira, não círculos)
  const smoothSet = isToxin ? SMOOTH_ZONES_TOXIN : SMOOTH_ZONES_FILLER
  const smoothGroups: Record<string, MorphPoint[]> = {}
  const rest: MorphPoint[] = []
  for (const p of points) {
    if (smoothSet.has(p.zone)) {
      // agrupar zonas contíguas da fronte juntas
      const key = ['forehead', 'glabella'].includes(p.zone) ? 'front' : p.zone + (p.side === 'right' ? '_r' : p.side === 'left' ? '_l' : '')
      ;(smoothGroups[key] ||= []).push(p)
    } else {
      rest.push(p)
    }
  }

  for (const group of Object.values(smoothGroups)) {
    const dose = group.reduce((s, p) => s + (p.units || 0), 0)
    const amt = clamp((isToxin ? toxinCurve(dose) : fillerCurve(dose)) * intensity, 0, 1)
    if (amt <= 0.02) continue
    const xs = group.map(p => p.x)
    const ys = group.map(p => p.y)
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2
    const rx = Math.max((Math.max(...xs) - Math.min(...xs)) / 2 + baseRadius * 1.1, baseRadius * 1.3)
    const ry = Math.max((Math.max(...ys) - Math.min(...ys)) / 2 + baseRadius * 0.9, baseRadius * 1.0)
    img = applySmoothEllipse(img, cx, cy, rx, ry, amt)
    if (amt > 0.55) img = applySmoothEllipse(img, cx, cy, rx, ry, amt * 0.7) // passe 2: rugas marcadas
  }

  // 2) Lábios: dose TOTAL define o volume (0.5ml contorno, 1ml nítido, 2ml forte)
  const lipPoints = rest.filter(p => p.zone === 'lip')
  if (!isToxin && lipPoints.length > 0) {
    const totalMl = lipPoints.reduce((s, p) => s + (p.units || 0), 0)
    const amt = clamp(fillerCurve(totalMl) * intensity, 0, 1)
    const bulge = amt * 0.42
    for (const p of lipPoints) {
      img = applyOp(img, { cx: p.x, cy: p.y, radius: baseRadius * 0.85, bulge })
    }
    const cx = lipPoints.reduce((s, p) => s + p.x, 0) / lipPoints.length
    const cy = lipPoints.reduce((s, p) => s + p.y, 0) / lipPoints.length
    img = applyLipEnhance(img, { cx, cy, radius: baseRadius * 1.2 }, amt * 0.8)
  }

  // 3) Demais pontos individuais
  for (const p of rest) {
    if (p.zone === 'lip') continue // já tratado
    const dose = p.units || 0
    const amt = clamp((isToxin ? toxinCurve(dose) : fillerCurve(dose)) * intensity, 0, 1)
    if (amt <= 0.02) continue

    if (isToxin && SLIM_ZONES.has(p.zone)) {
      // masseter/platisma: afina puxando pro centro do rosto
      const dir = p.x < faceCenterX ? 1 : -1
      img = applyOp(img, {
        cx: p.x, cy: p.y,
        radius: baseRadius * 1.3,
        dx: dir * amt * faceScale * 0.035,
      })
    } else if (LIFT_ZONES.has(p.zone)) {
      img = applyOp(img, {
        cx: p.x, cy: p.y,
        radius: baseRadius * 1.1,
        dy: -amt * faceScale * 0.028,
      })
    } else if (!isToxin && p.zone === 'malar') {
      // malar: volume + preenchimento de olheira (clareia a sombra acima)
      img = applyOp(img, { cx: p.x, cy: p.y, radius: baseRadius * 1.15, bulge: amt * 0.3 })
      img = applyDarkCircleFill(img, { cx: p.x, cy: p.y - baseRadius * 0.55, radius: baseRadius * 0.95 }, amt * 0.9)
    } else if (!isToxin && p.zone === 'chin') {
      // mento: projeção pra baixo/frente + volume
      img = applyOp(img, {
        cx: p.x, cy: p.y,
        radius: baseRadius * 1.1,
        bulge: amt * 0.3,
        dy: amt * faceScale * 0.02,
      })
    } else if (!isToxin && p.zone === 'jawline') {
      // contorno mandibular: volume + expansão lateral (define o ângulo)
      const dir = p.x < faceCenterX ? -1 : 1
      img = applyOp(img, {
        cx: p.x, cy: p.y,
        radius: baseRadius * 1.15,
        bulge: amt * 0.28,
        dx: dir * amt * faceScale * 0.015,
      })
    } else if (!isToxin && p.zone === 'nose') {
      // rinomodelação: leve lift de ponta
      img = applyOp(img, { cx: p.x, cy: p.y, radius: baseRadius * 0.8, dy: -amt * faceScale * 0.018 })
    } else {
      // genérico: volume proporcional
      img = applyOp(img, { cx: p.x, cy: p.y, radius: baseRadius, bulge: amt * (isToxin ? 0.1 : 0.3) })
    }
  }

  return img
}
