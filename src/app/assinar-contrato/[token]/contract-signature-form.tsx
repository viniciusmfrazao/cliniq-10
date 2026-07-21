'use client'

import { useState, useRef, useEffect } from 'react'

type Doc = {
  id: string
  content: string
}

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

export default function ContractSignatureForm({ doc, token }: { doc: Doc; token: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loading, setLoading] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [success, setSuccess] = useState(false)
  const [signerName, setSignerName] = useState('')
  const [signerCpf, setSignerCpf] = useState('')
  const [signerRole, setSignerRole] = useState('')

  const identityComplete = signerName.trim().length > 3 && signerCpf.replace(/\D/g, '').length === 11 && signerRole.trim().length > 1

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * 2
    canvas.height = rect.height * 2
    ctx.scale(2, 2)
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
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!identityComplete) return
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    setIsDrawing(true)
    const { x, y } = getPosition(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (!isDrawing) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = getPosition(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasSignature(true)
  }

  const stopDrawing = () => setIsDrawing(false)

  const clearSignature = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }

  const handleSubmit = async () => {
    if (!agreed || !hasSignature || !identityComplete) return
    const canvas = canvasRef.current
    if (!canvas) return

    setLoading(true)
    try {
      const signatureData = canvas.toDataURL('image/png')
      const response = await fetch(`/api/contratos/sign/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature: signatureData,
          signerName: signerName.trim(),
          signerCpf: signerCpf.trim(),
          signerRole: signerRole.trim(),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erro ao assinar')
      }
      setSuccess(true)
    } catch (error) {
      console.error(error)
      alert('Erro ao assinar contrato. Tente novamente.')
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
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Contrato assinado!</h2>
        <p className="text-slate-600">Sua assinatura foi registrada com sucesso. Você pode fechar esta página.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Contract content */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Texto do contrato</h2>
        </div>
        <div className="p-6 max-h-96 overflow-y-auto whitespace-pre-wrap break-words text-slate-700 font-mono text-sm leading-relaxed">
          {doc.content}
        </div>
      </div>

      {/* Signer identification */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="bg-violet-50 px-6 py-4 border-b border-violet-100">
          <h2 className="font-semibold text-violet-900">Identificação do responsável pela assinatura</h2>
          <p className="text-xs text-violet-600 mt-0.5">Preencha antes de assinar</p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Nome completo</label>
            <input
              type="text"
              value={signerName}
              onChange={e => setSignerName(e.target.value)}
              placeholder="Seu nome completo"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-violet-400 focus:ring-1 focus:ring-violet-400 outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">CPF</label>
            <input
              type="text"
              value={signerCpf}
              onChange={e => setSignerCpf(formatCpf(e.target.value))}
              placeholder="000.000.000-00"
              inputMode="numeric"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-violet-400 focus:ring-1 focus:ring-violet-400 outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Cargo/função na clínica</label>
            <input
              type="text"
              value={signerRole}
              onChange={e => setSignerRole(e.target.value)}
              placeholder="Ex: Sócia-administradora, Proprietária..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-violet-400 focus:ring-1 focus:ring-violet-400 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Agreement checkbox */}
      <label className={`flex items-start gap-3 p-4 bg-white rounded-xl shadow-sm ${identityComplete ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
        <input
          type="checkbox"
          checked={agreed}
          disabled={!identityComplete}
          onChange={e => setAgreed(e.target.checked)}
          className="mt-1 w-5 h-5 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
        />
        <span className="text-sm text-slate-700">
          Li e concordo com todo o conteúdo deste contrato, incluindo o Acordo de Tratamento de Dados (DPA), e declaro
          possuir poderes para assinar em nome da clínica acima identificada.
        </span>
      </label>

      {/* Signature area */}
      <div className={`bg-white rounded-2xl shadow-lg overflow-hidden ${!identityComplete ? 'opacity-50' : ''}`}>
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Sua assinatura</h2>
          {hasSignature && (
            <button onClick={clearSignature} className="text-sm text-slate-500 hover:text-slate-700">Limpar</button>
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
            {identityComplete ? 'Desenhe sua assinatura acima usando o mouse ou o dedo' : 'Preencha seus dados acima para liberar a assinatura'}
          </p>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!agreed || !hasSignature || !identityComplete || loading}
        className={`w-full py-4 rounded-xl text-white font-semibold text-lg transition-all ${
          agreed && hasSignature && identityComplete
            ? 'bg-gradient-to-r from-violet-500 to-pink-500 hover:shadow-lg hover:scale-[1.02]'
            : 'bg-slate-300 cursor-not-allowed'
        }`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
            Processando...
          </span>
        ) : 'Assinar contrato'}
      </button>

      <p className="text-xs text-slate-400 text-center">
        Ao assinar, você declara que leu e concorda com os termos acima. Sua assinatura será registrada com nome, CPF, data, hora e IP.
      </p>
    </div>
  )
}
