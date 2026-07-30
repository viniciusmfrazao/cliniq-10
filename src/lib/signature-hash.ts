import { createHash } from 'crypto'

/**
 * Gera um hash SHA-256 (hex) a partir das partes que compõem o conteúdo
 * assinado (texto/respostas + imagem da assinatura). Qualquer alteração
 * posterior em qualquer uma das partes muda o hash — serve como prova de
 * integridade complementar ao trio IP/User-Agent/país já registrado.
 *
 * As partes são unidas com um separador que não aparece em JSON/base64,
 * pra evitar colisão entre partes diferentes que concatenadas dessem a
 * mesma string.
 */
export function computeSignatureHash(parts: (string | null | undefined)[]): string {
  const joined = parts.map(p => p ?? '').join('\u0000')
  return createHash('sha256').update(joined, 'utf8').digest('hex')
}
