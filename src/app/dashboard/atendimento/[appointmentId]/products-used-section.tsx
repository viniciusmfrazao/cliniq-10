'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import { createLogger } from '@/lib/logger'

const log = createLogger('ProductsUsed')

type Product = {
  id: string
  name: string
  brand: string | null
  current_stock: number
  unit: string
  category: string | null
}

type UsedProduct = {
  id: string
  product_id: string
  quantity: number
  products: { name: string; unit: string } | null
}

type Props = {
  appointmentId: string
  patientId: string
  clinicId: string
  products: Product[]
  usedProducts: UsedProduct[]
}

export default function ProductsUsedSection({ appointmentId, patientId, clinicId, products, usedProducts: initialUsed }: Props) {
  const router = useRouter()
  const [usedProducts, setUsedProducts] = useState(initialUsed)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [quantityDraft, setQuantityDraft] = useState('1')
  const [searchTerm, setSearchTerm] = useState('')

  // Estado de edição
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editQuantity, setEditQuantity] = useState(1)
  const [editQtyDraft, setEditQtyDraft] = useState('1')
  const [editSaving, setEditSaving] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Filtrar produtos por busca
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Agrupar por categoria
  const productsByCategory = filteredProducts.reduce((acc, p) => {
    const cat = p.category || 'Outros'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(p)
    return acc
  }, {} as Record<string, Product[]>)

  const addProduct = async () => {
    if (!selectedProduct || quantity < 1) return
    
    const product = products.find(p => p.id === selectedProduct)
    if (!product) return

    if (quantity > product.current_stock) {
      alert(`Estoque insuficiente! Disponível: ${product.current_stock} ${product.unit}`)
      return
    }

    setSaving(true)
    log.info('Adicionando produto usado', { productId: selectedProduct, quantity, appointmentId })

    try {
      const { data: usedRecord, error: insertError } = await supabase
        .from('appointment_products')
        .insert({
          appointment_id: appointmentId,
          product_id: selectedProduct,
          quantity: quantity
        })
        .select('*, products(name, unit)')
        .single()

      if (insertError) {
        log.error('Erro ao registrar produto', insertError)
        throw insertError
      }

      const newStock = product.current_stock - quantity

      const { error: stockError } = await supabase
        .from('products')
        .update({ current_stock: newStock })
        .eq('id', selectedProduct)

      if (stockError) {
        log.error('Erro ao atualizar estoque', stockError)
        throw stockError
      }

      await supabase.from('stock_movements').insert({
        clinic_id: clinicId,
        product_id: selectedProduct,
        type: 'saida',
        quantity: quantity,
        previous_stock: product.current_stock,
        new_stock: newStock,
        reason: `Usado no atendimento`,
        appointment_id: appointmentId,
        patient_id: patientId
      })

      log.info('Produto adicionado e estoque descontado', { 
        productName: product.name,
        quantidade: quantity,
        estoqueAnterior: product.current_stock,
        estoqueNovo: newStock
      })

      setUsedProducts([...usedProducts, usedRecord])
      setSelectedProduct('')
      setQuantity(1)
      setQuantityDraft('1')
      setShowForm(false)
      router.refresh()
    } catch (err) {
      log.error('Erro ao adicionar produto', err)
      alert('Erro ao adicionar produto. Verifique os logs.')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (up: UsedProduct) => {
    setEditingId(up.id)
    setEditQuantity(up.quantity)
    setEditQtyDraft(String(up.quantity))
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditQuantity(1)
  }

  const saveEdit = async (up: UsedProduct) => {
    if (editQuantity < 1) return
    if (editQuantity === up.quantity) {
      cancelEdit()
      return
    }

    setEditSaving(true)
    log.info('Editando quantidade do produto', { usedId: up.id, oldQty: up.quantity, newQty: editQuantity })

    try {
      // Buscar estoque atual do produto
      const { data: productData } = await supabase
        .from('products')
        .select('current_stock')
        .eq('id', up.product_id)
        .single()

      if (!productData) throw new Error('Produto não encontrado')

      const diff = editQuantity - up.quantity // positivo = mais saída, negativo = devolução parcial

      if (diff > 0 && diff > productData.current_stock) {
        alert(`Estoque insuficiente! Disponível: ${productData.current_stock}`)
        setEditSaving(false)
        return
      }

      const newStock = productData.current_stock - diff

      // Atualizar quantidade no atendimento
      const { error: updateError } = await supabase
        .from('appointment_products')
        .update({ quantity: editQuantity })
        .eq('id', up.id)

      if (updateError) throw updateError

      // Ajustar estoque
      await supabase
        .from('products')
        .update({ current_stock: newStock })
        .eq('id', up.product_id)

      // Registrar movimentação de ajuste
      await supabase.from('stock_movements').insert({
        clinic_id: clinicId,
        product_id: up.product_id,
        type: diff > 0 ? 'saida' : 'entrada',
        quantity: Math.abs(diff),
        previous_stock: productData.current_stock,
        new_stock: newStock,
        reason: `Ajuste de quantidade no atendimento`,
        appointment_id: appointmentId,
        patient_id: patientId
      })

      log.info('Quantidade editada com sucesso', { diff, estoqueNovo: newStock })

      // Atualizar lista local
      setUsedProducts(usedProducts.map(p =>
        p.id === up.id ? { ...p, quantity: editQuantity } : p
      ))
      cancelEdit()
      router.refresh()
    } catch (err) {
      log.error('Erro ao editar quantidade', err)
      alert('Erro ao editar quantidade.')
    } finally {
      setEditSaving(false)
    }
  }

  const removeProduct = async (usedId: string, productId: string, qty: number) => {
    if (!confirm('Remover este produto? O estoque será devolvido.')) return

    try {
      const { data: product } = await supabase
        .from('products')
        .select('current_stock')
        .eq('id', productId)
        .single()

      if (!product) return

      const newStock = product.current_stock + qty

      await supabase
        .from('products')
        .update({ current_stock: newStock })
        .eq('id', productId)

      await supabase.from('stock_movements').insert({
        clinic_id: clinicId,
        product_id: productId,
        type: 'entrada',
        quantity: qty,
        previous_stock: product.current_stock,
        new_stock: newStock,
        reason: 'Devolvido - removido do atendimento',
        appointment_id: appointmentId
      })

      await supabase.from('appointment_products').delete().eq('id', usedId)

      setUsedProducts(usedProducts.filter(p => p.id !== usedId))
      router.refresh()
    } catch (err) {
      log.error('Erro ao remover produto', err)
      alert('Erro ao remover produto')
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">Produtos Utilizados</h3>
          <p className="text-xs text-slate-500">Seringas, fios, materiais, etc.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Icon name={showForm ? 'x' : 'plus'} className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Formulário para adicionar */}
        {showForm && (
          <div className="p-4 bg-slate-50 rounded-xl space-y-3">
            <div>
              <input
                type="text"
                placeholder="Buscar produto..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:border-violet-500 outline-none"
              />
            </div>

            <div className="max-h-48 overflow-y-auto space-y-3">
              {Object.entries(productsByCategory).map(([category, prods]) => (
                <div key={category}>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">{category}</p>
                  <div className="space-y-1">
                    {prods.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedProduct(p.id)}
                        className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors ${
                          selectedProduct === p.id 
                            ? 'bg-violet-100 border border-violet-300' 
                            : 'bg-white border border-slate-200 hover:border-violet-200'
                        }`}
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-900">{p.name}</p>
                          {p.brand && <p className="text-xs text-slate-500">{p.brand}</p>}
                        </div>
                        <span className="text-xs text-slate-500">
                          {p.current_stock} {p.unit}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {filteredProducts.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">Nenhum produto encontrado</p>
              )}
            </div>

            {selectedProduct && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-600">Quantidade:</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:border-violet-300"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={quantityDraft}
                    onChange={e => { setQuantityDraft(e.target.value); setQuantity(Math.max(1, parseInt(e.target.value) || 1)) }}
                    onBlur={() => setQuantityDraft(String(Math.max(1, quantity)))}
                    className="w-16 h-8 px-2 text-center bg-white border border-slate-200 rounded-lg text-sm"
                  />
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:border-violet-300"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={addProduct}
                  disabled={saving}
                  className="ml-auto px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {saving ? '...' : 'Adicionar'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Lista de produtos usados */}
        {usedProducts.length === 0 ? (
          <div className="text-center py-6">
            <Icon name="box" className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Nenhum produto registrado</p>
            <button
              onClick={() => setShowForm(true)}
              className="text-sm text-violet-600 hover:underline mt-1"
            >
              Adicionar produto
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {usedProducts.map(up => (
              <div key={up.id} className="p-3 bg-slate-50 rounded-lg">
                {editingId === up.id ? (
                  /* Modo edição */
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-900 flex-1 text-sm">
                      {(up.products as { name: string } | null)?.name || 'Produto'}
                    </p>
                    <button
                      onClick={() => setEditQuantity(Math.max(1, editQuantity - 1))}
                      className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:border-violet-300 text-sm"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={editQtyDraft}
                      onChange={e => { setEditQtyDraft(e.target.value); setEditQuantity(Math.max(1, parseInt(e.target.value) || 1)) }}
                      onBlur={() => setEditQtyDraft(String(Math.max(1, editQuantity)))}
                      className="w-14 h-7 px-1 text-center bg-white border border-slate-200 rounded-lg text-sm"
                    />
                    <button
                      onClick={() => setEditQuantity(editQuantity + 1)}
                      className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:border-violet-300 text-sm"
                    >
                      +
                    </button>
                    <button
                      onClick={() => saveEdit(up)}
                      disabled={editSaving}
                      className="px-3 py-1 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                    >
                      {editSaving ? '...' : 'Salvar'}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
                    >
                      <Icon name="x" className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  /* Modo visualização */
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900">
                        {(up.products as { name: string } | null)?.name || 'Produto'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {up.quantity} {(up.products as { unit: string } | null)?.unit || 'un'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEdit(up)}
                        className="p-1.5 hover:bg-violet-50 rounded-lg text-violet-500 transition-colors"
                        title="Editar quantidade"
                      >
                        <Icon name="edit" className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeProduct(up.id, up.product_id, up.quantity)}
                        className="p-1.5 hover:bg-red-50 rounded-lg text-red-500 transition-colors"
                        title="Remover produto"
                      >
                        <Icon name="trash" className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-xl">
          <Icon name="bell" className="w-4 h-4 text-blue-600 mt-0.5" />
          <p className="text-xs text-blue-700">
            O estoque é ajustado automaticamente ao editar ou remover produtos.
          </p>
        </div>
      </div>
    </div>
  )
}
