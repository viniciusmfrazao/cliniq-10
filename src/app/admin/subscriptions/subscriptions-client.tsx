'use client'

import { useState } from 'react'
import { normalizeText } from '@/lib/text'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Aguardando link', color: 'bg-slate-100 text-slate-600' },
  trial:     { label: 'Trial', color: 'bg-blue-100 text-blue-700' },
  active:    { label: 'Ativo', color: 'bg-emerald-100 text-emerald-700' },
  overdue:   { label: 'Inadimplente', color: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelado', color: 'bg-slate-200 text-slate-500' },
  blocked:   { label: 'Bloqueado', color: 'bg-red-200 text-red-800' },
}

const CARD_CONFIRM_EVENTS = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_ANTICIPATED', 'PAYMENT_DUNNING_RECEIVED']

const EVENT_LABELS: Record<string, string> = {
  PAYMENT_CONFIRMED: '✅ Pagamento confirmado',
  PAYMENT_RECEIVED: '✅ Pagamento recebido',
  PAYMENT_ANTICIPATED: '✅ Pagamento antecipado',
  PAYMENT_DUNNING_RECEIVED: '✅ Pagamento recebido (cobrança)',
  PAYMENT_OVERDUE: '⚠️ Vencido',
  PAYMENT_DELETED: '❌ Removido',
  PAYMENT_REFUNDED: '↩️ Estornado',
  PAYMENT_PARTIALLY_REFUNDED: '↩️ Estorno parcial',
  PAYMENT_REPROVED_BY_RISK_ANALYSIS: '❌ Reprovado (análise de risco)',
  PAYMENT_CHARGEBACK_REQUESTED: '🔄 Chargeback solicitado',
  PAYMENT_AWAITING_CHARGEBACK_REVERSAL: '🔄 Aguardando reversão de chargeback',
  SUBSCRIPTION_INACTIVATED: '🚫 Assinatura inativada',
  SUBSCRIPTION_DELETED: '🚫 Assinatura removida',
}

export default function SubscriptionsClient({ clinics, plans, eventsByClinic }: { clinics: any[]; plans: any[]; eventsByClinic: Record<string, any[]> }) {
  const hasCnpj = (c: any) => !!((c.cnpj || c.settings?.cnpj || '').replace(/\D/g, '').length >= 11)
  const [sending, setSending] = useState<string | null>(null)
  const [modal, setModal] = useState<{ clinicId: string; clinicName: string } | null>(null)
  const [form, setForm] = useState({ planId: '', planName: '', planPrice: '', billingCycle: 'MONTHLY', trialDays: '30', paymentMethod: 'CREDIT_CARD' })
  const [result, setResult] = useState<{ url?: string; error?: string } | null>(null)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const filtered = clinics.filter(c => normalizeText(c.name).includes(normalizeText(search)))

  async function sendLink() {
    if (!modal) return
    setSending(modal.clinicId)
    setResult(null)
    try {
      const plan = plans.find(p => p.id === form.planId)
      const r = await fetch('/api/asaas/send-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId: modal.clinicId,
          planName: plan?.display_name || plan?.name || form.planName,
          planPrice: parseFloat(form.planPrice) || plan?.price_monthly || 0,
          billingCycle: form.billingCycle,
          trialDays: parseInt(form.trialDays),
          paymentMethod: form.paymentMethod,
        }),
      })
      const data = await r.json()
      if (data.ok) {
        setResult({ url: data.checkoutUrl })
      } else {
        setResult({ error: data.error })
      }
    } catch (e: any) {
      setResult({ error: e.message })
    }
    setSending(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Assinaturas</h1>
          <p className="text-slate-500 text-sm mt-1">Gerencie os planos e cobranças das clínicas</p>
        </div>
        <div className="flex items-center gap-3">
          <a href="/admin/subscriptions/relatorio"
            className="text-xs px-3 py-1.5 border border-violet-200 text-violet-700 rounded-lg hover:bg-violet-50 font-medium">
            📊 Relatório de cobranças
          </a>
          <div className="text-xs text-slate-500">
            {clinics.filter(c => c.clinic_subscriptions?.[0]?.status === 'active').length} ativas /  {clinics.length} total
          </div>
        </div>
      </div>

      {/* Busca */}
      <input type="text" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Buscar clínica..."
        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20" />

      {/* Lista */}
      <div className="space-y-3">
        {filtered.map(clinic => {
          const sub = clinic.clinic_subscriptions?.[0]
          const status = sub?.status || 'pending'
          const { label, color } = STATUS_LABELS[status] || STATUS_LABELS.pending
          const events = eventsByClinic[clinic.id] || []
          const cardConfirmed = events.some(e => CARD_CONFIRM_EVENTS.includes(e.event))
          const isExpanded = expanded === clinic.id

          return (
            <div key={clinic.id} className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-violet-700 font-bold text-sm">{clinic.name.charAt(0)}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-800 truncate">{clinic.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{label}</span>
                    {sub?.checkout_sent_at && (
                      cardConfirmed
                        ? <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700">💳 Cartão cadastrado</span>
                        : <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">⏳ Aguardando cadastro do cartão</span>
                    )}
                    {!hasCnpj(clinic) && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700" title="Sem CNPJ/CPF cadastrado — não é possível gerar link de cobrança">
                        ⚠️ sem CNPJ
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 flex-wrap">
                    {sub?.plan_name && (
                      <p className="text-xs text-slate-500">
                        📦 {sub.plan_name} — R$ {sub.plan_price}/mês{sub?.payment_method && ` · ${sub.payment_method === 'PIX' ? 'Pix' : 'Cartão'}`}
                      </p>
                    )}
                    {sub?.last_payment_at && (
                      <p className="text-xs text-slate-500">💰 Último pagamento: {new Date(sub.last_payment_at).toLocaleDateString('pt-BR')}</p>
                    )}
                    {sub?.trial_ends_at && (
                      <p className="text-xs text-blue-500">⏳ Trial até {new Date(sub.trial_ends_at).toLocaleDateString('pt-BR')}</p>
                    )}
                    {sub?.checkout_sent_at && (
                      <p className="text-xs text-slate-400">📤 Link enviado em {new Date(sub.checkout_sent_at).toLocaleDateString('pt-BR')}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {events.length > 0 && (
                    <button
                      onClick={() => setExpanded(isExpanded ? null : clinic.id)}
                      className="text-xs px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">
                      {isExpanded ? '▲ Ocultar' : `▼ Histórico (${events.length})`}
                    </button>
                  )}
                  {sub?.asaas_checkout_url && (
                    <a href={sub.asaas_checkout_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs px-3 py-1.5 border border-violet-200 text-violet-700 rounded-lg hover:bg-violet-50">
                      🔗 Ver link
                    </a>
                  )}
                  <button
                    onClick={() => { setModal({ clinicId: clinic.id, clinicName: clinic.name }); setResult(null) }}
                    disabled={!hasCnpj(clinic)}
                    title={!hasCnpj(clinic) ? 'Cadastre o CNPJ/CPF da clínica no admin antes de enviar o link' : undefined}
                    className="text-xs px-3 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-lg font-medium"
                  >
                    📤 Enviar link
                  </button>
                </div>
              </div>

              {isExpanded && events.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 mb-2">Histórico de pagamentos</p>
                  <div className="space-y-1.5">
                    {events.map((ev, i) => (
                      <div key={i} className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                        <span>{EVENT_LABELS[ev.event] || ev.event}</span>
                        <div className="flex items-center gap-3">
                          {ev.value != null && <span className="text-slate-500">R$ {Number(ev.value).toFixed(2)}</span>}
                          {ev.billing_type && <span className="text-slate-400">{ev.billing_type === 'PIX' ? 'Pix' : 'Cartão'}</span>}
                          <span className="text-slate-400">{new Date(ev.occurred_at).toLocaleString('pt-BR')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal de envio */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-1">Enviar link de pagamento</h2>
            <p className="text-sm text-slate-500 mb-5">{modal.clinicName}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Plano</label>
                <select value={form.planId} onChange={e => {
                  const plan = plans.find(p => p.id === e.target.value)
                  setForm({ ...form, planId: e.target.value, planPrice: plan?.price_monthly?.toString() || '' })
                }}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm">
                  <option value="">Selecione...</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>{p.display_name || p.name} — R$ {p.price_monthly}/mês</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Valor mensal (R$)</label>
                <input type="number" step="0.01" min="0"
                  value={form.planPrice}
                  onChange={e => setForm({ ...form, planPrice: e.target.value })}
                  placeholder="Ex: 197.00"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500/20" />
                <p className="text-xs text-slate-400 mt-1">Pode editar o valor para cobrar diferente do plano padrão</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Forma de pagamento</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button"
                    onClick={() => setForm({ ...form, paymentMethod: 'CREDIT_CARD' })}
                    className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                      form.paymentMethod === 'CREDIT_CARD'
                        ? 'bg-violet-600 border-violet-600 text-white'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}>
                    💳 Cartão
                  </button>
                  <button type="button"
                    onClick={() => setForm({ ...form, paymentMethod: 'PIX' })}
                    className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                      form.paymentMethod === 'PIX'
                        ? 'bg-violet-600 border-violet-600 text-white'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}>
                    🔑 Pix
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {form.paymentMethod === 'CREDIT_CARD'
                    ? 'Cliente cadastra o cartão agora; a cobrança acontece só na data abaixo.'
                    : 'A Asaas gera a cobrança Pix (QR code) com vencimento na data abaixo, a cada ciclo.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cobrança</label>
                  <select value={form.billingCycle} onChange={e => setForm({ ...form, billingCycle: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm">
                    <option value="MONTHLY">Mensal</option>
                    <option value="YEARLY">Anual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">1ª cobrança em (dias)</label>
                  <input type="number" min={0} max={90} value={form.trialDays}
                    onChange={e => setForm({ ...form, trialDays: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm" />
                </div>
              </div>

              {result?.url && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  <p className="text-xs font-semibold text-emerald-700 mb-2">✅ Link gerado com sucesso!</p>
                  <a href={result.url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-emerald-600 underline break-all">{result.url}</a>
                  <button onClick={() => navigator.clipboard.writeText(result.url!)}
                    className="mt-2 block w-full text-xs py-1.5 bg-emerald-600 text-white rounded-lg">
                    📋 Copiar link
                  </button>
                </div>
              )}

              {result?.error && (
                <div className="p-3 bg-red-50 rounded-xl border border-red-100 text-xs text-red-700">
                  ❌ {result.error}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => { setModal(null); setResult(null) }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm">
                Fechar
              </button>
              <button onClick={sendLink} disabled={!form.planId || !!sending}
                className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-medium">
                {sending === modal.clinicId ? 'Gerando...' : '📤 Gerar e copiar link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


