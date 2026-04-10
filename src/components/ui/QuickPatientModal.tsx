'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
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
    birth_date: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [createdPatient, setCreatedPatient] = useState<{ id: string; name: string } | null>(null)

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
        birth_date: form.birth_date || null,
      })
      .select('id, name')
      .single()

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    setCreatedPatient(data)
    onPatientCreated(data)
    setLoading(false)
  }

  // Tela de sucesso
  if (createdPatient) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="check" className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Paciente cadastrado!</h3>
            <p className="text-sm text-slate-500 mb-6">
              <strong>{createdPatient.name}</strong> foi adicionado e já está selecionado.
            </p>

            {/* Alerta de cadastro incompleto */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-left">
              <div className="flex items-start gap-3">
                <Icon name="bell" className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Cadastro pendente</p>
                  <p className="text-xs text-amber-700 mt-1">
                    Quando o paciente chegar, complete o cadastro com CPF e outros dados.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={onClose}
                className="btn-primary w-full"
              >
                Continuar agendamento
              </button>
              <Link
                href={`/dashboard/pacientes/${createdPatient.id}`}
                className="btn-secondary w-full text-center"
                onClick={onClose}
              >
                Completar cadastro agora
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
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
          <div>
            <h3 className="text-lg font-bold text-slate-900">Cadastro Rápido</h3>
            <p className="text-xs text-slate-500">Para agendamento via WhatsApp</p>
          </div>
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
            <label className="label">WhatsApp *</label>
            <input
              type="tel"
              className="input"
              placeholder="(00) 00000-0000"
              value={form.phone}
              onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
            />
            <p className="text-xs text-slate-400 mt-1">Para contato e confirmação</p>
          </div>

          <div>
            <label className="label">Data de nascimento</label>
            <input
              type="date"
              className="input"
              value={form.birth_date}
              onChange={e => setForm(prev => ({ ...prev, birth_date: e.target.value }))}
            />
            <p className="text-xs text-slate-400 mt-1">Opcional agora, obrigatório na chegada</p>
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

        <div className="mt-4 p-3 bg-slate-50 rounded-xl">
          <p className="text-xs text-slate-500 text-center">
            💡 CPF e outros dados serão preenchidos quando o paciente chegar na clínica
          </p>
        </div>
      </div>
    </div>
  )
}
