'use client'

import { useEffect, useState, useCallback } from 'react'

type Followup = {
  id: string
  lead_id: string
  scheduled_at: string
  type: string
  note: string | null
  lead: { id: string; name: string; phone: string; status: string } | null
}

export default function FollowupAlertBadge() {
  const [followups, setFollowups] = useState<Followup[]>([])
  const [open, setOpen] = useState(false)
  const [completing, setCompleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const resp = await fetch('/api/crm/followups?today=true')
      const data = await resp.json()
      setFollowups(data.data || [])
    } catch {}
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 60_000) // atualiza a cada minuto
    return () => clearInterval(interval)
  }, [load])

  async function handleComplete(id: string) {
    setCompleting(id)
    try {
      await fetch('/api/crm/followups', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      await load()
    } finally {
      setCompleting(null)
    }
  }

  const typeIcon = (type: string) => {
    if (type === 'whatsapp') return '💬'
    if (type === 'call') return '📞'
    if (type === 'email') return '📧'
    return '📌'
  }

  const isOverdue = (scheduledAt: string) => new Date(scheduledAt) < new Date()

  if (followups.length === 0) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition"
      >
        🔔 Follow-ups
        <span className="bg-white text-amber-600 rounded-full text-xs font-bold px-1.5 py-0.5 min-w-[20px] text-center">
          {followups.length}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
              <p className="font-semibold text-slate-800 dark:text-white text-sm">Follow-ups de hoje</p>
              <p className="text-xs text-slate-400">{followups.length} pendente{followups.length > 1 ? 's' : ''}</p>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
              {followups.map(f => (
                <div key={f.id} className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-sm">{typeIcon(f.type)}</span>
                        <span className="text-sm font-medium text-slate-800 dark:text-white truncate">
                          {f.lead?.name || 'Lead'}
                        </span>
                        {isOverdue(f.scheduled_at) && (
                          <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">atrasado</span>
                        )}
                      </div>
                      {f.note && <p className="text-xs text-slate-500 truncate">{f.note}</p>}
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(f.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}
                      </p>
                    </div>
                    <button
                      onClick={() => handleComplete(f.id)}
                      disabled={completing === f.id}
                      className="text-xs px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg font-medium transition whitespace-nowrap"
                    >
                      {completing === f.id ? '...' : '✓ Feito'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700">
              <a href="/dashboard/crm" onClick={() => setOpen(false)}
                className="text-xs text-violet-600 hover:text-violet-700 font-medium">
                Ver todos no CRM →
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
