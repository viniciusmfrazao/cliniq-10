'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Patient = {
  id?: string
  name: string
  email: string
  phone: string
  cpf: string
  birth_date: string
  gender: string
  address: string
  city: string
  state: string
  zip_code: string
  notes: string
  tags: string[]
}

const EMPTY_PATIENT: Patient = {
  name: '',
  email: '',
  phone: '',
  cpf: '',
  birth_date: '',
  gender: '',
  address: '',
  city: '',
  state: '',
  zip_code: '',
  notes: '',
  tags: [],
}

export default function PatientForm({ patient }: { patient?: Patient }) {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState<Patient>(patient || EMPTY_PATIENT)
  const [tagInput, setTagInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isEditing = !!patient?.id

  const update = (field: keyof Patient, value: string | string[]) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function addTag() {
    if (tagInput.trim() && !form.tags.includes(tagInput.trim())) {
      update('tags', [...form.tags, tagInput.trim()])
      setTagInput('')
    }
  }

  function removeTag(tag: string) {
    update('tags', form.tags.filter(t => t !== tag))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Buscar clinic_id do usuario
    const { data: { user } } = await supabase.auth.getUser()
    const { data: userData } = await supabase.from('users').select('clinic_id').eq('id', user!.id).single()

    // Validar campo obrigatório
    if (!form.gender) {
      setError('O campo Sexo é obrigatório')
      setLoading(false)
      return
    }

    const patientData = {
      ...form,
      clinic_id: userData?.clinic_id,
      birth_date: form.birth_date || null,
      gender: form.gender,
      email: form.email || null,
      phone: form.phone || null,
      cpf: form.cpf || null,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      zip_code: form.zip_code || null,
      notes: form.notes || null,
    }

    let result
    if (isEditing) {
      result = await supabase
        .from('patients')
        .update(patientData)
        .eq('id', patient.id)
    } else {
      result = await supabase
        .from('patients')
        .insert(patientData)
    }

    if (result.error) {
      setError(result.error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard/pacientes')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="label">Nome completo *</label>
          <input
            className="input"
            type="text"
            placeholder="Maria da Silva"
            value={form.name}
            onChange={e => update('name', e.target.value)}
            required
          />
        </div>

        <div>
          <label className="label">Telefone</label>
          <input
            className="input"
            type="tel"
            placeholder="(11) 99999-9999"
            value={form.phone}
            onChange={e => update('phone', e.target.value)}
          />
        </div>

        <div>
          <label className="label">Email</label>
          <input
            className="input"
            type="email"
            placeholder="email@exemplo.com"
            value={form.email}
            onChange={e => update('email', e.target.value)}
          />
        </div>

        <div>
          <label className="label">CPF</label>
          <input
            className="input"
            type="text"
            placeholder="000.000.000-00"
            value={form.cpf}
            onChange={e => update('cpf', e.target.value)}
          />
        </div>

        <div>
          <label className="label">Data de nascimento</label>
          <input
            className="input"
            type="date"
            value={form.birth_date}
            onChange={e => update('birth_date', e.target.value)}
          />
        </div>

        <div>
          <label className="label">Sexo *</label>
          <select
            className="input"
            value={form.gender}
            onChange={e => update('gender', e.target.value)}
            required
          >
            <option value="">Selecione o sexo</option>
            <option value="female">Feminino</option>
            <option value="male">Masculino</option>
          </select>
        </div>

        <div>
          <label className="label">CEP</label>
          <input
            className="input"
            type="text"
            placeholder="00000-000"
            value={form.zip_code}
            onChange={e => update('zip_code', e.target.value)}
          />
        </div>

        <div className="md:col-span-2">
          <label className="label">Endereco</label>
          <input
            className="input"
            type="text"
            placeholder="Rua, numero, complemento"
            value={form.address}
            onChange={e => update('address', e.target.value)}
          />
        </div>

        <div>
          <label className="label">Cidade</label>
          <input
            className="input"
            type="text"
            placeholder="Sao Paulo"
            value={form.city}
            onChange={e => update('city', e.target.value)}
          />
        </div>

        <div>
          <label className="label">Estado</label>
          <input
            className="input"
            type="text"
            placeholder="SP"
            maxLength={2}
            value={form.state}
            onChange={e => update('state', e.target.value.toUpperCase())}
          />
        </div>

        <div className="md:col-span-2">
          <label className="label">Tags</label>
          <div className="flex gap-2 mb-2 flex-wrap">
            {form.tags.map(tag => (
              <span 
                key={tag} 
                className="text-xs bg-brand-100 text-brand-700 px-2 py-1 rounded-full flex items-center gap-1"
              >
                {tag}
                <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-500">x</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              type="text"
              placeholder="Adicionar tag..."
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
            />
            <button type="button" onClick={addTag} className="btn-secondary w-auto px-4">+</button>
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="label">Observacoes</label>
          <textarea
            className="input min-h-[100px]"
            placeholder="Alergias, preferencias, etc..."
            value={form.notes}
            onChange={e => update('notes', e.target.value)}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Salvando...' : isEditing ? 'Salvar alteracoes' : 'Cadastrar paciente'}
        </button>
        <button 
          type="button" 
          onClick={() => router.back()} 
          className="btn-secondary"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
