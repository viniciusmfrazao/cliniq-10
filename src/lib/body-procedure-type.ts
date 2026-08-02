// Classifica um produto/procedimento corporal pelo nome, na mesma linha do
// classifyInjectableType para o mapa facial. Estoque de harmonização corporal
// tende a ter nomes variados (enzimas, ativos de criolipólise, etc.) então a
// classificação olha o nome do produto, não a categoria genérica do estoque.

const PROCEDURE_KEYWORDS: Record<string, string[]> = {
  enzimas: ['enzima', 'lipolitic', 'lipolít', 'pplc', 'fosfatidilcolina'],
  criolipolise: ['criolipólise', 'criolipolise', 'crio'],
  ultrassom: ['ultrassom', 'hifu', 'cavitação', 'cavitacao'],
  radiofrequencia: ['radiofrequência', 'radiofrequencia', ' rf ', 'rf corporal'],
  drenagem: ['drenagem', 'linfática', 'linfatica'],
  bioestimulador: ['bioestimulador', 'sculptra', 'ellansé', 'ellanse', 'radiesse', 'colágeno', 'colageno'],
  pmma: ['pmma', 'metacrilato'],
  fios: ['fio de sustentação', 'fio de sustentacao', 'fio pdo', 'fios'],
  massagem: ['massagem modeladora', 'modelador'],
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export const BODY_PROCEDURE_TYPES: { value: string; label: string }[] = [
  { value: 'enzimas', label: 'Enzimas' },
  { value: 'criolipolise', label: 'Criolipólise' },
  { value: 'ultrassom', label: 'Ultrassom / HIFU' },
  { value: 'radiofrequencia', label: 'Radiofrequência' },
  { value: 'drenagem', label: 'Drenagem linfática' },
  { value: 'bioestimulador', label: 'Bioestimulador' },
  { value: 'pmma', label: 'PMMA' },
  { value: 'fios', label: 'Fios de sustentação' },
  { value: 'massagem', label: 'Massagem modeladora' },
  { value: 'outro', label: 'Outro' },
]

export function classifyBodyProcedureType(
  productName: string | null | undefined,
  category?: string | null
): string {
  const name = normalize(productName || '')

  for (const [type, keywords] of Object.entries(PROCEDURE_KEYWORDS)) {
    if (keywords.some(k => name.includes(normalize(k)))) return type
  }

  const cat = normalize(category || '')
  for (const [type, keywords] of Object.entries(PROCEDURE_KEYWORDS)) {
    if (keywords.some(k => cat.includes(normalize(k)))) return type
  }

  return 'outro'
}
