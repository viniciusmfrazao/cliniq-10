'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type InstanceState = {
  configured: boolean
  status: 'pending' | 'qr_pending' | 'connected' | 'disconnected' | 'error'
  instance_name?: string | null
  phone_number?: string | null
  qr_code?: string | null
  qr_expires_at?: string | null
  connected_at?: string | null
  last_event_at?: string | null
}

const POLL_INTERVAL_MS = 3000

function formatPhoneBR(raw: string | null | undefined): string {
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  // 5534988880000 -> +55 (34) 9 8888-0000
  const m = digits.match(/^(\d{2})(\d{2})(\d{1})(\d{4})(\d{4})$/)
  if (m) return `+${m[1]} (${m[2]}) ${m[3]} ${m[4]}-${m[5]}`
  const m2 = digits.match(/^(\d{2})(\d{2})(\d{4})(\d{4})$/)
  if (m2) return `+${m2[1]} (${m2[2]}) ${m2[3]}-${m2[4]}`
  return raw
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return 'agora mesmo'
  const min = Math.floor(ms / 60_000)
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  return `há ${d} dia${d > 1 ? 's' : ''}`
}

type DiagnoseResult = {
  ok: boolean
  local?: {
    instance_name?: string
    status?: string
    phone_number?: string | null
    connected_at?: string | null
    last_event_at?: string | null
    webhook_token_len?: number
  } | null
  expected?: { webhook_url?: string }
  evolution?: {
    connection?: unknown
    webhook?: unknown
  }
  message?: string
  error?: string
}

export default function WhatsappConfigPage() {
  const [state, setState] = useState<InstanceState | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [diag, setDiag] = useState<DiagnoseResult | null>(null)
  const [diagOpen, setDiagOpen] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/whatsapp/instance', { cache: 'no-store' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data: InstanceState = await r.json()
      setState(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Polling enquanto status é qr_pending pra detectar conexão
  useEffect(() => {
    const shouldPoll = state?.status === 'qr_pending'
    if (shouldPoll && !pollRef.current) {
      pollRef.current = setInterval(refresh, POLL_INTERVAL_MS)
    }
    if (!shouldPoll && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [state?.status, refresh])

  async function provisionAndQr() {
    setError(null)
    setBusy('provision')
    try {
      const r1 = await fetch('/api/whatsapp/instance', { method: 'POST' })
      const j1 = await r1.json()
      if (!r1.ok) throw new Error(j1.error || `HTTP ${r1.status}`)

      const r2 = await fetch('/api/whatsapp/instance/connect', { method: 'POST' })
      const j2 = await r2.json()
      if (!r2.ok) throw new Error(j2.error || `HTTP ${r2.status}`)

      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setBusy(null)
    }
  }

  async function refreshQr() {
    setError(null)
    setBusy('qr')
    try {
      const r = await fetch('/api/whatsapp/instance/connect', { method: 'POST' })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setBusy(null)
    }
  }

  async function disconnect() {
    if (!confirm('Desconectar o WhatsApp? Você poderá reconectar depois lendo um novo QR code.')) {
      return
    }
    setError(null)
    setBusy('disconnect')
    try {
      const r = await fetch('/api/whatsapp/instance/disconnect', { method: 'POST' })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setBusy(null)
    }
  }

  async function runDiagnose() {
    setError(null)
    setBusy('diagnose')
    try {
      const r = await fetch('/api/whatsapp/instance/diagnose', { cache: 'no-store' })
      const j: DiagnoseResult = await r.json()
      setDiag(j)
      setDiagOpen(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setBusy(null)
    }
  }

  async function refixWebhook() {
    setError(null)
    setBusy('refix')
    try {
      const r = await fetch('/api/whatsapp/instance/diagnose', { method: 'POST' })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      await runDiagnose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setBusy(null)
    }
  }

  async function destroy() {
    if (
      !confirm(
        'Remover completamente a configuração do WhatsApp dessa clínica? Essa ação apaga a instance no servidor.',
      )
    )
      return
    setError(null)
    setBusy('destroy')
    try {
      const r = await fetch('/api/whatsapp/instance', { method: 'DELETE' })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
          <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-2xl" />
        </div>
      </div>
    )
  }

  const status = state?.status ?? 'pending'

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">WhatsApp da Clínica</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Conecte seu número de WhatsApp pra receber e responder mensagens dos pacientes
            diretamente pelo sistema.
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 p-4 text-sm">
          {error}
        </div>
      )}

      {/* Estado: nunca configurado ou desconectado */}
      {(status === 'pending' || status === 'disconnected') && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-6 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-green-500 rounded-2xl flex items-center justify-center shadow-lg">
                <WhatsappIcon className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white">
                  {status === 'disconnected' ? 'WhatsApp desconectado' : 'Conecte seu WhatsApp'}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                  {status === 'disconnected'
                    ? 'Sua sessão expirou ou foi encerrada. Conecte de novo lendo um QR code.'
                    : 'Use o WhatsApp do celular pra escanear o QR e ativar o número da clínica.'}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <ol className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
              <Step n={1}>Abra o WhatsApp no celular da clínica</Step>
              <Step n={2}>
                Toque em <strong>Configurações &rarr; Aparelhos conectados</strong>
              </Step>
              <Step n={3}>
                Toque em <strong>Conectar um aparelho</strong>
              </Step>
              <Step n={4}>Escaneie o QR code que vai aparecer aqui</Step>
            </ol>

            <button
              onClick={provisionAndQr}
              disabled={busy !== null}
              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy === 'provision' ? 'Gerando QR…' : '📱 Conectar meu WhatsApp'}
            </button>
          </div>
        </div>
      )}

      {/* Estado: QR pendente */}
      {status === 'qr_pending' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
              </span>
              <h2 className="font-bold text-slate-900 dark:text-white">
                Aguardando você escanear…
              </h2>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-[auto,1fr] gap-6 items-start">
            <div className="flex flex-col items-center gap-3">
              <div className="w-64 h-64 bg-white border-2 border-slate-200 dark:border-slate-600 rounded-2xl p-3 shadow-inner flex items-center justify-center">
                {state?.qr_code ? (
                  <QRImage src={state.qr_code} />
                ) : (
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-slate-500 mt-3">Gerando QR…</p>
                  </div>
                )}
              </div>
              <button
                onClick={refreshQr}
                disabled={busy !== null}
                className="text-xs text-violet-600 dark:text-violet-400 hover:underline disabled:opacity-50"
              >
                {busy === 'qr' ? 'Gerando…' : '🔄 Gerar novo QR'}
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2 text-sm">
                  Como escanear
                </h3>
                <ol className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <Step n={1}>WhatsApp &rarr; Configurações</Step>
                  <Step n={2}>Aparelhos conectados &rarr; Conectar aparelho</Step>
                  <Step n={3}>Aponta a câmera pro QR ao lado</Step>
                </ol>
              </div>

              <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-300">
                ⚠️ O QR expira em ~50 segundos. Se sumir antes de você escanear, clica em
                <strong> Gerar novo QR</strong>.
              </div>

              <button
                onClick={destroy}
                disabled={busy !== null}
                className="text-xs text-slate-500 hover:text-rose-600 underline disabled:opacity-50"
              >
                Cancelar configuração
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Estado: conectado */}
      {status === 'connected' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-emerald-200 dark:border-emerald-700 overflow-hidden shadow-sm">
          <div className="p-6 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border-b border-emerald-100 dark:border-emerald-800">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-green-500 rounded-2xl flex items-center justify-center shadow-lg">
                <WhatsappIcon className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-slate-900 dark:text-white">WhatsApp conectado</h2>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                  Mensagens dos pacientes chegam em <strong>WhatsApp</strong> no menu lateral.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Número conectado" value={formatPhoneBR(state?.phone_number) || '—'} />
              <Field
                label="Conectado"
                value={
                  state?.connected_at
                    ? new Date(state.connected_at).toLocaleString('pt-BR', {
                        timeZone: 'America/Sao_Paulo',
                      })
                    : '—'
                }
              />
              <Field label="Última atividade" value={timeAgo(state?.last_event_at) || '—'} />
              <Field
                label="Identificador da instance"
                value={state?.instance_name || '—'}
                mono
              />
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={disconnect}
                disabled={busy !== null}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition disabled:opacity-50"
              >
                {busy === 'disconnect' ? 'Desconectando…' : 'Desconectar'}
              </button>
              <button
                onClick={destroy}
                disabled={busy !== null}
                className="px-4 py-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-sm font-medium transition disabled:opacity-50"
              >
                {busy === 'destroy' ? 'Removendo…' : 'Remover instance'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Estado: erro */}
      {status === 'error' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-rose-200 dark:border-rose-800 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-400">
              ⚠️
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white">Algo deu errado</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Tenta gerar um novo QR ou remover e configurar de novo.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={refreshQr}
              disabled={busy !== null}
              className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
            >
              Tentar novamente
            </button>
            <button
              onClick={destroy}
              disabled={busy !== null}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium disabled:opacity-50"
            >
              Remover e começar do zero
            </button>
          </div>
        </div>
      )}

      {/* Help */}
      <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800 rounded-2xl p-5 text-sm text-slate-700 dark:text-slate-300">
        <h3 className="font-bold text-slate-900 dark:text-white mb-2">Boas práticas</h3>
        <ul className="space-y-1.5 list-disc list-inside text-xs">
          <li>Use um número exclusivo da clínica — evita misturar com WhatsApp pessoal.</li>
          <li>O número precisa estar ativo no celular pelo menos 1x por semana.</li>
          <li>
            Não use WhatsApp Web no mesmo número em outro computador — pode derrubar a sessão.
          </li>
          <li>Se cair, é só voltar aqui e gerar um novo QR.</li>
        </ul>
      </div>

      {/* Diagnóstico avançado */}
      <details
        className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden"
        open={diagOpen}
        onToggle={(e) => setDiagOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer p-4 text-sm font-semibold text-slate-700 dark:text-slate-200 select-none hover:bg-slate-100 dark:hover:bg-slate-800 transition">
          🔧 Diagnóstico avançado
        </summary>
        <div className="p-4 pt-0 space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Se as mensagens não estão chegando mesmo com o WhatsApp conectado, use estas
            ferramentas pra verificar a integração com a Evolution.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={runDiagnose}
              disabled={busy !== null}
              className="px-3 py-1.5 text-xs rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50"
            >
              {busy === 'diagnose' ? 'Verificando…' : 'Verificar configuração'}
            </button>
            <button
              onClick={refixWebhook}
              disabled={busy !== null}
              className="px-3 py-1.5 text-xs rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {busy === 'refix' ? 'Refixando…' : 'Refixar webhook na Evolution'}
            </button>
          </div>
          {diag && (
            <pre className="mt-2 p-3 bg-slate-900 text-emerald-300 rounded-lg text-[11px] leading-relaxed overflow-x-auto max-h-96">
              {JSON.stringify(diag, null, 2)}
            </pre>
          )}
        </div>
      </details>
    </div>
  )
}

function StatusBadge({ status }: { status: InstanceState['status'] }) {
  const map: Record<InstanceState['status'], { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-slate-100 text-slate-600', text: '⚪', label: 'Não configurado' },
    qr_pending: { bg: 'bg-amber-100 text-amber-700', text: '🟡', label: 'Aguardando QR' },
    connected: { bg: 'bg-emerald-100 text-emerald-700', text: '🟢', label: 'Conectado' },
    disconnected: { bg: 'bg-slate-100 text-slate-600', text: '⚪', label: 'Desconectado' },
    error: { bg: 'bg-rose-100 text-rose-700', text: '🔴', label: 'Erro' },
  }
  const m = map[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${m.bg} dark:bg-opacity-20`}
    >
      <span>{m.text}</span>
      <span>{m.label}</span>
    </span>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 items-start">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs font-bold flex items-center justify-center">
        {n}
      </span>
      <span className="leading-relaxed">{children}</span>
    </li>
  )
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p
        className={`mt-1 text-sm text-slate-900 dark:text-slate-100 ${
          mono ? 'font-mono text-xs' : 'font-medium'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

function QRImage({ src }: { src: string }) {
  // Evolution geralmente devolve "data:image/png;base64,..."; suportamos os dois.
  const final = src.startsWith('data:') ? src : `data:image/png;base64,${src}`
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={final} alt="QR Code do WhatsApp" className="w-full h-full object-contain" />
}

function WhatsappIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}
