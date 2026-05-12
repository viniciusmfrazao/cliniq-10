'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'doctor', label: 'Médico(a)' },
  { value: 'biomedic', label: 'Biomédico(a)' },
  { value: 'nurse', label: 'Enfermeiro(a)' },
  { value: 'esthetician', label: 'Esteticista' },
  { value: 'physiotherapist', label: 'Fisioterapeuta' },
  { value: 'nutritionist', label: 'Nutricionista' },
  { value: 'psychologist', label: 'Psicólogo(a)' },
  { value: 'receptionist', label: 'Recepcionista' },
  { value: 'financial', label: 'Financeiro' },
  { value: 'manager', label: 'Gerente' },
  { value: 'assistant', label: 'Assistente' },
  { value: 'viewer', label: 'Visualizador' },
  { value: 'custom', label: '+ Outro (digite abaixo)' },
]

export default function InviteForm({ clinicId }: { clinicId: string }) {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'receptionist', customRole: '', professional_role: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const finalRole = form.role === 'custom' ? form.customRole.toLowerCase().replace(/\s+/g, '_') : form.role
      const finalRoleLabel = form.role === 'custom' ? form.customRole : ROLES.find(r => r.value === form.role)?.label || form.role

      const response = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          role: finalRole,
          roleLabel: finalRoleLabel,
          professional_role: form.professional_role || null,
          clinicId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Erro ao enviar convite')
        setLoading(false)
        return
      }

      setSuccess(data.message || `Membro cadastrado com sucesso!`)
      setForm({ name: '', email: '', password: '', role: 'receptionist', customRole: '' })
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar convite')
    }

    setLoading(false)
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="label">Senha de acesso</label>
          <div className="relative">
            <input
              className="input pr-10"
              type={showPassword ? 'text' : 'password'}
              placeholder="Mínimo 6 caracteres"
              value={form.password}
              onChange={e => update('password', e.target.value)}
              minLength={6}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
        </div>
        <div>
          <label className="label">Função</label>
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
      </div>

      {form.role === 'custom' && (
        <div>
          <label className="label">Nome da função personalizada</label>
          <input
            className="input"
            type="text"
            placeholder="Ex: Biomédica, Técnica em Estética..."
            value={form.customRole}
            onChange={e => update('customRole', e.target.value)}
            required
          />
        </div>
      )}

      {['admin', 'manager', 'receptionist', 'financial', 'viewer', 'assistant'].includes(form.role) && (
        <div>
          <label className="label">Também atende pacientes como? <span className="text-slate-400 font-normal">(opcional)</span></label>
          <select
            className="input"
            value={form.professional_role}
            onChange={e => update('professional_role', e.target.value)}
          >
            <option value="">Não atende pacientes</option>
            <option value="doctor">Médico(a)</option>
            <option value="biomedic">Biomédico(a)</option>
            <option value="nurse">Enfermeiro(a)</option>
            <option value="esthetician">Esteticista</option>
            <option value="physiotherapist">Fisioterapeuta</option>
            <option value="nutritionist">Nutricionista</option>
            <option value="psychologist">Psicólogo(a)</option>
          </select>
          <p className="text-xs text-slate-500 mt-1">Se selecionado, aparecerá como profissional disponível na agenda.</p>
        </div>
      )}
      
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
      {success && <p className="text-sm text-green-600 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{success}</p>}
      
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? 'Cadastrando...' : 'Cadastrar membro'}
      </button>
    </form>
  )
}
