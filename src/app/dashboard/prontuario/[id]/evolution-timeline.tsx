'use client'

import { useState } from 'react'

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

const TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  consultation: { icon: '🩺', color: 'bg-blue-100 text-blue-700', label: 'Consulta' },
  procedure: { icon: '💉', color: 'bg-purple-100 text-purple-700', label: 'Procedimento' },
  note: { icon: '📝', color: 'bg-slate-100 text-slate-700', label: 'Anotacao' },
  prescription: { icon: '💊', color: 'bg-green-100 text-green-700', label: 'Prescricao' },
  exam: { icon: '🔬', color: 'bg-amber-100 text-amber-700', label: 'Exame' },
}

type Props = {
  evolutions: Evolution[]
  /**
   * Map de path -> signed URL pras fotos. Geramos no server pra evitar
   * que o componente client chame storage.createSignedUrl (poderia, mas
   * uma chamada batched no SSR e mais rapido). Se um path nao tiver URL
   * (sumiu do storage, expirou, etc), mostramos placeholder de erro.
   */
  photoUrls?: Record<string, string>
}

export default function EvolutionTimeline({ evolutions, photoUrls = {} }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (evolutions.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl">📋</span>
        </div>
        <p className="text-sm text-slate-500">Nenhuma evolucao registrada</p>
        <p className="text-xs text-slate-400 mt-1">Clique em "Nova evolucao" para adicionar</p>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Linha vertical */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-100" />

      <div className="space-y-4">
        {evolutions.map(evo => {
          const config = TYPE_CONFIG[evo.type] || TYPE_CONFIG.note
          const isExpanded = expandedId === evo.id

          return (
            <div key={evo.id} className="relative pl-10">
              {/* Icone na timeline */}
              <div className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center text-sm ${config.color}`}>
                {config.icon}
              </div>

              <div 
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  isExpanded ? 'bg-white border-brand-200 shadow-sm' : 'bg-slate-50 border-transparent hover:border-slate-200'
                }`}
                onClick={() => setExpandedId(isExpanded ? null : evo.id)}
              >
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${config.color}`}>
                      {config.label}
                    </span>
                    <h3 className="text-sm font-medium text-slate-900 mt-1">{evo.title}</h3>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-slate-400">
                      {new Date(evo.created_at).toLocaleDateString('pt-BR')}
                    </p>
                    <p className="text-xs text-slate-400">
                      {new Date(evo.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                {evo.users?.name && (
                  <p className="text-xs text-slate-500 mb-2">por {evo.users.name}</p>
                )}

                {evo.content && (
                  <p className={`text-sm text-slate-600 ${isExpanded ? '' : 'line-clamp-2'}`}>
                    {evo.content}
                  </p>
                )}

                {evo.procedure_name && (
                  <p className="text-xs text-purple-600 mt-2">
                    Procedimento: {evo.procedure_name}
                  </p>
                )}

                {isExpanded && evo.photos && evo.photos.length > 0 && (
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {evo.photos.map((path, i) => {
                      const url = photoUrls[path]
                      return url ? (
                        <a
                          key={`${evo.id}-${i}`}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="block w-20 h-20 rounded-lg overflow-hidden border border-slate-200 hover:border-violet-400 transition-colors"
                          title="Abrir foto"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <img
                            src={url}
                            alt={`Foto ${i + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </a>
                      ) : (
                        <div
                          key={`${evo.id}-${i}`}
                          className="w-20 h-20 rounded-lg bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-600 text-[10px] text-center px-1"
                          title={`Nao foi possivel carregar: ${path}`}
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
  )
}
