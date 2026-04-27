'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'

type AppointmentRow = {
  id: string
  start_time: string
  status: string
  confirmation_sent_at: string
  patient_id: string | null
  professional_id: string | null
}

type PatientLite = { id: string; name: string; phone: string | null }
type UserLite = { id: string; name: string }

export default function ReminderHistory({ clinicId }: { clinicId: string }) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<AppointmentRow[]>([])
  const [patients, setPatients] = useState<Record<string, PatientLite>>({})
  const [profs, setProfs] = useState<Record<string, UserLite>>({})
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: apps } = await supabase
        .from('appointments')
        .select('id, start_time, status, confirmation_sent_at, patient_id, professional_id')
        .eq('clinic_id', clinicId)
        .not('confirmation_sent_at', 'is', null)
        .order('confirmation_sent_at', { ascending: false })
        .limit(30)

      const list = (apps as AppointmentRow[] | null) ?? []
      setRows(list)

      const patientIds = Array.from(
        new Set(list.map((a) => a.patient_id).filter(Boolean) as string[]),
      )
      const profIds = Array.from(
        new Set(list.map((a) => a.professional_id).filter(Boolean) as string[]),
      )

      const [{ data: pats }, { data: us }] = await Promise.all([
        patientIds.length > 0
          ? supabase.from('patients').select('id, name, phone').in('id', patientIds)
          : Promise.resolve({ data: [] as PatientLite[] }),
        profIds.length > 0
          ? supabase.from('users').select('id, name').in('id', profIds)
          : Promise.resolve({ data: [] as UserLite[] }),
      ])

      const pMap: Record<string, PatientLite> = {}
      for (const p of (pats as PatientLite[] | null) ?? []) pMap[p.id] = p
      setPatients(pMap)

      const uMap: Record<string, UserLite> = {}
      for (const u of (us as UserLite[] | null) ?? []) uMap[u.id] = u
      setProfs(uMap)
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
          <p className="font-semibold text-slate-900">Histórico de lembretes</p>
          <p className="text-sm text-slate-500">Últimos lembretes de consulta enviados</p>
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
          ) : rows.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-slate-500">
                Nenhum lembrete ainda. O primeiro envio rola amanhã às 20h se houver consulta
                pra depois de amanhã.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {rows.map((row) => {
                const patient = row.patient_id ? patients[row.patient_id] : null
                const prof = row.professional_id ? profs[row.professional_id] : null
                return (
                  <div key={row.id} className="p-4 hover:bg-slate-50">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-slate-900 truncate">
                            {patient?.name || `(paciente ${(row.patient_id || '').slice(0, 8)})`}
                          </p>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                            Enviado
                          </span>
                          <span className="text-xs text-slate-400">
                            {new Date(row.confirmation_sent_at).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Consulta:{' '}
                          {new Date(row.start_time).toLocaleString('pt-BR', {
                            timeZone: 'America/Sao_Paulo',
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {prof && <> · {prof.name}</>}
                        </p>
                        {patient?.phone && (
                          <p className="text-xs text-slate-400 mt-0.5">{patient.phone}</p>
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
