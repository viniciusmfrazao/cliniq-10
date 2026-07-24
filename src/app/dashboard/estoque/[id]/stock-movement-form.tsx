'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'

type Props = {
  product: {
    id: string
    current_stock: number
  }
}

export default function StockMovementForm({ product }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [type, setType] = useState<'entrada' | 'saida' | 'ajuste'>('entrada')
  const [quantity, setQuantity] = useState(1)
  const [reason, setReason] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sessão expirada. Recarregue a página e faça login novamente.')
      const { data: userData } = await supabase
        .from('users')
        .select('clinic_id')
        .eq('id', user.id)
        .single()

      let newStock = product.current_stock
      if (type === 'entrada') newStock += quantity
      else if (type === 'saida') newStock -= quantity
      else newStock = quantity

      if (newStock < 0) {
        alert('Estoque nao pode ficar negativo')
        setLoading(false)
        return
      }

      const { error } = await supabase.from('stock_movements').insert({
        clinic_id: userData?.clinic_id,
        product_id: product.id,
        type,
        quantity: type === 'ajuste' ? quantity - product.current_stock : quantity,
        previous_stock: product.current_stock,
        new_stock: newStock,
        reason: reason || null,
        user_id: user.id,
      })

      if (error) throw error

      router.refresh()
      setQuantity(1)
      setReason('')
    } catch (err) {
      console.error(err)
      alert('Erro ao movimentar estoque')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-2">
        {(['entrada', 'saida', 'ajuste'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all ${
              type === t
                ? t === 'entrada' ? 'bg-emerald-100 text-emerald-700' :
                  t === 'saida' ? 'bg-red-100 text-red-700' :
                  'bg-blue-100 text-blue-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t === 'entrada' ? '+ Entrada' : t === 'saida' ? '- Saida' : 'Ajuste'}
          </button>
        ))}
      </div>

      <div>
        <label className="label">
          {type === 'ajuste' ? 'Novo estoque' : 'Quantidade'}
        </label>
        <input
          type="number"
          min={type === 'ajuste' ? 0 : 1}
          className="input"
          value={quantity}
          onChange={e => setQuantity(parseInt(e.target.value) || 0)}
          required
        />
        {type !== 'ajuste' && (
          <p className="text-xs text-slate-500 mt-1">
            Novo estoque: {type === 'entrada' ? product.current_stock + quantity : product.current_stock - quantity}
          </p>
        )}
      </div>

      <div>
        <label className="label">Motivo (opcional)</label>
        <input
          type="text"
          className="input"
          placeholder="Ex: Compra, Uso em atendimento..."
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn-primary flex items-center justify-center gap-2"
      >
        {loading ? (
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <Icon name="check" className="w-4 h-4" />
        )}
        Confirmar
      </button>
    </form>
  )
}
