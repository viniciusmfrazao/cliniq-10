'use client'

import { useState, useCallback } from 'react'
import { createLogger } from '@/lib/logger'

const log = createLogger('useAsync')

type AsyncState<T> = {
  data: T | null
  loading: boolean
  error: Error | null
}

type UseAsyncReturn<T, Args extends unknown[]> = AsyncState<T> & {
  execute: (...args: Args) => Promise<T | null>
  reset: () => void
  setData: (data: T | null) => void
}

export function useAsync<T, Args extends unknown[] = []>(
  asyncFunction: (...args: Args) => Promise<T>,
  options?: {
    onSuccess?: (data: T) => void
    onError?: (error: Error) => void
    immediate?: boolean
    context?: string
  }
): UseAsyncReturn<T, Args> {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: false,
    error: null,
  })

  const execute = useCallback(
    async (...args: Args): Promise<T | null> => {
      setState(prev => ({ ...prev, loading: true, error: null }))
      
      const startTime = Date.now()
      const context = options?.context || 'async-operation'

      try {
        log.debug(`Starting ${context}`, { args: args.length > 0 ? args : undefined })
        
        const result = await asyncFunction(...args)
        
        const duration = Date.now() - startTime
        log.debug(`Completed ${context}`, { duration: `${duration}ms` })
        
        setState({ data: result, loading: false, error: null })
        options?.onSuccess?.(result)
        
        return result
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        const duration = Date.now() - startTime
        
        log.error(`Failed ${context}`, error, { duration: `${duration}ms` })
        
        setState({ data: null, loading: false, error })
        options?.onError?.(error)
        
        return null
      }
    },
    [asyncFunction, options]
  )

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null })
  }, [])

  const setData = useCallback((data: T | null) => {
    setState(prev => ({ ...prev, data }))
  }, [])

  return {
    ...state,
    execute,
    reset,
    setData,
  }
}

// Hook simplificado para mutations (criar, atualizar, deletar)
export function useMutation<T, Args extends unknown[] = []>(
  mutationFn: (...args: Args) => Promise<T>,
  options?: {
    onSuccess?: (data: T) => void
    onError?: (error: Error) => void
    successMessage?: string
    errorMessage?: string
    context?: string
  }
) {
  const { execute, loading, error, data, reset } = useAsync(mutationFn, {
    context: options?.context || 'mutation',
    onSuccess: (data) => {
      if (options?.successMessage) {
        // Você pode integrar com um toast aqui
        log.info(options.successMessage)
      }
      options?.onSuccess?.(data)
    },
    onError: (error) => {
      if (options?.errorMessage) {
        log.error(options.errorMessage, error)
      }
      options?.onError?.(error)
    },
  })

  return {
    mutate: execute,
    loading,
    error,
    data,
    reset,
  }
}

export default useAsync
