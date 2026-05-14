'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Icon from './Icon'

type Props = {
  href?: string      // destino fixo — se não passar, usa router.back()
  label?: string     // texto do botão, padrão "Voltar"
}

export default function BackButton({ href, label = 'Voltar' }: Props) {
  const router = useRouter()

  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4 group transition-colors"
      >
        <Icon name="arrowLeft" className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        {label}
      </Link>
    )
  }

  return (
    <button
      onClick={() => router.back()}
      className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4 group transition-colors"
    >
      <Icon name="arrowLeft" className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
      {label}
    </button>
  )
}
