'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'

type Props = { clinicId: string; clinicName: string }

export default function LgpdExport({ clinicId, clinicName }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function exportData(tipo: string) {
    setLoading(tipo)
    setDone(null)
    try {
      let rows: any[] = []
      let filename = ''

      if (tipo === 'pacientes') {
        const { data } = await supabase
          .from('patients')
          .select('id, name, email, phone, cpf, birth_date, created_at')
          .eq('clinic_id', clinicId)
          .order('name')
        rows = data || []
        filename = `pacientes_${clinicName}_${today()}.csv`
      } else if (tipo === 'anamneses') {
        const { data } = await supabase
          .from('anamneses')
          .select('id, token, status, created_at, completed_at, patients(name, email)')
          .eq('clinic_id', clinicId)
          .order('created_at', { ascending: false })
        rows = (data || []).map(a => ({
          id: a.id,
          paciente: (a.patients as any)?.name,
          email: (a.patients as any)?.email,
          status: a.status,
          enviado_em: a.created_at,
          preenchido_em: a.completed_at,
        }))
        filename = `anamneses_${clinicName}_${today()}.csv`
      } else if (tipo === 'agendamentos') {
        const { data } = await supabase
          .from('appointments')
          .select('id, start_time, end_time, status, patients(name, phone), procedures(name)')
          .eq('clinic_id', clinicId)
          .order('start_time', { ascending: false })
        rows = (data || []).map(a => ({
          id: a.id,
          paciente: (a.patients as any)?.name,
          telefone: (a.patients as any)?.phone,
          procedimento: (a.procedures as any)?.name,
          inicio: a.start_time,
          fim: a.end_time,
          status: a.status,
        }))
        filename = `agendamentos_${clinicName}_${today()}.csv`
      } else if (tipo === 'financeiro') {
        const { data } = await supabase
          .from('entradas')
          .select('id, data_venda, valor_bruto, valor_liquido, forma_pagamento, descricao, paciente_nome')
          .eq('clinic_id', clinicId)
          .order('data_venda', { ascending: false })
        rows = data || []
        filename = `financeiro_${clinicName}_${today()}.csv`
      }

      if (!rows.length) {
        alert('Nenhum dado encontrado.')
        setLoading(null)
        return
      }

      // Gerar CSV
      const headers = Object.keys(rows[0])
      const csv = [
        headers.join(';'),
        ...rows.map(r => headers.map(h => {
          const v = r[h] ?? ''
          return typeof v === 'string' && v.includes(';') ? `"${v}"` : v
        }).join(';'))
      ].join('\n')

      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      setDone(tipo)
    } catch (e) {
      alert('Erro ao exportar dados.')
    }
    setLoading(null)
  }

  function today() {
    return new Date().toISOString().slice(0, 10).replace(/-/g, '')
  }

  const items = [
    { key: 'pacientes', icon: '👥', title: 'Pacientes', desc: 'Nome, email, telefone, CPF, data de nascimento' },
    { key: 'anamneses', icon: '📋', title: 'Fichas de Anamnese', desc: 'Status e datas de preenchimento por paciente' },
    { key: 'agendamentos', icon: '📅', title: 'Agendamentos', desc: 'Histórico completo de consultas e procedimentos' },
    { key: 'financeiro', icon: '💰', title: 'Financeiro', desc: 'Entradas, valores e formas de pagamento' },
  ]

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <Icon name="shield" className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Lei Geral de Proteção de Dados (LGPD)</p>
          <p className="text-sm text-amber-700 mt-1">
            Conforme a LGPD (Lei nº 13.709/2018), você tem o direito de acessar, exportar e solicitar a exclusão dos dados pessoais tratados pela sua clínica. Os arquivos exportados contêm dados sensíveis — guarde-os com segurança.
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {items.map(item => (
          <div key={item.key} className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{item.icon}</span>
              <div>
                <p className="font-semibold text-slate-900">{item.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
              </div>
            </div>
            <button
              onClick={() => exportData(item.key)}
              disabled={loading === item.key}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              {loading === item.key ? (
                <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Exportando...</>
              ) : done === item.key ? (
                <><Icon name="check" className="w-3.5 h-3.5" /> Baixado!</>
              ) : (
                <><Icon name="download" className="w-3.5 h-3.5" /> Exportar CSV</>
              )}
            </button>
          </div>
        ))}
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-slate-700 mb-2">📌 Informações sobre retenção de dados</p>
        <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
          <li>Dados de pacientes são mantidos enquanto a conta estiver ativa</li>
          <li>Para solicitar exclusão total de dados, entre em contato: <strong>suporte@clinike.com.br</strong></li>
          <li>Backups automáticos são realizados diariamente pelo Supabase</li>
          <li>Todos os dados são armazenados em servidores na América do Sul (sa-east-1)</li>
        </ul>
      </div>
    </div>
  )
}
