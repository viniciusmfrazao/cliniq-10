'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { GUIDES, type GuideRole, type GuideStep } from '@/lib/guides'

type Props = {
  initialRoleId: string
  userName: string
}

export default function GuideView({ initialRoleId, userName }: Props) {
  const [activeId, setActiveId] = useState<string>(
    GUIDES.find((g) => g.id === initialRoleId)?.id || GUIDES[0].id,
  )
  const active = useMemo(
    () => GUIDES.find((g) => g.id === activeId) || GUIDES[0],
    [activeId],
  )

  return (
    <div className="space-y-6 md:space-y-10">
      <Hero active={active} userName={userName} />

      <RoleTabs activeId={activeId} onChange={setActiveId} />

      <StepFlow active={active} />

      <FooterCTA />

      {/* Animacoes globais usadas na pagina */}
      <style jsx global>{`
        @keyframes guide-gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes guide-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes guide-float-slow {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          50% { transform: translateY(-20px) translateX(10px); }
        }
        @keyframes guide-pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.45); }
          70% { box-shadow: 0 0 0 12px rgba(139, 92, 246, 0); }
          100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0); }
        }
        @keyframes guide-fade-up {
          from { opacity: 0; transform: translateY(28px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes guide-draw {
          from { stroke-dashoffset: 100%; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes guide-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .guide-hero-bg {
          background-size: 200% 200%;
          animation: guide-gradient-shift 14s ease-in-out infinite;
        }
        .guide-float { animation: guide-float 6s ease-in-out infinite; }
        .guide-float-slow { animation: guide-float-slow 9s ease-in-out infinite; }
        .guide-pulse-ring { animation: guide-pulse-ring 2.4s ease-out infinite; }
        .guide-fade-up { animation: guide-fade-up 0.6s ease-out both; }
        .guide-shimmer {
          background: linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.35) 50%, transparent 70%);
          background-size: 200% 100%;
          animation: guide-shimmer 2.6s linear infinite;
        }
      `}</style>
    </div>
  )
}

/* ============================== HERO ================================== */

function Hero({ active, userName }: { active: GuideRole; userName: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl md:rounded-3xl text-white isolate guide-hero-bg bg-gradient-to-br ${active.gradient}`}>
      {/* Bolhas decorativas com float */}
      <div className="pointer-events-none absolute -top-20 -right-12 w-72 h-72 bg-white/15 rounded-full blur-3xl guide-float-slow" />
      <div className="pointer-events-none absolute bottom-[-4rem] left-[-3rem] w-72 h-72 bg-white/10 rounded-full blur-3xl guide-float" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 w-40 h-40 bg-white/10 rounded-full blur-2xl guide-float-slow" />

      <div className="relative px-5 md:px-10 py-7 md:py-10">
        <div className="flex items-start gap-3 md:gap-5">
          <div className="text-4xl md:text-6xl leading-none guide-float select-none flex-shrink-0">
            {active.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white/80 text-xs md:text-sm font-medium uppercase tracking-wider">
              {userName ? `${userName}, este é o seu guia` : 'Guia de uso'}
            </p>
            <h1 className="text-2xl md:text-4xl font-black leading-tight mt-1">
              Como o {active.shortLabel}{' '}
              <span className="text-white/90">usa o Clinike no dia-a-dia</span>
            </h1>
            <p className="text-white/85 text-sm md:text-lg mt-2 max-w-2xl">
              {active.tagline}
            </p>

            <div className="mt-4 md:mt-5 flex flex-wrap items-center gap-2 md:gap-3">
              <span className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur px-3 py-1.5 rounded-full text-xs md:text-sm font-semibold">
                <Icon name="layers" className="w-3.5 h-3.5" />
                {active.steps.length} passos
              </span>
              <span className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur px-3 py-1.5 rounded-full text-xs md:text-sm font-semibold">
                <Icon name="zap" className="w-3.5 h-3.5" />
                Atalhos clicáveis
              </span>
              <span className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur px-3 py-1.5 rounded-full text-xs md:text-sm font-semibold">
                <Icon name="check" className="w-3.5 h-3.5" />
                Atualizado
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ============================ ROLE TABS ================================ */

function RoleTabs({
  activeId,
  onChange,
}: {
  activeId: string
  onChange: (id: string) => void
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
      {GUIDES.map((g) => {
        const active = g.id === activeId
        return (
          <button
            key={g.id}
            onClick={() => onChange(g.id)}
            className={`group relative overflow-hidden text-left rounded-xl md:rounded-2xl p-3 md:p-4 transition-all duration-300 active:scale-[0.98] ${
              active
                ? 'text-white shadow-xl scale-[1.02]'
                : 'bg-white border border-slate-100 hover:border-slate-200 hover:shadow-md'
            }`}
            aria-pressed={active}
          >
            {/* Fundo gradiente quando ativo */}
            {active && (
              <div
                className={`absolute inset-0 bg-gradient-to-br ${g.gradient} guide-hero-bg`}
                aria-hidden
              />
            )}

            {/* Glow no hover (quando inativo) */}
            {!active && (
              <div
                className={`pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br ${g.gradient}`}
                style={{ filter: 'blur(28px)', transform: 'scale(0.7)' }}
                aria-hidden
              />
            )}

            <div className="relative flex items-center gap-3">
              <div
                className={`text-2xl md:text-3xl flex-shrink-0 transition-transform duration-300 ${
                  active ? 'scale-110' : 'group-hover:scale-110'
                }`}
              >
                {g.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-xs md:text-sm font-bold truncate ${
                    active ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {g.shortLabel}
                </p>
                <p
                  className={`text-[10px] md:text-xs truncate ${
                    active ? 'text-white/85' : 'text-slate-500'
                  }`}
                >
                  {g.steps.length} passos
                </p>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

/* ============================ STEP FLOW ================================ */

function StepFlow({ active }: { active: GuideRole }) {
  // key força remount ao trocar de papel — anima entrada
  return (
    <div key={active.id} className="relative">
      {/* Linha vertical animada (apenas md+) que conecta os passos */}
      <div
        className="hidden md:block absolute left-[2.25rem] top-4 bottom-4 w-px"
        aria-hidden
      >
        <svg
          className="w-full h-full"
          preserveAspectRatio="none"
          viewBox="0 0 2 100"
        >
          <line
            x1="1"
            y1="0"
            x2="1"
            y2="100"
            stroke="url(#guide-line-grad)"
            strokeWidth="2"
            strokeDasharray="6 6"
            style={{ animation: 'guide-draw 1.4s ease-out both' }}
            pathLength={100}
            strokeDashoffset={0}
          />
          <defs>
            <linearGradient id="guide-line-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <ol className="space-y-4 md:space-y-6">
        {active.steps.map((step, idx) => (
          <StepCard
            key={`${active.id}-${idx}`}
            step={step}
            index={idx + 1}
            total={active.steps.length}
          />
        ))}
      </ol>
    </div>
  )
}

function StepCard({
  step,
  index,
  total,
}: {
  step: GuideStep
  index: number
  total: number
}) {
  const ref = useRef<HTMLLIElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true)
            obs.disconnect()
            break
          }
        }
      },
      { threshold: 0.15 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <li
      ref={ref}
      className={`relative pl-0 md:pl-20 transition-all duration-700 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      }`}
      style={{ transitionDelay: `${Math.min(index * 60, 360)}ms` }}
    >
      {/* Bolha com numero (desktop, sobre a linha) */}
      <div
        className="hidden md:flex absolute left-3 top-3 w-16 h-16 items-center justify-center"
        aria-hidden
      >
        <div
          className={`relative w-14 h-14 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-xl text-white font-black text-xl ${
            index === 1 ? 'guide-pulse-ring' : ''
          }`}
        >
          {/* Shimmer sutil */}
          <span className="absolute inset-0 rounded-2xl overflow-hidden">
            <span className="absolute inset-0 guide-shimmer opacity-60" />
          </span>
          <span className="relative">{index}</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 overflow-hidden group">
        <div className="p-4 md:p-6 flex gap-3 md:gap-5">
          {/* Bolha mobile (inline) */}
          <div
            className={`md:hidden flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg`}
            aria-hidden
          >
            <Icon name={step.icon} className="w-6 h-6 text-white" />
          </div>

          {/* Icone grande no desktop */}
          <div
            className={`hidden md:flex flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br ${step.color} items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}
            aria-hidden
          >
            <Icon name={step.icon} className="w-7 h-7 text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="md:hidden text-xs font-bold text-slate-400">
                Passo {index}/{total}
              </span>
              <h3 className="text-base md:text-lg font-bold text-slate-900">
                {step.title}
              </h3>
            </div>
            <p className="text-sm md:text-base text-slate-600 mt-1.5 leading-relaxed">
              {step.description}
            </p>

            {step.tip && (
              <div className="mt-3 flex gap-2 items-start bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                <span className="text-base leading-none mt-0.5">💡</span>
                <p className="text-xs md:text-sm text-amber-800 leading-relaxed">
                  <span className="font-semibold">Dica:</span> {step.tip}
                </p>
              </div>
            )}

            {step.href && (
              <div className="mt-3 md:mt-4">
                <Link
                  href={step.href}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r ${step.color} shadow-md hover:shadow-lg active:scale-95 transition-all`}
                >
                  Ir agora
                  <Icon name="arrowRight" className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}

/* ============================== FOOTER ================================= */

function FooterCTA() {
  return (
    <div className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-to-br from-slate-900 via-violet-900 to-purple-900 text-white p-6 md:p-10">
      <div className="pointer-events-none absolute -top-16 -right-12 w-60 h-60 bg-violet-400/30 rounded-full blur-3xl guide-float-slow" />
      <div className="pointer-events-none absolute -bottom-20 -left-12 w-72 h-72 bg-pink-400/20 rounded-full blur-3xl guide-float" />

      <div className="relative grid md:grid-cols-2 gap-6 items-center">
        <div>
          <p className="text-violet-200 text-xs md:text-sm font-bold uppercase tracking-wider">
            Precisa de ajuda?
          </p>
          <h2 className="text-xl md:text-3xl font-black mt-1.5 leading-tight">
            Fala com a gente — a Eva atende, a equipe humana também.
          </h2>
          <p className="text-white/70 mt-2 text-sm md:text-base">
            Tutorial completo em texto, atalhos do dia-a-dia e suporte humano por
            WhatsApp quando você precisar.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/eva"
            className="inline-flex items-center gap-2 px-4 md:px-5 py-2.5 md:py-3 rounded-xl bg-white text-slate-900 font-bold shadow-lg hover:scale-105 active:scale-95 transition-transform text-sm md:text-base"
          >
            <Icon name="sparkles" className="w-4 h-4 md:w-5 md:h-5" />
            Falar com a Eva
          </Link>
          <Link
            href="/dashboard/config/tutorial"
            className="inline-flex items-center gap-2 px-4 md:px-5 py-2.5 md:py-3 rounded-xl bg-white/10 backdrop-blur text-white font-bold border border-white/20 hover:bg-white/20 active:scale-95 transition-all text-sm md:text-base"
          >
            <Icon name="file" className="w-4 h-4 md:w-5 md:h-5" />
            Tutorial detalhado
          </Link>
          <a
            href="https://wa.me/5534991805722"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 md:px-5 py-2.5 md:py-3 rounded-xl bg-emerald-500 text-white font-bold shadow-lg hover:bg-emerald-600 active:scale-95 transition-all text-sm md:text-base"
          >
            <Icon name="message" className="w-4 h-4 md:w-5 md:h-5" />
            WhatsApp humano
          </a>
        </div>
      </div>
    </div>
  )
}
