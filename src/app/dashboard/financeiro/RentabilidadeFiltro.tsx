'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState } from 'react'

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

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!showCustom && (
        <select
          value={mesAtual}
          onChange={(e) => applyMonth(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white font-medium text-slate-700"
        >
          {meses.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      )}
      {showCustom && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={ini}
            onChange={(e) => setIni(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
          />
          <span className="text-slate-400 text-sm">até</span>
          <input
            type="date"
            value={fim}
            onChange={(e) => setFim(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
          />
          <button
            onClick={applyCustom}
            className="text-sm bg-violet-600 text-white px-3 py-2 rounded-lg font-semibold hover:bg-violet-700 transition"
          >
            Aplicar
          </button>
        </div>
      )}
      <button
        onClick={() => setShowCustom(!showCustom)}
        className="text-sm text-violet-600 font-medium hover:underline"
      >
        {showCustom ? 'Usar filtro de mês' : 'Período personalizado'}
      </button>
    </div>
  )
}
