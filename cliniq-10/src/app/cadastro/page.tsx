'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

function slugify(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default function CadastroPage() {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState({ clinicName: '', name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    })

    if (authError || !authData.user) {
      setError(authError?.message || 'Erro ao criar conta.')
      setLoading(false)
      return
    }

    const { error: fnError } = await supabase.rpc('create_clinic_with_admin', {
      p_clinic_name: form.clinicName,
      p_slug: slugify(form.clinicName),
      p_user_id: authData.user.id,
      p_user_name: form.name,
      p_user_email: form.email,
    })

    if (fnError) {
      setError('Erro ao configurar sua clínica. Tente novamente.')
      setLoading(false)
      return
    }

    router.push('/dashboard?welcome=1')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-brand-600 rounded-2xl mb-4">
            <span className="text-white text-xl font-bold">C</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Criar conta</h1>
          <p className="text-sm text-slate-500 mt-1">14 dias grátis · sem cartão</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Nome da clínica</label>
              <input className="input" type="text" placeholder="Clínica Bella" value={form.clinicName} onChange={e => update('clinicName', e.target.value)} required />
            </div>
            <div>
              <label className="label">Seu nome</label>
              <input className="input" type="text" placeholder="Dra. Ana Silva" value={form.name} onChange={e => update('name', e.target.value)} required />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" placeholder="dra@clinica.com" value={form.email} onChange={e => update('email', e.target.value)} required />
            </div>
            <div>
              <label className="label">Senha</label>
              <input className="input" type="password" placeholder="Mínimo 8 caracteres" value={form.password} onChange={e => update('password', e.target.value)} required minLength={8} />
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Criando sua conta...' : 'Começar gratuitamente'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <Link href="/login" className="text-sm text-slate-500 hover:text-slate-700">Já tenho conta</Link>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          Ao criar sua conta você concorda com os Termos de Uso e Política de Privacidade.
        </p>
      </div>
    </div>
  )
}
