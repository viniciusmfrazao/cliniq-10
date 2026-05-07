'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'

type LogRow = {
  id: string
  patient_id: string
  sent_at: string
  last_visit_at: string | null
  days_inactive: number | null
  procedure_name: string | null
  status: 'sent' | 'error' | 'skipped' | 'test'
  error: string | null
  message: string | null
}

type PatientLite = { id: string; name: string; phone: string | null }

const STATUS_BADGE: Record<LogRow['status'], { label: string; classes: string }> = {
  sent: { label: 'Enviada', classes: 'bg-emerald-100 text-emerald-700' },
  error: { label: 'Erro', classes: 'bg-rose-100 text-rose-700' },
  skipped: { label: 'Pendente', classes: 'bg-amber-100 text-amber-700' },
  test: { label: 'Teste', classes: 'bg-blue-100 text-blue-700' },
}

export default function RecallHistory({ clinicId }: { clinicId: string }) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<LogRow[]>([])
  const [patients, setPatients] = useState<Record<string, PatientLite>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: logs, error: logsErr } = await supabase
        .from('recall_messages_log')
        .select(
          'id, patient_id, sent_at, last_visit_at, days_inactive, procedure_name, status, error, message',
        )
        .eq('clinic_id', clinicId)
        .order('sent_at', { ascending: false })
        .limit(30)

      if (logsErr) {
        // tabela pode não existir ainda (SQL não rodado)
        if (/recall_messages_log/i.test(logsErr.message)) {
          setError(
            'A tabela recall_messages_log ainda não foi criada. Rode o arquivo supabase-recall-automation.sql no SQL Editor.',
          )
        } else {
          setError(logsErr.message)
        }
        setRows([])
        return
      }

      const list = (logs as LogRow[] | null) ?? []
      setRows(list)

      const ids = Array.from(new Set(list.map((l) => l.patient_id)))
      if (ids.length > 0) {
        const { data: pats } = await supabase
          .from('patients')
          .select('id, name, phone')
          .in('id', ids)
        const map: Record<string, PatientLite> = {}
        for (const p of (pats as PatientLite[] | null) ?? []) {
          map[p.id] = p
        }
        setPatients(map)
      }
    } finally {
      setLoading(false)
    }
  }, [clinicId, supabase])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full p-5 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
          <Icon name="clock" className="w-5 h-5 text-slate-600" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-slate-900">Histórico de recall</p>
          <p className="text-sm text-slate-500">Últimos pacientes contatados pra voltar</p>
        </div>
        <Icon
          name="chevronRight"
          className={`w-5 h-5 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </button>

      {open && (
        <div className="border-t border-slate-100">
          {loading ? (
            <div className="p-8 text-center">
              <Icon name="loader" className="w-6 h-6 text-slate-400 animate-spin mx-auto" />
            </div>
          ) : error ? (
            <div className="p-6 bg-amber-50 border-t border-amber-200">
              <p className="text-sm text-amber-800">{error}</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-slate-500">
                Nenhum recall ainda. O primeiro envio acontece amanhã às 10h se houver paciente
                inativo.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {rows.map((row) => {
                const badge = STATUS_BADGE[row.status]
                const patient = patients[row.patient_id]
                return (
                  <div key={row.id} className="p-4 hover:bg-slate-50">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-slate-900 truncate">
                            {patient?.name || `(paciente ${row.patient_id.slice(0, 8)})`}
                          </p>
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badge.classes}`}
                          >
                            {badge.label}
                          </span>
                          <span className="text-xs text-slate-400">
                            {new Date(row.sent_at).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Última visita:{' '}
                          {row.last_visit_at
                            ? new Date(row.last_visit_at).toLocaleDateString('pt-BR', {
                                timeZone: 'America/Sao_Paulo',
                              })
                            : '—'}
                          {row.days_inactive != null && <> · {row.days_inactive} dias atrás</>}
                          {row.procedure_name && <> · {row.procedure_name}</>}
                        </p>
                        {patient?.phone && (
                          <p className="text-xs text-slate-400 mt-0.5">{patient.phone}</p>
                        )}
                        {row.error && (
                          <p className="text-xs text-rose-600 mt-1 break-words">
                            Erro: {row.error}
                          </p>
                        )}
                        {row.message && row.status === 'sent' && (
                          <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                            “{row.message}”
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
