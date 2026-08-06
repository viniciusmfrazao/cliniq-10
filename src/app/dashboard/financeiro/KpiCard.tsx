'use client'

import { useState, type ReactNode } from 'react'
import Icon from '@/components/ui/Icon'
import ExplainModal from './ExplainModal'

type Props = {
  icon: string
  iconBg: string
  iconColor: string
  cardClassName?: string
  valueClassName?: string
  labelClassName?: string
  valueCompact: string
  valueFull: string
  valueTitle: string
  label: string
  explanation: ReactNode
  note?: ReactNode
}

// Card de KPI clicável — abre um modal explicando como o número foi calculado.
// Usado no dashboard Financeiro pra tirar a dúvida de "de onde veio esse valor"
// sem precisar perguntar (Receita bruta x Líquido x Caixa confundem bastante).
export default function KpiCard({
  icon, iconBg, iconColor, cardClassName, valueClassName, labelClassName,
  valueCompact, valueFull, valueTitle, label, explanation, note,
}: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`text-left rounded-2xl p-4 md:p-5 border shadow-sm min-w-0 w-full hover:ring-2 hover:ring-slate-200 active:ring-2 active:ring-slate-300 transition ${cardClassName || 'bg-white border-slate-100'}`}
      >
        <div className="flex items-center gap-3 mb-2 md:mb-3">
          <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
            <Icon name={icon} className={`w-5 h-5 ${iconColor}`} />
          </div>
        </div>
        <p className={`text-lg md:text-2xl font-black truncate ${valueClassName || 'text-slate-900'}`} title={valueTitle}>
          <span className="md:hidden">{valueCompact}</span>
          <span className="hidden md:inline">{valueFull}</span>
        </p>
        <p className={`text-xs md:text-sm truncate ${labelClassName || 'text-slate-500'}`}>{label}</p>
        {note}
      </button>

      {open && <ExplainModal title={label} valueFull={valueFull} explanation={explanation} onClose={() => setOpen(false)} />}
    </>
  )
}
