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

// Soma meses mantendo o dia do mês (dia 31 → último dia do mês seguinte).
// Boleto vence sempre no mesmo dia do mês, então a projeção anda de mês em mês,
// e não de 30 em 30 dias corridos como o repasse de cartão.
export function addMonthsBR(base: string, months: number): string {
  const [y, m, d] = base.slice(0, 10).split('-').map(Number)
  const alvo = new Date(Date.UTC(y, m - 1 + months, 1))
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate()
  const dia = String(Math.min(d, ultimoDia)).padStart(2, '0')
  return `${alvo.getUTCFullYear()}-${String(alvo.getUTCMonth() + 1).padStart(2, '0')}-${dia}`
}

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
  // Boleto: data do 1º vencimento escolhida no lançamento. Quando presente,
  // é a data base da projeção no lugar de data_venda.
  primeiro_vencimento?: string | null
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
  'Boleto': 'boleto',
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
  // Boleto é uma chave só ('boleto'); o parcelamento vem em n_parcelas, não no label.
  if (lower.startsWith('boleto')) return 'boleto'
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
  // Boleto: cai no dia seguinte ao vencimento, uma parcela por mês.
  const fallback: { dias: number; modo: 'fixo' | 'parcelado'; intervalo: number } =
    formaKey === 'boleto' ? { dias: 1, modo: 'parcelado', intervalo: 30 } : { dias: 30, modo: 'fixo', intervalo: 30 }
  const bandeiraKeys = normalizeBandeiraKeys(bandeira)
  for (const bKey of bandeiraKeys) {
    const t = taxas.find(t => t.forma === formaKey && t.bandeira === bKey)
    if (t) return { dias: t.dias_repasse, modo: t.modo_repasse, intervalo: t.intervalo_dias_parcelas ?? fallback.intervalo }
  }
  const todas = taxas.find(t => t.forma === formaKey && t.bandeira === 'todas')
  if (todas) return { dias: todas.dias_repasse, modo: todas.modo_repasse, intervalo: todas.intervalo_dias_parcelas ?? fallback.intervalo }
  return fallback
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

    // Boleto: a contagem parte do 1º vencimento informado no lançamento, não da
    // data da venda. Cartão continua partindo da data da venda.
    const dataBase = e.primeiro_vencimento || e.data_venda
    // Se a clínica informou o 1º vencimento e a venda foi dividida, sempre
    // parcelamos — não depende do modo_repasse configurado.
    const parcelado = modo === 'parcelado' || (!!e.primeiro_vencimento && nParcelas > 1)

    if (!parcelado || nParcelas <= 1) {
      // Todo o valor líquido cai de uma vez, em D+dias
      const data = addDaysBR(dataBase, dias)
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
      // Com 1º vencimento informado (boleto), cada parcela vence no mesmo dia
      // do mês seguinte e cai `dias` depois. Sem ele (cartão), mantém o
      // intervalo em dias corridos configurado em taxas_pagamento.
      const data = e.primeiro_vencimento
        ? addDaysBR(addMonthsBR(dataBase, i - 1), dias)
        : addDaysBR(dataBase, dias + (i - 1) * intervalo)
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

// Gera as datas de vencimento de todas as parcelas de um boleto a partir do
// 1º vencimento (mesma regra usada em gerarParcelas: dia fixo, mês a mês).
// Usado tanto pra criar as linhas em `boleto_parcelas` no lançamento quanto
// por qualquer tela que precise pré-visualizar as datas antes de salvar.
export function gerarVencimentosBoleto(primeiroVencimento: string, nParcelas: number): string[] {
  const n = Math.max(1, nParcelas || 1)
  return Array.from({ length: n }, (_, i) => addMonthsBR(primeiroVencimento, i))
}
