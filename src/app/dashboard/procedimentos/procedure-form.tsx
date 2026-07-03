'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import { parseSupabaseError } from '@/lib/error-messages'


type Professional = { id: string; name: string; role?: string }

type Procedure = {
  id?: string
  name: string
  description: string | null
  duration_minutes: number
  price: number
  category: string | null
  professional_ids?: string[] | null
  includes_return?: boolean | null
  return_days?: number | null
  active?: boolean
  custo_fixo_rateavel?: number | null
}

type Props = {
  clinicId: string
  professionals: Professional[]
  procedure?: Procedure
  onSaved?: () => void
  onCancel?: () => void
  compact?: boolean
  hasCustoRateavel?: boolean
}

export default function ProcedureForm({ clinicId, professionals, procedure, onSaved, onCancel, compact = false, hasCustoRateavel = false }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const isEditing = !!procedure?.id

  const [form, setForm] = useState({
    name: procedure?.name || '',
    description: procedure?.description || '',
    duration_minutes: String(procedure?.duration_minutes ?? 30),
    price: procedure?.price != null ? String(procedure.price) : '',
    category: procedure?.category || '',
    professional_ids: (procedure?.professional_ids || []) as string[],
    includes_return: !!procedure?.includes_return,
    return_days: procedure?.return_days != null ? String(procedure.return_days) : '15',
    custo_fixo_rateavel: procedure?.custo_fixo_rateavel != null ? String(procedure.custo_fixo_rateavel) : '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const update = <K extends keyof typeof form>(field: K, value: (typeof form)[K]) =>
    setForm(prev => ({ ...prev, [field]: value }))

  function toggleProfessional(id: string) {
    setForm(prev => ({
      ...prev,
      professional_ids: prev.professional_ids.includes(id)
        ? prev.professional_ids.filter(p => p !== id)
        : [...prev.professional_ids, id],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const payload = {
      clinic_id: clinicId,
      name: form.name,
      description: form.description || null,
      duration_minutes: parseInt(form.duration_minutes) || 30,
      price: parseFloat(form.price) || 0,
      category: form.category || null,
      professional_ids: form.professional_ids,
      includes_return: form.includes_return,
      return_days: form.includes_return ? parseInt(form.return_days) || null : null,
      ...(hasCustoRateavel
        ? { custo_fixo_rateavel: form.custo_fixo_rateavel !== '' ? parseFloat(form.custo_fixo_rateavel) : null }
        : {}),
    }

    const { error } = isEditing
      ? await supabase.from('procedures').update(payload).eq('id', procedure!.id!)
      : await supabase.from('procedures').insert(payload)

    if (error) {
      setError(parseSupabaseError(error))
      setLoading(false)
      return
    }

    if (!isEditing) {
      setForm({
        name: '',
        description: '',
        duration_minutes: '30',
        price: '',
        category: '',
        professional_ids: [],
        includes_return: false,
        return_days: '15',
        custo_fixo_rateavel: '',
      })
    }
    setLoading(false)
    onSaved?.()
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className={`grid gap-4 ${compact ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2'}`}>
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
          <label className="label">Duração (minutos)</label>
          <input
            className="input"
            type="number"
            placeholder="30"
            value={form.duration_minutes}
            onChange={e => update('duration_minutes', e.target.value)}
          />
        </div>

        <div>
          <label className="label">Preço (R$)</label>
          <input
            className="input"
            type="number"
            step="0.01"
            placeholder="0,00"
            value={form.price}
            onChange={e => update('price', e.target.value)}
          />
        </div>

        {hasCustoRateavel && (
          <div className="md:col-span-2">
            <label className="label">Custo de insumo estimado (R$)</label>
            <input
              className="input"
              type="number"
              step="0.01"
              placeholder="Ex: 25,00"
              value={form.custo_fixo_rateavel}
              onChange={e => update('custo_fixo_rateavel', e.target.value)}
            />
            <p className="text-xs text-slate-400 mt-1">
              Estimativa de custo de itens não rastreados no estoque (ex: algodão, cola, fita). Soma-se ao custo de produtos vinculados no atendimento — não substitui.
            </p>
          </div>
        )}

        <div className="md:col-span-2">
          <label className="label">Categoria</label>
          <input
            className="input"
            type="text"
            placeholder="Ex: Injetáveis, Facial, Corporal..."
            value={form.category}
            onChange={e => update('category', e.target.value)}
          />
        </div>

        <div className="md:col-span-2">
          <label className="label">Descrição</label>
          <textarea
            className="input min-h-[80px]"
            placeholder="Detalhes do procedimento..."
            value={form.description}
            onChange={e => update('description', e.target.value)}
          />
        </div>

        {/* Profissionais que realizam */}
        <div className="md:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">Profissionais que realizam</label>
            {professionals.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => update('professional_ids', professionals.map(p => p.id))}
                  className="text-xs text-violet-600 hover:underline"
                >
                  Todos
                </button>
                <span className="text-xs text-slate-300">•</span>
                <button
                  type="button"
                  onClick={() => update('professional_ids', [])}
                  className="text-xs text-slate-500 hover:underline"
                >
                  Nenhum
                </button>
              </div>
            )}
          </div>
          {professionals.length === 0 ? (
            <p className="text-xs text-slate-400 bg-slate-50 rounded-lg p-3">
              Nenhum profissional cadastrado. Adicione profissionais em Equipe.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {professionals.map(prof => {
                const selected = form.professional_ids.includes(prof.id)
                return (
                  <button
                    type="button"
                    key={prof.id}
                    onClick={() => toggleProfessional(prof.id)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                      selected
                        ? 'bg-violet-100 border-violet-300 text-violet-700 font-medium'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-violet-200'
                    }`}
                  >
                    {selected && <Icon name="check" className="w-3 h-3 inline -mt-0.5 mr-1" />}
                    {prof.name}
                  </button>
                )
              })}
            </div>
          )}
          <p className="text-xs text-slate-400 mt-2">
            Se nenhum for marcado, qualquer profissional da clínica pode realizar.
          </p>
        </div>

        {/* Retorno */}
        <div className="md:col-span-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.includes_return}
              onChange={e => update('includes_return', e.target.checked)}
              className="w-4 h-4 rounded text-violet-600"
            />
            <span className="text-sm font-medium text-slate-700">Inclui retorno</span>
          </label>
          {form.includes_return && (
            <div className="mt-2">
              <label className="label text-xs">Dias até o retorno</label>
              <input
                className="input w-32"
                type="number"
                min="1"
                value={form.return_days}
                onChange={e => update('return_days', e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Salvando...' : isEditing ? 'Atualizar procedimento' : 'Adicionar procedimento'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}
