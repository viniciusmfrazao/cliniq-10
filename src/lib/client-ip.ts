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
