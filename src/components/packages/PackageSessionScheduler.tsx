'use client'

import { useEffect, useState } from 'react'
import Icon from '@/components/ui/Icon'
import { addDaysBR } from '@/lib/datetime'

export type ScheduledSessionRow = {
  key: string
  date: string
  time: string
}

type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'manual'

const FREQUENCY_DAYS: Partial<Record<Frequency, number>> = {
  weekly: 7,
  biweekly: 14,
}

/**
 * Soma N meses a uma data YYYY-MM-DD, sem passar por `Date`/UTC (evita o
 * mesmo problema de fuso descrito em lib/datetime.ts). Ajusta o dia se o
 * mês de destino for mais curto (ex: 31/01 + 1 mês -> 28 ou 29/02).
 */
function addMonthsBR(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const totalMonths = (m - 1) + months
  const targetYear = y + Math.floor(totalMonths / 12)
  const targetMonth = ((totalMonths % 12) + 12) % 12 // 0-indexed
  const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate()
  const targetDay = Math.min(d, daysInTargetMonth)
  return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`
}

function nextSessionDate(firstDate: string, frequency: Frequency, index: number): string {
  if (frequency === 'manual') return firstDate
  if (frequency === 'monthly') return addMonthsBR(firstDate, index + 1)
  return addDaysBR(firstDate, (FREQUENCY_DAYS[frequency] || 0) * (index + 1))
}

/**
 * Pré-preenche N linhas de data/hora para as próximas sessões de um pacote,
 * a partir da data/hora da 1ª sessão (a que já está no formulário principal).
 * Cada linha continua editável individualmente (recorrência híbrida).
 */
export default function PackageSessionScheduler({
  count,
  firstDate,
  firstTime,
  rows,
  onChange,
}: {
  count: number
  firstDate: string
  firstTime: string
  rows: ScheduledSessionRow[]
  onChange: (rows: ScheduledSessionRow[]) => void
}) {
  const [frequency, setFrequency] = useState<Frequency>('weekly')

  // Regera as linhas quando a contagem de sessões extras ou a frequência mudam
  useEffect(() => {
    if (count <= 0) {
      if (rows.length > 0) onChange([])
      return
    }
    const next: ScheduledSessionRow[] = Array.from({ length: count }).map((_, i) => {
      const existing = rows[i]
      if (existing) return existing
      const date = nextSessionDate(firstDate, frequency, i)
      return { key: Math.random().toString(36).slice(2), date, time: firstTime }
    })
    onChange(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, frequency])

  if (count <= 0) return null

  function updateRow(key: string, field: 'date' | 'time', value: string) {
    onChange(rows.map(r => (r.key === key ? { ...r, [field]: value } : r)))
  }

  function applyFrequency(freq: Frequency) {
    setFrequency(freq)
    onChange(
      rows.map((r, i) => ({
        ...r,
        date: freq === 'manual' ? r.date : nextSessionDate(firstDate, freq, i),
      }))
    )
  }

  return (
    <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3 bg-violet-50/40">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-700">
          Próximas {count} sessão{count !== 1 ? 'ões' : ''}
        </p>
        <select
          className="input !py-1.5 !text-xs w-auto"
          value={frequency}
          onChange={e => applyFrequency(e.target.value as Frequency)}
        >
          <option value="weekly">Semanal</option>
          <option value="biweekly">Quinzenal</option>
          <option value="monthly">Mensal</option>
          <option value="manual">Datas manuais</option>
        </select>
      </div>

      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={row.key} className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 w-14 flex-shrink-0">
              Sessão {i + 2}
            </span>
            <input
              type="date"
              className="input !py-1.5 !text-xs"
              value={row.date}
              onChange={e => updateRow(row.key, 'date', e.target.value)}
            />
            <input
              type="time"
              className="input !py-1.5 !text-xs w-28 flex-shrink-0"
              value={row.time}
              onChange={e => updateRow(row.key, 'time', e.target.value)}
            />
          </div>
        ))}
      </div>

      <p className="text-[11px] text-violet-600 bg-violet-100 rounded-xl px-3 py-2 flex items-start gap-1.5">
        <Icon name="info" className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        As datas ficam pré-marcadas, mas cada sessão só é descontada do pacote quando o atendimento for concluído.
      </p>
    </div>
  )
}
