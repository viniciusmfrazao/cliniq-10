// Helpers compartilhados de forma de pagamento / bandeira / cálculo de taxa.
// Extraído de entrada-form.tsx pra ser reaproveitado em outros lugares
// (payment-modal, sell-product-modal) sem duplicar a lógica de taxas.

export const FORMAS_PAGAMENTO = [
  'Pix', 'Dinheiro', 'Débito',
  'Crédito 1x', 'Crédito 2x', 'Crédito 3x', 'Crédito 4x', 'Crédito 5x', 'Crédito 6x',
  'Crédito 7x', 'Crédito 8x', 'Crédito 9x', 'Crédito 10x', 'Crédito 11x', 'Crédito 12x'
]

export const BANDEIRAS_CARTAO = ['Visa', 'Mastercard', 'Amex, Elo, outros']

// Mapeamento: label do form → chave no banco (taxas_pagamento.forma)
export const FORMA_PARA_KEY: Record<string, string> = {
  'Pix': 'pix', 'Dinheiro': 'dinheiro', 'Débito': 'debito',
  'Crédito 1x': 'credito_1x', 'Crédito 2x': 'credito_2x', 'Crédito 3x': 'credito_3x',
  'Crédito 4x': 'credito_4x', 'Crédito 5x': 'credito_5x', 'Crédito 6x': 'credito_6x',
  'Crédito 7x': 'credito_7x', 'Crédito 8x': 'credito_8x', 'Crédito 9x': 'credito_9x',
  'Crédito 10x': 'credito_10x', 'Crédito 11x': 'credito_11x', 'Crédito 12x': 'credito_12x',
}

// Mapeamento: label da bandeira → chaves candidatas no banco
export const BANDEIRA_PARA_KEY: Record<string, string[]> = {
  'Visa': ['visa'],
  'Mastercard': ['master'],
  'Amex, Elo, outros': ['amex', 'elo'],
}

export type TaxaPag = { forma: string; bandeira: string; taxa_percentual: number }

export function getTaxaPct(taxasPagamento: TaxaPag[], forma: string, bandeira: string): number {
  const formaKey = FORMA_PARA_KEY[forma]
  if (!formaKey || formaKey === 'pix' || formaKey === 'dinheiro') return 0
  const bandeiraKeys = BANDEIRA_PARA_KEY[bandeira] || []
  // 1. Tenta match específico pela bandeira selecionada
  for (const bKey of bandeiraKeys) {
    const t = taxasPagamento.find(t => t.forma === formaKey && t.bandeira === bKey)
    if (t) return Number(t.taxa_percentual)
  }
  // 2. Fallback para 'todas' (taxa padrão sem especificação de bandeira)
  const todas = taxasPagamento.find(t => t.forma === formaKey && t.bandeira === 'todas')
  if (todas) return Number(todas.taxa_percentual)
  return 0
}
