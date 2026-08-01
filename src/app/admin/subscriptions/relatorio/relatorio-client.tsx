'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

const CONFIRM_EVENTS = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_ANTICIPATED', 'PAYMENT_DUNNING_RECEIVED']

const EVENT_LABELS: Record<string, string> = {
  PAYMENT_CONFIRMED: '✅ Confirmado',
  PAYMENT_RECEIVED: '✅ Recebido',
  PAYMENT_ANTICIPATED: '✅ Antecipado',
  PAYMENT_DUNNING_RECEIVED: '✅ Recebido (cobrança)',
  PAYMENT_OVERDUE: '⚠️ Vencido',
  PAYMENT_DELETED: '❌ Removido',
  PAYMENT_REFUNDED: '↩️ Estornado',
  PAYMENT_PARTIALLY_REFUNDED: '↩️ Estorno parcial',
  PAYMENT_REPROVED_BY_RISK_ANALYSIS: '❌ Reprovado',
  PAYMENT_CHARGEBACK_REQUESTED: '🔄 Chargeback',
  PAYMENT_AWAITING_CHARGEBACK_REVERSAL: '🔄 Reversão chargeback',
  SUBSCRIPTION_INACTIVATED: '🚫 Inativada',
  SUBSCRIPTION_DELETED: '🚫 Removida',
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Aguardando link', color: 'bg-slate-100 text-slate-600' },
  trial: { label: 'Trial', color: 'bg-blue-100 text-blue-700' },
  active: { label: 'Ativo', color: 'bg-emerald-100 text-emerald-700' },
  overdue: { label: 'Inadimplente', color: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelado', color: 'bg-slate-200 text-slate-500' },
  blocked: { label: 'Bloqueado', color: 'bg-red-200 text-red-800' },
}

function monthKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string) {
  const [y, m] = key.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export default function RelatorioClient({ events, subscriptions }: { events: any[]; subscriptions: any[] }) {
  const [tab, setTab] = useState<'resumo' | 'transacoes' | 'recorrencias'>('resumo')

  const confirmedEvents = useMemo(() => events.filter(e => CONFIRM_EVENTS.includes(e.event)), [events])

  const monthly = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {}
    for (const ev of confirmedEvents) {
      const key = monthKey(ev.occurred_at)
      if (!map[key]) map[key] = { total: 0, count: 0 }
      map[key].total += Number(ev.value) || 0
      map[key].count += 1
    }
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]))
  }, [confirmedEvents])

  const totalRecebido = confirmedEvents.reduce((s, e) => s + (Number(e.value) || 0), 0)
  const mrrAtivo = subscriptions
    .filter(s => s.status === 'active')
    .reduce((s, sub) => s + (Number(sub.plan_price) || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/admin/subscriptions" className="text-xs text-violet-600 hover:underline">← Assinaturas</Link>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Relatório de Cobranças</h1>
          <p className="text-slate-500 text-sm mt-1">Histórico de pagamentos e recorrências da Asaas</p>
        </div>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">💰 Total recebido (histórico registrado)</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">R$ {totalRecebido.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">📈 MRR ativo (assinaturas ativas)</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">R$ {mrrAtivo.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">🧾 Cobranças confirmadas</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{confirmedEvents.length}</p>
        </div>
      </div>

      {confirmedEvents.length === 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-amber-700">
          ⚠️ O histórico de eventos só começou a ser registrado a partir do deploy mais recente. Cobranças confirmadas antes disso não aparecem aqui — só o "último pagamento" de cada assinatura (visível na aba Recorrências).
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {[
          { id: 'resumo', label: '📅 Por mês' },
          { id: 'transacoes', label: '🧾 Transações' },
          { id: 'recorrencias', label: '🔁 Recorrências' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Por mês */}
      {tab === 'resumo' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {monthly.length === 0 ? (
            <p className="p-6 text-sm text-slate-400 text-center">Nenhum pagamento registrado ainda.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Mês</th>
                  <th className="text-right px-4 py-2.5 font-medium">Cobranças</th>
                  <th className="text-right px-4 py-2.5 font-medium">Total recebido</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map(([key, data]) => (
                  <tr key={key} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 text-slate-700 capitalize">{monthLabel(key)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-500">{data.count}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-800">R$ {data.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Transações */}
      {tab === 'transacoes' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {events.length === 0 ? (
            <p className="p-6 text-sm text-slate-400 text-center">Nenhum evento registrado ainda.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Data</th>
                  <th className="text-left px-4 py-2.5 font-medium">Clínica</th>
                  <th className="text-left px-4 py-2.5 font-medium">Evento</th>
                  <th className="text-left px-4 py-2.5 font-medium">Forma</th>
                  <th className="text-right px-4 py-2.5 font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{new Date(ev.occurred_at).toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-2.5 text-slate-700">{ev.clinics?.name || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-600">{EVENT_LABELS[ev.event] || ev.event}</td>
                    <td className="px-4 py-2.5 text-slate-500">{ev.billing_type ? (ev.billing_type === 'PIX' ? 'Pix' : 'Cartão') : '—'}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-800">{ev.value != null ? `R$ ${Number(ev.value).toFixed(2)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Recorrências */}
      {tab === 'recorrencias' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {subscriptions.length === 0 ? (
            <p className="p-6 text-sm text-slate-400 text-center">Nenhuma assinatura cadastrada.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Clínica</th>
                  <th className="text-left px-4 py-2.5 font-medium">Status</th>
                  <th className="text-left px-4 py-2.5 font-medium">Plano</th>
                  <th className="text-left px-4 py-2.5 font-medium">Último pagamento</th>
                  <th className="text-left px-4 py-2.5 font-medium">Próxima cobrança</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((sub, i) => {
                  const { label, color } = STATUS_LABELS[sub.status] || STATUS_LABELS.pending
                  return (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-4 py-2.5 text-slate-700">{sub.clinics?.name || '—'}</td>
                      <td className="px-4 py-2.5"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{label}</span></td>
                      <td className="px-4 py-2.5 text-slate-500">
                        {sub.plan_name ? `${sub.plan_name} — R$ ${sub.plan_price}/${sub.billing_cycle === 'YEARLY' ? 'ano' : 'mês'}` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">
                        {sub.last_payment_at
                          ? `${new Date(sub.last_payment_at).toLocaleDateString('pt-BR')}${sub.last_payment_value ? ` (R$ ${Number(sub.last_payment_value).toFixed(2)})` : ''}`
                          : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">
                        {sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString('pt-BR') : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
