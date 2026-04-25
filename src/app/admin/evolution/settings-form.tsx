'use client'

import { useState, useTransition } from 'react'
import { saveEvolutionSettings, testEvolutionConnection, generateWebhookSecret } from './actions'

type Setting = {
  key: string
  value: string | null
  is_secret: boolean
  description: string | null
  updated_at: string
}

type FieldDef = {
  key: string
  label: string
  hint: string
  group: 'evolution' | 'n8n'
  placeholder?: string
  isUrl?: boolean
}

const FIELDS: FieldDef[] = [
  {
    key: 'evolution_url',
    label: 'URL da Evolution API',
    hint: 'Endpoint público, sem barra no final.',
    group: 'evolution',
    placeholder: 'https://evolution.cliniq.app',
    isUrl: true,
  },
  {
    key: 'evolution_master_key',
    label: 'Master API Key',
    hint: 'API key global da sua Evolution. Aparece no .env quando você sobe a Evolution.',
    group: 'evolution',
  },
  {
    key: 'evolution_webhook_secret',
    label: 'Webhook Secret',
    hint: 'Usado para validar webhooks recebidos da Evolution. Pode gerar automático.',
    group: 'evolution',
  },
  {
    key: 'n8n_donna_url',
    label: 'URL do Webhook da Donna (N8N)',
    hint: 'Onde o sistema envia mensagens recebidas pra Donna processar.',
    group: 'n8n',
    placeholder: 'https://vfrazao.app.n8n.cloud/webhook/donna-v4',
    isUrl: true,
  },
  {
    key: 'n8n_donna_secret',
    label: 'Secret de chamadas da Donna',
    hint: 'Header enviado pra Donna autenticar que a chamada veio do Cliniq.',
    group: 'n8n',
  },
]

export default function EvolutionSettingsForm({ initial }: { initial: Record<string, Setting> }) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map(f => [f.key, initial[f.key]?.value ?? '']))
  )
  const [show, setShow] = useState<Record<string, boolean>>({})
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null)
  const [testing, setTesting] = useState(false)

  function update(key: string, value: string) {
    setValues(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setFeedback(null)
    startTransition(async () => {
      try {
        await saveEvolutionSettings(values)
        setFeedback({ type: 'success', msg: 'Configurações salvas.' })
      } catch (e) {
        setFeedback({ type: 'error', msg: e instanceof Error ? e.message : 'Erro ao salvar' })
      }
    })
  }

  async function handleTest() {
    setFeedback(null)
    setTesting(true)
    try {
      const r = await testEvolutionConnection({
        url: values.evolution_url,
        apiKey: values.evolution_master_key,
      })
      if (r.ok) {
        setFeedback({
          type: 'success',
          msg: `Conexão OK. Instâncias encontradas: ${r.instances.length}.`,
        })
      } else {
        setFeedback({ type: 'error', msg: r.error })
      }
    } finally {
      setTesting(false)
    }
  }

  async function handleGenSecret() {
    const v = await generateWebhookSecret()
    update('evolution_webhook_secret', v)
    setFeedback({ type: 'info', msg: 'Secret gerado. Lembre de salvar.' })
  }

  const groups: Array<{ id: 'evolution' | 'n8n'; title: string; description: string }> = [
    {
      id: 'evolution',
      title: 'Evolution API (WhatsApp)',
      description: 'Servidor único compartilhado por todas as clínicas. Cada clínica cria a própria instance.',
    },
    {
      id: 'n8n',
      title: 'N8N (Donna)',
      description: 'Workflow conversacional. Recebe mensagens de qualquer clínica com clinic_id no payload.',
    },
  ]

  return (
    <form
      className="space-y-6"
      autoComplete="off"
      onSubmit={e => e.preventDefault()}
    >
      {groups.map(g => (
        <section
          key={g.id}
          className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
        >
          <header className="p-5 border-b border-slate-100 dark:border-slate-700">
            <h2 className="font-semibold text-slate-900 dark:text-white">{g.title}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{g.description}</p>
          </header>

          <div className="p-5 space-y-4">
            {/* hidden honeypot pra evitar autofill agressivo do Chrome */}
            <input
              type="text"
              name="email"
              autoComplete="username"
              tabIndex={-1}
              aria-hidden="true"
              style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
              defaultValue=""
              onChange={() => {}}
            />
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              tabIndex={-1}
              aria-hidden="true"
              style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
              defaultValue=""
              onChange={() => {}}
            />
            {FIELDS.filter(f => f.group === g.id).map(f => {
              const isSecret = initial[f.key]?.is_secret ?? false
              const visible = show[f.key]
              const inputType = isSecret && !visible ? 'password' : f.isUrl ? 'url' : 'text'
              return (
                <div key={f.key}>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    {f.label}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type={inputType}
                      name={`cfg-${f.key}`}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-form-type="other"
                      value={values[f.key] ?? ''}
                      onChange={e => update(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className="flex-1 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                    />
                    {isSecret && (
                      <button
                        type="button"
                        onClick={() => setShow(s => ({ ...s, [f.key]: !s[f.key] }))}
                        className="px-3 py-2 text-xs rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                      >
                        {visible ? 'Ocultar' : 'Mostrar'}
                      </button>
                    )}
                    {f.key === 'evolution_webhook_secret' && (
                      <button
                        type="button"
                        onClick={handleGenSecret}
                        className="px-3 py-2 text-xs rounded-lg bg-violet-100 text-violet-700 hover:bg-violet-200"
                      >
                        Gerar
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{f.hint}</p>
                </div>
              )
            })}
          </div>
        </section>
      ))}

      {feedback && (
        <div
          className={`rounded-lg p-3 text-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
              : feedback.type === 'error'
              ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
              : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
          }`}
        >
          {feedback.msg}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleTest}
          disabled={testing || !values.evolution_url || !values.evolution_master_key}
          className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 text-sm font-medium disabled:opacity-50"
        >
          {testing ? 'Testando…' : 'Testar conexão Evolution'}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="px-5 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 text-sm font-semibold disabled:opacity-50"
        >
          {pending ? 'Salvando…' : 'Salvar configurações'}
        </button>
      </div>
    </form>
  )
}
