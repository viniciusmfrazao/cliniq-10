'use client'

import { useState, useTransition } from 'react'
import Icon from '@/components/ui/Icon'

type Props = {
  leadId: string
  leadName: string
  onClose: () => void
  onScheduled: () => void
}

export default function FollowupModal({ leadId, leadName, onClose, onScheduled }: Props) {
  const [saving, startSaving] = useTransition()
  const [error, setError] = useState('')

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  const nowPlus1h = new Date(Date.now() + 60 * 60 * 1000)
  const defaultTime = nowPlus1h.toLocaleTimeString('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  })

  const [date, setDate] = useState(today)
  const [time, setTime] = useState(defaultTime)
  const [note, setNote] = useState('')

  function handleSubmit() {
    if (!date || !time) { setError('Selecione data e horário.'); return }
    setError('')

    startSaving(async () => {
      const scheduledAt = `${date}T${time}:00-03:00`
      try {
        const res = await fetch('/api/crm/followups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_id: leadId,
            scheduled_at: scheduledAt,
            type: 'whatsapp',
            note: note.trim() || null,
          }),
        })
        const json = await res.json()
        if (!res.ok) {
          setError(json.error || 'Erro ao agendar follow-up.')
          return
        }
        onScheduled()
        onClose()
      } catch {
        setError('Erro ao agendar follow-up.')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Agendar follow-up</h2>
            {leadName && <p className="text-xs text-slate-500 mt-0.5">{leadName}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Data *</label>
              <input
                type="date"
                className="input"
                value={date}
                min={today}
                onChange={e => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Horário *</label>
              <input
                type="time"
                className="input"
                value={time}
                onChange={e => setTime(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Observação</label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Ex: retornar sobre orçamento, confirmar interesse..."
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>

          <p className="text-xs text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2">
            A Eva fica pausada nessa conversa até o horário do follow-up. Você recebe um lembrete quando chegar a hora.
          </p>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>
          )}

          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? 'Agendando...' : 'Confirmar follow-up'}
          </button>
        </div>
      </div>
    </div>
  )
}
