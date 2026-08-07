'use client'

import { useEffect, useState } from 'react'

type ImpersonationInfo = {
  superAdminEmail: string
  targetUserName: string
  targetClinicName: string
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

export default function ImpersonationBanner() {
  const [info, setInfo] = useState<ImpersonationInfo | null>(null)
  const [stopping, setStopping] = useState(false)

  useEffect(() => {
    const raw = readCookie('clinike-impersonating')
    if (!raw) return
    try {
      setInfo(JSON.parse(raw))
    } catch {
      setInfo(null)
    }
  }, [])

  if (!info) return null

  async function handleStop() {
    setStopping(true)
    try {
      const resp = await fetch('/api/admin/impersonate/stop', { method: 'POST' })
      if (resp.ok) {
        window.location.href = '/admin/clinics'
      } else {
        alert('Erro ao voltar pro admin')
        setStopping(false)
      }
    } catch {
      alert('Erro ao voltar pro admin')
      setStopping(false)
    }
  }

  return (
    <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between gap-3 flex-wrap text-sm">
      <span>
        🔓 Acessando como <strong>{info.targetUserName}</strong> · {info.targetClinicName}
      </span>
      <button
        onClick={handleStop}
        disabled={stopping}
        className="bg-white/20 hover:bg-white/30 disabled:opacity-50 px-3 py-1 rounded-lg font-medium transition"
      >
        {stopping ? 'Voltando...' : '← Voltar pro admin'}
      </button>
    </div>
  )
}
