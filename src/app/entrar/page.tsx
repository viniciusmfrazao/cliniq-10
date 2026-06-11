'use client'

import { useState } from 'react'
import { useEffect } from 'react'

const URL = 'https://yqrjbyaucimvmzpfipgs.supabase.co'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxcmpieWF1Y2ltdm16cGZpcGdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NzE0ODcsImV4cCI6MjA5MTM0NzQ4N30.T8kjp-2Nl0HGe9_UIvQNZXPT6DNJgaqK3awUKU0HeYA'

export default function EntrarPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Limpa cookies antigos ao montar
  useEffect(() => {
    try {
      document.cookie = 'clinike-auth-token=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/'
      localStorage.removeItem('clinike-auth-token')
    } catch {}
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      // Importa dinamicamente para garantir versão fresh
      const { createBrowserClient } = await import('@supabase/ssr')
      const sb = createBrowserClient(URL, KEY)
      const { error: signInError } = await sb.auth.signInWithPassword({ email, password })
      if (signInError) {
        setError('Email ou senha incorretos.')
        setLoading(false)
        return
      }
      window.location.href = '/dashboard'
    } catch {
      setError('Erro ao conectar. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <img src="/logo.svg" alt="Clinike" className="w-16 h-16 rounded-2xl mx-auto mb-4 shadow-xl" />
          <h1 className="text-3xl font-black text-slate-900">Clinike</h1>
          <p className="text-slate-500 text-sm mt-1">Simples como deve ser</p>
        </div>
        <div className="card p-8">
          <h2 className="text-2xl font-black text-slate-900 mb-6">Bem-vindo de volta!</h2>
          <form onSubmit={handleLogin} className="space-y-5">
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
            <div>
              <label className="label">Senha</label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border-2 border-red-100 rounded-2xl px-4 py-3 font-medium">
                {error}
              </div>
            )}
            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
          <div className="mt-6 text-center">
            <a href="/esqueci-senha" className="text-sm text-slate-500 hover:text-slate-700 font-medium">
              Esqueci minha senha
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
