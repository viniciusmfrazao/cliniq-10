'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function EsqueciSenhaPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    })

    if (error) {
      setError('Erro ao enviar email. Verifique o endereco.')
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-2xl mb-4">
            <span className="text-green-600 text-xl">✓</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Email enviado!</h1>
          <p className="text-sm text-slate-500 mb-6">
            Verifique sua caixa de entrada e clique no link para redefinir sua senha.
          </p>
          <Link href="/login" className="text-sm text-brand-600 hover:underline">
            Voltar ao login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-brand-600 rounded-2xl mb-4">
            <span className="text-white text-xl font-bold">C</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Esqueceu a senha?</h1>
          <p className="text-sm text-slate-500 mt-1">Digite seu email para recuperar</p>
        </div>
        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input 
                className="input" 
                type="email" 
                placeholder="voce@clinica.com" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
              />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Enviando...' : 'Enviar link de recuperacao'}
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
