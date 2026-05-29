'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'

type AnamneseRow = {
  id: string
  status: string
  created_at: string
  whatsapp_sent_at: string | null
  viewed_at: string | null
  completed_at: string | null
}

type Props = {
  patientId: string
  /** Anamnese mais recente já carregada no servidor — usamos como seed */
  latestAnamnese: { id: string } | null
}

function fmt(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  viewed: 'Visualizada',
  completed: 'Preenchida',
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  viewed: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
}

export default function AnamneseHistorico({ patientId, latestAnamnese }: Props) {
  const [rows, setRows] = useState<AnamneseRow[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    const supabase = createClient()
    supabase
      .from('anamneses')
      .select('id, status, created_at, whatsapp_sent_at, viewed_at, completed_at')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setRows(data || [])
        setLoading(false)
      })
  }, [open, patientId])

  // Não mostrar nada se nunca enviou
  if (!latestAnamnese) return null

  return (
    <div className="px-1">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
      >
        <Icon name={open ? 'chevronDown' : 'chevronRight'} className="w-3 h-3" />
        Histórico de envios
      </button>

      {open && (
        <div className="mt-2 rounded-xl border border-slate-100 overflow-hidden">
          {loading ? (
            <div className="p-4 text-xs text-slate-400 text-center">Carregando...</div>
          ) : rows.length === 0 ? (
            <div className="p-4 text-xs text-slate-400 text-center">Nenhum envio registrado.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500">
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                  <th className="text-left px-3 py-2 font-medium">Enviado</th>
                  <th className="text-left px-3 py-2 font-medium">Visualizado</th>
                  <th className="text-left px-3 py-2 font-medium">Preenchido</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={r.id}
                    className={`border-t border-slate-100 ${i === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                  >
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full font-medium text-[10px] ${STATUS_COLOR[r.status] || 'bg-slate-100 text-slate-600'}`}>
                        {STATUS_LABEL[r.status] || r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {r.whatsapp_sent_at ? (
                        <span className="flex items-center gap-1">
                          <Icon name="phone" className="w-3 h-3 text-emerald-500" />
                          {fmt(r.whatsapp_sent_at)}
                        </span>
                      ) : (
                        <span className="text-slate-400">{fmt(r.created_at)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {r.viewed_at ? fmt(r.viewed_at) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {r.completed_at ? fmt(r.completed_at) : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
