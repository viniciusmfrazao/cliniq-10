'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Email ou senha incorretos.'); setLoading(false); return }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse-soft" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse-soft" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse-soft" style={{ animationDelay: '2s' }} />
      
      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 gradient-bg rounded-2xl mb-4 shadow-xl shadow-purple-200 animate-float">
            <span className="text-white text-2xl font-bold">C</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Cliniq</h1>
          <p className="text-sm text-slate-500 mt-2">Gestao inteligente para sua clinica</p>
        </div>

        <div className="card p-6 shadow-xl">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Icon name="mail" className="w-5 h-5" />
                </div>
                <input 
                  className="input pl-11" 
                  type="email" 
                  placeholder="voce@clinica.com" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  required 
                />
              </div>
            </div>
            <div>
              <label className="label">Senha</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Icon name="lock" className="w-5 h-5" />
                </div>
                <input 
                  className="input pl-11 pr-11" 
                  type={showPassword ? 'text' : 'password'} 
                  placeholder="********" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  required 
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} className="w-5 h-5" />
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <Icon name="x" className="w-4 h-4 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading} 
              className="btn-primary flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  Entrar
                  <Icon name="arrowRight" className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100">
            <Link 
              href="/esqueci-senha" 
              className="text-sm text-slate-500 hover:text-slate-700 flex items-center justify-center gap-2 mb-4"
            >
              <Icon name="unlock" className="w-4 h-4" />
              Esqueci minha senha
            </Link>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-slate-500 mb-2">Ainda nao tem conta?</p>
          <Link 
            href="/cadastro" 
            className="inline-flex items-center gap-2 gradient-text font-semibold text-sm hover:opacity-80"
          >
            <Icon name="sparkles" className="w-4 h-4" />
            Criar conta gratis - 14 dias de trial
          </Link>
        </div>

        <p className="text-center text-xs text-slate-400 mt-8">
          © 2026 Cliniq. Todos os direitos reservados.
        </p>
      </div>
    </div>
  )
}
