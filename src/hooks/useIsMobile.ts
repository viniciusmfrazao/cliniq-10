'use client'

import { useState, useEffect } from 'react'

/**
 * Retorna true se a largura da janela for menor que 768px (md breakpoint).
 * Atualiza em tempo real ao redimensionar.
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    function check() {
      setIsMobile(window.innerWidth < breakpoint)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [breakpoint])

  return isMobile
}
