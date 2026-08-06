'use client'

import type { ReactNode } from 'react'
import Icon from '@/components/ui/Icon'

type Props = {
  title: string
  valueFull: string
  explanation: ReactNode
  onClose: () => void
}

// Bottom sheet no mobile (mais fácil de alcançar com o polegar, não cobre a
// tela inteira), modal centralizado no desktop. Compartilhado por KpiCard e
// RentCard pra manter o mesmo comportamento em todo o dashboard Financeiro.
export default function ExplainModal({ title, valueFull, explanation, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/40 p-0 md:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-md max-h-[80vh] overflow-y-auto p-5 pb-safe"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-slate-900 pr-3">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="w-9 h-9 rounded-lg hover:bg-slate-100 active:bg-slate-200 flex items-center justify-center flex-shrink-0"
          >
            <Icon name="x" className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <p className="text-2xl font-black text-slate-900 mb-4">{valueFull}</p>
        <div className="text-sm text-slate-600 space-y-2 leading-relaxed">{explanation}</div>
      </div>
    </div>
  )
}
