'use client'

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatBRL } from '@/lib/format'

type TendenciaRow = {
  mes: string
  receita: number
  lucro_operacional: number
}

function mesLabelCurto(mes: string) {
  const [, m] = mes.split('-')
  const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return MESES[Number(m) - 1] || mes
}

function TendenciaTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const receita = payload.find((p: any) => p.dataKey === 'receita')?.value ?? 0
  const lucro = payload.find((p: any) => p.dataKey === 'lucro_operacional')?.value ?? 0
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-lg px-3 py-2 text-xs">
      <p className="font-bold text-slate-900 mb-1.5">{label}</p>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="w-2 h-2 rounded-sm bg-violet-200" />
        <span className="text-slate-500">Receita:</span>
        <span className="font-semibold text-slate-900">{formatBRL(receita)}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        <span className="text-slate-500">Lucro op.:</span>
        <span className={`font-semibold ${lucro >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatBRL(lucro)}</span>
      </div>
    </div>
  )
}

export default function RentabilidadeTendenciaChart({ tendencia }: { tendencia: TendenciaRow[] }) {
  const data = tendencia.map((t) => ({ ...t, label: mesLabelCurto(t.mes) }))

  return (
    <div style={{ width: '100%', height: 160 }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <YAxis hide />
          <Tooltip content={<TendenciaTooltip />} cursor={{ fill: '#f8fafc' }} />
          <Bar dataKey="receita" fill="#ddd6fe" radius={[4, 4, 0, 0]} barSize={22} />
          <Line
            type="monotone"
            dataKey="lucro_operacional"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }}
            activeDot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
