'use client'

import { useState } from 'react'

type Props = {
  token: string
  alreadyConfirmed: boolean
  isCancelled: boolean
  patientName: string
  clinicName: string
  procedureName: string
  professionalName: string
  dateLabel: string
  timeLabel: string
}

export default function ConfirmarClient({
  token,
  alreadyConfirmed,
  isCancelled,
  patientName,
  clinicName,
  procedureName,
  professionalName,
  dateLabel,
  timeLabel,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(alreadyConfirmed)
  const [error, setError] = useState('')

  const firstName = patientName.trim().split(/\s+/)[0] || 'Olá'

  async function handleConfirm() {
    setLoading(true)
    setError('')
    try {
      const r = await fetch(`/api/confirmar/${token}`, { method: 'POST' })
      if (r.ok) {
        setConfirmed(true)
      } else {
        const d = await r.json()
        setError(d.error || 'Erro ao confirmar. Tente novamente.')
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 to-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo / clínica */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm text-slate-500 font-medium">{clinicName}</p>
        </div>

        {/* Card principal */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6">

          {isCancelled ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="text-lg font-bold text-slate-800 mb-1">Agendamento cancelado</h1>
              <p className="text-sm text-slate-500">Este agendamento não está mais ativo.</p>
            </div>

          ) : confirmed ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-slate-800 mb-1">Confirmado! 🎉</h1>
              <p className="text-sm text-slate-500 mb-5">
                Ótimo, {firstName}! Te esperamos.
              </p>
              <div className="bg-slate-50 rounded-2xl p-4 text-left space-y-2.5">
                <Row icon="📅" label={dateLabel} />
                <Row icon="🕐" label={`às ${timeLabel}`} />
                {procedureName && <Row icon="✨" label={procedureName} />}
                {professionalName && <Row icon="👩‍⚕️" label={professionalName} />}
              </div>
            </div>

          ) : (
            <>
              <h1 className="text-lg font-bold text-slate-800 mb-1">
                Olá, {firstName}! 👋
              </h1>
              <p className="text-sm text-slate-500 mb-5">
                Confirme sua presença no agendamento abaixo.
              </p>

              <div className="bg-slate-50 rounded-2xl p-4 mb-6 space-y-2.5">
                <Row icon="📅" label={dateLabel} />
                <Row icon="🕐" label={`às ${timeLabel}`} />
                {procedureName && <Row icon="✨" label={procedureName} />}
                {professionalName && <Row icon="👩‍⚕️" label={professionalName} />}
              </div>

              {error && (
                <p className="text-xs text-red-500 mb-3 text-center">{error}</p>
              )}

              <button
                onClick={handleConfirm}
                disabled={loading}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold text-base rounded-2xl transition-all shadow-md shadow-emerald-200 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    Confirmar presença
                  </>
                )}
              </button>
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Powered by Clinike
        </p>
      </div>
    </div>
  )
}

function Row({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-base">{icon}</span>
      <span className="text-sm text-slate-700 font-medium capitalize">{label}</span>
    </div>
  )
}
