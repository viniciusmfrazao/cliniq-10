'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Icon from './Icon'

/**
 * Lightbox modal pra visualizar fotos em tamanho grande.
 *
 * Suporta:
 * - Navegação entre fotos com botões prev/next ou setas do teclado
 * - Fechamento via ESC, clique no backdrop ou botão X
 * - Swipe horizontal em mobile (touch)
 * - Trava o scroll do body enquanto aberto
 * - Acessível: role=dialog, aria-modal, label, focus inicial no botão fechar
 *
 * É controlado: o pai controla `open` e `index` e reage a `onClose` /
 * `onIndexChange`. Se urls é uma lista vazia ou index inválido, não
 * renderiza nada.
 */
type Props = {
  open: boolean
  urls: string[]
  index: number
  onClose: () => void
  onIndexChange: (next: number) => void
  /** Texto opcional pra screen readers / fallback alt. */
  altPrefix?: string
}

const SWIPE_THRESHOLD_PX = 50

export default function PhotoLightbox({
  open,
  urls,
  index,
  onClose,
  onIndexChange,
  altPrefix = 'Foto',
}: Props) {
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)
  const touchStartXRef = useRef<number | null>(null)

  const goPrev = useCallback(() => {
    if (urls.length === 0) return
    onIndexChange((index - 1 + urls.length) % urls.length)
  }, [index, urls.length, onIndexChange])

  const goNext = useCallback(() => {
    if (urls.length === 0) return
    onIndexChange((index + 1) % urls.length)
  }, [index, urls.length, onIndexChange])

  // Atalhos de teclado: ESC fecha, setas navegam.
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        goNext()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goPrev()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose, goNext, goPrev])

  // Trava o scroll enquanto modal aberto.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // Foco inicial no X pra acessibilidade.
  useEffect(() => {
    if (open) {
      // pequeno delay pro mount do botão antes de focar
      const t = window.setTimeout(() => closeBtnRef.current?.focus(), 0)
      return () => window.clearTimeout(t)
    }
  }, [open])

  if (!open || urls.length === 0) return null
  const safeIndex = Math.min(Math.max(index, 0), urls.length - 1)
  const url = urls[safeIndex]
  const total = urls.length

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Galeria de fotos (${safeIndex + 1} de ${total})`}
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={(e) => {
        // Fecha ao clicar no backdrop (não na imagem nem nos controles).
        if (e.target === e.currentTarget) onClose()
      }}
      onTouchStart={(e) => {
        touchStartXRef.current = e.touches[0]?.clientX ?? null
      }}
      onTouchEnd={(e) => {
        const start = touchStartXRef.current
        touchStartXRef.current = null
        if (start == null) return
        const end = e.changedTouches[0]?.clientX ?? start
        const dx = end - start
        if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return
        if (dx > 0) goPrev()
        else goNext()
      }}
    >
      {/* Botão fechar */}
      <button
        ref={closeBtnRef}
        type="button"
        onClick={onClose}
        aria-label="Fechar galeria"
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
      >
        <Icon name="x" className="w-5 h-5" />
      </button>

      {/* Contador */}
      {total > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-medium">
          {safeIndex + 1} / {total}
        </div>
      )}

      {/* Botão prev (desktop) */}
      {total > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            goPrev()
          }}
          aria-label="Foto anterior"
          className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center transition-colors"
        >
          <Icon name="chevronLeft" className="w-6 h-6" />
        </button>
      )}

      {/* Botão next (desktop) */}
      {total > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            goNext()
          }}
          aria-label="Próxima foto"
          className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center transition-colors"
        >
          <Icon name="chevronRight" className="w-6 h-6" />
        </button>
      )}

      {/* Imagem */}
      <div className="max-w-[95vw] max-h-[90vh] flex items-center justify-center select-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={`${altPrefix} ${safeIndex + 1} de ${total}`}
          className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
          draggable={false}
        />
      </div>

      {/* Setas inline (mobile) */}
      {total > 1 && (
        <div className="sm:hidden absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              goPrev()
            }}
            aria-label="Foto anterior"
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <Icon name="chevronLeft" className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              goNext()
            }}
            aria-label="Próxima foto"
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <Icon name="chevronRight" className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  )
}
