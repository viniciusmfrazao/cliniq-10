'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

type Props = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'rows'> & {
  /** Linhas minimas (default 3) */
  minRows?: number
  /** Linhas maximas (default 12). Acima disso, scroll interno. */
  maxRows?: number
}

/**
 * Textarea que cresce conforme voce digita.
 *
 * - Sem flicker de fundo no focus (so muda borda).
 * - Auto-resize (sem scroll interno até atingir maxRows).
 * - scroll-margin-bottom alto pro navegador deixar o campo acima do teclado.
 * - enterkeyhint, autoComplete e spellcheck ajustados pra mobile.
 */
const AutoTextarea = forwardRef<HTMLTextAreaElement, Props>(function AutoTextarea(
  { minRows = 3, maxRows = 12, className = '', onChange, value, defaultValue, ...rest },
  ref
) {
  const innerRef = useRef<HTMLTextAreaElement>(null)
  useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement)

  const resize = () => {
    const el = innerRef.current
    if (!el) return
    // Mede a partir do conteudo: zera height e copia scrollHeight
    el.style.height = 'auto'
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 22
    const padding =
      parseFloat(getComputedStyle(el).paddingTop) +
      parseFloat(getComputedStyle(el).paddingBottom)
    const min = lineHeight * minRows + padding
    const max = lineHeight * maxRows + padding
    const next = Math.min(Math.max(el.scrollHeight, min), max)
    el.style.height = `${next}px`
    el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden'
  }

  useEffect(() => {
    resize()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, defaultValue])

  return (
    <textarea
      ref={innerRef}
      value={value}
      defaultValue={defaultValue}
      onChange={(e) => {
        resize()
        onChange?.(e)
      }}
      onInput={resize}
      autoComplete="off"
      autoCorrect="on"
      spellCheck={true}
      enterKeyHint="enter"
      style={{ scrollMarginBottom: '40vh' }}
      className={
        'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl ' +
        'text-slate-900 placeholder:text-slate-400 ' +
        'outline-none transition-[border-color,box-shadow] duration-150 ' +
        'focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 ' +
        'resize-none ' +
        className
      }
      {...rest}
    />
  )
})

export default AutoTextarea
