'use client'

import { useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'

type Product = {
  id: string
  name: string
  brand: string | null
  category: string
  unit: string
  current_stock: number
  min_stock: number
  cost_price: number | null
  sale_price: number | null
  expiry_date: string | null
}

type Props = {
  products: Product[]
  categories: { id: string; label: string; icon: string }[]
}

export default function ProductList({ products, categories }: Props) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.brand?.toLowerCase().includes(search.toLowerCase())
    const matchCategory = category === 'all' || p.category === category
    return matchSearch && matchCategory
  })

  const getStockStatus = (p: Product) => {
    if (p.current_stock === 0) return { color: 'bg-red-100 text-red-700', label: 'Zerado' }
    if (p.current_stock <= p.min_stock) return { color: 'bg-amber-100 text-amber-700', label: 'Baixo' }
    return { color: 'bg-emerald-100 text-emerald-700', label: 'OK' }
  }

  const getExpiryStatus = (date: string | null) => {
    if (!date) return null
    const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
    if (days < 0) return { color: 'text-red-600', label: 'Vencido' }
    if (days <= 30) return { color: 'text-amber-600', label: `${days}d` }
    return null
  }

  return (
    <div className="card overflow-hidden">
      {/* Filtros */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar produto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  category === cat.id
                    ? 'gradient-bg text-white shadow-lg'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Icon name={cat.icon} className="w-4 h-4" />
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
            <Icon name="box" className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-slate-600 font-medium">Nenhum produto encontrado</p>
          <p className="text-sm text-slate-400 mt-1">Adicione produtos ao estoque</p>
          <Link href="/dashboard/estoque/novo" className="btn-primary w-auto px-6 inline-flex items-center gap-2 mt-4">
            <Icon name="plus" className="w-4 h-4" />
            Adicionar Produto
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-slate-50">
          {filtered.map(product => {
            const stockStatus = getStockStatus(product)
            const expiryStatus = getExpiryStatus(product.expiry_date)
            return (
              <Link
                key={product.id}
                href={`/dashboard/estoque/${product.id}`}
                className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center flex-shrink-0">
                  <Icon 
                    name={product.category === 'injetavel' ? 'syringe' : product.category === 'cosmetico' ? 'sparkles' : 'box'} 
                    className="w-6 h-6 text-slate-500" 
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900 truncate">{product.name}</p>
                    {expiryStatus && (
                      <span className={`text-xs font-medium ${expiryStatus.color}`}>{expiryStatus.label}</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 truncate">
                    {product.brand || 'Sem marca'} • {product.unit}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold text-slate-900">{product.current_stock}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stockStatus.color}`}>
                    {stockStatus.label}
                  </span>
                </div>
                <Icon name="chevronRight" className="w-5 h-5 text-slate-300 flex-shrink-0" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
