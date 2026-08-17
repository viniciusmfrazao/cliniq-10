'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useToast } from '@/components/ui/Toast'
import PinSetup from '@/components/PinSetup'
import { createClient } from '@/lib/supabase/client'
import { clearPin, isMobileDevice, isPinSupported, pinDeviceId, readPinRecord } from '@/lib/pin-auth'

export default function SegurancaPage() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [createdAt, setCreatedAt] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)


  const refresh = useCallback(() => {
    const record = readPinRecord()
    setEnabled(!!record)
    setCreatedAt(record?.createdAt ?? null)
  }, [])

  useEffect(() => {
    async function load() {
      refresh()
      setLoading(false)
    }
    void load()
  }, [refresh])

  async function handleRemove() {
    // Revoga o aparelho no servidor também: sem isso o segredo continuaria
    // válido se alguém tivesse copiado o localStorage.
    const deviceId = pinDeviceId()
    if (deviceId) {
      try {
        await createClient().from('pin_devices').delete().eq('id', deviceId)
      } catch {}
    }
    clearPin()
    refresh()
    setEditing(false)
    toast.success('PIN removido deste aparelho')
  }

  function handleDone() {
    refresh()
    setEditing(false)
    toast.success('PIN salvo com sucesso')
  }

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
        >
          <Icon name="chevronLeft" className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">PIN de acesso</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Entre sem digitar email e senha toda vez
          </p>
        </div>
      </div>

      {!isPinSupported() && (
        <div className="card p-6 bg-amber-50 border border-amber-200">
          <p className="text-sm text-amber-800">
            Este navegador não suporta o PIN. Ele exige conexão segura (https).
          </p>
        </div>
      )}

      {isPinSupported() && isMobileDevice() && editing && (
        <div className="card p-6">
          <PinSetup
            onDone={handleDone}
            onSkip={() => setEditing(false)}
            skipLabel="Cancelar"
          />
        </div>
      )}

      {isPinSupported() && !isMobileDevice() && (
        <div className="card p-6">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            O PIN funciona no celular e no tablet. Aqui no computador o acesso continua por email
            e senha — abra o Clinike no celular para cadastrar.
          </p>
          {enabled && (
            <button type="button" onClick={handleRemove} className="btn btn-primary mt-4">
              Remover o PIN deste computador
            </button>
          )}
        </div>
      )}

      {isPinSupported() && isMobileDevice() && !editing && (
        <div className="card p-6">
          <div className="flex items-start gap-4">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shadow ${
                enabled
                  ? 'bg-gradient-to-br from-violet-500 to-indigo-500'
                  : 'bg-slate-200 dark:bg-slate-700'
              }`}
            >
              <Icon
                name={enabled ? 'lock' : 'unlock'}
                className={`w-5 h-5 ${enabled ? 'text-white' : 'text-slate-500'}`}
              />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-900 dark:text-white">
                {enabled ? 'PIN ativo neste aparelho' : 'PIN não configurado'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {enabled && createdAt
                  ? `Cadastrado em ${new Date(createdAt).toLocaleDateString('pt-BR')}`
                  : 'Cadastre 6 dígitos para entrar mais rápido'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-6">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="btn btn-primary"
            >
              {enabled ? 'Trocar PIN' : 'Criar PIN'}
            </button>
            {enabled && (
              <button
                type="button"
                onClick={handleRemove}
                className="btn bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
              >
                Remover PIN
              </button>
            )}
          </div>
        </div>
      )}

      <div className="card p-6 bg-slate-50 dark:bg-slate-800/50">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
          Como funciona
        </h2>
        <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-2 leading-relaxed">
          <li>• O PIN vale só neste aparelho e não substitui sua senha.</li>
          <li>• Ele não é guardado em lugar nenhum — nem aqui, nem no servidor.</li>
          <li>• Esqueceu? Toque em &quot;Esqueci meu PIN&quot; e entre com a senha.</li>
          <li>• Após 5 erros o PIN é apagado automaticamente.</li>
          <li>• Ao sair da conta o PIN é removido deste aparelho.</li>
        </ul>
      </div>
    </div>
  )
}
