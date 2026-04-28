/**
 * Extrai o IP real do cliente a partir dos headers da request.
 *
 * Por que ler do header em vez de aceitar `body.ip`:
 *  - O cliente pode mentir no body (`ip: '127.0.0.1'`).
 *  - Para registros com valor probatório (assinatura de anamnese,
 *    consentimento de documento) precisamos do IP confiável visto
 *    pelo edge da Vercel/Supabase.
 *
 * Ordem de preferência:
 *  1. `x-forwarded-for`  (Vercel/Cloudflare/Nginx) — primeiro IP da lista
 *  2. `x-real-ip`        (proxies genéricos)
 *  3. `cf-connecting-ip` (Cloudflare)
 *  4. `x-vercel-forwarded-for`
 */
export function getClientIp(headers: Headers): string | null {
  const xff = headers.get('x-forwarded-for')
  if (xff) {
    // x-forwarded-for pode ser "ip1, ip2, ip3" — pegamos o primeiro,
    // que é o do cliente original. Os demais são proxies intermediários.
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  const cf = headers.get('cf-connecting-ip')
  if (cf) return cf.trim()
  const vercel = headers.get('x-vercel-forwarded-for')
  if (vercel) {
    const first = vercel.split(',')[0]?.trim()
    if (first) return first
  }
  return null
}

/**
 * Retorna o User-Agent do cliente (parte do conjunto probatório de
 * assinaturas). Limita a 500 chars pra evitar absurdos.
 */
export function getUserAgent(headers: Headers): string | null {
  const ua = headers.get('user-agent')
  if (!ua) return null
  return ua.trim().slice(0, 500) || null
}

/**
 * Retorna o código ISO do país de origem da requisição.
 *
 * Em Vercel, vem em `x-vercel-ip-country` (ex: 'BR', 'US').
 * Em Cloudflare, vem em `cf-ipcountry`.
 *
 * É geolocalização aproximada (por IP) — não é prova absoluta de
 * onde a pessoa está, mas é evidência adicional que ajuda a
 * caracterizar a origem do ato.
 */
export function getClientCountry(headers: Headers): string | null {
  const vercel = headers.get('x-vercel-ip-country')
  if (vercel) return vercel.trim().toUpperCase().slice(0, 4) || null
  const cf = headers.get('cf-ipcountry')
  if (cf) return cf.trim().toUpperCase().slice(0, 4) || null
  return null
}
