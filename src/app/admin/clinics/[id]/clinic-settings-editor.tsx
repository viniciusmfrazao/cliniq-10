'use client'

import { useMemo, useState } from 'react'

type Plan = {
  id: string
  name: string
}

type User = {
  id: string
  name: string
  email: string
  role: string
}

type Props = {
  clinic: {
    id: string
    name: string
    slug: string
    cnpj?: string | null
    plan_id?: string | null
    trial_ends_at?: string | null
    plan_price?: number | null
    plan_expires_at?: string | null
    billing_whatsapp?: string | null
    billing_notes?: string | null
    settings?: Record<string, unknown> | null
  }
  users: User[]
  plans: Plan[]
}

export default function ClinicSettingsEditor({ clinic, users, plans }: Props) {
  const admins = useMemo(() => users.filter((u) => u.role === 'admin'), [users])
  const initialAdmin = admins[0]
  const initialOverride =
    clinic.settings &&
    typeof clinic.settings.max_whatsapp_numbers_override === 'number' &&
    clinic.settings.max_whatsapp_numbers_override > 0
      ? String(clinic.settings.max_whatsapp_numbers_override)
      : ''

  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: clinic.name || '',
    slug: clinic.slug || '',
    cnpj: clinic.cnpj || '',
    plan_id: clinic.plan_id || '',
    trial_ends_at: clinic.trial_ends_at ? clinic.trial_ends_at.slice(0, 10) : '',
    plan_price: clinic.plan_price ? String(clinic.plan_price) : '',
    plan_expires_at: clinic.plan_expires_at ? clinic.plan_expires_at.slice(0, 10) : '',
    billing_whatsapp: clinic.billing_whatsapp || '',
    billing_notes: clinic.billing_notes || '',
    max_whatsapp_numbers_override: initialOverride,
    admin_id: initialAdmin?.id || '',
    admin_name: initialAdmin?.name || '',
    admin_email: initialAdmin?.email || '',
  })

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        cnpj: form.cnpj.trim() || null,
        plan_id: form.plan_id || null,
        trial_ends_at: form.trial_ends_at || null,
        plan_price: form.plan_price ? parseFloat(form.plan_price) : null,
        plan_expires_at: form.plan_expires_at || null,
        billing_whatsapp: form.billing_whatsapp.trim() || null,
        billing_notes: form.billing_notes.trim() || null,
        max_whatsapp_numbers_override: form.max_whatsapp_numbers_override
          ? Math.max(1, parseInt(form.max_whatsapp_numbers_override, 10))
          : null,
        primary_admin: form.admin_id
          ? {
              id: form.admin_id,
              name: form.admin_name.trim(),
              email: form.admin_email.trim(),
            }
          : undefined,
      }

      const res = await fetch(`/api/admin/clinics/${clinic.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar alterações')
      setMessage('Dados da clínica atualizados com sucesso.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSave}
      className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4"
    >
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Editar clínica e acesso</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome da clínica</label>
          <input
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Slug</label>
          <input
            value={form.slug}
            onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">CNPJ</label>
          <input
            value={form.cnpj}
            onChange={(e) => setForm((prev) => ({ ...prev, cnpj: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fim do trial</label>
          <input
            type="date"
            value={form.trial_ends_at}
            onChange={(e) => setForm((prev) => ({ ...prev, trial_ends_at: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          />
        </div>
      </div>

      {/* Cobrança */}
      <div className="border border-emerald-100 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-800 rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">💰 Cobrança & Plano</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Valor mensal (R$)</label>
            <input
              type="number"
              step="0.01"
              placeholder="Ex: 297.00"
              value={form.plan_price}
              onChange={(e) => setForm((prev) => ({ ...prev, plan_price: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Plano vence em</label>
            <input
              type="date"
              value={form.plan_expires_at}
              onChange={(e) => setForm((prev) => ({ ...prev, plan_expires_at: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">WhatsApp para cobrança</label>
            <input
              type="text"
              placeholder="Ex: 5534999990000"
              value={form.billing_whatsapp}
              onChange={(e) => setForm((prev) => ({ ...prev, billing_whatsapp: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notas de cobrança (interno)</label>
          <input
            type="text"
            placeholder="Ex: paga sempre dia 5, parcelado, etc."
            value={form.billing_notes}
            onChange={(e) => setForm((prev) => ({ ...prev, billing_notes: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Plano</label>
          <select
            value={form.plan_id}
            onChange={(e) => setForm((prev) => ({ ...prev, plan_id: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <option value="">Sem plano vinculado</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Limite WhatsApp desta clínica (override)
          </label>
          <input
            type="number"
            min={1}
            value={form.max_whatsapp_numbers_override}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, max_whatsapp_numbers_override: e.target.value }))
            }
            placeholder="vazio = usa limite do plano"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          />
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
        <h3 className="font-medium text-slate-900 dark:text-white mb-3">Recuperar acesso (alterar email admin)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select
            value={form.admin_id}
            onChange={(e) => {
              const picked = admins.find((a) => a.id === e.target.value)
              setForm((prev) => ({
                ...prev,
                admin_id: e.target.value,
                admin_name: picked?.name || prev.admin_name,
                admin_email: picked?.email || prev.admin_email,
              }))
            }}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <option value="">Selecione admin</option>
            {admins.map((admin) => (
              <option key={admin.id} value={admin.id}>
                {admin.name}
              </option>
            ))}
          </select>
          <input
            value={form.admin_name}
            onChange={(e) => setForm((prev) => ({ ...prev, admin_name: e.target.value }))}
            placeholder="Nome do admin"
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          />
          <input
            type="email"
            value={form.admin_email}
            onChange={(e) => setForm((prev) => ({ ...prev, admin_email: e.target.value }))}
            placeholder="Novo email de acesso"
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-emerald-600">{message}</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg"
        >
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </div>
    </form>
  )
}

