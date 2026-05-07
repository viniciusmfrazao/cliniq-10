'use client'

/**
 * Contexto global de "linha WhatsApp selecionada".
 *
 * Persiste em localStorage (chave: cliniq_wa_line_<clinicId>).
 * '' = todas as linhas / sem filtro (quando só há 1 número).
 *
 * Alimenta:
 *  - /dashboard/whatsapp  → filtra conversas
 *  - /dashboard/crm       → filtra leads
 *  - Sidebar              → exibe seletor quando há 2+ linhas
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'

export interface WaLine {
  instance_name: string
  label: string | null
  phone_number: string | null
  role_inbound: boolean
  auto_reply_enabled: boolean
}

interface WaLineCtx {
  /** Lista de linhas conectadas da clínica */
  lines: WaLine[]
  /** Linha selecionada atualmente ('' = todas) */
  selectedLine: string
  setSelectedLine: (instance: string) => void
  /** Atualiza a lista de linhas (chamado no carregamento do layout) */
  setLines: (lines: WaLine[]) => void
  /** True quando há mais de 1 linha — controla exibição do seletor */
  hasMultipleLines: boolean
}

const Ctx = createContext<WaLineCtx>({
  lines: [],
  selectedLine: '',
  setSelectedLine: () => {},
  setLines: () => {},
  hasMultipleLines: false,
})

export function WaLineProvider({
  clinicId,
  children,
}: {
  clinicId: string
  children: React.ReactNode
}) {
  const storageKey = `cliniq_wa_line_${clinicId}`

  const [lines, setLinesState] = useState<WaLine[]>([])
  const [selectedLine, setSelectedLineState] = useState<string>('')

  // Carrega preferência salva
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) setSelectedLineState(saved)
    } catch {}
  }, [storageKey])

  const setSelectedLine = useCallback(
    (instance: string) => {
      setSelectedLineState(instance)
      try {
        if (instance) {
          localStorage.setItem(storageKey, instance)
        } else {
          localStorage.removeItem(storageKey)
        }
      } catch {}
    },
    [storageKey],
  )

  const setLines = useCallback((newLines: WaLine[]) => {
    setLinesState(newLines)
  }, [])

  return (
    <Ctx.Provider
      value={{
        lines,
        selectedLine,
        setSelectedLine,
        setLines,
        hasMultipleLines: lines.length > 1,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useWaLine() {
  return useContext(Ctx)
}
