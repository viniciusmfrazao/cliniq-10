'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'

type LogRow = {
  id: string
  patient_id: string
  appointment_id: string | null
  professional_id: string | null
  procedure_name: string | null
  sent_at: string
  replied_at: string | null
  score: number | null
  comment: string | null
  status: 'sent' | 'error' | 'skipped' | 'test' | 'replied'
  error: string | null
  message: string | null
}

type PatientLite = { id: string; name: string; phone: string | null }
type UserLite = { id: string; name: string }

const STATUS_BADGE: Record<LogRow['status'], { label: string; classes: string }> = {
  sent: { label: 'Enviada', classes: 'bg-emerald-100 text-emerald-700' },
  replied: { label: 'Respondida', classes: 'bg-blue-100 text-blue-700' },
  error: { label: 'Erro', classes: 'bg-rose-100 text-rose-700' },
  skipped: { label: 'Pendente', classes: 'bg-amber-100 text-amber-700' },
  test: { label: 'Teste', classes: 'bg-slate-100 text-slate-700' },
}

function scoreEmoji(score: number | null): string {
  if (score == null) return ''
  if (score >= 5) return '🤩'
  if (score >= 4) return '🙂'
  if (score >= 3) return '😐'
  if (score >= 2) return '😕'
  return '😞'
}

function scoreLabel(score: number | null): string {
  if (score == null) return ''
  return ['Péssimo', 'Ruim', 'Regular', 'Bom', 'Excelente'][score - 1] || ''
}

function npsCategory(score: number): 'promotor' | 'neutro' | 'detrator' {
  // Adaptado pra escala 1-5: 5 = promotor, 4 = neutro, 1-3 = detrator
  if (score >= 5) return 'promotor'
  if (score >= 4) return 'neutro'
  return 'detrator'
}

export default function NpsHistory({ clinicId }: { clinicId: string }) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<LogRow[]>([])
  const [patients, setPatients] = useState<Record<string, PatientLite>>({})
  const [profs, setProfs] = useState<Record<string, UserLite>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: logs, error: logsErr } = await supabase
        .from('nps_responses')
        .select(
          'id, patient_id, appointment_id, professional_id, procedure_name, sent_at, replied_at, score, comment, status, error, message',
        )
        .eq('clinic_id', clinicId)
        .order('sent_at', { ascending: false })
        .limit(50)

      if (logsErr) {
        if (/nps_responses/i.test(logsErr.message)) {
          setError(
            'A tabela nps_responses ainda não foi criada. Rode o arquivo supabase-nps-automation.sql no SQL Editor.',
          )
        } else {
          setError(logsErr.message)
        }
        setRows([])
        return
      }

      const list = (logs as LogRow[] | null) ?? []
      setRows(list)

      const patientIds = Array.from(new Set(list.map((l) => l.patient_id)))
      const profIds = Array.from(
        new Set(list.map((l) => l.professional_id).filter(Boolean) as string[]),
      )

      if (patientIds.length > 0) {
        const { data: pats } = await supabase
          .from('patients')
          .select('id, name, phone')
          .in('id', patientIds)
        const map: Record<string, PatientLite> = {}
        for (const p of (pats as PatientLite[] | null) ?? []) {
          map[p.id] = p
        }
        setPatients(map)
      }

      if (profIds.length > 0) {
        const { data: us } = await supabase.from('users').select('id, name').in('id', profIds)
        const map: Record<string, UserLite> = {}
        for (const u of (us as UserLite[] | null) ?? []) {
          map[u.id] = u
        }
        setProfs(map)
      }
    } finally {
      setLoading(false)
    }
  }, [clinicId, supabase])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  const stats = useMemo(() => {
    const replied = rows.filter((r) => r.score != null && r.score >= 1 && r.score <= 5)
    const totalSent = rows.filter((r) => ['sent', 'replied'].includes(r.status)).length
    const totalReplied = replied.length
    const avg =
      replied.length > 0 ? replied.reduce((s, r) => s + (r.score ?? 0), 0) / replied.length : null
    const promotores = replied.filter((r) => npsCategory(r.score!) === 'promotor').length
    const neutros = replied.filter((r) => npsCategory(r.score!) === 'neutro').length
    const detratores = replied.filter((r) => npsCategory(r.score!) === 'detrator').length
    return {
      totalSent,
      totalReplied,
      replyRate: totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0,
      avg,
      promotores,
      neutros,
      detratores,
    }
  }, [rows])

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full p-5 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
          <Icon name="star" className="w-5 h-5 text-slate-600" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-slate-900">Histórico de NPS</p>
          <p className="text-sm text-slate-500">
            Avaliações dos últimos atendimentos
            {stats.avg != null && (
              <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-semibold">
                Média {stats.avg.toFixed(1)} ⭐
              </span>
            )}
          </p>
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
                Nenhum NPS ainda. O primeiro envio acontece amanhã às 11h se houver atendimento
                concluído hoje.
              </p>
            </div>
          ) : (
            <>
              {/* Stats card */}
              <div className="p-5 bg-gradient-to-br from-slate-50 to-emerald-50 border-b border-slate-100">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">
                      Enviadas
                    </p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{stats.totalSent}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">
                      Respostas
                    </p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">
                      {stats.totalReplied}
                      <span className="text-sm text-slate-500 ml-1">({stats.replyRate}%)</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">
                      Média
                    </p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">
                      {stats.avg != null ? `${stats.avg.toFixed(1)} ⭐` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">
                      Distribuição
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-sm">
                      <span className="text-emerald-700 font-semibold">
                        {stats.promotores}🤩
                      </span>
                      <span className="text-amber-700 font-semibold">{stats.neutros}🙂</span>
                      <span className="text-rose-700 font-semibold">{stats.detratores}😞</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lista */}
              <div className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const badge = STATUS_BADGE[row.status]
                  const patient = patients[row.patient_id]
                  const prof = row.professional_id ? profs[row.professional_id] : null
                  const hasScore = row.score != null && row.score >= 1 && row.score <= 5
                  return (
                    <div key={row.id} className="p-4 hover:bg-slate-50">
                      <div className="flex items-start gap-3">
                        {hasScore ? (
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center flex-shrink-0 shadow-md">
                            <span className="text-xl font-bold">{row.score}</span>
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center flex-shrink-0">
                            <span className="text-lg">—</span>
                          </div>
                        )}
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
                            {hasScore && (
                              <span className="text-xs text-slate-600 font-medium">
                                {scoreEmoji(row.score)} {scoreLabel(row.score)}
                              </span>
                            )}
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
                            {row.procedure_name || 'atendimento'}
                            {prof && <> · {prof.name}</>}
                            {row.replied_at && (
                              <>
                                {' '}
                                · respondeu em{' '}
                                {new Date(row.replied_at).toLocaleString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </>
                            )}
                          </p>
                          {patient?.phone && (
                            <p className="text-xs text-slate-400 mt-0.5">{patient.phone}</p>
                          )}
                          {row.comment && (
                            <p className="text-sm text-slate-700 mt-2 p-2 bg-slate-50 rounded-lg italic">
                              “{row.comment}”
                            </p>
                          )}
                          {row.error && (
                            <p className="text-xs text-rose-600 mt-1 break-words">
                              Erro: {row.error}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
