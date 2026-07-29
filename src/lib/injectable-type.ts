// Classifica um produto injetável como 'toxin' (toxina botulínica) ou 'filler'
// (preenchedor / bioestimulador / outros injetáveis não-toxina).
//
// Motivo de existir: no estoque, praticamente todo produto injetável é
// cadastrado com category = 'injetavel' (genérico), então NÃO dá pra usar a
// categoria do estoque pra diferenciar botox de preenchedor. A classificação
// precisa olhar o nome do produto.

const TOXIN_KEYWORDS = [
  'botox', 'toxina', 'dysport', 'nabota', 'botulift', 'letybo', 'botulínica', 'botulinica',
]

const FILLER_KEYWORDS = [
  'preench', 'ácido hialurônico', 'acido hialuronico', 'hialurônico', 'hialuronico',
  'restylane', 'juvederm', 'biogelis', 'yvoire', 'belotero', 'radiesse', 'profhilo',
  'neuramis', 'skinvive', 'sculptra', 'elleva', 'diamond', 'bioestimulador',
  'kirialys', 'skinbooster', 'filler',
]

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
}

/**
 * Retorna 'toxin' ou 'filler' com base no nome do produto (e, como fallback
 * fraco, na categoria). Prioriza correspondência pelo nome porque a
 * categoria do estoque não é confiável para essa distinção.
 */
export function classifyInjectableType(
  productName: string | null | undefined,
  category?: string | null
): 'toxin' | 'filler' {
  const name = normalize(productName || '')

  if (TOXIN_KEYWORDS.some(k => name.includes(normalize(k)))) return 'toxin'
  if (FILLER_KEYWORDS.some(k => name.includes(normalize(k)))) return 'filler'

  // Fallback: categoria explícita (raro, mas cobre cadastros bem-feitos)
  const cat = normalize(category || '')
  if (cat.includes('preenchimento') || cat.includes('filler') || cat.includes('bioestimulador')) return 'filler'
  if (cat.includes('toxina') || cat.includes('botox')) return 'toxin'

  // Default conservador: quando não dá pra identificar, assume toxin
  // (comportamento anterior), mas agora só cai aqui de fato quando o nome
  // não tem nenhuma pista.
  return 'toxin'
}
