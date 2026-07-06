'use client'

import { useEffect, useRef } from 'react'

/**
 * BrazilCopa — confetes nas cores do Clinike ao abrir o app.
 * (Bandeira/badge da Copa removidos, mantido só o confete.)
 */
export default function BrazilCopa() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const onResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    window.addEventListener('resize', onResize)

    const colors = ['#F472B6', '#312E81', '#4C1D95', '#ffffff', '#F472B6', '#312E81']

    type Piece = {
      x: number; y: number; r: number
      color: string; speed: number
      wobble: number; wobbleSpeed: number
      angle: number; angleSpeed: number
      opacity: number; shape: 'circle' | 'rect'
    }

    const pieces: Piece[] = Array.from({ length: 55 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * -window.innerHeight,
      r: Math.random() * 5 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      speed: Math.random() * 0.8 + 0.3,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: Math.random() * 0.02 + 0.005,
      angle: Math.random() * Math.PI * 2,
      angleSpeed: (Math.random() - 0.5) * 0.04,
      opacity: Math.random() * 0.5 + 0.4,
      shape: Math.random() > 0.5 ? 'circle' : 'rect',
    }))

    let animId: number
    const startTime = Date.now()
    const DURATION = 12000

    function draw() {
      if (!ctx || !canvas) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const elapsed = Date.now() - startTime
      if (elapsed > DURATION) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        canvas.style.display = 'none'
        return
      }

      const fadeRatio = elapsed > DURATION - 3000
        ? 1 - (elapsed - (DURATION - 3000)) / 3000
        : 1

      for (const p of pieces) {
        p.y += p.speed
        p.wobble += p.wobbleSpeed
        p.angle += p.angleSpeed
        p.x += Math.sin(p.wobble) * 0.6
        if (p.y > canvas.height + 10) {
          p.y = -10
          p.x = Math.random() * canvas.width
        }
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.angle)
        ctx.globalAlpha = p.opacity * fadeRatio
        ctx.fillStyle = p.color
        if (p.shape === 'circle') {
          ctx.beginPath()
          ctx.arc(0, 0, p.r, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r)
        }
        ctx.restore()
      }

      animId = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed', top: 0, left: 0,
          width: '100%', height: '100%',
          pointerEvents: 'none', zIndex: 99998,
        }}
      />
    </>
  )
}
