'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState } from 'react'
import Icon from '@/components/ui/Icon'

const MESES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function ultimosMeses(n: number) {
  const out: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    out.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) })
  }
  return out
}

function mesLabelCurto(mes: string) {
  const [y, m] = mes.split('-').map(Number)
  if (!y || !m) return mes
  return `${MESES_CURTO[m - 1]}/${y}`
}

function somaMes(mes: string, delta: number) {
  const [y, m] = mes.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function RentabilidadeFiltro({
  mesAtual,
  iniAtual,
  fimAtual,
}: {
  mesAtual: string
  iniAtual?: string
  fimAtual?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const meses = ultimosMeses(12)
  const isCustom = !!(iniAtual && fimAtual)
  const [showCustom, setShowCustom] = useState(isCustom)
  const [ini, setIni] = useState(iniAtual || '')
  const [fim, setFim] = useState(fimAtual || '')

  function applyMonth(mes: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('mes', mes)
    params.delete('ini')
    params.delete('fim')
    router.push(`${pathname}?${params.toString()}`)
  }

  function applyCustom() {
    if (!ini || !fim) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('ini', ini)
    params.set('fim', fim)
    params.delete('mes')
    router.push(`${pathname}?${params.toString()}`)
  }

  const podeAvancar = mesAtual < meses[0].value

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!showCustom && (
        <div className="inline-flex items-center h-11 bg-white border border-slate-200 rounded-full shadow-sm">
          <button
            type="button"
            onClick={() => applyMonth(somaMes(mesAtual, -1))}
            className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-full text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition"
            aria-label="Mês anterior"
          >
            <Icon name="chevronLeft" className="w-4 h-4" />
          </button>

          <div className="relative flex items-center gap-1.5 px-1">
            <Icon name="calendar" className="w-4 h-4 text-violet-400 pointer-events-none flex-shrink-0" />
            <select
              value={mesAtual}
              onChange={(e) => applyMonth(e.target.value)}
              className="appearance-none bg-transparent text-sm font-semibold text-slate-700 pr-1 focus:outline-none cursor-pointer capitalize"
            >
              {meses.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => podeAvancar && applyMonth(somaMes(mesAtual, 1))}
            disabled={!podeAvancar}
            className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-full text-slate-400 hover:text-violet-600 hover:bg-violet-50 disabled:opacity-0 disabled:pointer-events-none transition"
            aria-label="Próximo mês"
          >
            <Icon name="chevronRight" className="w-4 h-4" />
          </button>
        </div>
      )}

      {showCustom && (
        <div className="inline-flex flex-wrap items-center h-11 gap-2 bg-white border border-slate-200 rounded-full shadow-sm px-4">
          <Icon name="calendar" className="w-4 h-4 text-violet-400 flex-shrink-0" />
          <input
            type="date"
            value={ini}
            onChange={(e) => setIni(e.target.value)}
            className="text-sm text-slate-700 bg-transparent focus:outline-none"
          />
          <span className="text-slate-300 text-sm">→</span>
          <input
            type="date"
            value={fim}
            onChange={(e) => setFim(e.target.value)}
            className="text-sm text-slate-700 bg-transparent focus:outline-none"
          />
          <button
            onClick={applyCustom}
            className="text-xs bg-violet-600 text-white px-3 py-1.5 rounded-full font-semibold hover:bg-violet-700 transition"
          >
            Aplicar
          </button>
        </div>
      )}

      <button
        onClick={() => setShowCustom(!showCustom)}
        className="text-xs text-violet-600 font-medium hover:underline whitespace-nowrap"
      >
        {showCustom ? `Voltar pra ${mesLabelCurto(mesAtual)}` : 'Período personalizado'}
      </button>
    </div>
  )
}
