'use client'

import { useState } from 'react'

type Instance = {
  instance_name: string
  status: string
  clinic_id: string
  phone_number?: string | null
  clinic_name?: string
}

type Props = {
  config: Record<string, string>
  instances: Instance[]
}

export default function AdminConfigClient({ config, instances }: Props) {
  const [form, setForm] = useState({
    clinike_pix_key: config.clinike_pix_key || '',
    clinike_pix_name: config.clinike_pix_name || 'Clinike',
    clinike_pix_city: config.clinike_pix_city || '',
    clinike_billing_instance: config.clinike_billing_instance || '',
    clinike_billing_from_number: config.clinike_billing_from_number || '',
    evolution_url: config.evolution_url || '',
    evolution_master_key: config.evolution_master_key || '',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  // Nova instância
  const [newInstance, setNewInstance] = useState({ phone: '', name: '' })
  const [creatingInstance, setCreatingInstance] = useState(false)
  const [instanceMsg, setInstanceMsg] = useState<string | null>(null)
  const [showNewInstance, setShowNewInstance] = useState(false)

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
      setMsg(data.ok ? '✅ Configurações salvas!' : `❌ ${data.error}`)
    } catch {
      setMsg('❌ Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateInstance() {
    if (!newInstance.phone) { setInstanceMsg('❌ Informe o número'); return }
    setCreatingInstance(true)
    setInstanceMsg(null)
    try {
      const resp = await fetch('/api/admin/whatsapp/create-instance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: newInstance.phone, name: newInstance.name }),
      })
      const data = await resp.json()
      if (data.ok) {
        setInstanceMsg(`✅ Instância criada! Escaneie o QR Code para conectar.`)
        setNewInstance({ phone: '', name: '' })
        setShowNewInstance(false)
        setTimeout(() => window.location.reload(), 2000)
      } else {
        setInstanceMsg(`❌ ${data.error}`)
      }
    } catch {
      setInstanceMsg('❌ Erro ao criar instância')
    } finally {
      setCreatingInstance(false)
    }
  }

  const connectedInstances = instances.filter(i => i.status === 'connected')
  const allInstances = instances

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Configurações do Clinike</h1>
        <p className="text-slate-500 dark:text-slate-400">Configurações globais do sistema</p>
      </div>

      {/* Pix */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">🔑 Chave Pix para Cobrança</h2>
          <p className="text-sm text-slate-500 mt-0.5">Dados usados para gerar o código Pix das cobranças</p>
        </div>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Chave Pix (CPF, CNPJ, email ou telefone)</label>
            <input
              type="text"
              placeholder="Ex: 09561895633"
              value={form.clinike_pix_key}
              onChange={e => setForm(f => ({ ...f, clinike_pix_key: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome do recebedor</label>
              <input
                type="text"
                placeholder="Ex: Clinike"
                value={form.clinike_pix_name}
                onChange={e => setForm(f => ({ ...f, clinike_pix_name: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cidade</label>
              <input
                type="text"
                placeholder="Ex: Uberlandia"
                value={form.clinike_pix_city}
                onChange={e => setForm(f => ({ ...f, clinike_pix_city: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* WhatsApp de Cobrança */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">📱 WhatsApp de Saída (Cobrança)</h2>
          <p className="text-sm text-slate-500 mt-0.5">Instância de onde saem as mensagens de cobrança para as clínicas</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Instância de saída</label>
          <select
            value={form.clinike_billing_instance}
            onChange={e => setForm(f => ({ ...f, clinike_billing_instance: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">Selecione uma instância...</option>
            {connectedInstances.map(i => (
              <option key={i.instance_name} value={i.instance_name}>
                {i.phone_number ? `📱 ${i.phone_number}` : i.instance_name} — {i.clinic_name}
              </option>
            ))}
            {allInstances.filter(i => i.status !== 'connected').map(i => (
              <option key={i.instance_name} value={i.instance_name} disabled>
                ⚫ {i.phone_number || i.instance_name} — {i.clinic_name} (desconectado)
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">Selecione seu número pessoal do Clinike, não o de uma clínica cliente.</p>
        </div>

        {/* Cadastrar nova instância */}
        <div className="border border-dashed border-slate-200 dark:border-slate-600 rounded-xl p-4">
          <button
            onClick={() => setShowNewInstance(!showNewInstance)}
            className="text-sm font-medium text-violet-600 hover:text-violet-700 flex items-center gap-2"
          >
            {showNewInstance ? '▾' : '▸'} + Cadastrar novo número de WhatsApp
          </button>

          {showNewInstance && (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Número (com DDI)</label>
                  <input
                    type="text"
                    placeholder="Ex: 5534999999999"
                    value={newInstance.phone}
                    onChange={e => setNewInstance(n => ({ ...n, phone: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nome da instância</label>
                  <input
                    type="text"
                    placeholder="Ex: clinike-cobranca"
                    value={newInstance.name}
                    onChange={e => setNewInstance(n => ({ ...n, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>
              <button
                onClick={handleCreateInstance}
                disabled={creatingInstance}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
              >
                {creatingInstance ? 'Criando...' : 'Criar instância e conectar'}
              </button>
              {instanceMsg && (
                <p className={`text-sm ${instanceMsg.startsWith('✅') ? 'text-emerald-600' : 'text-red-600'}`}>
                  {instanceMsg}
                </p>
              )}
              <p className="text-xs text-slate-400">
                Após criar, escaneie o QR Code na tela de WhatsApp da clínica vinculada para conectar.
              </p>
            </div>
          )}
        </div>
      </div>

      {msg && (
        <div className={`text-sm px-4 py-3 rounded-xl ${msg.startsWith('✅') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {msg}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl font-medium text-sm transition"
      >
        {saving ? 'Salvando...' : 'Salvar configurações'}
      </button>

      {/* Fluxo */}
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Como funciona o envio de cobrança</h3>
        <div className="space-y-2 text-sm text-slate-500">
          {[
            'Você clica em 💸 Cobrar no card de uma clínica',
            'O sistema gera o código Pix com os dados configurados acima',
            'A mensagem sai pela instância selecionada (seu número)',
            'Chega no telefone cadastrado na clínica (campo Telefone da Clínica)',
          ].map((t, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-violet-500 font-bold">{i + 1}.</span>
              <span>{t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
