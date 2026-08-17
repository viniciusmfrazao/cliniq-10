'use client'

import { useEffect, useState } from 'react'
import Icon from '@/components/ui/Icon'
import PinKeypad from '@/components/PinKeypad'
import { PIN_LENGTH, setupPin } from '@/lib/pin-auth'

interface PinSetupProps {
  email: string
  refreshToken: string
  onDone: () => void
  /** Quando ausente, o botão "Agora não" não aparece (ex.: tela de configurações) */
  onSkip?: () => void
  skipLabel?: string
}

/** PINs óbvios demais — bloqueados na criação. */
function isWeak(pin: string): boolean {
  if (/^(\d)\1+$/.test(pin)) return true // 111111
  const asc = '0123456789'
  const desc = '9876543210'
  return asc.includes(pin) || desc.includes(pin) // 123456 / 654321
}

export default function PinSetup({
  email,
  refreshToken,
  onDone,
  onSkip,
  skipLabel = 'Agora não',
}: PinSetupProps) {
  const [step, setStep] = useState<'create' | 'confirm'>('create')
  const [first, setFirst] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (pin.length !== PIN_LENGTH || saving) return

    if (step === 'create') {
      if (isWeak(pin)) {
        setError('Evite sequências ou dígitos repetidos.')
        setPin('')
        setShake(true)
        return
      }
      setFirst(pin)
      setPin('')
      setError('')
      setStep('confirm')
      return
    }

    if (pin !== first) {
      setError('Os PINs não conferem. Vamos começar de novo.')
      setFirst('')
      setPin('')
      setShake(true)
      setStep('create')
      return
    }

    setSaving(true)
    setupPin(pin, email, refreshToken)
      .then(onDone)
      .catch(() => {
        setError('Não foi possível salvar o PIN neste aparelho.')
        setSaving(false)
        setPin('')
        setFirst('')
        setStep('create')
      })
  }, [pin, step, first, saving, email, refreshToken, onDone])

  useEffect(() => {
    if (!shake) return
    const t = setTimeout(() => setShake(false), 400)
    return () => clearTimeout(t)
  }, [shake])

  return (
    <div className="w-full max-w-sm mx-auto text-center">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shadow-lg mx-auto mb-5">
        <Icon name="lock" className="w-7 h-7 text-white" />
      </div>

      <h2 className="text-xl font-black text-slate-900 dark:text-white">
        {step === 'create' ? 'Crie um PIN de acesso' : 'Repita o PIN'}
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
        {step === 'create'
          ? 'Assim você entra sem digitar email e senha toda vez.'
          : 'Só para confirmar que não errou nenhum dígito.'}
      </p>

      <div className="mt-8">
        <PinKeypad value={pin} onChange={setPin} disabled={saving} shake={shake} />
      </div>

      <div className="h-10 mt-5 flex items-center justify-center">
        {saving && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <div className="w-4 h-4 border-2 border-slate-300 border-t-violet-600 rounded-full animate-spin" />
            Salvando...
          </div>
        )}
        {!saving && error && (
          <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>

      {onSkip && !saving && (
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-2"
        >
          {skipLabel}
        </button>
      )}

      <p className="text-[11px] leading-relaxed text-slate-400 dark:text-slate-500 mt-6">
        O PIN vale só neste aparelho e não substitui sua senha. Se esquecer, é só entrar com a senha
        e cadastrar outro.
      </p>
    </div>
  )
}
