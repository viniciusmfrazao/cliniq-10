'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ProcedureForm({ clinicId }: { clinicId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState({
    name: '',
    description: '',
    duration_minutes: '30',
    price: '',
    category: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.from('procedures').insert({
      clinic_id: clinicId,
      name: form.name,
      description: form.description || null,
      duration_minutes: parseInt(form.duration_minutes) || 30,
      price: parseFloat(form.price) || 0,
      category: form.category || null,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setForm({ name: '', description: '', duration_minutes: '30', price: '', category: '' })
    setLoading(false)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="label">Nome do procedimento *</label>
          <input
            className="input"
            type="text"
            placeholder="Ex: Botox - Testa"
            value={form.name}
            onChange={e => update('name', e.target.value)}
            required
          />
        </div>

        <div>
          <label className="label">Duracao (minutos)</label>
          <input
            className="input"
            type="number"
            placeholder="30"
            value={form.duration_minutes}
            onChange={e => update('duration_minutes', e.target.value)}
          />
        </div>

        <div>
          <label className="label">Preco (R$)</label>
          <input
            className="input"
            type="number"
            step="0.01"
            placeholder="0,00"
            value={form.price}
            onChange={e => update('price', e.target.value)}
          />
        </div>

        <div className="md:col-span-2">
          <label className="label">Categoria</label>
          <input
            className="input"
            type="text"
            placeholder="Ex: Injetaveis, Facial, Corporal..."
            value={form.category}
            onChange={e => update('category', e.target.value)}
          />
        </div>

        <div className="md:col-span-2">
          <label className="label">Descricao</label>
          <textarea
            className="input min-h-[80px]"
            placeholder="Detalhes do procedimento..."
            value={form.description}
            onChange={e => update('description', e.target.value)}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}

      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? 'Salvando...' : 'Adicionar procedimento'}
      </button>
    </form>
  )
}
