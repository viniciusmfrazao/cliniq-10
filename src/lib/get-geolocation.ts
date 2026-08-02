'use client'

/**
 * Tenta obter a geolocalização do navegador antes de assinar. Best-effort:
 * se o usuário negar a permissão, o navegador não suportar, ou demorar
 * mais que o timeout, resolve com null em vez de travar o fluxo de
 * assinatura — a assinatura não pode depender de permissão de GPS.
 */
export function getGeolocation(timeoutMs = 10000): Promise<{ lat: number; lon: number } | null> {
  return new Promise(resolve => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null)
      return
    }
    const timer = setTimeout(() => resolve(null), timeoutMs)
    navigator.geolocation.getCurrentPosition(
      pos => {
        clearTimeout(timer)
        resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude })
      },
      () => {
        clearTimeout(timer)
        resolve(null)
      },
      { timeout: timeoutMs, maximumAge: 60000 }
    )
  })
}
