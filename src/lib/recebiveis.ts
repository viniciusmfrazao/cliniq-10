// Lógica compartilhada de projeção de recebíveis (parcelas futuras de vendas
// já lançadas em `entradas`, aplicando prazo de repasse por forma/bandeira
// configurado em `taxas_pagamento`).
//
// Extraído de previsao-recebimento-view.tsx pra ser reutilizado no card do
// dashboard e no DRE (visão de caixa), sem duplicar a regra de negócio.
//
// Regra: 1ª parcela cai em D+dias_repasse; demais parcelas (quando
// modo_repasse='parcelado') caem a cada +intervalo_dias_parcelas a partir da
// 1ª. Ex: crédito 3x com dias_repasse=30, intervalo=30 → parcelas em D+30,
// D+60, D+90.

import { addDaysBR } from './datetime'

export type TaxaPag = {
  forma: string
  bandeira: string | null
  dias_repasse: number
  modo_repasse: 'fixo' | 'parcelado'
  intervalo_dias_parcelas?: number
}

export type EntradaParaProjecao = {
  id: string
  data_venda: string
  paciente_nome?: string | null
  procedimento_nome?: string | null
  forma_pagamento: string
  bandeira: string | null
  valor_liquido: number
  n_parcelas: number | null
}

export type ParcelaProjetada = {
  key: string
  entradaId: string
  data: string
  parcelaNum: number
  totalParcelas: number
  valorLiquido: number
  pacienteNome: string
  procedimentoNome: string
  formaPagamento: string
  diferida: boolean // true se não caiu no mesmo dia da venda (D+0)
}

// Mesmo mapeamento usado em entradas/nova/entrada-form.tsx (formato "Crédito 3x")
const FORMA_PARA_KEY: Record<string, string> = {
  'Pix': 'pix', 'Dinheiro': 'dinheiro', 'Débito': 'debito',
  'Crédito 1x': 'credito_1x', 'Crédito 2x': 'credito_2x', 'Crédito 3x': 'credito_3x',
  'Crédito 4x': 'credito_4x', 'Crédito 5x': 'credito_5x', 'Crédito 6x': 'credito_6x',
  'Crédito 7x': 'credito_7x', 'Crédito 8x': 'credito_8x', 'Crédito 9x': 'credito_9x',
  'Crédito 10x': 'credito_10x', 'Crédito 11x': 'credito_11x', 'Crédito 12x': 'credito_12x',
}

const BANDEIRA_PARA_KEY: Record<string, string[]> = {
  'Visa': ['visa'],
  'Mastercard': ['master'],
  'Amex, Elo, outros': ['amex', 'elo'],
}

const BANDEIRA_KEYS_CONHECIDAS = ['visa', 'master', 'elo', 'amex', 'hipercard']
const FORMAS_SIMPLES = ['pix', 'dinheiro', 'debito', 'boleto']

// `entradas.forma_pagamento` chega em dois formatos diferentes dependendo de onde
// foi lançada a entrada: "Crédito 3x" (Nova Entrada manual) ou "credito" + n_parcelas
// separado (modal de Registrar Pagamento do agendamento). Normaliza os dois pra
// chave usada em taxas_pagamento (ex: credito_3x).
export function normalizeFormaKey(formaPagamento: string, nParcelas: number): string | null {
  const raw = (formaPagamento || '').trim()
  if (FORMA_PARA_KEY[raw]) return FORMA_PARA_KEY[raw]
  const lower = raw.toLowerCase()
  if (lower === 'credito' || lower === 'crédito') return `credito_${nParcelas || 1}x`
  if (/^credito_\d+x$/.test(lower)) return lower
  if (FORMAS_SIMPLES.includes(lower)) return lower
  return null
}

// `entradas.bandeira` também chega em dois formatos: label ("Visa", "Amex, Elo, outros")
// do formulário manual, ou key já normalizada ("visa", "amex") do modal de pagamento.
export function normalizeBandeiraKeys(bandeira: string | null): string[] {
  if (!bandeira) return []
  const raw = bandeira.trim()
  const lower = raw.toLowerCase()
  if (BANDEIRA_KEYS_CONHECIDAS.includes(lower)) return [lower]
  if (lower === 'todas') return []
  if (BANDEIRA_PARA_KEY[raw]) return BANDEIRA_PARA_KEY[raw]
  return []
}

// Resolve prazo de repasse pela mesma lógica de fallback usada para taxa:
// bandeira específica > 'todas' > default (fixo D+30 se não configurado)
export function getPrazo(
  taxas: TaxaPag[],
  formaPagamento: string,
  bandeira: string | null,
  nParcelas: number
): { dias: number; modo: 'fixo' | 'parcelado'; intervalo: number } {
  const formaKey = normalizeFormaKey(formaPagamento, nParcelas)
  if (!formaKey) return { dias: 30, modo: 'fixo', intervalo: 30 }
  const bandeiraKeys = normalizeBandeiraKeys(bandeira)
  for (const bKey of bandeiraKeys) {
    const t = taxas.find(t => t.forma === formaKey && t.bandeira === bKey)
    if (t) return { dias: t.dias_repasse, modo: t.modo_repasse, intervalo: t.intervalo_dias_parcelas ?? 30 }
  }
  const todas = taxas.find(t => t.forma === formaKey && t.bandeira === 'todas')
  if (todas) return { dias: todas.dias_repasse, modo: todas.modo_repasse, intervalo: todas.intervalo_dias_parcelas ?? 30 }
  return { dias: 30, modo: 'fixo', intervalo: 30 }
}

// Gera a projeção completa de parcelas (passadas e futuras) a partir de uma
// lista de entradas + taxas configuradas. Quem consome decide o filtro de
// data (dashboard/DRE filtram por mês, previsão filtra por período futuro).
export function gerarParcelas(entradas: EntradaParaProjecao[], taxas: TaxaPag[]): ParcelaProjetada[] {
  const geradas: ParcelaProjetada[] = []

  for (const e of entradas) {
    const nParcelas = e.n_parcelas || 1
    const valorLiquido = Number(e.valor_liquido) || 0
    const { dias, modo, intervalo } = getPrazo(taxas, e.forma_pagamento, e.bandeira, nParcelas)

    if (modo === 'fixo' || nParcelas <= 1) {
      // Todo o valor líquido cai de uma vez, em D+dias
      const data = addDaysBR(e.data_venda, dias)
      geradas.push({
        key: `${e.id}-1`,
        entradaId: e.id,
        data,
        parcelaNum: 1,
        totalParcelas: 1,
        valorLiquido,
        pacienteNome: e.paciente_nome || 'Paciente',
        procedimentoNome: e.procedimento_nome || 'Procedimento',
        formaPagamento: e.forma_pagamento,
        diferida: dias > 0,
      })
      continue
    }

    // Parcelado: 1ª parcela em D+dias, demais a cada `intervalo` dias a partir da 1ª
    const valorParcela = valorLiquido / nParcelas
    for (let i = 1; i <= nParcelas; i++) {
      const data = addDaysBR(e.data_venda, dias + (i - 1) * intervalo)
      geradas.push({
        key: `${e.id}-${i}`,
        entradaId: e.id,
        data,
        parcelaNum: i,
        totalParcelas: nParcelas,
        valorLiquido: valorParcela,
        pacienteNome: e.paciente_nome || 'Paciente',
        procedimentoNome: e.procedimento_nome || 'Procedimento',
        formaPagamento: e.forma_pagamento,
        diferida: true,
      })
    }
  }

  return geradas
}
