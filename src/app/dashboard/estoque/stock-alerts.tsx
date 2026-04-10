'use client'

import { useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'

type Product = {
  id: string
  name: string
  current_stock: number
  min_stock: number
  expiry_date: string | null
}

type Props = {
  lowStock: Product[]
  expiringSoon: Product[]
  expired: Product[]
}

export default function StockAlerts({ lowStock, expiringSoon, expired }: Props) {
  const [expanded, setExpanded] = useState(true)

  const totalAlerts = lowStock.length + expiringSoon.length + expired.length

  return (
    <div className="mb-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full card p-4 flex items-center justify-between hover:shadow-md transition-shadow"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
            <Icon name="bell" className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-slate-900">{totalAlerts} alertas de estoque</p>
            <p className="text-xs text-slate-500">Clique para ver detalhes</p>
          </div>
        </div>
        <Icon name={expanded ? 'chevronUp' : 'chevronDown'} className="w-5 h-5 text-slate-400" />
      </button>

      {expanded && (
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {expired.length > 0 && (
            <div className="card p-4 border-l-4 border-red-500">
              <p className="text-xs font-semibold text-red-600 uppercase mb-2">Vencidos</p>
              <div className="space-y-2">
                {expired.slice(0, 3).map(p => (
                  <Link key={p.id} href={`/dashboard/estoque/${p.id}`} className="block text-sm text-slate-700 hover:text-slate-900">
                    {p.name}
                  </Link>
                ))}
                {expired.length > 3 && (
                  <p className="text-xs text-slate-400">+{expired.length - 3} mais</p>
                )}
              </div>
            </div>
          )}

          {expiringSoon.length > 0 && (
            <div className="card p-4 border-l-4 border-amber-500">
              <p className="text-xs font-semibold text-amber-600 uppercase mb-2">Vencendo em 30 dias</p>
              <div className="space-y-2">
                {expiringSoon.slice(0, 3).map(p => (
                  <Link key={p.id} href={`/dashboard/estoque/${p.id}`} className="block text-sm text-slate-700 hover:text-slate-900">
                    {p.name}
                  </Link>
                ))}
                {expiringSoon.length > 3 && (
                  <p className="text-xs text-slate-400">+{expiringSoon.length - 3} mais</p>
                )}
              </div>
            </div>
          )}

          {lowStock.length > 0 && (
            <div className="card p-4 border-l-4 border-blue-500">
              <p className="text-xs font-semibold text-blue-600 uppercase mb-2">Estoque baixo</p>
              <div className="space-y-2">
                {lowStock.slice(0, 3).map(p => (
                  <Link key={p.id} href={`/dashboard/estoque/${p.id}`} className="flex items-center justify-between text-sm text-slate-700 hover:text-slate-900">
                    <span>{p.name}</span>
                    <span className="text-xs text-slate-400">{p.current_stock}/{p.min_stock}</span>
                  </Link>
                ))}
                {lowStock.length > 3 && (
                  <p className="text-xs text-slate-400">+{lowStock.length - 3} mais</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
