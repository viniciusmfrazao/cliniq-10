'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'doctor', label: 'Médico(a)' },
  { value: 'esthetician', label: 'Esteticista' },
  { value: 'receptionist', label: 'Recepcionista' },
  { value: 'viewer', label: 'Visualizador' },
]

export default function InviteForm({ clinicId }: { clinicId: string }) {
  const router = useRouter()
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

    try {
      const response = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          role: form.role,
          clinicId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Erro ao enviar convite')
        setLoading(false)
        return
      }

      setSuccess(data.message || `Convite enviado para ${form.email}`)
      setForm({ name: '', email: '', role: 'receptionist' })
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
