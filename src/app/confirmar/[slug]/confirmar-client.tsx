'use client'

import { useState } from 'react'

type Props = {
  slug: string
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
  slug,
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
  const clinicInitial = (clinicName.trim()[0] || 'C').toUpperCase()

  async function handleConfirm() {
    setLoading(true)
    setError('')
    try {
      const r = await fetch(`/api/confirmar/${slug}`, { method: 'POST' })
      if (r.ok) {
        setConfirmed(true)
      } else {
        const d = await r.json().catch(() => ({}))
        setError(d.error || 'Não foi possível confirmar. Tente novamente.')
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const DetailRow = ({ icon, label }: { icon: string; label: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0' }}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        {icon === 'calendar' && <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>}
        {icon === 'clock' && <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>}
        {icon === 'sparkles' && <path d="M12 3l1.9 5.8L19.5 10l-5.6 1.2L12 17l-1.9-5.8L4.5 10l5.6-1.2z" />}
        {icon === 'user' && <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>}
      </svg>
      <span style={{ fontSize: 14.5, color: '#2C2A3A', fontWeight: 500, textTransform: 'capitalize' }}>{label}</span>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #F5F3FF 0%, #FFFFFF 55%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ background: '#FFFFFF', borderRadius: 24, border: '1px solid #EFEAFE', overflow: 'hidden', boxShadow: '0 10px 40px rgba(124,58,237,0.10)' }}>

          {/* Header roxo */}
          <div style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)', padding: '28px 24px 24px', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 24, fontWeight: 600, color: '#FFFFFF' }}>
              {clinicInitial}
            </div>
            <p style={{ margin: 0, color: '#FFFFFF', fontSize: 17, fontWeight: 600 }}>{clinicName}</p>
            <p style={{ margin: '4px 0 0', color: '#E9D5FF', fontSize: 13 }}>Confirmação de presença</p>
          </div>

          <div style={{ padding: 24 }}>
            {isCancelled ? (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </div>
                <p style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 600, color: '#1E1B2E' }}>Agendamento cancelado</p>
                <p style={{ margin: 0, fontSize: 14, color: '#6B6880' }}>Este agendamento não está mais ativo. Em caso de dúvida, entre em contato com a clínica.</p>
              </div>
            ) : confirmed ? (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                </div>
                <p style={{ margin: '0 0 6px', fontSize: 21, fontWeight: 600, color: '#1E1B2E' }}>Presença confirmada! 🎉</p>
                <p style={{ margin: '0 0 20px', fontSize: 14.5, color: '#6B6880', lineHeight: 1.5 }}>Que ótimo, {firstName}! Já deixamos tudo pronto pra te receber.</p>
                <div style={{ background: '#F5F3FF', borderRadius: 16, padding: '16px 18px', textAlign: 'left' }}>
                  <DetailRow icon="calendar" label={dateLabel} />
                  <DetailRow icon="clock" label={`às ${timeLabel}`} />
                  {procedureName && <DetailRow icon="sparkles" label={procedureName} />}
                  {professionalName && <DetailRow icon="user" label={professionalName} />}
                </div>
              </div>
            ) : (
              <>
                <p style={{ margin: '0 0 4px', fontSize: 19, fontWeight: 600, color: '#1E1B2E' }}>Olá, {firstName}! 👋</p>
                <p style={{ margin: '0 0 20px', fontSize: 14.5, color: '#6B6880', lineHeight: 1.5 }}>Confirme sua presença no agendamento abaixo.</p>

                <div style={{ background: '#F5F3FF', borderRadius: 16, padding: '16px 18px', marginBottom: 22 }}>
                  <DetailRow icon="calendar" label={dateLabel} />
                  <DetailRow icon="clock" label={`às ${timeLabel}`} />
                  {procedureName && <DetailRow icon="sparkles" label={procedureName} />}
                  {professionalName && <DetailRow icon="user" label={professionalName} />}
                </div>

                {error && (
                  <p style={{ fontSize: 13, color: '#EF4444', textAlign: 'center', margin: '0 0 14px' }}>{error}</p>
                )}

                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  style={{ width: '100%', padding: 15, background: loading ? '#6EE7B7' : '#10B981', color: '#FFFFFF', fontSize: 15, fontWeight: 600, border: 'none', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: loading ? 'default' : 'pointer', boxShadow: '0 4px 14px rgba(16,185,129,0.30)', transition: 'background 0.15s' }}
                >
                  {loading ? (
                    <span style={{ width: 20, height: 20, border: '2.5px solid rgba(255,255,255,0.4)', borderTopColor: '#FFFFFF', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                  ) : (
                    <>
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                      Confirmar presença
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11.5, color: '#A8A4C0', margin: '16px 0 0' }}>Powered by Clinike</p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
