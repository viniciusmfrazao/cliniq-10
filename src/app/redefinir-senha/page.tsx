'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'

function RedefinirSenhaInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const initialEmail = searchParams.get('email') || ''
  const initialMode = searchParams.get('modo') === 'codigo' ? 'code' : 'auto'

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [checking, setChecking] = useState(true)
  const [mode, setMode] = useState<'auto' | 'code' | 'expired'>(initialMode)
  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState('')

  useEffect(() => {
    async function checkSession() {
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      const type = hashParams.get('type')
      const hashError = hashParams.get('error_code') || hashParams.get('error')

      if (hashError) {
        window.history.replaceState(null, '', '/redefinir-senha')
        setMode('code')
        setChecking(false)
        return
      }

      if (accessToken && type === 'recovery') {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || ''
        })
        
        if (!error) {
          setSessionReady(true)
          window.history.replaceState(null, '', '/redefinir-senha')
        } else {
          setMode('code')
        }
        setChecking(false)
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setSessionReady(true)
        setChecking(false)
        return
      }

      if (initialMode === 'code' || initialEmail) {
        setMode('code')
      } else {
        setMode('expired')
      }
      setChecking(false)
    }

    checkSession()
  }, [supabase.auth, initialEmail, initialMode])

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!email) {
      setError('Informe seu email.')
      return
    }
    const cleanCode = code.replace(/\D/g, '')
    if (cleanCode.length !== 6) {
      setError('O código tem 6 dígitos.')
      return
    }

    setLoading(true)
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: cleanCode,
      type: 'recovery'
    })

    if (verifyError) {
      const msg = verifyError.message?.toLowerCase() || ''
      if (msg.includes('expired')) {
        setError('Código expirado. Solicite um novo.')
      } else if (msg.includes('invalid')) {
        setError('Código inválido. Verifique os 6 dígitos.')
      } else {
        setError('Não foi possível validar o código. Tente novamente.')
      }
      setLoading(false)
      return
    }

    setSessionReady(true)
    setMode('auto')
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({
      password: password
    })

    if (error) {
      setError('Erro ao atualizar senha. Tente novamente.')
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)

    setTimeout(() => {
      router.push('/dashboard')
    }, 2000)
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 via-white to-slate-100">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (mode === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 via-white to-slate-100">
        <div className="w-full max-w-md">
          <div className="card p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Icon name="x" className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Link expirado ou inválido</h2>
            <p className="text-slate-500 mb-2">
              Isso costuma acontecer quando o seu provedor de email (Outlook, antivírus) abre o link automaticamente antes de você.
            </p>
            <p className="text-slate-500 mb-6 text-sm">
              Solicite novamente — desta vez você poderá usar o <strong>código de 6 dígitos</strong> do email, que é à prova desse problema.
            </p>
            <div className="flex flex-col gap-3">
              <Link href="/esqueci-senha" className="btn-primary inline-flex items-center justify-center gap-2">
                Solicitar novo link
              </Link>
              <button
                onClick={() => setMode('code')}
                className="text-sm text-slate-600 hover:text-slate-900 underline"
              >
                Já tenho um código de 6 dígitos
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!sessionReady && mode === 'code') {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 via-white to-slate-100">
        <div className="w-full max-w-md">
          <div className="card p-8">
            <div className="mb-8">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mb-4">
                <Icon name="lock" className="w-6 h-6 text-slate-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Digite o código</h2>
              <p className="text-slate-500 mt-2 text-sm">
                Enviamos um código de 6 dígitos para o seu email. Ele funciona mesmo se o link automático tiver falhado.
              </p>
            </div>

            <form onSubmit={handleVerifyCode} className="space-y-5">
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
                <label className="label">Código de 6 dígitos</label>
                <input
                  className="input text-center tracking-[0.5em] text-2xl font-bold"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                />
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
                    Validando...
                  </>
                ) : (
                  <>
                    Continuar
                    <Icon name="arrowRight" className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center space-y-2">
              <Link href="/esqueci-senha" className="text-sm text-slate-500 hover:text-slate-700 block">
                Não recebeu? Solicitar novo código
              </Link>
              <Link href="/login" className="text-sm text-slate-400 hover:text-slate-600 block">
                Voltar ao login
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 via-white to-slate-100">
        <div className="w-full max-w-md">
          <div className="card p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Icon name="x" className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Link expirado</h2>
            <p className="text-slate-500 mb-6">
              O link de recuperação expirou ou é inválido. Solicite um novo.
            </p>
            <Link href="/esqueci-senha" className="btn-primary inline-flex items-center gap-2">
              Solicitar novo link
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 via-white to-slate-100">
        <div className="w-full max-w-md">
          <div className="card p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Icon name="check" className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Senha atualizada!</h2>
            <p className="text-slate-500 mb-6">
              Redirecionando para o dashboard...
            </p>
            <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin mx-auto" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <div className="mb-8">
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mb-4">
              <Icon name="lock" className="w-6 h-6 text-slate-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Nova senha</h2>
            <p className="text-slate-500 mt-2">Digite sua nova senha abaixo</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Nova senha</label>
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
                  minLength={6}
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

            <div>
              <label className="label">Confirmar senha</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <Icon name="lock" className="w-5 h-5" />
                </div>
                <input 
                  className="input pl-12" 
                  type={showPassword ? 'text' : 'password'} 
                  placeholder="••••••••" 
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)} 
                  required 
                />
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
                  Salvando...
                </>
              ) : (
                <>
                  Salvar nova senha
                  <Icon name="check" className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/login" className="text-sm text-slate-500 hover:text-slate-700">
              Voltar ao login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RedefinirSenhaPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 via-white to-slate-100">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
      </div>
    }>
      <RedefinirSenhaInner />
    </Suspense>
  )
}
