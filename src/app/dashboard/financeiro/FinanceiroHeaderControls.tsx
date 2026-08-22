'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import RentabilidadeFiltro from './RentabilidadeFiltro'

// CSS (flex/grid/table) não deixa um filho com width:100% influenciar a
// largura "auto" do próprio pai — sempre cai numa referência circular e o
// navegador ignora o 100% pro cálculo. Por isso medimos a largura real do
// bloco de botões em JS e aplicamos esse valor exato na pill do filtro.
export default function FinanceiroHeaderControls({
  mesAtual,
  iniAtual,
  fimAtual,
  isOwnScope,
}: {
  mesAtual: string
  iniAtual?: string
  fimAtual?: string
  isOwnScope: boolean
}) {
  const buttonsRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number>()

  useLayoutEffect(() => {
    const el = buttonsRef.current
    if (!el) return
    const update = () => setWidth(el.getBoundingClientRect().width)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="flex flex-col items-end gap-2">
      {!isOwnScope && (
        <div style={width ? { width } : undefined}>
          <RentabilidadeFiltro mesAtual={mesAtual} iniAtual={iniAtual} fimAtual={fimAtual} />
        </div>
      )}
      <div ref={buttonsRef} className="flex gap-2">
        <Link
          href="/dashboard/financeiro/entradas/nova"
          className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-emerald-700 transition"
        >
          <Icon name="plus" className="w-5 h-5" />
          Nova Entrada
        </Link>
        {!isOwnScope && (
          <Link
            href="/dashboard/financeiro/saidas/nova"
            className="inline-flex items-center gap-2 bg-rose-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-rose-700 transition"
          >
            <Icon name="minus" className="w-5 h-5" />
            Nova Saída
          </Link>
        )}
      </div>
    </div>
  )
}
