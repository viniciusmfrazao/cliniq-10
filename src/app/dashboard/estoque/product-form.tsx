'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'

type Product = {
  id?: string
  name: string
  brand: string
  category: string
  unit: string
  min_stock: number
  current_stock: number
  cost_price: string
  sale_price: string
  expiry_date: string
  batch_number: string
  supplier: string
  notes: string
}

const CATEGORIES = [
  { id: 'injetavel', label: 'Injetavel' },
  { id: 'cosmetico', label: 'Cosmetico' },
  { id: 'descartavel', label: 'Descartavel' },
  { id: 'equipamento', label: 'Equipamento' },
  { id: 'medicamento', label: 'Medicamento' },
  { id: 'outros', label: 'Outros' },
]

const UNITS = ['unidade', 'ml', 'mg', 'g', 'kg', 'ampola', 'frasco', 'caixa', 'pacote']

export default function ProductForm({ product }: { product?: Product }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState<Product>({
    name: product?.name || '',
    brand: product?.brand || '',
    category: product?.category || 'injetavel',
    unit: product?.unit || 'unidade',
    min_stock: product?.min_stock || 5,
    current_stock: product?.current_stock || 0,
    cost_price: product?.cost_price || '',
    sale_price: product?.sale_price || '',
    expiry_date: product?.expiry_date || '',
    batch_number: product?.batch_number || '',
    supplier: product?.supplier || '',
    notes: product?.notes || '',
  })

  const update = (field: string, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sessão expirada. Recarregue a página e faça login novamente.')
      const { data: userData } = await supabase
        .from('users')
        .select('clinic_id')
        .eq('id', user.id)
        .single()

      const productData = {
        clinic_id: userData?.clinic_id,
        name: form.name,
        brand: form.brand || null,
        category: form.category,
        unit: form.unit,
        min_stock: form.min_stock,
        current_stock: form.current_stock,
        cost_price: form.cost_price ? parseFloat(form.cost_price) : null,
        sale_price: form.sale_price ? parseFloat(form.sale_price) : null,
        expiry_date: form.expiry_date || null,
        batch_number: form.batch_number || null,
        supplier: form.supplier || null,
        notes: form.notes || null,
      }

      if (product?.id) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', product.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('products')
          .insert(productData)
        if (error) throw error
      }

      router.push('/dashboard/estoque')
      router.refresh()
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao salvar produto'
      setError(errorMessage)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-6">
      {/* Info basica */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="label">Nome do produto *</label>
          <input
            type="text"
            className="input"
            placeholder="Ex: Botox 100U"
            value={form.name}
            onChange={e => update('name', e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Marca</label>
          <input
            type="text"
            className="input"
            placeholder="Ex: Allergan"
            value={form.brand}
            onChange={e => update('brand', e.target.value)}
          />
        </div>
        <div>
          <label className="label">Fornecedor</label>
          <input
            type="text"
            className="input"
            placeholder="Nome do fornecedor"
            value={form.supplier}
            onChange={e => update('supplier', e.target.value)}
          />
        </div>
      </div>

      {/* Categoria e unidade */}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label">Categoria</label>
          <select
            className="input"
            value={form.category}
            onChange={e => update('category', e.target.value)}
          >
            {CATEGORIES.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Unidade</label>
          <select
            className="input"
            value={form.unit}
            onChange={e => update('unit', e.target.value)}
          >
            {UNITS.map(u => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Estoque */}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label">Estoque atual</label>
          <input
            type="number"
            className="input"
            min="0"
            value={form.current_stock}
            onChange={e => update('current_stock', parseInt(e.target.value) || 0)}
          />
        </div>
        <div>
          <label className="label">Estoque minimo (alerta)</label>
          <input
            type="number"
            className="input"
            min="0"
            value={form.min_stock}
            onChange={e => update('min_stock', parseInt(e.target.value) || 0)}
          />
        </div>
      </div>

      {/* Precos */}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label">Preco de custo (R$)</label>
          <input
            type="number"
            step="0.01"
            className="input"
            placeholder="0,00"
            value={form.cost_price}
            onChange={e => update('cost_price', e.target.value)}
          />
        </div>
        <div>
          <label className="label">Preco de venda (R$)</label>
          <input
            type="number"
            step="0.01"
            className="input"
            placeholder="0,00"
            value={form.sale_price}
            onChange={e => update('sale_price', e.target.value)}
          />
        </div>
      </div>

      {/* Lote e validade */}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label">Numero do lote</label>
          <input
            type="text"
            className="input"
            placeholder="ABC123"
            value={form.batch_number}
            onChange={e => update('batch_number', e.target.value)}
          />
        </div>
        <div>
          <label className="label">Data de validade</label>
          <input
            type="date"
            className="input"
            value={form.expiry_date}
            onChange={e => update('expiry_date', e.target.value)}
          />
        </div>
      </div>

      {/* Observacoes */}
      <div>
        <label className="label">Observacoes</label>
        <textarea
          className="input min-h-[80px]"
          placeholder="Informacoes adicionais..."
          value={form.notes}
          onChange={e => update('notes', e.target.value)}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <Icon name="x" className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="btn-secondary flex-1"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="btn-primary flex-1 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Icon name="check" className="w-4 h-4" />
              {product?.id ? 'Atualizar' : 'Cadastrar'}
            </>
          )}
        </button>
      </div>
    </form>
  )
}
