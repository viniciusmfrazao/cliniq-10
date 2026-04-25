'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { GUIDES, defaultGuideForRole, type GuideRole } from '@/lib/guides'

type Props = {
  /** Role do usuario logado (admin, doctor, etc). Usado pra sugerir o papel certo. */
  userRole?: string | null
  /** Nome curto do usuario, opcional. */
  userName?: string
}

const STORAGE_KEY = 'clinike.welcome.dismissed.v1'
const ROLE_KEY = 'clinike.welcome.role.v1'

/**
 * Card de boas-vindas que aparece no Inicio. Pergunta o papel,
 * mostra os 4-5 passos chave e linka pra /dashboard/como-funciona.
 *
 * Usa localStorage pra:
 * - Lembrar a escolha de papel.
 * - Esconder de vez quando o usuario marca "Ja entendi".
 *
 * As animacoes ficam em globals.css (.guide-* / guide-fade-up etc.)
 * pra evitar styled-jsx em client component.
 */
export default function WelcomeCard({ userRole, userName }: Props) {
  // Comeca escondido pra evitar flash em quem ja dispensou
  const [mounted, setMounted] = useState(false)
  const [dismissed, setDismissed] = useState(true)
  const [activeId, setActiveId] = useState<string>(() => {
    try {
      return defaultGuideForRole(userRole || null).id
    } catch {
      return GUIDES[0].id
    }
  })

  useEffect(() => {
    setMounted(true)
    try {
      const dismiss = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
      setDismissed(dismiss === '1')
      const savedRole = typeof window !== 'undefined' ? window.localStorage.getItem(ROLE_KEY) : null
      if (savedRole && GUIDES.find((g) => g.id === savedRole)) {
        setActiveId(savedRole)
      } else {
        setActiveId(defaultGuideForRole(userRole || null).id)
      }
    } catch {
      // sem localStorage (privacidade) -> mostra normal
      setDismissed(false)
    }
  }, [userRole])

  const guide: GuideRole = GUIDES.find((g) => g.id === activeId) || GUIDES[0]
  const preview = guide.steps.slice(0, 4)

  function dismiss() {
    setDismissed(true)
    try {
      window.localStorage.setItem(STORAGE_KEY, '1')
    } catch {}
  }

  function chooseRole(id: string) {
    setActiveId(id)
    try {
      window.localStorage.setItem(ROLE_KEY, id)
    } catch {}
  }

  if (!mounted || dismissed) return null

  return (
    <div className={`relative overflow-hidden rounded-2xl md:rounded-3xl text-white guide-hero-bg guide-fade-up bg-gradient-to-br ${guide.gradient}`}>
      {/* Bolhas decorativas (animadas via globals.css) */}
      <div className="pointer-events-none absolute -top-16 -right-10 w-56 h-56 bg-white/15 rounded-full blur-3xl guide-float-slow" />
      <div className="pointer-events-none absolute -bottom-16 -left-10 w-48 h-48 bg-white/10 rounded-full blur-3xl guide-float" />

      <div className="relative p-5 md:p-8">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-white/80 text-[11px] md:text-xs font-bold uppercase tracking-wider">
              Bem-vindo ao Clinike{userName ? `, ${userName}` : ''}
            </p>
            <h2 className="text-lg md:text-2xl font-black leading-tight mt-1">
              Vou te mostrar como usar no dia-a-dia
            </h2>
            <p className="text-white/85 text-xs md:text-sm mt-1">
              Escolha o seu papel e veja os passos principais. Você pode ver o
              guia completo a qualquer hora.
            </p>
          </div>
          <button
            onClick={dismiss}
            className="flex-shrink-0 w-8 h-8 md:w-9 md:h-9 rounded-xl bg-white/15 hover:bg-white/25 active:scale-90 transition-all flex items-center justify-center"
            aria-label="Fechar guia de boas-vindas"
            title="Não mostrar mais"
          >
            <Icon name="x" className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>

        {/* Papeis */}
        <div className="mt-4 flex flex-wrap gap-2">
          {GUIDES.map((g) => {
            const active = g.id === activeId
            return (
              <button
                key={g.id}
                onClick={() => chooseRole(g.id)}
                className={`px-3 py-1.5 rounded-full text-xs md:text-sm font-bold transition-all active:scale-95 ${
                  active
                    ? 'bg-white text-slate-900 shadow-lg'
                    : 'bg-white/15 text-white hover:bg-white/25'
                }`}
              >
                <span className="mr-1">{g.emoji}</span>
                {g.shortLabel}
              </button>
            )
          })}
        </div>

        {/* Mini-stepper horizontal (preview) */}
        <div className="mt-4 md:mt-5 grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
          {preview.map((step, i) => (
            <div
              key={`${guide.id}-${i}`}
              className="guide-step-in bg-white/15 backdrop-blur rounded-xl p-3 border border-white/10 hover:bg-white/25 transition-colors"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${step.color} flex items-center justify-center shadow-md flex-shrink-0`}>
                  <Icon name={step.icon} className="w-4 h-4 text-white" />
                </div>
                <span className="text-[10px] md:text-xs font-black text-white/80">
                  Passo {i + 1}
                </span>
              </div>
              <p className="text-xs md:text-sm font-bold mt-2 leading-tight line-clamp-2">
                {step.title}
              </p>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="mt-4 md:mt-5 flex flex-wrap items-center gap-2 md:gap-3">
          <Link
            href={`/dashboard/como-funciona?papel=${guide.id}`}
            className="inline-flex items-center gap-2 px-4 py-2 md:px-5 md:py-2.5 rounded-xl bg-white text-slate-900 font-bold shadow-lg hover:scale-105 active:scale-95 transition-transform text-sm md:text-base"
          >
            Ver guia completo
            <Icon name="arrowRight" className="w-4 h-4" />
          </Link>
          <button
            onClick={dismiss}
            className="inline-flex items-center gap-2 px-4 py-2 md:px-5 md:py-2.5 rounded-xl bg-white/10 backdrop-blur text-white font-semibold border border-white/20 hover:bg-white/20 active:scale-95 transition-all text-sm md:text-base"
          >
            Já entendi
          </button>
        </div>
      </div>
    </div>
  )
}
