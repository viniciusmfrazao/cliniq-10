import Link from 'next/link'
import Icon from '@/components/ui/Icon'

/**
 * Card de resumo de uma anamnese pra ser usado no atendimento e no
 * histórico do paciente. Extrai chips de alerta das responses (gestante,
 * lactante, alergias, fumante, medicamentos em uso) e mostra a queixa
 * principal — informações que mudam decisão clínica antes do
 * procedimento.
 */

type AnamneseLike = {
  id: string
  status: 'pending' | 'viewed' | 'completed' | string
  responses: Record<string, unknown> | null
  completed_at: string | null
  created_at: string
  signature_data?: string | null
}

type Variant = 'compact' | 'full'

type Props = {
  anamnese: AnamneseLike
  variant?: Variant
  /** Se for o registro "mais recente" pra dar destaque visual. */
  highlightRecent?: boolean
}

type Chip = {
  label: string
  tone: 'red' | 'amber' | 'emerald' | 'slate'
  title?: string
}

/**
 * Considera "marcou sim" se valor é literalmente 'Sim' (case-insensitive)
 * ou true. Os formulários de anamnese gravam strings tipo 'Sim' / 'Não'.
 */
function isYes(v: unknown): boolean {
  if (v === true) return true
  if (typeof v !== 'string') return false
  return v.trim().toLowerCase() === 'sim'
}

/** Procura chaves que começam com `alergia_` e estão como Sim. */
function listAllergies(responses: Record<string, unknown>): string[] {
  const out: string[] = []
  for (const [k, v] of Object.entries(responses)) {
    if (!k.startsWith('alergia_') || k.endsWith('_desc')) continue
    if (isYes(v)) {
      const nice = k.replace(/^alergia_/, '').trim()
      if (nice) out.push(nice)
    }
  }
  return out
}

function buildChips(responses: Record<string, unknown> | null): Chip[] {
  if (!responses) return []
  const chips: Chip[] = []

  if (isYes(responses.gravida)) {
    chips.push({ label: 'Gestante', tone: 'red', title: 'Paciente gestante — checar contraindicações' })
  }
  if (isYes(responses.lactante)) {
    chips.push({ label: 'Lactante', tone: 'red', title: 'Em fase de amamentação' })
  }

  const allergies = listAllergies(responses)
  if (allergies.length > 0) {
    chips.push({
      label: `Alergia: ${allergies.slice(0, 2).join(', ')}${allergies.length > 2 ? ` +${allergies.length - 2}` : ''}`,
      tone: 'red',
      title: `Alergias declaradas: ${allergies.join(', ')}`,
    })
  }
  if (isYes(responses.herpes)) {
    chips.push({ label: 'Herpes', tone: 'amber', title: 'Histórico de herpes labial' })
  }
  if (isYes(responses.autoim)) {
    chips.push({
      label: 'Auto-imune',
      tone: 'amber',
      title: typeof responses.autoim_qual === 'string' ? String(responses.autoim_qual) : undefined,
    })
  }
  if (isYes(responses.tabaco)) {
    const qty = typeof responses.tabaco_qtd === 'string' ? ` (${responses.tabaco_qtd})` : ''
    chips.push({ label: `Fumante${qty}`, tone: 'amber' })
  }

  const meds: string[] = []
  if (isYes(responses.antiinfl)) meds.push('anti-inflamatório')
  if (isYes(responses.antibio)) meds.push('antibiótico')
  if (isYes(responses.cortic)) meds.push('corticóide')
  if (isYes(responses.outroMed)) meds.push('outro')
  if (meds.length > 0) {
    chips.push({ label: `Em uso: ${meds.join(', ')}`, tone: 'amber' })
  }

  if (isYes(responses.imagem)) {
    chips.push({ label: 'Autoriza imagem', tone: 'emerald' })
  }

  return chips
}

const TONE_CLASS: Record<Chip['tone'], string> = {
  red: 'bg-red-100 text-red-700 border-red-200',
  amber: 'bg-amber-100 text-amber-700 border-amber-200',
  emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700' },
  viewed: { label: 'Visualizada', cls: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Preenchida', cls: 'bg-emerald-100 text-emerald-700' },
}

export default function AnamneseSummaryCard({
  anamnese,
  variant = 'full',
  highlightRecent = false,
}: Props) {
  const chips = buildChips(anamnese.responses)
  const statusBadge =
    STATUS_BADGE[anamnese.status] ?? { label: anamnese.status, cls: 'bg-slate-100 text-slate-700' }
  const completed = anamnese.status === 'completed' && anamnese.completed_at
  const dateLabel = completed
    ? `Preenchida em ${new Date(anamnese.completed_at!).toLocaleDateString('pt-BR')}`
    : `Enviada em ${new Date(anamnese.created_at).toLocaleDateString('pt-BR')}`

  const queixa =
    anamnese.responses && typeof anamnese.responses['queixa_obs'] === 'string'
      ? String(anamnese.responses['queixa_obs']).trim()
      : ''
  const queixaAreas =
    anamnese.responses && Array.isArray(anamnese.responses['queixa'])
      ? (anamnese.responses['queixa'] as unknown[]).filter((v): v is string => typeof v === 'string')
      : []

  // === Variante compacta: 1 linha + chips ===
  if (variant === 'compact') {
    return (
      <Link
        href={`/dashboard/anamnese/${anamnese.id}`}
        className="block p-3 rounded-xl border border-slate-200 hover:border-violet-300 bg-white hover:bg-violet-50/30 transition-colors"
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
              <Icon name="file" className="w-4 h-4 text-violet-700" />
            </span>
            <span className="text-sm font-medium text-slate-900 truncate">{dateLabel}</span>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${statusBadge.cls}`}>
            {statusBadge.label}
          </span>
        </div>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {chips.slice(0, 4).map((c, i) => (
              <span
                key={i}
                title={c.title}
                className={`text-[10px] px-1.5 py-0.5 rounded-full border ${TONE_CLASS[c.tone]}`}
              >
                {c.label}
              </span>
            ))}
            {chips.length > 4 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                +{chips.length - 4}
              </span>
            )}
          </div>
        )}
      </Link>
    )
  }

  // === Variante full: card destacável com queixa + chips + link ===
  return (
    <div
      className={`card p-5 ${highlightRecent ? 'ring-2 ring-violet-200 border-violet-200' : ''}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
            <Icon name="file" className="w-5 h-5 text-violet-700" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              {highlightRecent ? 'Anamnese mais recente' : 'Anamnese'}
            </h2>
            <p className="text-xs text-slate-500">{dateLabel}</p>
          </div>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${statusBadge.cls}`}
        >
          {statusBadge.label}
        </span>
      </div>

      {anamnese.status === 'completed' ? (
        <>
          {chips.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {chips.map((c, i) => (
                <span
                  key={i}
                  title={c.title}
                  className={`text-xs px-2 py-1 rounded-full border ${TONE_CLASS[c.tone]}`}
                >
                  {c.label}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic mb-3">Sem alertas relevantes.</p>
          )}

          {(queixaAreas.length > 0 || queixa) && (
            <div className="bg-slate-50 rounded-lg p-3 mb-3">
              {queixaAreas.length > 0 && (
                <p className="text-xs text-slate-500 mb-1">
                  <span className="font-semibold">Áreas de interesse:</span>{' '}
                  {queixaAreas.join(', ')}
                </p>
              )}
              {queixa && (
                <p className="text-sm text-slate-700 whitespace-pre-wrap line-clamp-3">
                  {queixa}
                </p>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-slate-500 mb-3">
          Aguardando o paciente preencher.
        </p>
      )}

      <Link
        href={`/dashboard/anamnese/${anamnese.id}`}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-700 hover:text-violet-800"
      >
        Abrir ficha completa
        <Icon name="chevronRight" className="w-3 h-3" />
      </Link>
    </div>
  )
}
