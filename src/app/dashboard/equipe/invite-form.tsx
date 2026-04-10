'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'professional', label: 'Profissional (Médico/Esteticista)' },
  { value: 'receptionist', label: 'Recepcionista' },
]

export default function InviteForm({ clinicId }: { clinicId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState({ name: '', email: '', role: 'receptionist' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    // Gerar senha temporaria
    const tempPassword = Math.random().toString(36).slice(-8) + 'A1!'

    // Criar usuario no Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: tempPassword,
      options: {
        data: { invited: true }
      }
    })

    if (authError || !authData.user) {
      setError(authError?.message || 'Erro ao criar usuario')
      setLoading(false)
      return
    }

    // Adicionar na tabela users
    const { error: dbError } = await supabase.from('users').insert({
      id: authData.user.id,
      clinic_id: clinicId,
      name: form.name,
      email: form.email,
      role: form.role,
    })

    if (dbError) {
      console.error('Erro ao inserir usuário:', dbError)
      setError(`Erro: ${dbError.message}`)
      setLoading(false)
      return
    }

    // Enviar email de recuperacao de senha para o usuario definir a senha
    await supabase.auth.resetPasswordForEmail(form.email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    })

    setSuccess(`Convite enviado para ${form.email}`)
    setForm({ name: '', email: '', role: 'receptionist' })
    setLoading(false)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="label">Nome</label>
          <input
            className="input"
            type="text"
            placeholder="Nome completo"
            value={form.name}
            onChange={e => update('name', e.target.value)}
            required
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
            required
          />
        </div>
      </div>
      <div>
        <label className="label">Funcao</label>
        <select
          className="input"
          value={form.role}
          onChange={e => update('role', e.target.value)}
        >
          {ROLES.map(role => (
            <option key={role.value} value={role.value}>{role.label}</option>
          ))}
        </select>
      </div>
      
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
      {success && <p className="text-sm text-green-600 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{success}</p>}
      
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? 'Enviando...' : 'Enviar convite'}
      </button>
    </form>
  )
}
