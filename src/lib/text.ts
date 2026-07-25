/**
 * Helpers de texto pra busca ignorando acentuação/caixa.
 * Ex: normalizeText('José') === normalizeText('jose') === 'jose'
 */
export function normalizeText(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** Mantém só os dígitos (útil pra buscar telefone/CPF independente de formatação) */
export function onlyDigits(s: string | null | undefined): string {
  return (s || '').replace(/\D/g, '')
}
