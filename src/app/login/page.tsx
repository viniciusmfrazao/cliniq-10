'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { useBiometric } from '@/hooks/useBiometric'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const {
    isAvailable: biometryAvailable,
    hasCredentials: biometryHasCredentials,
    isLoading: biometryLoading,
    biometryType,
    saveCredentials,
    authenticateWithBiometry,
  } = useBiometric()

  // Tenta login por biometria automaticamente ao abrir o app
  useEffect(() => {
    if (biometryAvailable && biometryHasCredentials) {
      handleBiometricLogin()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biometryAvailable, biometryHasCredentials])

  async function handleBiometricLogin() {
    const credentials = await authenticateWithBiometry()
    if (!credentials) return
    await doLogin(credentials.email, credentials.password)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    await doLogin(email, password, true)
  }

  async function doLogin(em: string, pw: string, saveAfter = false) {
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: em, password: pw })

    if (signInError) {
      setError('Email ou senha incorretos.')
      setLoading(false)
      return
    }

    // Salva credenciais para biometria no próximo acesso
    if (saveAfter) saveCredentials(em, pw)

    window.location.href = '/dashboard'
  }

  const showBiometricButton = biometryAvailable && biometryHasCredentials

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

            {/* Botão de biometria */}
            {showBiometricButton && (
              <button
                type="button"
                onClick={handleBiometricLogin}
                disabled={biometryLoading || loading}
                className="w-full mb-6 flex items-center justify-center gap-3 py-3.5 px-4 rounded-2xl border-2 border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-700 font-semibold transition-colors disabled:opacity-60"
              >
                {biometryLoading ? (
                  <div className="w-5 h-5 border-2 border-violet-400/30 border-t-violet-600 rounded-full animate-spin" />
                ) : (
                  <span className="text-2xl">{biometryType === 'Face ID' ? '🔐' : '👆'}</span>
                )}
                {biometryLoading ? 'Verificando...' : `Entrar com ${biometryType}`}
              </button>
            )}

            {showBiometricButton && (
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400 font-medium">ou entre com email</span>
                <div className="flex-1 h-px bg-slate-200" />
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
                disabled={loading || biometryLoading}
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
