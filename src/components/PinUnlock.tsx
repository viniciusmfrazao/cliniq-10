'use client'

import { useCallback, useEffect, useState } from 'react'
import Icon from '@/components/ui/Icon'
import PinKeypad from '@/components/PinKeypad'
import { PIN_LENGTH, PinError, clearPin, pinEmail, unlockPin } from '@/lib/pin-auth'

interface PinUnlockProps {
  /** Volta para o login por email/senha. `message` explica o motivo, quando houver. */
  onFallback: (message?: string) => void
}

export default function PinUnlock({ onFallback }: PinUnlockProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [loading, setLoading] = useState(false)
  const email = pinEmail()

  const submit = useCallback(
    async (value: string) => {
      setLoading(true)
      setError('')
      try {
        // O servidor valida o segredo do aparelho e cria uma sessão nova.
        await unlockPin(value)
        window.location.href = '/dashboard'
      } catch (err) {
        const code = err instanceof PinError ? err.code : 'wrong_pin'

        if (code === 'locked') {
          onFallback('Muitas tentativas. O PIN foi removido — entre com sua senha.')
          return
        }
        if (code === 'no_pin' || code === 'unsupported') {
          onFallback()
          return
        }
        if (code === 'device_rejected') {
          onFallback('Este aparelho não está mais autorizado. Entre com sua senha.')
          return
        }
        if (code === 'network') {
          // PIN certo, rede fora: não penaliza tentativas nem apaga o PIN.
          setError('Sem conexão. Tente de novo.')
          setPin('')
          setLoading(false)
          return
        }

        const left = err instanceof PinError ? err.message : ''
        setError(
          left && left !== 'wrong_pin'
            ? `PIN incorreto. ${left} tentativa${left === '1' ? '' : 's'} restante${left === '1' ? '' : 's'}.`
            : 'PIN incorreto.'
        )
        setPin('')
        setShake(true)
        setLoading(false)
        try {
          navigator.vibrate?.([0, 40, 60, 40])
        } catch {}
      }
    },
    [onFallback]
  )

  // Envia sozinho ao completar os 6 dígitos
  useEffect(() => {
    if (pin.length === PIN_LENGTH && !loading) void submit(pin)
  }, [pin, loading, submit])

  useEffect(() => {
    if (!shake) return
    const t = setTimeout(() => setShake(false), 400)
    return () => clearTimeout(t)
  }, [shake])

  function handleForgot() {
    clearPin()
    onFallback('PIN removido. Entre com sua senha para cadastrar um novo.')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8 bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
      <div className="w-full max-w-sm text-center">
        <img
          src="/logo.svg"
          alt="Clinike"
          className="w-16 h-16 rounded-2xl mx-auto mb-5 shadow-xl"
        />
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Digite seu PIN</h1>
        {email && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 truncate">{email}</p>
        )}

        <div className="mt-10">
          <PinKeypad value={pin} onChange={setPin} disabled={loading} shake={shake} />
        </div>

        <div className="h-12 mt-6 flex items-center justify-center">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <div className="w-4 h-4 border-2 border-slate-300 border-t-violet-600 rounded-full animate-spin" />
              Entrando...
            </div>
          )}
          {!loading && error && (
            <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => onFallback()}
            className="text-sm font-medium text-slate-600 dark:text-slate-300 flex items-center justify-center gap-2"
          >
            <Icon name="lock" className="w-4 h-4" />
            Entrar com senha
          </button>
          <button
            type="button"
            onClick={handleForgot}
            className="text-sm text-slate-400 dark:text-slate-500"
          >
            Esqueci meu PIN
          </button>
        </div>
      </div>
    </div>
  )
}
