'use client'

import { useState } from 'react'

type Props = {
  config: Record<string, string>
  instances: Array<{ instance_name: string; status: string; clinic_id: string }>
}

export default function AdminConfigClient({ config, instances }: Props) {
  const [form, setForm] = useState({
    clinike_billing_instance: config.clinike_billing_instance || '',
    clinike_billing_from_number: config.clinike_billing_from_number || '',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setMsg(null)
    try {
      const resp = await fetch('/api/admin/config/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await resp.json()
      if (data.ok) setMsg('✅ Configurações salvas!')
      else setMsg(`❌ ${data.error}`)
    } catch {
      setMsg('❌ Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Configurações do Clinike</h1>
        <p className="text-slate-500 dark:text-slate-400">Configurações globais do sistema</p>
      </div>

      {/* Cobrança WhatsApp */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">💸 WhatsApp de Cobrança</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Número e instância de onde saem as mensagens de cobrança para as clínicas
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Instância WhatsApp de saída
          </label>
          <select
            value={form.clinike_billing_instance}
            onChange={e => setForm(f => ({ ...f, clinike_billing_instance: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">Selecione uma instância...</option>
            {instances.map(i => (
              <option key={i.instance_name} value={i.instance_name}>
                {i.instance_name} ({i.status})
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">
            Esta instância será usada para enviar cobranças. Escolha um número seu (Clinike), não o das clínicas.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Número do Clinike (para exibição)
          </label>
          <input
            type="text"
            placeholder="Ex: 5534999999999"
            value={form.clinike_billing_from_number}
            onChange={e => setForm(f => ({ ...f, clinike_billing_from_number: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <p className="text-xs text-slate-400 mt-1">
            Número visível para as clínicas quando receberem a cobrança
          </p>
        </div>

        {msg && (
          <div className={`text-sm px-3 py-2 rounded-lg ${msg.startsWith('✅') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {msg}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition"
        >
          {saving ? 'Salvando...' : 'Salvar configurações'}
        </button>
      </div>

      {/* Info de fluxo */}
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Como funciona o envio de cobrança</h3>
        <div className="space-y-2 text-sm text-slate-500">
          <div className="flex items-start gap-2">
            <span className="text-violet-500 font-bold mt-0.5">1.</span>
            <span>Você clica em <strong>💸 Cobrar</strong> no card de uma clínica</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-violet-500 font-bold mt-0.5">2.</span>
            <span>O sistema gera o <strong>Pix EMV</strong> com o valor e vencimento da clínica</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-violet-500 font-bold mt-0.5">3.</span>
            <span>A mensagem <strong>sai</strong> pela instância configurada aqui (seu número)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-violet-500 font-bold mt-0.5">4.</span>
            <span>A mensagem <strong>chega</strong> no telefone cadastrado na clínica (campo Telefone da Clínica)</span>
          </div>
        </div>
      </div>
    </div>
  )
}
