'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Icon from '@/components/ui/Icon'
import { renderMorph, MorphPoint } from './morph-engine'

type PlanPoint = {
  id: string
  zone: string
  side: string
  x: number   // coords do FaceMap (viewBox 320x420)
  y: number
  units: number
}

const MAX_W = 720

export default function PhotoSimulator({
  planPoints,
  type,
}: {
  planPoints: PlanPoint[]
  type: string
}) {
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [intensity, setIntensity] = useState(1)
  const [compare, setCompare] = useState(50) // slider antes/depois (%)
  const [processing, setProcessing] = useState(false)
  const [points, setPoints] = useState<(MorphPoint & { id: string })[]>([])
  const [dragId, setDragId] = useState<string | null>(null)
  const [dims, setDims] = useState({ w: 0, h: 0 })

  const beforeCanvasRef = useRef<HTMLCanvasElement>(null)
  const afterCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const sourceDataRef = useRef<ImageData | null>(null)
  const renderTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Upload da foto — fica só no browser, nada é enviado ao servidor
  function handleFile(file: File) {
    setLoadError(null)
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => setImgEl(img)
      img.onerror = () => setLoadError('Não foi possível ler esta imagem. Tente outro arquivo (JPG/PNG).')
      img.src = reader.result as string
    }
    reader.onerror = () => setLoadError('Erro ao ler o arquivo.')
    reader.readAsDataURL(file)
  }

  // Quando a imagem carrega, desenhar nos canvases (que estão SEMPRE montados)
  useEffect(() => {
    if (!imgEl) return
    const before = beforeCanvasRef.current
    const after = afterCanvasRef.current
    if (!before || !after) return

    const scale = Math.min(1, MAX_W / imgEl.width)
    const w = Math.round(imgEl.width * scale)
    const h = Math.round(imgEl.height * scale)
    setDims({ w, h })

    before.width = w; before.height = h
    after.width = w; after.height = h
    const bctx = before.getContext('2d')
    const actx = after.getContext('2d')
    if (!bctx || !actx) { setLoadError('Canvas não suportado neste navegador.'); return }
    bctx.drawImage(imgEl, 0, 0, w, h)
    actx.drawImage(imgEl, 0, 0, w, h)
    sourceDataRef.current = bctx.getImageData(0, 0, w, h)

    // Posicionar pontos do plano proporcionalmente (usuária ajusta arrastando)
    setPoints(planPoints.map(p => ({
      id: p.id,
      zone: p.zone,
      units: p.units,
      side: p.side,
      x: (p.x / 320) * w,
      y: (p.y / 420) * h,
    })))
    setImgLoaded(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgEl])

  const runRender = useCallback(() => {
    const src = sourceDataRef.current
    const after = afterCanvasRef.current
    if (!src || !after || dims.w === 0) return
    setProcessing(true)
    requestAnimationFrame(() => {
      setTimeout(() => {
        const faceScale = dims.w * 0.55 // estimativa da largura do rosto na foto
        const result = renderMorph(src, points, type, intensity, faceScale, dims.w / 2)
        after.getContext('2d')!.putImageData(result, 0, 0)
        setProcessing(false)
      }, 10)
    })
  }, [points, type, intensity, dims])

  // Re-render com debounce quando pontos/intensidade mudam
  useEffect(() => {
    if (!imgLoaded) return
    if (renderTimer.current) clearTimeout(renderTimer.current)
    renderTimer.current = setTimeout(runRender, 250)
    return () => { if (renderTimer.current) clearTimeout(renderTimer.current) }
  }, [imgLoaded, runRender])

  // Drag dos pontos
  function clientToCanvas(e: React.PointerEvent) {
    const rect = containerRef.current!.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * dims.w,
      y: ((e.clientY - rect.top) / rect.height) * dims.h,
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragId) return
    const { x, y } = clientToCanvas(e)
    setPoints(prev => prev.map(p => p.id === dragId ? { ...p, x, y } : p))
  }

  function downloadResult() {
    const before = beforeCanvasRef.current
    const after = afterCanvasRef.current
    if (!before || !after || dims.w === 0) return
    const { w, h } = dims
    const comp = document.createElement('canvas')
    comp.width = w * 2 + 16
    comp.height = h + 40
    const ctx = comp.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, comp.width, comp.height)
    ctx.drawImage(before, 0, 40)
    ctx.drawImage(after, w + 16, 40)
    ctx.fillStyle = '#334155'
    ctx.font = 'bold 18px sans-serif'
    ctx.fillText('Antes', 8, 26)
    ctx.fillText('Simulação*', w + 24, 26)
    ctx.font = '11px sans-serif'
    ctx.fillStyle = '#94a3b8'
    ctx.fillText('*Simulação ilustrativa. Resultados reais variam.', w + 24, h + 36)
    const a = document.createElement('a')
    a.download = 'simulacao-harmonizacao.png'
    a.href = comp.toDataURL('image/png')
    a.click()
  }

  function resetPhoto() {
    setImgLoaded(false)
    setImgEl(null)
    setPoints([])
    setDims({ w: 0, h: 0 })
    sourceDataRef.current = null
  }

  return (
    <div className="space-y-4">
      {!imgLoaded && (
        <label className="block cursor-pointer">
          <div className="border-2 border-dashed border-purple-200 rounded-2xl p-12 text-center hover:border-purple-400 hover:bg-purple-50 transition-all">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Icon name="camera" className="w-7 h-7 text-purple-600" />
            </div>
            <p className="font-semibold text-slate-900">Enviar foto frontal do paciente</p>
            <p className="text-sm text-slate-500 mt-1">A foto é processada apenas no seu navegador — não é enviada a nenhum servidor</p>
            {loadError && <p className="text-sm text-red-500 mt-2">{loadError}</p>}
          </div>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>
      )}

      {imgLoaded && (
        <>
          {/* Controles */}
          <div className="flex flex-wrap items-center gap-4 p-4 bg-slate-50 rounded-xl">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-slate-500 block mb-1">
                Intensidade do efeito: {(intensity * 100).toFixed(0)}%
              </label>
              <input
                type="range" min="0" max="2" step="0.1"
                value={intensity}
                onChange={e => setIntensity(parseFloat(e.target.value))}
                className="w-full accent-purple-600"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-slate-500 block mb-1">Comparar antes / depois</label>
              <input
                type="range" min="0" max="100"
                value={compare}
                onChange={e => setCompare(parseInt(e.target.value))}
                className="w-full accent-pink-600"
              />
            </div>
            <button onClick={downloadResult} className="btn-secondary w-auto px-4 py-2 text-sm flex items-center gap-2">
              <Icon name="download" className="w-4 h-4" />
              Baixar comparativo
            </button>
            <button onClick={resetPhoto} className="btn-secondary w-auto px-4 py-2 text-sm">
              Trocar foto
            </button>
          </div>

          <p className="text-xs text-slate-500 flex items-center gap-1">
            <Icon name="target" className="w-3.5 h-3.5" />
            Arraste os pontos roxos para alinhá-los com as regiões correspondentes do rosto na foto
          </p>
        </>
      )}

      {/* Comparador — canvases SEMPRE montados (refs precisam existir no upload) */}
      <div
        ref={containerRef}
        className={`relative rounded-2xl overflow-hidden border border-slate-200 select-none touch-none mx-auto ${imgLoaded ? '' : 'hidden'}`}
        style={dims.w > 0 ? { maxWidth: dims.w, aspectRatio: `${dims.w}/${dims.h}` } : undefined}
        onPointerMove={onPointerMove}
        onPointerUp={() => setDragId(null)}
        onPointerLeave={() => setDragId(null)}
      >
        {/* Depois (embaixo) */}
        <canvas ref={afterCanvasRef} className="absolute inset-0 w-full h-full" />
        {/* Antes (em cima, revelado pelo clip-path conforme o slider) */}
        <canvas
          ref={beforeCanvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ clipPath: `inset(0 ${100 - compare}% 0 0)` }}
        />
        {/* Linha divisória */}
        {imgLoaded && (
          <>
            <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none" style={{ left: `${compare}%` }}>
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
                <Icon name="menu" className="w-4 h-4 text-slate-600" />
              </div>
            </div>
            <span className="absolute top-3 left-3 text-xs font-semibold bg-black/50 text-white px-2 py-1 rounded-lg">Antes</span>
            <span className="absolute top-3 right-3 text-xs font-semibold bg-purple-600/80 text-white px-2 py-1 rounded-lg">Simulação</span>

            {/* Pontos arrastáveis */}
            {points.map(p => (
              <button
                key={p.id}
                onPointerDown={(e) => { e.preventDefault(); setDragId(p.id) }}
                className={`absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full border-2 border-white shadow-lg cursor-move transition-transform ${
                  dragId === p.id ? 'scale-125 bg-pink-500' : 'bg-purple-600'
                }`}
                style={{
                  left: `${(p.x / dims.w) * 100}%`,
                  top: `${(p.y / dims.h) * 100}%`,
                }}
                title={p.zone}
              />
            ))}

            {processing && (
              <div className="absolute inset-0 bg-white/40 flex items-center justify-center pointer-events-none">
                <div className="w-8 h-8 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
              </div>
            )}
          </>
        )}
      </div>

      {imgLoaded && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
          ⚠️ Simulação ilustrativa gerada por deformação de imagem — não representa garantia de resultado.
          Sempre alinhe expectativas com o paciente.
        </p>
      )}
    </div>
  )
}
