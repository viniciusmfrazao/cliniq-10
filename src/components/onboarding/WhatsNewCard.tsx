'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'

/**
 * Card de "Novidades" no Início. Mostra as funcionalidades novas mais
 * importantes pra clínica, com link direto pra usar ou aprender mais.
 *
 * Bump o NEWS_VERSION quando quiser que o card volte a aparecer pra
 * quem já dispensou uma versão anterior (ex: leva de features novas).
 */

const NEWS_VERSION = '2026-08'
const STORAGE_KEY = `clinike.whatsnew.dismissed.${NEWS_VERSION}`

type NewsItem = {
  icon: string
  title: string
  description: string
  href: string
  cta: string
  color: string
}

const NEWS: NewsItem[] = [
  {
    icon: 'box',
    title: 'Venda de produto avulso',
    description: 'Venda um produto sem precisar de agendamento — direto na ficha do paciente ou no pagamento da agenda. Entra separado no financeiro, com ranking próprio.',
    href: '/dashboard/pacientes',
    cta: 'Ver pacientes',
    color: 'from-emerald-500 to-teal-500',
  },
  {
    icon: 'file',
    title: 'Anamnese personalizada',
    description: 'Monte seu próprio formulário de anamnese, estilo Google Forms, além do modelo padrão.',
    href: '/dashboard/anamnese',
    cta: 'Criar template',
    color: 'from-violet-500 to-purple-500',
  },
  {
    icon: 'sparkles',
    title: 'Áudio nas automações',
    description: 'Confirmação, lembrete e pós-venda agora podem sair por áudio, texto, ou os dois — mais pessoal no WhatsApp.',
    href: '/dashboard/config/automacoes',
    cta: 'Configurar',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    icon: 'users',
    title: 'Mapa Corporal',
    description: 'Registre aplicações de harmonização corporal em silhuetas de frente e costas, igual ao mapa facial.',
    href: '/dashboard/pacientes',
    cta: 'Ver na ficha',
    color: 'from-rose-500 to-pink-500',
  },
]

export default function WhatsNewCard() {
  const [mounted, setMounted] = useState(false)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    setMounted(true)
    try {
      const dismiss = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
      setDismissed(dismiss === '1')
    } catch {
      setDismissed(false)
    }
  }, [])

  function dismiss() {
    setDismissed(true)
    try {
      window.localStorage.setItem(STORAGE_KEY, '1')
    } catch {}
  }

  if (!mounted || dismissed) return null

  return (
    <div className="relative overflow-hidden rounded-2xl md:rounded-3xl border border-slate-200 bg-white guide-fade-up">
      <div className="p-4 md:p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
              <Icon name="zap" className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-black text-slate-900">Novidades no Clinike</h2>
              <p className="text-xs text-slate-500">O que chegou de novo pra sua clínica usar</p>
            </div>
          </div>
          <button
            onClick={dismiss}
            className="flex-shrink-0 w-7 h-7 rounded-lg hover:bg-slate-100 active:scale-90 transition-all flex items-center justify-center text-slate-400"
            aria-label="Fechar novidades"
            title="Não mostrar mais"
          >
            <Icon name="x" className="w-4 h-4" />
          </button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {NEWS.map((item, i) => (
            <Link
              key={item.title}
              href={item.href}
              className="guide-step-in group flex flex-col rounded-xl border border-slate-100 p-3 hover:border-slate-200 hover:shadow-md transition-all"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center shadow-sm flex-shrink-0 mb-2`}>
                <Icon name={item.icon} className="w-4 h-4 text-white" />
              </div>
              <p className="text-sm font-bold text-slate-900 leading-tight">{item.title}</p>
              <p className="text-xs text-slate-500 mt-1 leading-snug flex-1">{item.description}</p>
              <span className="text-xs font-semibold text-violet-600 mt-2 inline-flex items-center gap-1 group-hover:gap-1.5 transition-all">
                {item.cta}
                <Icon name="chevronRight" className="w-3 h-3" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
