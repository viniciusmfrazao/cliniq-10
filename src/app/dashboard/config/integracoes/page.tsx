'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'

export default function IntegracoesPage() {
  const [n8nUrl, setN8nUrl] = useState('https://vfrazao.app.n8n.cloud')
  const [webhooks, setWebhooks] = useState({
    appointment_created: '',
    appointment_reminder: '',
    appointment_checkin: '',
    patient_birthday: '',
    lead_created: '',
    nps_request: '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  const webhookEvents = [
    { 
      key: 'appointment_created', 
      label: 'Novo Agendamento', 
      description: 'Disparado quando um agendamento é criado',
      icon: 'calendar',
      color: 'blue'
    },
    { 
      key: 'appointment_reminder', 
      label: 'Lembrete de Consulta', 
      description: 'Disparado 24h e 2h antes da consulta',
      icon: 'clock',
      color: 'amber'
    },
    { 
      key: 'appointment_checkin', 
      label: 'Check-in do Paciente', 
      description: 'Disparado quando paciente faz check-in na recepção',
      icon: 'userCheck',
      color: 'emerald'
    },
    { 
      key: 'patient_birthday', 
      label: 'Aniversário', 
      description: 'Disparado às 8h no dia do aniversário',
      icon: 'gift',
      color: 'pink'
    },
    { 
      key: 'lead_created', 
      label: 'Novo Lead no CRM', 
      description: 'Disparado quando um lead é criado',
      icon: 'target',
      color: 'violet'
    },
    { 
      key: 'nps_request', 
      label: 'Pesquisa NPS', 
      description: 'Disparado após atendimento para coletar avaliação',
      icon: 'star',
      color: 'yellow'
    },
  ]

  async function handleSave() {
    setSaving(true)
    // Aqui você pode salvar no banco de dados se necessário
    // Por agora, vamos usar variáveis de ambiente
    
    // Simular salvamento
    await new Promise(r => setTimeout(r, 1000))
    
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function testWebhook(event: string, url: string) {
    if (!url) {
      setTestResult(`❌ URL não configurada para ${event}`)
      return
    }

    setTestResult(`🔄 Testando ${event}...`)
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event,
          data: { test: true, message: 'Teste de conexão do Cliniq' },
          timestamp: new Date().toISOString()
        })
      })

      if (response.ok) {
        setTestResult(`✅ Webhook ${event} funcionando!`)
      } else {
        setTestResult(`❌ Erro ${response.status}: ${response.statusText}`)
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      setTestResult(`❌ Erro de conexão: ${errorMessage}`)
    }

    setTimeout(() => setTestResult(null), 5000)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Integrações</h1>
        <p className="text-sm text-slate-500 mt-1">Configure webhooks para automação com n8n</p>
      </div>

      {/* n8n Connection */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-orange-50 to-red-50">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white text-2xl font-bold">n8n</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">n8n Workflow Automation</h2>
              <p className="text-sm text-slate-600">Conecte com seu n8n para automações de WhatsApp</p>
            </div>
            <div className="ml-auto">
              <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
                Configurado
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
              URL do n8n
            </label>
            <input
              type="url"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              value={n8nUrl}
              onChange={e => setN8nUrl(e.target.value)}
              placeholder="https://seu-n8n.app.n8n.cloud"
            />
          </div>

          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-sm text-slate-600 mb-2">
              <strong>Webhook de retorno do Cliniq:</strong>
            </p>
            <code className="text-xs bg-slate-200 px-2 py-1 rounded">
              {typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/n8n
            </code>
            <p className="text-xs text-slate-500 mt-2">
              Use esta URL no n8n para enviar respostas de volta ao Cliniq
            </p>
          </div>
        </div>
      </div>

      {/* Webhooks Configuration */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Webhooks de Eventos</h2>
          <p className="text-sm text-slate-500 mt-1">
            Configure as URLs do n8n para cada tipo de evento
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          {webhookEvents.map(event => (
            <div key={event.key} className="p-4 hover:bg-slate-50 transition-colors">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 bg-${event.color}-100 rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <Icon name={event.icon} className={`w-5 h-5 text-${event.color}-600`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-slate-900">{event.label}</p>
                    <code className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                      {event.key}
                    </code>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">{event.description}</p>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                      placeholder={`${n8nUrl}/webhook/cliniq-${event.key.replace('_', '-')}`}
                      value={webhooks[event.key as keyof typeof webhooks]}
                      onChange={e => setWebhooks(prev => ({ ...prev, [event.key]: e.target.value }))}
                    />
                    <button
                      onClick={() => testWebhook(event.key, webhooks[event.key as keyof typeof webhooks] || `${n8nUrl}/webhook/cliniq-${event.key.replace('_', '-')}`)}
                      className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                    >
                      Testar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Test Result */}
      {testResult && (
        <div className={`p-4 rounded-xl ${
          testResult.startsWith('✅') ? 'bg-emerald-50 text-emerald-700' :
          testResult.startsWith('❌') ? 'bg-red-50 text-red-700' :
          'bg-blue-50 text-blue-700'
        }`}>
          {testResult}
        </div>
      )}

      {/* Instructions */}
      <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl border border-violet-100 p-6">
        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Icon name="info" className="w-5 h-5 text-violet-600" />
          Como configurar no n8n
        </h3>
        
        <ol className="space-y-3 text-sm text-slate-700">
          <li className="flex gap-2">
            <span className="w-6 h-6 bg-violet-100 text-violet-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
            <span>No n8n, crie um novo workflow e adicione um nó <strong>"Webhook"</strong></span>
          </li>
          <li className="flex gap-2">
            <span className="w-6 h-6 bg-violet-100 text-violet-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
            <span>Configure o método como <strong>POST</strong> e copie a URL do webhook</span>
          </li>
          <li className="flex gap-2">
            <span className="w-6 h-6 bg-violet-100 text-violet-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
            <span>Cole a URL no campo correspondente acima</span>
          </li>
          <li className="flex gap-2">
            <span className="w-6 h-6 bg-violet-100 text-violet-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
            <span>Adicione os nós de <strong>WhatsApp</strong> (Evolution API, Z-API, etc) para enviar as mensagens</span>
          </li>
          <li className="flex gap-2">
            <span className="w-6 h-6 bg-violet-100 text-violet-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">5</span>
            <span>Ative o workflow e teste usando o botão "Testar" acima</span>
          </li>
        </ol>

        <div className="mt-4 p-3 bg-white/50 rounded-xl">
          <p className="text-xs text-slate-600">
            <strong>Dados enviados pelo Cliniq:</strong> Cada webhook envia um JSON com <code>event</code>, <code>data</code> (informações do paciente, agendamento, etc) e <code>timestamp</code>.
          </p>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
        >
          {saving ? 'Salvando...' : saved ? '✓ Salvo!' : 'Salvar configurações'}
        </button>
      </div>
    </div>
  )
}
