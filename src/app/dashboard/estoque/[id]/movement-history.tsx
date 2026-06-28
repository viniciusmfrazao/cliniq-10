'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'

type Movement = {
  id: string
  type: string
  quantity: number
  previous_stock: number
  new_stock: number
  reason: string | null
  created_at: string
  patients: { name: string } | null
  product_id: string
}

type Props = {
  movements: Movement[]
  clinicId: string
}

export default function MovementHistory({ movements: initialMovements, clinicId }: Props) {
  const router = useRouter()
  const [movements, setMovements] = useState(initialMovements)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editQty, setEditQty] = useState(1)
  const [editQtyDraft, setEditQtyDraft] = useState('1')
  const [editReason, setEditReason] = useState('')
  const [saving, setSaving] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'entrada': return { icon: 'plus', color: 'text-emerald-600', bg: 'bg-emerald-100' }
      case 'saida': return { icon: 'minus', color: 'text-red-600', bg: 'bg-red-100' }
      case 'uso_atendimento': return { icon: 'syringe', color: 'text-purple-600', bg: 'bg-purple-100' }
      default: return { icon: 'refresh', color: 'text-blue-600', bg: 'bg-blue-100' }
    }
  }

  const startEdit = (m: Movement) => {
    setEditingId(m.id)
    setEditQty(m.quantity)
    setEditQtyDraft(String(m.quantity))
    setEditReason(m.reason || '')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditQty(1)
    setEditQtyDraft('1')
    setEditReason('')
  }

  const saveEdit = async (m: Movement) => {
    if (editQty < 1) return
    setSaving(true)

    try {
      // Buscar estoque atual do produto
      const { data: productData } = await supabase
        .from('products')
        .select('current_stock')
        .eq('id', m.product_id)
        .single()

      if (!productData) throw new Error('Produto não encontrado')

      const oldQty = m.quantity
      const diff = editQty - oldQty // diferença na quantidade

      // Ajustar estoque: se era saída, aumentar diff = mais saída; se era entrada, aumentar diff = mais entrada
      const stockDelta = m.type === 'entrada' ? diff : -diff
      const newStock = productData.current_stock + stockDelta

      if (newStock < 0) {
        alert('Estoque ficaria negativo com essa alteração.')
        setSaving(false)
        return
      }

      // Atualizar movimentação
      const { error: updateError } = await supabase
        .from('stock_movements')
        .update({
          quantity: editQty,
          reason: editReason || m.reason,
          new_stock: m.previous_stock + (m.type === 'entrada' ? editQty : -editQty)
        })
        .eq('id', m.id)

      if (updateError) throw updateError

      // Atualizar estoque do produto
      await supabase
        .from('products')
        .update({ current_stock: newStock })
        .eq('id', m.product_id)

      setMovements(movements.map(mv =>
        mv.id === m.id
          ? { ...mv, quantity: editQty, reason: editReason || mv.reason, new_stock: mv.previous_stock + (mv.type === 'entrada' ? editQty : -editQty) }
          : mv
      ))
      cancelEdit()
      router.refresh()
    } catch (err) {
      console.error('Erro ao editar movimentação', err)
      alert('Erro ao editar movimentação.')
    } finally {
      setSaving(false)
    }
  }

  const deleteMovement = async (m: Movement) => {
    if (!confirm('Excluir esta movimentação? O estoque será revertido.')) return

    try {
      const { data: productData } = await supabase
        .from('products')
        .select('current_stock')
        .eq('id', m.product_id)
        .single()

      if (!productData) throw new Error('Produto não encontrado')

      // Reverter o efeito da movimentação no estoque
      const revertedStock = m.type === 'entrada'
        ? productData.current_stock - m.quantity
        : productData.current_stock + m.quantity

      if (revertedStock < 0) {
        alert('Não é possível excluir: o estoque ficaria negativo.')
        return
      }

      await supabase
        .from('stock_movements')
        .delete()
        .eq('id', m.id)

      await supabase
        .from('products')
        .update({ current_stock: revertedStock })
        .eq('id', m.product_id)

      setMovements(movements.filter(mv => mv.id !== m.id))
      router.refresh()
    } catch (err) {
      console.error('Erro ao excluir movimentação', err)
      alert('Erro ao excluir movimentação.')
    }
  }

  if (movements.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-slate-100 flex items-center justify-center">
          <Icon name="list" className="w-6 h-6 text-slate-400" />
        </div>
        <p className="text-sm text-slate-500">Nenhuma movimentacao registrada</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 max-h-[400px] overflow-y-auto">
      {movements.map(m => {
        const config = getTypeConfig(m.type)
        const isEditing = editingId === m.id

        return (
          <div key={m.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
            <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
              <Icon name={config.icon} className={`w-4 h-4 ${config.color}`} />
            </div>

            <div className="flex-1 min-w-0">
              {isEditing ? (
                /* Modo edição */
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Qtd:</span>
                    <button
                      onClick={() => setEditQty(Math.max(1, editQty - 1))}
                      className="w-6 h-6 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-600 text-xs"
                    >-</button>
                    <input
                      type="number"
                      min="1"
                      value={editQty}
                      onChange={e => setEditQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-14 h-6 px-1 text-center bg-white border border-slate-200 rounded text-sm"
                    />
                    <button
                      onClick={() => setEditQty(editQty + 1)}
                      className="w-6 h-6 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-600 text-xs"
                    >+</button>
                  </div>
                  <input
                    type="text"
                    value={editReason}
                    onChange={e => setEditReason(e.target.value)}
                    placeholder="Motivo..."
                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(m)}
                      disabled={saving}
                      className="px-3 py-1 bg-violet-600 hover:bg-violet-700 text-white rounded text-xs font-semibold disabled:opacity-50"
                    >
                      {saving ? '...' : 'Salvar'}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                /* Modo visualização */
                <>
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-semibold ${config.color}`}>
                      {m.type === 'entrada' && '+'}
                      {m.type === 'saida' && '-'}
                      {m.quantity} unidades
                    </p>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-400 mr-1">
                        {m.previous_stock} → {m.new_stock}
                      </span>
                      <button
                        onClick={() => startEdit(m)}
                        className="p-1 hover:bg-violet-100 rounded text-violet-500 transition-colors"
                        title="Editar"
                      >
                        <Icon name="edit" className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteMovement(m)}
                        className="p-1 hover:bg-red-100 rounded text-red-500 transition-colors"
                        title="Excluir"
                      >
                        <Icon name="trash" className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {m.reason && (
                    <p className="text-xs text-slate-600 mt-0.5">{m.reason}</p>
                  )}
                  {m.patients?.name && (
                    <p className="text-xs text-slate-500 mt-0.5">Paciente: {m.patients.name}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(m.created_at).toLocaleString('pt-BR')}
                    
                  </p>
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
