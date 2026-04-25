/**
 * Helpers de formatacao usados no dashboard.
 *
 * formatBRL → formato completo "R$ 1.234,56".
 * formatBRLCompact → encurta valores grandes pra caber em cards estreitos
 * (ex: "R$ 15k", "R$ 1,2M"). Use em mobile / sidebars onde o espaco e curto.
 */

export function formatBRL(value: number, options?: Intl.NumberFormatOptions): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    ...options,
  })
}

export function formatBRLCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}M`
  }
  if (Math.abs(value) >= 1_000) {
    return `R$ ${(value / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`
  }
  return formatBRL(value, { maximumFractionDigits: 0 })
}

/**
 * Formata numero generico de forma compacta (1.2k, 1.2M).
 */
export function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}M`
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`
  }
  return value.toLocaleString('pt-BR')
}
