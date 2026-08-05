// Helpers compartilhados de forma de pagamento / bandeira / cálculo de taxa.
// Extraído de entrada-form.tsx pra ser reaproveitado em outros lugares
// (payment-modal, sell-product-modal) sem duplicar a lógica de taxas.

export const FORMAS_PAGAMENTO = [
  'Pix', 'Dinheiro', 'Débito',
  'Crédito 1x', 'Crédito 2x', 'Crédito 3x', 'Crédito 4x', 'Crédito 5x', 'Crédito 6x',
  'Crédito 7x', 'Crédito 8x', 'Crédito 9x', 'Crédito 10x', 'Crédito 11x', 'Crédito 12x',
  'Boleto 1x', 'Boleto 2x', 'Boleto 3x', 'Boleto 4x', 'Boleto 5x', 'Boleto 6x',
  'Boleto 7x', 'Boleto 8x', 'Boleto 9x', 'Boleto 10x', 'Boleto 11x', 'Boleto 12x',
]

export const BANDEIRAS_CARTAO = ['Visa', 'Mastercard', 'Amex, Elo, outros']

// Boleto não tem bandeira e não tem taxa por parcelamento — todas as variações
// "Boleto Nx" apontam pra mesma chave `boleto` em taxas_pagamento. O número de
// parcelas vira `n_parcelas` na entrada e a data do 1º vencimento é escolhida
// no lançamento (`entradas.primeiro_vencimento`).
export function isBoleto(forma: string): boolean {
  return (forma || '').trim().toLowerCase().startsWith('boleto')
}

export function isCartao(forma: string): boolean {
  const f = (forma || '').trim()
  return f.startsWith('Crédito') || f === 'Débito'
}

// Mapeamento: label do form → chave no banco (taxas_pagamento.forma)
export const FORMA_PARA_KEY: Record<string, string> = {
  'Pix': 'pix', 'Dinheiro': 'dinheiro', 'Débito': 'debito',
  'Crédito 1x': 'credito_1x', 'Crédito 2x': 'credito_2x', 'Crédito 3x': 'credito_3x',
  'Crédito 4x': 'credito_4x', 'Crédito 5x': 'credito_5x', 'Crédito 6x': 'credito_6x',
  'Crédito 7x': 'credito_7x', 'Crédito 8x': 'credito_8x', 'Crédito 9x': 'credito_9x',
  'Crédito 10x': 'credito_10x', 'Crédito 11x': 'credito_11x', 'Crédito 12x': 'credito_12x',
  'Boleto 1x': 'boleto', 'Boleto 2x': 'boleto', 'Boleto 3x': 'boleto',
  'Boleto 4x': 'boleto', 'Boleto 5x': 'boleto', 'Boleto 6x': 'boleto',
  'Boleto 7x': 'boleto', 'Boleto 8x': 'boleto', 'Boleto 9x': 'boleto',
  'Boleto 10x': 'boleto', 'Boleto 11x': 'boleto', 'Boleto 12x': 'boleto',
  'Boleto': 'boleto',
}

// Mapeamento: label da bandeira → chaves candidatas no banco
export const BANDEIRA_PARA_KEY: Record<string, string[]> = {
  'Visa': ['visa'],
  'Mastercard': ['master'],
  'Amex, Elo, outros': ['amex', 'elo'],
}

export type TaxaPag = { forma: string; bandeira: string; taxa_percentual: number; taxa_fixa?: number | null }

// Extrai o número de parcelas do label ("Crédito 3x" / "Boleto 10x" → 3 / 10)
export function parcelasDoLabel(forma: string): number {
  const m = (forma || '').match(/(\d+)x/)
  return m ? parseInt(m[1]) : 1
}

// Resolve a linha de taxa configurada: bandeira específica > 'todas' > nada
function findTaxa(taxasPagamento: TaxaPag[], forma: string, bandeira: string): TaxaPag | null {
  const formaKey = FORMA_PARA_KEY[forma]
  if (!formaKey || formaKey === 'pix' || formaKey === 'dinheiro') return null
  const bandeiraKeys = BANDEIRA_PARA_KEY[bandeira] || []
  for (const bKey of bandeiraKeys) {
    const t = taxasPagamento.find(t => t.forma === formaKey && t.bandeira === bKey)
    if (t) return t
  }
  return taxasPagamento.find(t => t.forma === formaKey && t.bandeira === 'todas') || null
}

export function getTaxaPct(taxasPagamento: TaxaPag[], forma: string, bandeira: string): number {
  const t = findTaxa(taxasPagamento, forma, bandeira)
  return t ? Number(t.taxa_percentual) || 0 : 0
}

// Taxa fixa em R$ cobrada por documento emitido (hoje usada só no boleto:
// cada parcela é um boleto, então a taxa fixa é multiplicada pelo nº de parcelas).
export function getTaxaFixa(taxasPagamento: TaxaPag[], forma: string, bandeira: string): number {
  const t = findTaxa(taxasPagamento, forma, bandeira)
  return t ? Number(t.taxa_fixa) || 0 : 0
}

export type CalcPagamento = {
  v: number
  nParcelas: number
  taxaPct: number        // % configurado
  taxaFixaUnit: number   // R$ fixo por documento
  taxaFixaTotal: number  // R$ fixo × nº de documentos
  valorTaxa: number      // total descontado (%, + fixo)
  valorLiquido: number
  taxaEfetivaPct: number // valorTaxa / valor × 100 — é o que grava em entradas.taxa_percentual
}

// Cálculo único de taxa/líquido usado por Nova Entrada, Venda de Produtos e
// Registrar Pagamento. Grava `taxaEfetivaPct` em entradas.taxa_percentual pra
// que valor_taxa e valor_liquido continuem batendo com valor_bruto × pct
// (inclusive nos rateios feitos no banco), mesmo quando existe taxa fixa.
export function calcPagamento(
  taxasPagamento: TaxaPag[],
  forma: string,
  bandeira: string,
  valor: number,
  nParcelasOverride?: number
): CalcPagamento {
  const v = Number(valor) || 0
  const nParcelas = nParcelasOverride ?? parcelasDoLabel(forma)
  const taxaPct = getTaxaPct(taxasPagamento, forma, bandeira)
  const taxaFixaUnit = getTaxaFixa(taxasPagamento, forma, bandeira)
  // Taxa fixa só faz sentido por documento emitido (boleto = 1 por parcela).
  const nDocs = isBoleto(forma) ? Math.max(1, nParcelas) : 1
  const taxaFixaTotal = taxaFixaUnit * nDocs
  const valorTaxa = Math.min(v, Math.round((v * (taxaPct / 100) + taxaFixaTotal) * 100) / 100)
  const valorLiquido = Math.round((v - valorTaxa) * 100) / 100
  const taxaEfetivaPct = v > 0 ? Math.round((valorTaxa / v) * 1000000) / 10000 : 0
  return { v, nParcelas, taxaPct, taxaFixaUnit, taxaFixaTotal, valorTaxa, valorLiquido, taxaEfetivaPct }
}
