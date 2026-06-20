'use client'

import { useEffect, useRef } from 'react'

/**
 * BrazilCopa — Copa do Mundo 2026 🇧🇷
 * Confetes leves + bandeira SVG no canto.
 * Remover após a Copa (julho 2026).
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

    const colors = ['#009c3b', '#ffdf00', '#002776', '#ffffff', '#009c3b', '#ffdf00']

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

      {/* Bandeira SVG do Brasil no canto inferior direito */}
      <div style={{
        position: 'fixed',
        top: 12,
        right: 12,
        zIndex: 99997,
        pointerEvents: 'none',
        animation: 'copaFadeIn 1.5s ease forwards',
        filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.35))',
      }}>
        {/* Bandeira Brasil 72x50px */}
        <svg width="72" height="50" viewBox="0 0 720 504" xmlns="http://www.w3.org/2000/svg">
          {/* Fundo verde */}
          <rect width="720" height="504" fill="#009c3b"/>
          {/* Losango amarelo */}
          <polygon points="360,36 684,252 360,468 36,252" fill="#ffdf00"/>
          {/* Círculo azul */}
          <circle cx="360" cy="252" r="140" fill="#002776"/>
          {/* Faixa branca */}
          <path d="M220,290 Q360,220 500,290" stroke="white" strokeWidth="26" fill="none"/>
          {/* Estrelas (simplificadas) */}
          {[
            [250,200],[300,168],[360,155],[420,168],[470,200],
            [230,252],[490,252],[250,304],[470,304],[360,320],
            [300,340],[420,340],[360,358],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="10" fill="white"/>
          ))}
          {/* Texto ORDEM E PROGRESSO */}
          <text
            x="360" y="298"
            textAnchor="middle"
            fontSize="28"
            fontFamily="Arial, sans-serif"
            fontWeight="bold"
            fill="#009c3b"
            letterSpacing="2"
          >
            ORDEM E PROGRESSO
          </text>
        </svg>

        {/* Badge Copa */}
        <div style={{
          marginTop: 4,
          textAlign: 'center',
          background: 'rgba(0,0,0,0.6)',
          borderRadius: 8,
          padding: '2px 8px',
          backdropFilter: 'blur(4px)',
        }}>
          <span style={{ color: '#ffdf00', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>
            🏆 COPA 2026
          </span>
        </div>
      </div>

      <style>{`
        @keyframes copaFadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
