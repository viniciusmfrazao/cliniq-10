'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'

type ReportLead = {
  id: string
  name: string
  phone: string
  interest: string | null
  status: string
  created_at: string
  last_whatsapp_at: string | null
  lost_reason: string | null
  // Agendamento
  appointment_date: string | null
  appointment_status: string | null
  procedure_name: string | null
}

const STATUS_LABEL: Record<string, string> = {
  new: 'Novo Lead',
  contacted: 'Em Conversa',
  scheduled: 'Agendado',
  client: 'Cliente',
  lost: 'Perdido',
}

const STATUS_COLOR: Record<string, string> = {
  new: 'bg-slate-100 text-slate-600',
  contacted: 'bg-blue-100 text-blue-700',
  scheduled: 'bg-amber-100 text-amber-700',
  client: 'bg-emerald-100 text-emerald-700',
  lost: 'bg-red-100 text-red-600',
}

export default function CrmReport({ clinicId }: { clinicId: string }) {
  const supabase = createClient()
  const [leads, setLeads] = useState<ReportLead[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('leads')
      .select(`
        id, name, phone, interest, status, created_at,
        last_whatsapp_at, lost_reason,
        appointments(start_time, status, procedures(name))
      `)
      .eq('clinic_id', clinicId)
      .gte('created_at', dateFrom + 'T00:00:00')
      .lte('created_at', dateTo + 'T23:59:59')
      .order('created_at', { ascending: false })

    const mapped: ReportLead[] = (data || []).map((l: any) => {
      const apt = l.appointments?.[0]
      return {
        id: l.id,
        name: l.name,
        phone: l.phone,
        interest: l.interest,
        status: l.status,
        created_at: l.created_at,
        last_whatsapp_at: l.last_whatsapp_at,
        lost_reason: l.lost_reason,
        appointment_date: apt?.start_time || null,
        appointment_status: apt?.status || null,
        procedure_name: apt?.procedures?.name || null,
      }
    })
    setLeads(mapped)
    setLoading(false)
  }, [clinicId, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  // Estatísticas
  const total = leads.length
  const agendados = leads.filter(l => l.appointment_date).length
  const compareceram = leads.filter(l => l.appointment_status === 'completed').length
  const perdidos = leads.filter(l => l.status === 'lost').length
  const taxaAgendamento = total > 0 ? Math.round((agendados / total) * 100) : 0
  const taxaComparecimento = agendados > 0 ? Math.round((compareceram / agendados) * 100) : 0

  // Exportar XLS
  async function exportXLS() {
    setExporting(true)
    try {
      const XLSX = await import('xlsx')
      const rows = leads.map(l => ({
        'Nome': l.name,
        'Telefone': l.phone,
        'Data de Entrada': new Date(l.created_at).toLocaleDateString('pt-BR'),
        'Interesse': l.interest || '-',
        'Status': STATUS_LABEL[l.status] || l.status,
        'Data Agendamento': l.appointment_date
          ? new Date(l.appointment_date).toLocaleDateString('pt-BR')
          : '-',
        'Procedimento': l.procedure_name || '-',
        'Compareceu': l.appointment_status === 'completed' ? 'Sim'
          : l.appointment_date ? 'Não' : '-',
        'Motivo Perda': l.lost_reason || '-',
        'Último Contato': l.last_whatsapp_at
          ? new Date(l.last_whatsapp_at).toLocaleDateString('pt-BR')
          : '-',
      }))

      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()

      // Largura das colunas
      ws['!cols'] = [
        { wch: 25 }, { wch: 18 }, { wch: 16 }, { wch: 22 },
        { wch: 14 }, { wch: 18 }, { wch: 22 }, { wch: 12 },
        { wch: 20 }, { wch: 16 },
      ]

      XLSX.utils.book_append_sheet(wb, ws, 'Relatório de Leads')

      // Aba de resumo
      const resumo = [
        ['Relatório de Leads — Clinike', ''],
        ['Período', `${new Date(dateFrom).toLocaleDateString('pt-BR')} a ${new Date(dateTo).toLocaleDateString('pt-BR')}`],
        ['', ''],
        ['Total de Leads', total],
        ['Agendados', agendados],
        ['Compareceram', compareceram],
        ['Perdidos', perdidos],
        ['Taxa de Agendamento', `${taxaAgendamento}%`],
        ['Taxa de Comparecimento', `${taxaComparecimento}%`],
      ]
      const wsResumo = XLSX.utils.aoa_to_sheet(resumo)
      wsResumo['!cols'] = [{ wch: 25 }, { wch: 20 }]
      XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo')

      const fileName = `leads_${dateFrom}_${dateTo}.xlsx`
      XLSX.writeFile(wb, fileName)
    } finally {
      setExporting(false)
    }
  }

  function fmt(iso: string | null) {
    if (!iso) return '-'
    return new Date(iso).toLocaleDateString('pt-BR')
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">De</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="input text-sm" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Até</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="input text-sm" />
        </div>
        <button onClick={load} className="btn-secondary text-sm h-10 px-4">
          Filtrar
        </button>
        <button onClick={exportXLS} disabled={exporting || leads.length === 0}
          className="ml-auto flex items-center gap-2 px-4 h-10 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
          <Icon name="download" className="w-4 h-4" />
          {exporting ? 'Exportando...' : 'Exportar XLS'}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Leads', value: total, color: 'text-slate-900' },
          { label: 'Agendados', value: agendados, color: 'text-amber-600' },
          { label: 'Compareceram', value: compareceram, color: 'text-emerald-600' },
          { label: 'Perdidos', value: perdidos, color: 'text-red-500' },
          { label: 'Taxa Agendamento', value: `${taxaAgendamento}%`, color: 'text-violet-600' },
        ].map(k => (
          <div key={k.label} className="card p-3 text-center">
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="card p-8 text-center text-slate-400">Carregando...</div>
      ) : leads.length === 0 ? (
        <div className="card p-8 text-center text-slate-400">Nenhum lead no período selecionado</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['Entrada', 'Nome', 'Telefone', 'Interesse', 'Status', 'Agendamento', 'Procedimento', 'Compareceu', 'Perdido'].map(h => (
                  <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-slate-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.map(l => (
                <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 px-3 whitespace-nowrap text-slate-500">{fmt(l.created_at)}</td>
                  <td className="py-2.5 px-3 font-medium text-slate-900 whitespace-nowrap">{l.name}</td>
                  <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{l.phone}</td>
                  <td className="py-2.5 px-3 text-slate-600">{l.interest || <span className="text-slate-300">-</span>}</td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[l.status] || 'bg-slate-100 text-slate-600'}`}>
                      {STATUS_LABEL[l.status] || l.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap text-slate-500">{fmt(l.appointment_date)}</td>
                  <td className="py-2.5 px-3 text-slate-600">{l.procedure_name || <span className="text-slate-300">-</span>}</td>
                  <td className="py-2.5 px-3 text-center">
                    {l.appointment_status === 'completed'
                      ? <span className="text-emerald-600 font-semibold">✓</span>
                      : l.appointment_date
                      ? <span className="text-slate-300">✗</span>
                      : <span className="text-slate-200">-</span>}
                  </td>
                  <td className="py-2.5 px-3">
                    {l.status === 'lost'
                      ? <span className="text-xs text-red-500">{l.lost_reason || 'Sim'}</span>
                      : <span className="text-slate-200">-</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
