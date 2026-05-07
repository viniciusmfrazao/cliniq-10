'use client'

import { useMemo, useState } from 'react'
import PhotoLightbox from '@/components/ui/PhotoLightbox'
import AnamneseSummaryCard from '@/components/anamnese/AnamneseSummaryCard'

type Evolution = {
  id: string
  type: string
  title: string
  content: string | null
  procedure_name: string | null
  photos: string[] | null
  created_at: string
  users: { name: string } | null
}

type AnamneseTimelineItem = {
  id: string
  status: 'pending' | 'viewed' | 'completed' | string
  responses: Record<string, unknown> | null
  completed_at: string | null
  created_at: string
  signature_data?: string | null
}

const TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  consultation: { icon: '🩺', color: 'bg-blue-100 text-blue-700', label: 'Consulta' },
  procedure: { icon: '💉', color: 'bg-purple-100 text-purple-700', label: 'Procedimento' },
  note: { icon: '📝', color: 'bg-slate-100 text-slate-700', label: 'Anotacao' },
  prescription: { icon: '💊', color: 'bg-green-100 text-green-700', label: 'Prescricao' },
  exam: { icon: '🔬', color: 'bg-amber-100 text-amber-700', label: 'Exame' },
  anamnese: { icon: '📋', color: 'bg-violet-100 text-violet-700', label: 'Anamnese' },
}

type Props = {
  evolutions: Evolution[]
  /**
   * Anamneses do paciente pra mesclar na timeline. Mostradas inline com
   * o resto, ordenadas por data (completed_at quando preenchidas, senão
   * created_at). Opcional pra manter compat com chamadas antigas.
   */
  anamneses?: AnamneseTimelineItem[]
  /**
   * Map de path -> signed URL pras fotos. Geramos no server pra evitar
   * que o componente client chame storage.createSignedUrl. Se um path
   * nao tiver URL (sumiu do storage), mostramos placeholder de erro.
   */
  photoUrls?: Record<string, string>
}

const FILTERS: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'Tudo' },
  { id: 'consultation', label: 'Consultas' },
  { id: 'procedure', label: 'Procedimentos' },
  { id: 'note', label: 'Notas' },
  { id: 'prescription', label: 'Prescrições' },
  { id: 'exam', label: 'Exames' },
  { id: 'anamnese', label: 'Anamneses' },
]

/**
 * Item unificado da timeline. Todo card é um destes — `kind` decide
 * qual renderizador usa.
 */
type TimelineItem =
  | { kind: 'evolution'; sortDate: string; data: Evolution }
  | { kind: 'anamnese'; sortDate: string; data: AnamneseTimelineItem }

/**
 * Quantas thumbs a gente mostra no card recolhido. O resto vira um badge
 * "+N" que abre o lightbox direto na primeira foto.
 */
const COLLAPSED_THUMBS = 4

export default function EvolutionTimeline({
  evolutions,
  anamneses = [],
  photoUrls = {},
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')

  // State do lightbox: qual evolução abriu e em qual índice começa.
  const [lightbox, setLightbox] = useState<{ evoId: string; index: number } | null>(null)

  // Constrói lista unificada e ordenada (mais recente primeiro).
  // Anamnese usa completed_at (quando preenchida) ou created_at como
  // data-âncora pra timeline.
  const items: TimelineItem[] = useMemo(() => {
    const evoItems: TimelineItem[] = evolutions.map((e) => ({
      kind: 'evolution',
      sortDate: e.created_at,
      data: e,
    }))
    const anamItems: TimelineItem[] = anamneses.map((a) => ({
      kind: 'anamnese',
      sortDate: a.completed_at || a.created_at,
      data: a,
    }))
    return [...evoItems, ...anamItems].sort((a, b) =>
      a.sortDate < b.sortDate ? 1 : a.sortDate > b.sortDate ? -1 : 0,
    )
  }, [evolutions, anamneses])

  const filtered = useMemo(() => {
    if (filter === 'all') return items
    if (filter === 'anamnese') return items.filter((i) => i.kind === 'anamnese')
    return items.filter((i) => i.kind === 'evolution' && i.data.type === filter)
  }, [filter, items])

  // URLs do lightbox: só as fotos da evolução aberta, com signed URL
  // resolvida. Mantemos os paths (índice) alinhados pra navegação coerente.
  const lightboxUrls = useMemo(() => {
    if (!lightbox) return [] as string[]
    const evo = evolutions.find((e) => e.id === lightbox.evoId)
    if (!evo?.photos) return []
    return evo.photos
      .map((p) => photoUrls[p])
      .filter((u): u is string => !!u)
  }, [lightbox, evolutions, photoUrls])

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl">📋</span>
        </div>
        <p className="text-sm text-slate-500">Nenhum registro ainda</p>
        <p className="text-xs text-slate-400 mt-1">
          Clique em &quot;+ Nova evolução&quot; para adicionar
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Filtros por tipo */}
      <div className="flex flex-wrap gap-1.5 mb-4 -mt-1">
        {FILTERS.map((f) => {
          let count: number
          if (f.id === 'all') count = items.length
          else if (f.id === 'anamnese') count = anamneses.length
          else count = evolutions.filter((e) => e.type === f.id).length
          if (f.id !== 'all' && count === 0) return null
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === f.id
                  ? 'bg-violet-100 text-violet-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label} {count > 0 && <span className="opacity-60">({count})</span>}
            </button>
          )
        })}
      </div>

      <div className="relative">
        {/* Linha vertical */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-100" />

        <div className="space-y-4">
          {filtered.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-slate-500">Nenhum registro nesse filtro</p>
            </div>
          )}
          {filtered.map((item) => {
            // Anamnese tem renderização própria (delegada pro card
            // reutilizável) com ícone na lateral pra manter o ritmo da
            // timeline.
            if (item.kind === 'anamnese') {
              const a = item.data
              const cfg = TYPE_CONFIG.anamnese
              return (
                <div key={`anam-${a.id}`} className="relative pl-10">
                  <div
                    className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center text-sm ${cfg.color}`}
                  >
                    {cfg.icon}
                  </div>
                  <AnamneseSummaryCard anamnese={a} variant="compact" />
                </div>
              )
            }

            const evo = item.data
            const config = TYPE_CONFIG[evo.type] || TYPE_CONFIG.note
            const isExpanded = expandedId === evo.id
            const photos = evo.photos ?? []
            const hasPhotos = photos.length > 0

            // Quando recolhido, mostramos só os primeiros N. Quando
            // expandido, mostramos todos. O lightbox sempre navega no
            // conjunto completo da evolução.
            const visiblePhotos = isExpanded ? photos : photos.slice(0, COLLAPSED_THUMBS)
            const hiddenCount = Math.max(0, photos.length - visiblePhotos.length)

            return (
              <div key={evo.id} className="relative pl-10">
                {/* Icone na timeline */}
                <div
                  className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center text-sm ${config.color}`}
                >
                  {config.icon}
                </div>

                <div
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isExpanded
                      ? 'bg-white border-brand-200 shadow-sm'
                      : 'bg-slate-50 border-transparent hover:border-slate-200'
                  }`}
                  onClick={() => setExpandedId(isExpanded ? null : evo.id)}
                >
                  <div className="flex items-start justify-between mb-1 gap-2">
                    <div className="min-w-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${config.color}`}>
                        {config.label}
                      </span>
                      <h3 className="text-sm font-medium text-slate-900 mt-1 truncate">
                        {evo.title}
                      </h3>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-slate-400">
                        {new Date(evo.created_at).toLocaleDateString('pt-BR')}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(evo.created_at).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>

                  {evo.users?.name && (
                    <p className="text-xs text-slate-500 mb-2">por {evo.users.name}</p>
                  )}

                  {evo.content && (
                    <p
                      className={`text-sm text-slate-600 whitespace-pre-wrap ${
                        isExpanded ? '' : 'line-clamp-2'
                      }`}
                    >
                      {evo.content}
                    </p>
                  )}

                  {evo.procedure_name && (
                    <p className="text-xs text-purple-600 mt-2">
                      Procedimento: {evo.procedure_name}
                    </p>
                  )}

                  {/* Galeria de fotos: aparece SEMPRE que tem foto, não só
                      quando o card está expandido. Antes (commit a645919) só
                      aparecia no expandido — o profissional achava que as
                      fotos do atendimento "tinham sumido". */}
                  {hasPhotos && (
                    <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                      {visiblePhotos.map((path, i) => {
                        const url = photoUrls[path]
                        // O lightbox navega só nas fotos que TEM signed URL
                        // (filtradas em lightboxUrls). Aqui mapeamos o índice
                        // do thumb -> índice no array filtrado.
                        const validUrls = photos
                          .map((p) => photoUrls[p])
                          .filter((u): u is string => !!u)
                        const lightboxIndex = url ? validUrls.indexOf(url) : -1

                        return url ? (
                          <button
                            key={`${evo.id}-${i}`}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setLightbox({
                                evoId: evo.id,
                                index: lightboxIndex >= 0 ? lightboxIndex : 0,
                              })
                            }}
                            className="relative block aspect-square rounded-lg overflow-hidden border border-slate-200 hover:border-violet-400 hover:ring-2 hover:ring-violet-100 transition-all group"
                            title="Clique para ampliar"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt={`Foto ${i + 1} da evolução`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              loading="lazy"
                            />
                            {/* Overlay no hover indicando que é clicável */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                            {/* "+N" sobre a última thumb quando há mais fotos
                                escondidas (somente no estado recolhido). */}
                            {!isExpanded &&
                              i === visiblePhotos.length - 1 &&
                              hiddenCount > 0 && (
                                <div className="absolute inset-0 bg-black/55 flex items-center justify-center text-white font-bold text-lg">
                                  +{hiddenCount}
                                </div>
                              )}
                          </button>
                        ) : (
                          <div
                            key={`${evo.id}-${i}`}
                            className="aspect-square rounded-lg bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 text-[10px] text-center px-1"
                            title={`Não foi possível carregar: ${path}`}
                          >
                            Foto indispon.
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <p className="text-xs text-brand-600 mt-2">
                    {isExpanded ? 'Clique para fechar' : 'Clique para expandir'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Lightbox global pra galeria. Renderizado no topo do componente
          (fora do map) pra ficar acima de qualquer card e cobrir toda tela. */}
      <PhotoLightbox
        open={!!lightbox && lightboxUrls.length > 0}
        urls={lightboxUrls}
        index={lightbox?.index ?? 0}
        onClose={() => setLightbox(null)}
        onIndexChange={(next) =>
          setLightbox((prev) => (prev ? { ...prev, index: next } : prev))
        }
        altPrefix="Foto da evolução"
      />
    </div>
  )
}
