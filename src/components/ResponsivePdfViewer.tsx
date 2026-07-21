'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

declare global {
  interface Window {
    pdfjsLib?: any
  }
}

const PDFJS_VERSION = '3.11.174'
const PDFJS_SRC = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`
const PDFJS_WORKER_SRC = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`

let pdfjsLoadPromise: Promise<any> | null = null

function loadPdfJs(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib)
  if (pdfjsLoadPromise) return pdfjsLoadPromise

  pdfjsLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = PDFJS_SRC
    script.async = true
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC
        resolve(window.pdfjsLib)
      } else {
        reject(new Error('pdfjsLib nao carregou'))
      }
    }
    script.onerror = () => reject(new Error('Falha ao carregar pdf.js'))
    document.body.appendChild(script)
  })
  return pdfjsLoadPromise
}

/**
 * Visualizador de PDF responsivo — renderiza cada página em <canvas>
 * escalado pra largura do container, em vez de <iframe> (que mostra o PDF
 * na escala nativa da página e corta conteúdo em telas estreitas/mobile).
 */
export default function ResponsivePdfViewer({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pdfDocRef = useRef<any>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const renderTokenRef = useRef(0)

  const renderPages = useCallback(async () => {
    const container = containerRef.current
    const pdfDoc = pdfDocRef.current
    if (!container || !pdfDoc) return

    const myToken = ++renderTokenRef.current
    const width = container.clientWidth
    if (!width) return

    container.innerHTML = ''

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      if (myToken !== renderTokenRef.current) return // outro render (resize) tomou a frente
      const page = await pdfDoc.getPage(pageNum)
      const unscaledViewport = page.getViewport({ scale: 1 })
      const scale = width / unscaledViewport.width
      const viewport = page.getViewport({ scale })

      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      canvas.style.width = '100%'
      canvas.style.height = 'auto'
      canvas.style.display = 'block'
      if (pageNum > 1) canvas.style.marginTop = '8px'
      container.appendChild(canvas)

      const ctx = canvas.getContext('2d')
      if (!ctx) continue
      await page.render({ canvasContext: ctx, viewport }).promise
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const pdfjsLib = await loadPdfJs()
        const doc = await pdfjsLib.getDocument(url).promise
        if (cancelled) return
        pdfDocRef.current = doc
        setStatus('ready')
        await renderPages()
      } catch (e) {
        console.error('Erro ao carregar PDF:', e)
        if (!cancelled) setStatus('error')
      }
    }
    load()

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  useEffect(() => {
    if (status !== 'ready') return
    let timeout: ReturnType<typeof setTimeout>
    function onResize() {
      clearTimeout(timeout)
      timeout = setTimeout(() => { renderPages() }, 200)
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      clearTimeout(timeout)
    }
  }, [status, renderPages])

  if (status === 'error') {
    return (
      <div className="p-6 text-center text-sm text-slate-500">
        Não foi possível exibir o documento aqui.{' '}
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-violet-600 font-medium">
          Abrir PDF em nova aba
        </a>
      </div>
    )
  }

  return (
    <div className="w-full">
      {status === 'loading' && (
        <div className="flex items-center justify-center py-10">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-violet-500 rounded-full animate-spin" />
        </div>
      )}
      <div ref={containerRef} className="w-full max-h-[75vh] overflow-y-auto" />
    </div>
  )
}
