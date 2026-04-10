'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'

type Evolution = {
  id: string
  type: string
  title: string
  content: string
  created_at: string
}

type Props = {
  patient: { id: string; name: string }
  evolutions: Evolution[]
  appointmentId: string
}

const EVOLUTION_TYPES = [
  { id: 'consulta', label: 'Consulta', icon: 'clipboard' },
  { id: 'procedimento', label: 'Procedimento', icon: 'syringe' },
  { id: 'retorno', label: 'Retorno', icon: 'refresh' },
  { id: 'observacao', label: 'Observacao', icon: 'file' },
]

export default function MedicalSection({ patient, evolutions, appointmentId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    type: 'procedimento',
    title: '',
    content: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: userData } = await supabase
        .from('users')
        .select('clinic_id')
        .eq('id', user!.id)
        .single()

      const { error } = await supabase.from('evolutions').insert({
        clinic_id: userData?.clinic_id,
        patient_id: patient.id,
        appointment_id: appointmentId,
        user_id: user!.id,
        type: form.type,
        title: form.title || `${EVOLUTION_TYPES.find(t => t.id === form.type)?.label} - ${new Date().toLocaleDateString('pt-BR')}`,
        content: form.content,
      })

      if (error) throw error

      setShowForm(false)
      setForm({ type: 'procedimento', title: '', content: '' })
      router.refresh()
    } catch (err) {
      console.error(err)
      alert('Erro ao salvar evolucao')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <Icon name="clipboard" className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Prontuario</h3>
            <p className="text-xs text-slate-500">Evolucoes e anotacoes</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary w-auto px-4 py-2 text-sm flex items-center gap-2"
        >
          <Icon name="plus" className="w-4 h-4" />
          Nova evolucao
        </button>
      </div>

      {/* Form de nova evolucao */}
      {showForm && (
        <form onSubmit={handleSubmit} className="p-4 bg-slate-50 border-b border-slate-100">
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {EVOLUTION_TYPES.map(type => (
              <button
                key={type.id}
                type="button"
                onClick={() => setForm(f => ({ ...f, type: type.id }))}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  form.type === type.id
                    ? 'gradient-bg text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon name={type.icon} className="w-4 h-4" />
                {type.label}
              </button>
            ))}
          </div>

          <input
            type="text"
            className="input mb-3"
            placeholder="Titulo (opcional)"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          />

          <textarea
            className="input min-h-[150px]"
            placeholder="Descreva o procedimento realizado, observacoes clinicas, orientacoes ao paciente..."
            value={form.content}
            onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
            required
          />

          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={() => setShowForm(false)}
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
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Icon name="check" className="w-4 h-4" />
              )}
              Salvar
            </button>
          </div>
        </form>
      )}

      {/* Lista de evolucoes */}
      <div className="divide-y divide-slate-50 max-h-[400px] overflow-y-auto">
        {evolutions.length === 0 ? (
          <div className="p-8 text-center">
            <Icon name="file" className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Nenhuma evolucao registrada</p>
          </div>
        ) : (
          evolutions.map(evo => (
            <div key={evo.id} className="p-4 hover:bg-slate-50">
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  evo.type === 'procedimento' ? 'bg-purple-100 text-purple-600' :
                  evo.type === 'consulta' ? 'bg-blue-100 text-blue-600' :
                  evo.type === 'retorno' ? 'bg-emerald-100 text-emerald-600' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  <Icon 
                    name={EVOLUTION_TYPES.find(t => t.id === evo.type)?.icon || 'file'} 
                    className="w-4 h-4" 
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-slate-900 text-sm">{evo.title}</p>
                    <span className="text-xs text-slate-400">
                      {new Date(evo.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap line-clamp-3">
                    {evo.content}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
