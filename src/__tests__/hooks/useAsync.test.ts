import { renderHook, act, waitFor } from '@testing-library/react'
import { useAsync, useMutation } from '@/hooks/useAsync'

describe('useAsync', () => {
  it('should start with initial state', () => {
    const asyncFn = jest.fn().mockResolvedValue('result')
    const { result } = renderHook(() => useAsync(asyncFn))

    expect(result.current.loading).toBe(false)
    expect(result.current.data).toBe(null)
    expect(result.current.error).toBe(null)
  })

  it('should set loading state while executing', async () => {
    let resolve: (value: string) => void
    const promise = new Promise<string>(r => { resolve = r })
    const asyncFn = jest.fn().mockReturnValue(promise)
    
    const { result } = renderHook(() => useAsync(asyncFn))

    act(() => {
      result.current.execute()
    })

    expect(result.current.loading).toBe(true)

    await act(async () => {
      resolve!('result')
      await promise
    })

    expect(result.current.loading).toBe(false)
  })

  it('should return data on success', async () => {
    const asyncFn = jest.fn().mockResolvedValue('success data')
    const { result } = renderHook(() => useAsync(asyncFn))

    await act(async () => {
      await result.current.execute()
    })

    expect(result.current.data).toBe('success data')
    expect(result.current.error).toBe(null)
  })

  it('should return error on failure', async () => {
    const error = new Error('Test error')
    const asyncFn = jest.fn().mockRejectedValue(error)
    const { result } = renderHook(() => useAsync(asyncFn))

    await act(async () => {
      await result.current.execute()
    })

    expect(result.current.data).toBe(null)
    expect(result.current.error).toEqual(error)
  })

  it('should call onSuccess callback', async () => {
    const asyncFn = jest.fn().mockResolvedValue('data')
    const onSuccess = jest.fn()
    
    const { result } = renderHook(() => 
      useAsync(asyncFn, { onSuccess })
    )

    await act(async () => {
      await result.current.execute()
    })

    expect(onSuccess).toHaveBeenCalledWith('data')
  })

  it('should call onError callback', async () => {
    const error = new Error('Test error')
    const asyncFn = jest.fn().mockRejectedValue(error)
    const onError = jest.fn()
    
    const { result } = renderHook(() => 
      useAsync(asyncFn, { onError })
    )

    await act(async () => {
      await result.current.execute()
    })

    expect(onError).toHaveBeenCalledWith(error)
  })

  it('should reset state', async () => {
    const asyncFn = jest.fn().mockResolvedValue('data')
    const { result } = renderHook(() => useAsync(asyncFn))

    await act(async () => {
      await result.current.execute()
    })

    expect(result.current.data).toBe('data')

    act(() => {
      result.current.reset()
    })

    expect(result.current.data).toBe(null)
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe(null)
  })

  it('should pass arguments to async function', async () => {
    const asyncFn = jest.fn().mockResolvedValue('result')
    const { result } = renderHook(() => useAsync(asyncFn))

    await act(async () => {
      await result.current.execute('arg1', 'arg2')
    })

    expect(asyncFn).toHaveBeenCalledWith('arg1', 'arg2')
  })
})

describe('useMutation', () => {
  it('should work like useAsync with mutate method', async () => {
    const mutationFn = jest.fn().mockResolvedValue({ id: 1 })
    const { result } = renderHook(() => useMutation(mutationFn))

    await act(async () => {
      await result.current.mutate()
    })

    expect(result.current.data).toEqual({ id: 1 })
  })
})
