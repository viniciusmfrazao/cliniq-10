'use client'

import { useEffect, useState } from 'react'

/**
 * Retorna um valor com atraso. Útil pra reduzir filtragens/renders
 * em inputs com listas grandes.
 */
export function useDebouncedValue<T>(value: T, delayMs = 150): T {
  const [debounced, setDebounced] = useState<T>(value)

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(handle)
  }, [value, delayMs])

  return debounced
}
