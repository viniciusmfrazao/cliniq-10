'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type RealtimeEvent = '*' | 'INSERT' | 'UPDATE' | 'DELETE'

type Options = {
  /** Tabela a ser observada (ex: 'appointments') */
  table: string
  /** Eventos a escutar. Default: '*' (INSERT, UPDATE, DELETE) */
  event?: RealtimeEvent
  /** Filtro de igualdade simples (ex: { column: 'clinic_id', value: '...' }) */
  filter?: { column: string; value: string }
  /**
   * Callback invocado a cada mudança. Se ausente, chama router.refresh()
   * com debounce automático (evita thrashing quando vários eventos chegam juntos).
   */
  onChange?: (payload: unknown) => void
  /** Debounce do refresh em ms (default 400) */
  debounceMs?: number
  /** Desabilita temporariamente a inscrição */
  enabled?: boolean
}

/**
 * Observa mudanças em uma tabela do Supabase via Realtime e dispara
 * `router.refresh()` (com debounce) ou um callback custom.
 *
 * Dispensa estado local — o server component re-renderiza com os dados novos.
 */
export function useRealtimeRefresh({
  table,
  event = '*',
  filter,
  onChange,
  debounceMs = 400,
  enabled = true,
}: Options) {
  const router = useRouter()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled) return

    const supabase = createClient()
    const channelName = `rt:${table}:${filter?.column ?? 'all'}:${filter?.value ?? 'all'}`

    const filterString = filter ? `${filter.column}=eq.${filter.value}` : undefined

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes' as never,
        { event, schema: 'public', table, ...(filterString ? { filter: filterString } : {}) },
        (payload: unknown) => {
          if (onChange) {
            onChange(payload)
            return
          }
          if (debounceRef.current) clearTimeout(debounceRef.current)
          debounceRef.current = setTimeout(() => {
            router.refresh()
          }, debounceMs)
        }
      )
      .subscribe()

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, event, filter?.column, filter?.value, enabled])
}
