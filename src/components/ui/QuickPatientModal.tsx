'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from './Icon'

type Props = {
  clinicId: string
  onPatientCreated: (patient: { id: string; name: string }) => void
  onClose: () => void
}

export default function QuickPatientModal({ clinicId, onPatientCreated, onClose }: Props) {
  const supabase = createClient()
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Nome é obrigatório')
      return
    }

    setLoading(true)
    setError('')

    const { data, error: insertError } = await supabase
      .from('patients')
      .insert({
        clinic_id: clinicId,
        name: form.name.trim(),
        phone: form.phone || null,
        email: form.email || null,
      })
      .select('id, name')
      .single()

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    onPatientCreated(data)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">Cadastro Rápido de Paciente</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <Icon name="x" className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nome completo *</label>
            <input
              type="text"
              className="input"
              placeholder="Nome do paciente"
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              autoFocus
              required
            />
          </div>

          <div>
            <label className="label">Telefone / WhatsApp</label>
            <input
              type="tel"
              className="input"
              placeholder="(00) 00000-0000"
              value={form.phone}
              onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
            />
          </div>

          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              placeholder="email@exemplo.com"
              value={form.email}
              onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1"
            >
              {loading ? 'Salvando...' : 'Cadastrar e selecionar'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              Cancelar
            </button>
          </div>
        </form>

        <p className="text-xs text-slate-500 mt-4 text-center">
          Você pode completar os dados do paciente depois
        </p>
      </div>
    </div>
  )
}
