'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'

function slugify(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const FEATURES = [
  { icon: 'calendar', text: 'Agenda inteligente' },
  { icon: 'users', text: 'Gestao de pacientes' },
  { icon: 'syringe', text: 'Mapa de injetaveis' },
  { icon: 'sparkles', text: 'Eva IA assistente' },
]

export default function CadastroPage() {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState({ clinicName: '', name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const update = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email, 
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        }
      })

      if (authError) {
        setError(authError.message)
        setLoading(false)
        return
      }

      if (!authData.user) {
        setError('Erro ao criar usuario. Tente novamente.')
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
        console.error('Erro RPC:', fnError)
        setError(`Erro ao criar clinica: ${fnError.message}`)
        setLoading(false)
        return
      }

      if (authData.session) {
        router.push('/dashboard?welcome=1')
        router.refresh()
      } else {
        setError('Verifique seu email para confirmar a conta.')
        setLoading(false)
      }
    } catch (err) {
      console.error('Erro:', err)
      setError('Erro inesperado. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 flex relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse-soft" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse-soft" style={{ animationDelay: '1s' }} />

      {/* Left Panel - Features (hidden on mobile) */}
      <div className="hidden lg:flex flex-col justify-center flex-1 px-16 relative">
        <div className="max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 gradient-bg rounded-2xl mb-6 shadow-xl shadow-purple-200">
            <span className="text-white text-2xl font-bold">C</span>
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            A gestao que sua <span className="gradient-text">clinica merece</span>
          </h1>
          <p className="text-lg text-slate-600 mb-8">
            Simplifique sua rotina com a plataforma mais completa para clinicas de estetica.
          </p>
          <div className="grid grid-cols-2 gap-4">
            {FEATURES.map(f => (
              <div key={f.text} className="flex items-center gap-3 p-4 bg-white/60 backdrop-blur-sm rounded-xl border border-white/80">
                <div className="w-10 h-10 gradient-bg rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon name={f.icon} className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-medium text-slate-700">{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 gradient-bg rounded-2xl mb-3 shadow-xl shadow-purple-200">
              <span className="text-white text-xl font-bold">C</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Clinike</h1>
          </div>

          <div className="card p-6 shadow-xl">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900">Criar conta</h2>
              <div className="flex items-center gap-2 mt-2">
                <div className="px-3 py-1 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full">
                  <span className="text-xs font-semibold gradient-text">14 dias gratis</span>
                </div>
                <span className="text-xs text-slate-400">Sem cartao de credito</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Nome da clinica</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Icon name="briefcase" className="w-5 h-5" />
                  </div>
                  <input 
                    className="input pl-11" 
                    type="text" 
                    placeholder="Clinica Bella" 
                    value={form.clinicName} 
                    onChange={e => update('clinicName', e.target.value)} 
                    required 
                  />
                </div>
              </div>
              <div>
                <label className="label">Seu nome</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Icon name="user" className="w-5 h-5" />
                  </div>
                  <input 
                    className="input pl-11" 
                    type="text" 
                    placeholder="Dra. Ana Silva" 
                    value={form.name} 
                    onChange={e => update('name', e.target.value)} 
                    required 
                  />
                </div>
              </div>
              <div>
                <label className="label">Email</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Icon name="mail" className="w-5 h-5" />
                  </div>
                  <input 
                    className="input pl-11" 
                    type="email" 
                    placeholder="dra@clinica.com" 
                    value={form.email} 
                    onChange={e => update('email', e.target.value)} 
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
                    placeholder="Minimo 8 caracteres" 
                    value={form.password} 
                    onChange={e => update('password', e.target.value)} 
                    required 
                    minLength={8} 
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
                <div className={`flex items-center gap-2 text-sm rounded-xl px-4 py-3 ${
                  error.includes('Verifique') 
                    ? 'text-blue-600 bg-blue-50 border border-blue-100' 
                    : 'text-red-600 bg-red-50 border border-red-100'
                }`}>
                  <Icon name={error.includes('Verifique') ? 'mail' : 'x'} className="w-4 h-4 flex-shrink-0" />
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
                    Criando sua conta...
                  </>
                ) : (
                  <>
                    <Icon name="sparkles" className="w-4 h-4" />
                    Comecar gratuitamente
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-100 text-center">
              <span className="text-sm text-slate-500">Ja tem conta? </span>
              <Link href="/login" className="text-sm font-semibold gradient-text hover:opacity-80">
                Fazer login
              </Link>
            </div>
          </div>

          <p className="text-center text-xs text-slate-400 mt-6">
            Ao criar sua conta voce concorda com os <a href="#" className="underline">Termos de Uso</a> e <a href="#" className="underline">Politica de Privacidade</a>.
          </p>
        </div>
      </div>
    </div>
  )
}
