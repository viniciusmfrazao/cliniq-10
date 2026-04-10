'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'

type Product = {
  id: string
  name: string
  unit: string
  current_stock: number
  sale_price: number | null
}

type UsedProduct = {
  id: string
  quantity: number
  products: { name: string; unit: string } | null
}

type Props = {
  appointmentId: string
  products: Product[]
  usedProducts: UsedProduct[]
  clinicId: string
}

export default function ProductsSection({ appointmentId, products, usedProducts, clinicId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState('')
  const [quantity, setQuantity] = useState(1)

  const selectedProductData = products.find(p => p.id === selectedProduct)

  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedProduct) return
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const product = products.find(p => p.id === selectedProduct)
      if (!product) throw new Error('Produto nao encontrado')

      // Adicionar produto usado no atendimento
      const { error: aptError } = await supabase.from('appointment_products').insert({
        appointment_id: appointmentId,
        product_id: selectedProduct,
        quantity,
        unit_price: product.sale_price,
      })
      if (aptError) throw aptError

      // Criar movimentacao de estoque
      const { error: stockError } = await supabase.from('stock_movements').insert({
        clinic_id: clinicId,
        product_id: selectedProduct,
        type: 'uso_atendimento',
        quantity,
        previous_stock: product.current_stock,
        new_stock: product.current_stock - quantity,
        reason: 'Uso em atendimento',
        appointment_id: appointmentId,
        user_id: user!.id,
      })
      if (stockError) throw stockError

      setShowForm(false)
      setSelectedProduct('')
      setQuantity(1)
      router.refresh()
    } catch (err) {
      console.error(err)
      alert('Erro ao adicionar produto')
    } finally {
      setLoading(false)
    }
  }

  async function handleRemoveProduct(usedProductId: string) {
    if (!confirm('Remover este produto?')) return

    try {
      const { error } = await supabase
        .from('appointment_products')
        .delete()
        .eq('id', usedProductId)
      if (error) throw error
      router.refresh()
    } catch (err) {
      console.error(err)
      alert('Erro ao remover produto')
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
            <Icon name="box" className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Produtos Utilizados</h3>
            <p className="text-xs text-slate-500">Controle de insumos</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary w-auto px-4 py-2 text-sm flex items-center gap-2"
        >
          <Icon name="plus" className="w-4 h-4" />
          Adicionar
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleAddProduct} className="p-4 bg-slate-50 border-b border-slate-100">
          <div className="space-y-3">
            <div>
              <label className="label">Produto</label>
              <select
                className="input"
                value={selectedProduct}
                onChange={e => setSelectedProduct(e.target.value)}
                required
              >
                <option value="">Selecione um produto</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.current_stock} em estoque)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Quantidade</label>
                <input
                  type="number"
                  min="1"
                  max={selectedProductData?.current_stock || 999}
                  className="input"
                  value={quantity}
                  onChange={e => setQuantity(parseInt(e.target.value) || 1)}
                  required
                />
              </div>
              {selectedProductData?.sale_price && (
                <div>
                  <label className="label">Valor</label>
                  <p className="input bg-slate-100">
                    {(selectedProductData.sale_price * quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !selectedProduct}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Icon name="check" className="w-4 h-4" />
                )}
                Adicionar
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Lista de produtos usados */}
      <div className="divide-y divide-slate-50">
        {usedProducts.length === 0 ? (
          <div className="p-8 text-center">
            <Icon name="box" className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Nenhum produto adicionado</p>
          </div>
        ) : (
          usedProducts.map(item => (
            <div key={item.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <span className="text-emerald-600 font-bold text-sm">{item.quantity}x</span>
                </div>
                <div>
                  <p className="font-medium text-slate-900 text-sm">{item.products?.name}</p>
                  <p className="text-xs text-slate-500">{item.products?.unit}</p>
                </div>
              </div>
              <button
                onClick={() => handleRemoveProduct(item.id)}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Icon name="trash" className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
