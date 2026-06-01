'use client'

import { useState, useEffect, useCallback } from 'react'

type EvaLog = {
  id: string
  created_at: string
  clinic_id: string | null
  phone: string | null
  source: string
  event: string
  status: string
  details: Record<string, unknown> | null
  duration_ms: number | null
  error_message: string | null
  clinics: { name: string } | null
}

const STATUS_COLORS: Record<string, string> = {
  ok:      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  error:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  skipped: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  partial: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

const EVENT_ICONS: Record<string, string> = {
  received:      '📥',
  processed:     '🤖',
  sent:          '📤',
  error:         '❌',
  skipped:       '⏭️',
  followup:      '🔁',
  booking:       '📅',
  reminder_sent: '🔔',
}

const SOURCE_LABELS: Record<string, string> = {
  'webhook':          'Webhook',
  'eva-process':      'Eva (resposta)',
  'cron-followup':    'Follow-up',
  'cron-reminders':   'Lembrete D-1',
  'cron-reminder-2h': 'Lembrete 2h',
  'cron-nps':         'NPS',
  'cron-birthdays':   'Aniversário',
  'cron-recall':      'Recall',
}

export default function EvaLogsPage() {
  const [logs, setLogs] = useState<EvaLog[]>([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    source: '',
    event: '',
    status: '',
    phone: '',
    clinic_id: '',
    dateFrom: '',
    dateTo: '',
  })

  const fetchLogs = useCallback(async () => {
    try {
      const p = new URLSearchParams()
      Object.entries(filters).forEach(([k, v]) => { if (v) p.set(k === 'dateFrom' ? 'date_from' : k === 'dateTo' ? 'date_to' : k, v) })
      p.set('limit', '300')
      const res = await fetch(`/api/admin/eva-logs?${p}`)
      if (res.ok) setLogs(await res.json())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { fetchLogs() }, [fetchLogs])
  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(fetchLogs, 8000)
    return () => clearInterval(id)
  }, [autoRefresh, fetchLogs])

  const stats = {
    total: logs.length,
    ok: logs.filter(l => l.status === 'ok').length,
    error: logs.filter(l => l.status === 'error').length,
    booking: logs.filter(l => l.event === 'booking').length,
    followup: logs.filter(l => l.event === 'followup').length,
  }

  const fmt = (d: string) => new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })

  function setF(key: string, val: string) { setFilters(f => ({ ...f, [key]: val })) }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">🤖 Logs da Eva</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Todas as rotas — webhook, respostas, follow-up, lembretes</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="rounded" />
            Auto (8s)
          </label>
          <button onClick={fetchLogs} className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition">
            ↺ Atualizar
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Total', val: stats.total, cls: 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700' },
          { label: 'OK', val: stats.ok, cls: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' },
          { label: 'Erros', val: stats.error, cls: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' },
          { label: 'Agendamentos', val: stats.booking, cls: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800' },
          { label: 'Follow-ups', val: stats.followup, cls: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
        ].map(s => (
          <div key={s.label} className={`${s.cls} rounded-xl border p-3`}>
            <p className="text-xs text-slate-500 dark:text-slate-400">{s.label}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{s.val}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Origem</label>
            <select value={filters.source} onChange={e => setF('source', e.target.value)} className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm">
              <option value="">Todas</option>
              {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Evento</label>
            <select value={filters.event} onChange={e => setF('event', e.target.value)} className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm">
              <option value="">Todos</option>
              <option value="received">Recebido</option>
              <option value="processed">Processado</option>
              <option value="booking">Agendamento</option>
              <option value="followup">Follow-up</option>
              <option value="reminder_sent">Lembrete</option>
              <option value="skipped">Ignorado</option>
              <option value="error">Erro</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Status</label>
            <select value={filters.status} onChange={e => setF('status', e.target.value)} className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm">
              <option value="">Todos</option>
              <option value="ok">OK</option>
              <option value="error">Erro</option>
              <option value="partial">Parcial</option>
              <option value="skipped">Ignorado</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Telefone</label>
            <input type="text" placeholder="Ex: 34991805722" value={filters.phone} onChange={e => setF('phone', e.target.value)} className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Data início</label>
            <input type="date" value={filters.dateFrom} onChange={e => setF('dateFrom', e.target.value)} className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Data fim</label>
            <input type="date" value={filters.dateTo} onChange={e => setF('dateTo', e.target.value)} className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm" />
          </div>
          <div className="flex items-end">
            <button onClick={() => setFilters({ source: '', event: '', status: '', phone: '', clinic_id: '', dateFrom: '', dateTo: '' })} className="w-full px-2 py-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm transition">
              Limpar
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-slate-400">Nenhum log encontrado</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  {['Data/Hora (BRT)', 'Clínica', 'Telefone', 'Origem', 'Evento', 'Status', 'Duração', 'Detalhe'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {logs.map(log => (
                  <>
                    <tr key={log.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer ${log.status === 'error' ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}
                      onClick={() => setExpanded(expanded === log.id ? null : log.id)}>
                      <td className="px-4 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">{fmt(log.created_at)}</td>
                      <td className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300 max-w-[120px] truncate">
                        {(log.clinics as any)?.name || log.clinic_id?.slice(0, 8) || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-600 dark:text-slate-400">{log.phone || '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">{SOURCE_LABELS[log.source] || log.source}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        <span className="font-medium">{EVENT_ICONS[log.event] || '•'} {log.event}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[log.status] || STATUS_COLORS.skipped}`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {log.duration_ms != null ? `${log.duration_ms}ms` : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px] truncate">
                        {log.error_message
                          ? <span className="text-red-600 dark:text-red-400">{log.error_message}</span>
                          : log.details?.tools_used
                            ? <span className="text-violet-600 dark:text-violet-400">🛠 {(log.details.tools_used as string[]).join(', ')}</span>
                            : log.details?.reason
                              ? <span>{String(log.details.reason)}</span>
                              : '—'}
                      </td>
                    </tr>
                    {expanded === log.id && (
                      <tr key={`${log.id}-detail`} className="bg-slate-50 dark:bg-slate-700/40">
                        <td colSpan={8} className="px-4 py-4">
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                              <p className="font-semibold text-slate-700 dark:text-slate-200 mb-2">Detalhes</p>
                              {log.error_message && (
                                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 mb-3 text-red-700 dark:text-red-300">
                                  <strong>Erro:</strong> {log.error_message}
                                </div>
                              )}
                              <div className="space-y-1 text-slate-600 dark:text-slate-300">
                                <p><strong>ID:</strong> <span className="font-mono">{log.id}</span></p>
                                <p><strong>Clínica ID:</strong> <span className="font-mono">{log.clinic_id || '—'}</span></p>
                                <p><strong>Telefone:</strong> {log.phone || '—'}</p>
                                <p><strong>Duração:</strong> {log.duration_ms != null ? `${log.duration_ms}ms` : '—'}</p>
                              </div>
                            </div>
                            <div>
                              <p className="font-semibold text-slate-700 dark:text-slate-200 mb-2">Payload</p>
                              <pre className="bg-slate-900 dark:bg-slate-950 text-green-400 rounded-lg p-3 overflow-auto max-h-48 text-xs leading-relaxed">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
