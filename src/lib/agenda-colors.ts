/**
 * Cores da agenda — fonte única de verdade.
 *
 * Precedência de cor do card:
 *   1. appointments.color        (override manual do agendamento)
 *   2. procedures.color          (override por procedimento)
 *   3. procedure_category_colors (cor da categoria)
 *   4. status                    (comportamento atual — fallback)
 *
 * O fundo do card vem da cor resolvida; a borda esquerda e o dot continuam
 * refletindo o STATUS. Clínica que não configurou nada cai no item 4 e a
 * agenda fica idêntica a como era antes da feature.
 *
 * IMPORTANTE: todas as classes precisam ser strings estáticas e completas.
 * O Tailwind não gera classe montada em runtime (`bg-${cor}-100` não funciona).
 */

export type ColorStyle = {
  /** fundo do card */
  bg: string
  /** cor do texto sobre o fundo */
  text: string
  /** borda (usada nos blocos; no card de agendamento a borda vem do status) */
  border: string
  /** bolinha sólida — usada no seletor de cor e nas legendas */
  dot: string
  /** rótulo em pt-BR para o seletor */
  label: string
}

/**
 * Paleta da agenda. Superset das 6 chaves do COLOR_BLOCK antigo
 * (slate, red, orange, amber, blue, purple), com os mesmos valores de classe,
 * para que os blocos de profissional possam migrar pra cá sem mudança visual.
 */
export const AGENDA_PALETTE: Record<string, ColorStyle> = {
  slate: { bg: 'bg-slate-200', text: 'text-slate-700', border: 'border-slate-400', dot: 'bg-slate-400', label: 'Cinza' },
  red: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-400', dot: 'bg-red-400', label: 'Vermelho' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-400', dot: 'bg-orange-400', label: 'Laranja' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-400', dot: 'bg-amber-400', label: 'Âmbar' },
  blue: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-400', dot: 'bg-blue-400', label: 'Azul' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-400', dot: 'bg-purple-400', label: 'Roxo' },
  // novas
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-400', dot: 'bg-emerald-400', label: 'Verde' },
  teal: { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-400', dot: 'bg-teal-400', label: 'Verde-água' },
  cyan: { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-400', dot: 'bg-cyan-400', label: 'Ciano' },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-400', dot: 'bg-indigo-400', label: 'Índigo' },
  pink: { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-400', dot: 'bg-pink-400', label: 'Rosa' },
  rose: { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-400', dot: 'bg-rose-400', label: 'Rosê' },
}

/** Ordem de exibição no seletor de cor. */
export const AGENDA_PALETTE_KEYS = Object.keys(AGENDA_PALETTE)

export type StatusStyle = ColorStyle & {
  /** fundo saturado da faixa lateral — precisa de contraste pra ícone branco */
  solid: string
  /** mesma cor da faixa, como borda (visão de mês, onde não cabe faixa) */
  solidBorder: string
  /** nome do ícone em Icon.tsx */
  icon: string
}

/** Status do agendamento. bg/text/border mantêm exatamente as classes que já estavam em agenda-view. */
export const STATUS_CONFIG: Record<string, StatusStyle> = {
  scheduled: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', dot: 'bg-slate-400', solid: 'bg-slate-500', solidBorder: 'border-slate-500', icon: 'calendar', label: 'Agendado' },
  pending_confirmation: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300', dot: 'bg-yellow-400', solid: 'bg-yellow-600', solidBorder: 'border-yellow-600', icon: 'clock', label: 'Aguard. confirmação' },
  confirmed: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', dot: 'bg-blue-500', solid: 'bg-blue-500', solidBorder: 'border-blue-500', icon: 'userCheck', label: 'Confirmado' },
  in_progress: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300', dot: 'bg-amber-500', solid: 'bg-amber-600', solidBorder: 'border-amber-600', icon: 'play', label: 'Em atendimento' },
  completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500', solid: 'bg-emerald-600', solidBorder: 'border-emerald-600', icon: 'check', label: 'Realizado' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', dot: 'bg-red-500', solid: 'bg-red-500', solidBorder: 'border-red-500', icon: 'x', label: 'Cancelado' },
  no_show: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', dot: 'bg-red-500', solid: 'bg-red-600', solidBorder: 'border-red-600', icon: 'alertCircle', label: 'Não compareceu' },
  rescheduling: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300', dot: 'bg-orange-500', solid: 'bg-orange-500', solidBorder: 'border-orange-500', icon: 'refresh', label: 'Reagendamento' },
}

/** Estilo puro do status, sem a cor de procedimento por cima. Use em chips que rotulam o status. */
export function getStatusStyle(status?: string | null): StatusStyle {
  return STATUS_CONFIG[status || 'scheduled'] || STATUS_CONFIG.scheduled
}

/**
 * Espelha public.fn_normalize_category() do Postgres.
 * `procedures.category` é texto livre, então "Injetáveis", "injetaveis" e
 * " Injetaveis " precisam casar com a mesma linha de procedure_category_colors.
 */
export function normalizeCategory(category?: string | null): string {
  if (!category) return ''
  return category
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

export type CategoryColorRow = { category: string; color: string }

/** Constrói o mapa categoria-normalizada -> chave de cor. */
export function buildCategoryColorMap(rows: CategoryColorRow[] | null | undefined): Record<string, string> {
  const map: Record<string, string> = {}
  for (const row of rows || []) {
    const key = normalizeCategory(row.category)
    if (key && row.color) map[key] = row.color
  }
  return map
}

export type ResolveColorInput = {
  status?: string | null
  /** appointments.color */
  appointmentColor?: string | null
  /** procedures.color */
  procedureColor?: string | null
  /** procedures.category — resolvida contra o categoryColorMap */
  category?: string | null
  categoryColorMap?: Record<string, string>
}

export type ResolvedAppointmentColor = ColorStyle & {
  /** faixa lateral: sempre o status, nunca a cor do procedimento */
  solid: string
  solidBorder: string
  icon: string
  /** de onde veio o fundo — útil pra debug e pra legendas */
  source: 'appointment' | 'procedure' | 'category' | 'status'
}

/**
 * Resolve o visual do card: fundo pela cor configurada, borda/dot pelo status.
 * Chave de cor inválida (paleta mudou, dado sujo) é ignorada e cai no próximo nível.
 */
export function resolveAppointmentColor(input: ResolveColorInput): ResolvedAppointmentColor {
  const status = getStatusStyle(input.status)

  const categoryKey = normalizeCategory(input.category)
  const categoryColor = categoryKey ? input.categoryColorMap?.[categoryKey] : undefined

  const candidates: Array<[ResolvedAppointmentColor['source'], string | null | undefined]> = [
    ['appointment', input.appointmentColor],
    ['procedure', input.procedureColor],
    ['category', categoryColor],
  ]

  for (const [source, key] of candidates) {
    if (!key) continue
    const palette = AGENDA_PALETTE[key]
    if (!palette) continue
    return {
      bg: palette.bg,
      text: palette.text,
      // borda, dot, faixa e ícone seguem o STATUS — é assim que o status continua legível
      border: status.border,
      dot: status.dot,
      solid: status.solid,
      solidBorder: status.solidBorder,
      icon: status.icon,
      label: status.label,
      source,
    }
  }

  return { ...status, source: 'status' }
}
