'use client'

import { useState } from 'react'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Aguardando link', color: 'bg-slate-100 text-slate-600' },
  trial:     { label: 'Trial', color: 'bg-blue-100 text-blue-700' },
  active:    { label: 'Ativo', color: 'bg-emerald-100 text-emerald-700' },
  overdue:   { label: 'Inadimplente', color: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelado', color: 'bg-slate-200 text-slate-500' },
  blocked:   { label: 'Bloqueado', color: 'bg-red-200 text-red-800' },
}

export default function SubscriptionsClient({ clinics, plans }: { clinics: any[]; plans: any[] }) {
  const [sending, setSending] = useState<string | null>(null)
  const [modal, setModal] = useState<{ clinicId: string; clinicName: string } | null>(null)
  const [form, setForm] = useState({ planId: '', planName: '', planPrice: '', billingCycle: 'MONTHLY', trialDays: '30' })
  const [result, setResult] = useState<{ url?: string; error?: string } | null>(null)
  const [search, setSearch] = useState('')

  const filtered = clinics.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))

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
          planName: plan?.name || form.planName,
          planPrice: plan?.price || parseFloat(form.planPrice),
          billingCycle: form.billingCycle,
          trialDays: parseInt(form.trialDays),
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

          return (
            <div key={clinic.id} className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                <span className="text-violet-700 font-bold text-sm">{clinic.name.charAt(0)}</span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-slate-800 truncate">{clinic.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{label}</span>
                </div>
                <div className="flex items-center gap-4 mt-1 flex-wrap">
                  {sub?.plan_name && (
                    <p className="text-xs text-slate-500">📦 {sub.plan_name} — R$ {sub.plan_price}/mês</p>
                  )}
                  {sub?.last_payment_at && (
                    <p className="text-xs text-slate-500">💰 Último pagamento: {new Date(sub.last_payment_at).toLocaleDateString('pt-BR')}</p>
                  )}
                  {sub?.trial_ends_at && (
                    <p className="text-xs text-blue-500">⏳ Trial até {new Date(sub.trial_ends_at).toLocaleDateString('pt-BR')}</p>
                  )}
                  {sub?.checkout_sent_at && !sub?.asaas_checkout_url && (
                    <p className="text-xs text-slate-400">Link enviado em {new Date(sub.checkout_sent_at).toLocaleDateString('pt-BR')}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {sub?.asaas_checkout_url && (
                  <a href={sub.asaas_checkout_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs px-3 py-1.5 border border-violet-200 text-violet-700 rounded-lg hover:bg-violet-50">
                    🔗 Ver link
                  </a>
                )}
                <button
                  onClick={() => { setModal({ clinicId: clinic.id, clinicName: clinic.name }); setResult(null) }}
                  className="text-xs px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium"
                >
                  📤 Enviar link
                </button>
              </div>
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
                <select value={form.planId} onChange={e => setForm({ ...form, planId: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm">
                  <option value="">Selecione...</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>{p.name} — R$ {p.price}/mês</option>
                  ))}
                </select>
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">Trial (dias)</label>
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
