// Numeração FDI
// Adulto: 11-18 (sup dir), 21-28 (sup esq), 31-38 (inf esq), 41-48 (inf dir)
// Leite:  51-55 (sup dir), 61-65 (sup esq), 71-75 (inf esq), 81-85 (inf dir)

export type ToothCondition =
  | 'carie'
  | 'restauracao'
  | 'coroa'
  | 'canal'
  | 'extracao'
  | 'implante'
  | 'fratura'
  | 'ausente'
  | 'protese'
  | 'selante'

export const CONDITION_LABELS: Record<ToothCondition, string> = {
  carie:      'Cárie',
  restauracao:'Restauração',
  coroa:      'Coroa',
  canal:      'Canal',
  extracao:   'Extração',
  implante:   'Implante',
  fratura:    'Fratura',
  ausente:    'Ausente',
  protese:    'Prótese',
  selante:    'Selante',
}

export const CONDITION_COLORS: Record<ToothCondition, string> = {
  carie:       '#ef4444', // vermelho
  restauracao: '#3b82f6', // azul
  coroa:       '#f59e0b', // amarelo
  canal:       '#8b5cf6', // roxo
  extracao:    '#6b7280', // cinza
  implante:    '#10b981', // verde
  fratura:     '#f97316', // laranja
  ausente:     '#d1d5db', // cinza claro
  protese:     '#ec4899', // rosa
  selante:     '#06b6d4', // ciano
}

export type ToothData = {
  number: number
  label: string
  x: number
  y: number
  quadrant: 1 | 2 | 3 | 4
}

// Adulto — 32 dentes
export const ADULT_TEETH: ToothData[] = [
  // Quadrante 1 — Superior direito (18→11)
  { number: 18, label: '18', x: 30,  y: 40,  quadrant: 1 },
  { number: 17, label: '17', x: 68,  y: 30,  quadrant: 1 },
  { number: 16, label: '16', x: 106, y: 22,  quadrant: 1 },
  { number: 15, label: '15', x: 144, y: 18,  quadrant: 1 },
  { number: 14, label: '14', x: 182, y: 16,  quadrant: 1 },
  { number: 13, label: '13', x: 220, y: 15,  quadrant: 1 },
  { number: 12, label: '12', x: 258, y: 15,  quadrant: 1 },
  { number: 11, label: '11', x: 296, y: 15,  quadrant: 1 },
  // Quadrante 2 — Superior esquerdo (21→28)
  { number: 21, label: '21', x: 334, y: 15,  quadrant: 2 },
  { number: 22, label: '22', x: 372, y: 15,  quadrant: 2 },
  { number: 23, label: '23', x: 410, y: 15,  quadrant: 2 },
  { number: 24, label: '24', x: 448, y: 16,  quadrant: 2 },
  { number: 25, label: '25', x: 486, y: 18,  quadrant: 2 },
  { number: 26, label: '26', x: 524, y: 22,  quadrant: 2 },
  { number: 27, label: '27', x: 562, y: 30,  quadrant: 2 },
  { number: 28, label: '28', x: 600, y: 40,  quadrant: 2 },
  // Quadrante 3 — Inferior esquerdo (31→38) - espelhado
  { number: 31, label: '31', x: 334, y: 140, quadrant: 3 },
  { number: 32, label: '32', x: 372, y: 140, quadrant: 3 },
  { number: 33, label: '33', x: 410, y: 140, quadrant: 3 },
  { number: 34, label: '34', x: 448, y: 142, quadrant: 3 },
  { number: 35, label: '35', x: 486, y: 144, quadrant: 3 },
  { number: 36, label: '36', x: 524, y: 150, quadrant: 3 },
  { number: 37, label: '37', x: 562, y: 160, quadrant: 3 },
  { number: 38, label: '38', x: 600, y: 170, quadrant: 3 },
  // Quadrante 4 — Inferior direito (41→48)
  { number: 41, label: '41', x: 296, y: 140, quadrant: 4 },
  { number: 42, label: '42', x: 258, y: 140, quadrant: 4 },
  { number: 43, label: '43', x: 220, y: 140, quadrant: 4 },
  { number: 44, label: '44', x: 182, y: 142, quadrant: 4 },
  { number: 45, label: '45', x: 144, y: 144, quadrant: 4 },
  { number: 46, label: '46', x: 106, y: 150, quadrant: 4 },
  { number: 47, label: '47', x: 68,  y: 160, quadrant: 4 },
  { number: 48, label: '48', x: 30,  y: 170, quadrant: 4 },
]

// Leite — 20 dentes
export const CHILD_TEETH: ToothData[] = [
  // Quadrante 5 — Superior direito
  { number: 55, label: '55', x: 80,  y: 40,  quadrant: 1 },
  { number: 54, label: '54', x: 130, y: 28,  quadrant: 1 },
  { number: 53, label: '53', x: 185, y: 20,  quadrant: 1 },
  { number: 52, label: '52', x: 240, y: 16,  quadrant: 1 },
  { number: 51, label: '51', x: 296, y: 15,  quadrant: 1 },
  // Quadrante 6 — Superior esquerdo
  { number: 61, label: '61', x: 334, y: 15,  quadrant: 2 },
  { number: 62, label: '62', x: 390, y: 16,  quadrant: 2 },
  { number: 63, label: '63', x: 445, y: 20,  quadrant: 2 },
  { number: 64, label: '64', x: 500, y: 28,  quadrant: 2 },
  { number: 65, label: '65', x: 550, y: 40,  quadrant: 2 },
  // Quadrante 7 — Inferior esquerdo
  { number: 71, label: '71', x: 334, y: 140, quadrant: 3 },
  { number: 72, label: '72', x: 390, y: 140, quadrant: 3 },
  { number: 73, label: '73', x: 445, y: 144, quadrant: 3 },
  { number: 74, label: '74', x: 500, y: 148, quadrant: 3 },
  { number: 75, label: '75', x: 550, y: 155, quadrant: 3 },
  // Quadrante 8 — Inferior direito
  { number: 81, label: '81', x: 296, y: 140, quadrant: 4 },
  { number: 82, label: '82', x: 240, y: 140, quadrant: 4 },
  { number: 83, label: '83', x: 185, y: 144, quadrant: 4 },
  { number: 84, label: '84', x: 130, y: 148, quadrant: 4 },
  { number: 85, label: '85', x: 80,  y: 155, quadrant: 4 },
]
