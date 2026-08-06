'use client'

import { useState, type ReactNode } from 'react'
import ExplainModal from './ExplainModal'

type Props = {
  label: string
  valueDisplay: ReactNode   // como o valor aparece no card (pode ter 2 linhas, ex: Fixos)
  valueFull: string         // valor "limpo" pro cabeçalho do modal
  cardClassName?: string
  valueClassName?: string
  explanation: ReactNode
}

// Versão compacta do KpiCard pra grade de Rentabilidade (Receita, CMV, Lucro
// bruto, Margem, Fixos, Lucro operacional) — mesmo padrão de clique-pra-
// explicar, só que no tamanho pequeno usado ali.
export default function RentCard({ label, valueDisplay, valueFull, cardClassName, valueClassName, explanation }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`text-left p-3 rounded-xl w-full min-w-0 hover:ring-2 hover:ring-slate-200 active:ring-2 active:ring-slate-300 transition ${cardClassName || 'bg-slate-50'}`}
      >
        <p className="text-xs text-slate-500 mb-1 truncate">{label}</p>
        <div className={`text-sm font-bold ${valueClassName || 'text-slate-700'}`}>{valueDisplay}</div>
      </button>

      {open && <ExplainModal title={label} valueFull={valueFull} explanation={explanation} onClose={() => setOpen(false)} />}
    </>
  )
}
