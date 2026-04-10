'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RedefinirSenhaPage() {
  const router = useRouter()
  const supabase = createClient()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (password !== confirmPassword) {
      setError('As senhas nao coincidem.')
      setLoading(false)
      return
    }

    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError('Erro ao redefinir senha. Tente novamente.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-brand-600 rounded-2xl mb-4">
            <span className="text-white text-xl font-bold">C</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Nova senha</h1>
          <p className="text-sm text-slate-500 mt-1">Digite sua nova senha</p>
        </div>
        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Nova senha</label>
              <input 
                className="input" 
                type="password" 
                placeholder="Minimo 8 caracteres" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
                minLength={8}
              />
            </div>
            <div>
              <label className="label">Confirmar senha</label>
              <input 
                className="input" 
                type="password" 
                placeholder="Digite novamente" 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
                required 
              />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Salvando...' : 'Redefinir senha'}
            </button>
          </form>
          <div className="mt-4 text-center">
            <Link href="/login" className="text-sm text-slate-500 hover:text-slate-700">Voltar ao login</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
