'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { clearImpersonationCookie } from '@/lib/clear-impersonation-cookie'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import PinUnlock from '@/components/PinUnlock'
import PinSetup from '@/components/PinSetup'
import { clearPinIfOtherUser, declinePin, hasPin, pinEmail, shouldOfferPin } from '@/lib/pin-auth'

type LoginMode = 'checking' | 'pin' | 'password' | 'setup'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [mode, setMode] = useState<LoginMode>('checking')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState<{ email: string; refreshToken: string } | null>(null)

  // Só decide depois de montar: o blob do PIN vive no localStorage
  useEffect(() => {
    // Pré-preenche o email do aparelho: mesmo caindo no fallback de senha,
    // a pessoa só digita a senha.
    const stored = pinEmail()
    if (stored) setEmail(stored)
    setMode(hasPin() ? 'pin' : 'password')
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      setError('Email ou senha incorretos.')
      setLoading(false)
      return
    }

    // Login normal nunca deve carregar uma impersonação de sessão anterior
    clearImpersonationCookie()

    // Entrou outra conta neste aparelho: o PIN da conta anterior tem que sair
    clearPinIfOtherUser(email)

    // Oferece o PIN antes de seguir (só se ainda não existe e não foi recusado)
    try {
      const { data } = await supabase.auth.getSession()
      if (data.session?.refresh_token && shouldOfferPin()) {
        setPending({
          email: data.session.user?.email ?? email,
          refreshToken: data.session.refresh_token,
        })
        setMode('setup')
        setLoading(false)
        return
      }
    } catch {
      // Falha ao oferecer o PIN nunca pode impedir o login
    }

    // Reload completo garante que o servidor lê o novo cookie
    window.location.href = '/dashboard'
  }

  function goToDashboard() {
    window.location.href = '/dashboard'
  }

  // Evita piscar o formulário de senha antes de saber se há PIN cadastrado
  if (mode === 'checking') {
    return <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100" />
  }

  if (mode === 'pin') {
    return (
      <PinUnlock
        onFallback={(message) => {
          setNotice(message ?? '')
          setMode('password')
        }}
      />
    )
  }

  if (mode === 'setup' && pending) {
    return (
      <div className="min-h-screen flex items-center justify-center px-8 bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
        <PinSetup
          email={pending.email}
          refreshToken={pending.refreshToken}
          onDone={goToDashboard}
          onSkip={() => {
            declinePin()
            goToDashboard()
          }}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex relative overflow-hidden">
      {/* Left Panel */}
      <div className="hidden lg:flex flex-1 relative items-center justify-center p-12" style={{ background: 'linear-gradient(135deg, #1E1041 0%, #3730A3 50%, #6366F1 100%)' }}>
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse-glow" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-white/5 rounded-full blur-2xl" />
        </div>
        <div className="relative text-white max-w-md">
          <div className="flex items-center gap-4 mb-8">
            <img src="/logo.svg" alt="Clinike" className="w-20 h-20 rounded-2xl animate-float shadow-2xl" />
            <div>
              <h2 className="text-3xl font-black">Clinike</h2>
              <p className="text-white/60 text-sm">Simples como deve ser</p>
            </div>
          </div>
          <h1 className="text-5xl font-black mb-4 leading-tight">
            Gerencie sua clínica com{' '}
            <span className="animate-gradient-text">inteligência</span>
            {' '}real
          </h1>
          <p className="text-white/70 text-lg">
            Agenda, pacientes, financeiro, estoque, prontuário e muito mais — tudo em um sistema moderno, 100% na nuvem.
          </p>
          <div className="mt-12 flex gap-3 flex-wrap">
            {['Agenda', 'Pacientes', 'Injetáveis', 'Estoque', 'Financeiro'].map((item, i) => (
              <div
                key={item}
                className="px-4 py-2 bg-white/10 backdrop-blur rounded-xl text-sm font-medium animate-slide-up"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 via-white to-slate-100">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-10">
            <img src="/logo.svg" alt="Clinike" className="w-16 h-16 rounded-2xl mx-auto mb-4 shadow-xl" />
            <h1 className="text-3xl font-black text-slate-900">Clinike</h1>
            <p className="text-slate-500 text-sm mt-1">Simples como deve ser</p>
          </div>

          <div className="card p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-black text-slate-900">Bem-vindo de volta!</h2>
              <p className="text-slate-500 mt-2">Entre para acessar sua clínica</p>
            </div>

            {notice && (
              <div className="mb-5 flex items-start gap-3 text-sm text-amber-800 bg-amber-50 border-2 border-amber-100 rounded-2xl px-4 py-3">
                <Icon name="info" className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="font-medium">{notice}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="label">Email</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Icon name="mail" className="w-5 h-5" />
                  </div>
                  <input
                    className="input pl-12"
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
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Icon name="lock" className="w-5 h-5" />
                  </div>
                  <input
                    className="input pl-12 pr-12"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <Icon name={showPassword ? 'eyeOff' : 'eye'} className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-3 text-sm text-red-600 bg-red-50 border-2 border-red-100 rounded-2xl px-4 py-3">
                  <Icon name="x" className="w-5 h-5 flex-shrink-0" />
                  <p className="font-medium">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    Entrar
                    <Icon name="arrowRight" className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 pt-8 border-t-2 border-slate-100">
              <Link
                href="/esqueci-senha"
                className="text-sm text-slate-500 hover:text-slate-700 flex items-center justify-center gap-2 font-medium"
              >
                <Icon name="unlock" className="w-4 h-4" />
                Esqueci minha senha
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
