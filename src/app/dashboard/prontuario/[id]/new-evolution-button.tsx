'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Props = {
  patientId: string
  clinicId: string
  professionalId: string
  professionalName: string
}

export default function NewEvolutionButton({ patientId, clinicId, professionalId, professionalName }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    type: 'consultation',
    title: '',
    content: '',
    procedure_name: '',
  })

  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: insertError } = await supabase.from('evolutions').insert({
      clinic_id: clinicId,
      patient_id: patientId,
      professional_id: professionalId,
      type: form.type,
      title: form.title || getTitleByType(form.type),
      content: form.content || null,
      procedure_name: form.type === 'procedure' ? form.procedure_name : null,
    })

    if (insertError) {
      setError(`Erro ao salvar: ${insertError.message}`)
      setLoading(false)
      return
    }

    setForm({ type: 'consultation', title: '', content: '', procedure_name: '' })
    setOpen(false)
    setLoading(false)
    router.refresh()
  }

  function getTitleByType(type: string) {
    const titles: Record<string, string> = {
      consultation: 'Consulta',
      procedure: form.procedure_name || 'Procedimento',
      note: 'Anotacao',
      prescription: 'Prescricao',
      exam: 'Resultado de exame',
    }
    return titles[type] || 'Evolucao'
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary w-auto px-4 py-2 text-sm">
        + Nova evolucao
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Nova evolucao</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Tipo</label>
              <select
                className="input"
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value })}
              >
                <option value="consultation">🩺 Consulta</option>
                <option value="procedure">💉 Procedimento</option>
                <option value="note">📝 Anotacao</option>
                <option value="prescription">💊 Prescricao</option>
                <option value="exam">🔬 Exame</option>
              </select>
            </div>

            {form.type === 'procedure' && (
              <div>
                <label className="label">Nome do procedimento</label>
                <input
                  className="input"
                  placeholder="Ex: Botox - Testa"
                  value={form.procedure_name}
                  onChange={e => setForm({ ...form, procedure_name: e.target.value })}
                />
              </div>
            )}

            <div>
              <label className="label">Titulo (opcional)</label>
              <input
                className="input"
                placeholder={getTitleByType(form.type)}
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Descricao / Conteudo</label>
              <textarea
                className="input min-h-[150px]"
                placeholder="Descreva a consulta, procedimento ou anotacao..."
                value={form.content}
                onChange={e => setForm({ ...form, content: e.target.value })}
              />
            </div>

            <p className="text-xs text-slate-400">
              Registrando como: {professionalName}
            </p>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? 'Salvando...' : 'Salvar evolucao'}
              </button>
              <button 
                type="button" 
                onClick={() => setOpen(false)} 
                className="btn-secondary"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
