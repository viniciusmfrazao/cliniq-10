'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Doc = {
  id: string
  content: string
}

export default function SignatureForm({ doc, token }: { doc: Doc; token: string }) {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loading, setLoading] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * 2
    canvas.height = rect.height * 2
    ctx.scale(2, 2)

    // Style
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  const getPosition = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      }
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return

    setIsDrawing(true)
    const { x, y } = getPosition(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (!isDrawing) return

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return

    const { x, y } = getPosition(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasSignature(true)
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }

  const handleSubmit = async () => {
    if (!agreed || !hasSignature) return

    const canvas = canvasRef.current
    if (!canvas) return

    setLoading(true)

    try {
      const signatureData = canvas.toDataURL('image/png')

      const response = await fetch(`/api/documents/sign/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature: signatureData,
          ip: 'captured',
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erro ao assinar')
      }

      setSuccess(true)
    } catch (error) {
      console.error(error)
      alert('Erro ao assinar documento. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-100 flex items-center justify-center">
          <svg className="w-10 h-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Documento assinado!</h2>
        <p className="text-slate-600">Sua assinatura foi registrada com sucesso. Você pode fechar esta página.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Document content */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Conteudo do documento</h2>
        </div>
        <div className="p-6 max-h-96 overflow-y-auto whitespace-pre-wrap text-slate-700 font-mono text-sm leading-relaxed">
          {doc.content}
        </div>
      </div>

      {/* Agreement checkbox */}
      <label className="flex items-start gap-3 p-4 bg-white rounded-xl shadow-sm cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={e => setAgreed(e.target.checked)}
          className="mt-1 w-5 h-5 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
        />
        <span className="text-sm text-slate-700">
          Li e concordo com todo o conteudo deste documento e autorizo a realizacao do(s) procedimento(s) nele descrito(s).
        </span>
      </label>

      {/* Signature area */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Sua assinatura</h2>
          {hasSignature && (
            <button
              onClick={clearSignature}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Limpar
            </button>
          )}
        </div>
        <div className="p-6">
          <div className="border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 overflow-hidden">
            <canvas
              ref={canvasRef}
              className="w-full h-48 cursor-crosshair touch-none"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2 text-center">
            Desenhe sua assinatura acima usando o mouse ou o dedo
          </p>
        </div>
      </div>

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!agreed || !hasSignature || loading}
        className={`w-full py-4 rounded-xl text-white font-semibold text-lg transition-all ${
          agreed && hasSignature
            ? 'bg-gradient-to-r from-violet-500 to-pink-500 hover:shadow-lg hover:scale-[1.02]'
            : 'bg-slate-300 cursor-not-allowed'
        }`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
            Processando...
          </span>
        ) : (
          'Assinar documento'
        )}
      </button>

      <p className="text-xs text-slate-400 text-center">
        Ao assinar, voce declara que leu e concorda com os termos acima. Sua assinatura sera registrada com data, hora e IP.
      </p>
    </div>
  )
}
