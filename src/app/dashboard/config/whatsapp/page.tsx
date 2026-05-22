'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type InstanceStatus =
  | 'pending'
  | 'qr_pending'
  | 'connected'
  | 'disconnected'
  | 'error'

type InstanceItem = {
  id: string
  instance_name: string
  phone_number: string | null
  status: InstanceStatus
  qr_code: string | null
  qr_expires_at: string | null
  connected_at: string | null
  last_event_at: string | null
  auto_reply_enabled: boolean
  is_default: boolean
  role_inbound: boolean
  role_outbound_automation: boolean
  role_outbound_manual: boolean
  label: string | null
  assigned_to: string | null
}

type ApiState = {
  configured: boolean
  status: InstanceStatus
  instances: InstanceItem[]
}

const POLL_INTERVAL_MS = 3000

function formatPhoneBR(raw: string | null | undefined): string {
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
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

export default function WhatsappConfigPage() {
  const [state, setState] = useState<ApiState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [hasEva, setHasEva] = useState(true) // default true enquanto carrega
  const [showAddForm, setShowAddForm] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [r, mR] = await Promise.all([
        fetch('/api/whatsapp/instance', { cache: 'no-store' }),
        fetch('/api/clinic/modules', { cache: 'no-store' }),
      ])
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data = await r.json()
      setState(data)
      if (mR.ok) {
        const mData = await mR.json()
        const modules: string[] = mData.active_modules || []
        setHasEva(modules.length === 0 || modules.includes('eva_ia'))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const hasQrPending = state?.instances?.some((i: InstanceItem) => i.status === 'qr_pending')
  useEffect(() => {
    if (hasQrPending && !pollRef.current) {
      pollRef.current = setInterval(refresh, POLL_INTERVAL_MS)
    }
    if (!hasQrPending && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [hasQrPending, refresh])

  async function provisionFirst() {
    setError(null)
    setBusy('provision')
    try {
      const r1 = await fetch('/api/whatsapp/instance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
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

  async function addNewNumber() {
    setError(null)
    setBusy('add_new')
    try {
      const r1 = await fetch('/api/whatsapp/instance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          add_new: true,
          label: newLabel.trim() || null,
        }),
      })
      const j1 = await r1.json()
      if (!r1.ok) throw new Error(j1.error || `HTTP ${r1.status}`)

      const created = j1.instance_name as string
      const r2 = await fetch('/api/whatsapp/instance/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instance_name: created }),
      })
      const j2 = await r2.json()
      if (!r2.ok) throw new Error(j2.error || `HTTP ${r2.status}`)

      setShowAddForm(false)
      setNewLabel('')
      setExpandedId(created)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setBusy(null)
    }
  }

  async function refreshQr(instance: InstanceItem) {
    setError(null)
    setBusy(`qr-${instance.instance_name}`)
    try {
      const r = await fetch('/api/whatsapp/instance/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instance_name: instance.instance_name }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setBusy(null)
    }
  }

  async function disconnect(instance: InstanceItem) {
    if (!confirm(`Desconectar o WhatsApp ${instance.label || instance.instance_name}?`)) {
      return
    }
    setError(null)
    setBusy(`disconnect-${instance.instance_name}`)
    try {
      const r = await fetch(
        `/api/whatsapp/instance/disconnect?instance_name=${encodeURIComponent(instance.instance_name)}`,
        { method: 'POST' },
      )
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setBusy(null)
    }
  }

  async function destroy(instance: InstanceItem) {
    const confirmText =
      state?.instances && state.instances.length > 1
        ? `Remover o número "${instance.label || instance.instance_name}"? Os outros números da clínica continuam funcionando.`
        : 'Remover completamente a configuração do WhatsApp dessa clínica?'
    if (!confirm(confirmText)) return
    setError(null)
    setBusy(`destroy-${instance.instance_name}`)
    try {
      const r = await fetch(
        `/api/whatsapp/instance?instance_name=${encodeURIComponent(instance.instance_name)}`,
        { method: 'DELETE' },
      )
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setBusy(null)
    }
  }

  async function patchInstance(
    instance: InstanceItem,
    body: Record<string, unknown>,
    busyKey: string,
  ) {
    setError(null)
    setBusy(busyKey)
    try {
      const r = await fetch('/api/whatsapp/instance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instance_name: instance.instance_name, ...body }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setBusy(null)
    }
  }

  async function forceReset(instance: InstanceItem) {
    if (
      !confirm(
        '🔥 RESET TOTAL DESTE NÚMERO\n\n' +
          'Vai apagar a instância antiga, criar uma nova e gerar QR.\n' +
          'Você precisa estar com o celular em mãos pra escanear.\n\n' +
          'Continuar?',
      )
    )
      return
    setError(null)
    setBusy(`reset-${instance.instance_name}`)
    try {
      const r = await fetch(
        `/api/whatsapp/instance/force-reset?instance_name=${encodeURIComponent(instance.instance_name)}`,
        { method: 'POST' },
      )
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      await refresh()
      setExpandedId(j.instance_name || null)
      alert('✅ Reset feito! Escaneie o QR que vai aparecer agora.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
          <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-2xl" />
        </div>
      </div>
    )
  }

  const instances = state?.instances ?? []
  const noInstances = instances.length === 0

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Números de WhatsApp da clínica
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Conecte um ou mais números pra receber mensagens, mandar automações
            (NPS, lembretes, aniversário) e responder pelo painel.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 p-4 text-sm">
          {error}
        </div>
      )}

      {/* Caso vazio: primeiro número */}
      {noInstances && (
        <FirstTimeSetup busy={busy} onProvision={provisionFirst} />
      )}

      {/* Lista de números */}
      {!noInstances && (
        <div className="space-y-4">
          {instances.map(inst => (
            <InstanceCard
              key={inst.id}
              instance={inst}
              expanded={expandedId === inst.instance_name}
              onToggleExpand={() =>
                setExpandedId(prev =>
                  prev === inst.instance_name ? null : inst.instance_name,
                )
              }
              busy={busy}
              onRefreshQr={() => refreshQr(inst)}
              onDisconnect={() => disconnect(inst)}
              onDestroy={() => destroy(inst)}
              onForceReset={() => forceReset(inst)}
              onSetDefault={() =>
                patchInstance(inst, { is_default: true }, `default-${inst.instance_name}`)
              }
              hasEva={hasEva}
              onUpdateRole={async (role, value) => {
                // Exclusividade: Eva só pode atender em 1 número por vez
                if (role === 'role_inbound' && value === true) {
                  // Desativa role_inbound em todos os outros números
                  const others = instances.filter(
                    (i) => i.instance_name !== inst.instance_name && i.role_inbound
                  )
                  for (const other of others) {
                    await patchInstance(other, { role_inbound: false, auto_reply_enabled: false }, `role-${other.instance_name}-role_inbound`)
                  }
                }
                // Sincroniza auto_reply_enabled com role_inbound
                // (o cron de follow-up usa auto_reply_enabled para decidir se dispara)
                const patch: Record<string, boolean> = { [role]: value }
                if (role === 'role_inbound') patch.auto_reply_enabled = value
                patchInstance(inst, patch, `role-${inst.instance_name}-${role}`)
              }}
              onSaveLabel={label =>
                patchInstance(inst, { label }, `label-${inst.instance_name}`)
              }
            />
          ))}

          {/* Adicionar novo número */}
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full p-4 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition flex items-center justify-center gap-2 text-sm font-medium"
            >
              <span className="text-xl">+</span>
              Adicionar outro número de WhatsApp
            </button>
          )}

          {showAddForm && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Apelido pra esse número (opcional)
                </label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  placeholder="Ex: Comercial, Operacional, Recepção da Maria"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Você pode mudar depois. Ajuda a identificar quando tem mais de um número.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addNewNumber}
                  disabled={busy === 'add_new'}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                >
                  {busy === 'add_new' ? 'Criando…' : '📱 Criar e gerar QR'}
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false)
                    setNewLabel('')
                  }}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm font-medium"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800 rounded-2xl p-5 text-sm text-slate-700 dark:text-slate-300">
        <h3 className="font-bold text-slate-900 dark:text-white mb-2">
          Como organizar quando tenho mais de um número
        </h3>
        <ul className="space-y-1.5 list-disc list-inside text-xs">
          <li>
            <strong>Eva atende</strong>: marque os números onde a Eva responde
            mensagens recebidas (geralmente o número comercial/marketing).
          </li>
          <li>
            <strong>Sai automação</strong>: NPS, lembrete, aniversário e recall
            saem por aqui (ex: número operacional).
          </li>
          <li>
            <strong>Pode usar pelo painel</strong>: a secretária consegue
            iniciar conversas por esse número.
          </li>
          <li>
            O número marcado como <strong>padrão</strong> é o fallback quando
            nenhuma outra regra se aplica.
          </li>
        </ul>
      </div>
    </div>
  )
}

function FirstTimeSetup({
  busy,
  onProvision,
}: {
  busy: string | null
  onProvision: () => void
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="p-6 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-green-500 rounded-2xl flex items-center justify-center shadow-lg">
            <WhatsappIcon className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white">
              Conecte seu primeiro número de WhatsApp
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
              Use o WhatsApp do celular pra escanear o QR e ativar o número da clínica.
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
          onClick={onProvision}
          disabled={busy !== null}
          className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy === 'provision' ? 'Gerando QR…' : '📱 Conectar meu WhatsApp'}
        </button>
      </div>
    </div>
  )
}

function InstanceCard({
  instance,
  expanded,
  onToggleExpand,
  busy,
  onRefreshQr,
  onDisconnect,
  onDestroy,
  onForceReset,
  onSetDefault,
  onUpdateRole,
  onSaveLabel,
}: {
  instance: InstanceItem
  expanded: boolean
  onToggleExpand: () => void
  busy: string | null
  onRefreshQr: () => void
  onDisconnect: () => void
  onDestroy: () => void
  onForceReset: () => void
  onSetDefault: () => void
  hasEva?: boolean
  onUpdateRole: (
    role: 'role_inbound' | 'role_outbound_automation' | 'role_outbound_manual',
    value: boolean,
  ) => void
  onSaveLabel: (label: string) => void
}) {
  const [labelDraft, setLabelDraft] = useState(instance.label || '')
  const [editingLabel, setEditingLabel] = useState(false)

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full p-5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-500 rounded-xl flex items-center justify-center shadow flex-shrink-0">
              <WhatsappIcon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                  {instance.label || formatPhoneBR(instance.phone_number) || instance.instance_name}
                </p>
                {instance.is_default && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
                    PADRÃO
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {formatPhoneBR(instance.phone_number) || 'sem número conectado'}
                {instance.last_event_at && (
                  <>
                    {' · '}
                    <span>{timeAgo(instance.last_event_at)}</span>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={instance.status} />
            <span
              className={`text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            >
              ▼
            </span>
          </div>
        </div>

        {/* Papeis em chips */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {hasEva && <RoleChip
            active={instance.role_inbound}
            label="Eva atende"
            emoji="📥"
            title="Eva responde mensagens recebidas neste número"
          />}
          <RoleChip
            active={instance.role_outbound_automation}
            label="Sai automação"
            emoji="🤖"
            title="NPS, lembrete, aniversário e recall saem por aqui"
          />
          <RoleChip
            active={instance.role_outbound_manual}
            label="Manual"
            emoji="✍️"
            title="Secretária pode usar pra responder pelo painel"
          />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-700 p-5 space-y-5">
          {/* Editar label */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Apelido
            </label>
            {editingLabel ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={labelDraft}
                  onChange={e => setLabelDraft(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                  placeholder="Ex: Comercial"
                  autoFocus
                />
                <button
                  onClick={() => {
                    onSaveLabel(labelDraft.trim() || '')
                    setEditingLabel(false)
                  }}
                  className="px-3 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700"
                >
                  Salvar
                </button>
                <button
                  onClick={() => {
                    setLabelDraft(instance.label || '')
                    setEditingLabel(false)
                  }}
                  className="px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-sm text-slate-900 dark:text-slate-100 font-medium">
                  {instance.label || (
                    <span className="text-slate-400 italic">Sem apelido</span>
                  )}
                </p>
                <button
                  onClick={() => setEditingLabel(true)}
                  className="text-xs text-violet-600 hover:underline"
                >
                  editar
                </button>
              </div>
            )}
          </div>

          {/* Toggles de papel */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Pra que esse número é usado
            </p>
            {hasEva && <RoleToggle
              label="Eva atende mensagens recebidas aqui"
              hint="Quando o paciente manda mensagem nesse número, a Eva responde automaticamente."
              checked={instance.role_inbound}
              onChange={v => onUpdateRole('role_inbound', v)}
            />}
            <RoleToggle
              label="Automação sai por aqui"
              hint="NPS pós-atendimento, lembretes, aniversários e recall de inativos saem deste número."
              checked={instance.role_outbound_automation}
              onChange={v => onUpdateRole('role_outbound_automation', v)}
            />
            <RoleToggle
              label="Secretária pode usar manualmente"
              hint="Aparece no painel /whatsapp como número disponível pra responder."
              checked={instance.role_outbound_manual}
              onChange={v => onUpdateRole('role_outbound_manual', v)}
            />
          </div>

          {/* QR + ações de conexão */}
          {instance.status === 'qr_pending' && instance.qr_code && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-2">
                Aguardando você escanear…
              </p>
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <div className="w-48 h-48 bg-white border-2 border-amber-300 dark:border-amber-700 rounded-xl p-2 flex-shrink-0">
                  <QRImage src={instance.qr_code} />
                </div>
                <div className="text-xs text-amber-800 dark:text-amber-300 space-y-2">
                  <p>
                    No celular: <strong>3 pontinhos → Aparelhos conectados →
                    Conectar um aparelho</strong>. Aponta a câmera pro QR ao lado.
                  </p>
                  <p className="text-[11px]">
                    O QR expira em ~50 segundos. Se sumir, clica em &quot;Gerar novo QR&quot;.
                  </p>
                  <button
                    onClick={onRefreshQr}
                    disabled={busy !== null}
                    className="text-xs text-violet-600 hover:underline disabled:opacity-50"
                  >
                    🔄 Gerar novo QR
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Detalhes técnicos */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Conectado em
              </p>
              <p className="text-slate-700 dark:text-slate-200 mt-0.5">
                {instance.connected_at
                  ? new Date(instance.connected_at).toLocaleString('pt-BR', {
                      timeZone: 'America/Sao_Paulo',
                    })
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Última atividade
              </p>
              <p className="text-slate-700 dark:text-slate-200 mt-0.5">
                {timeAgo(instance.last_event_at) || '—'}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Identificador da instance
              </p>
              <p className="font-mono text-[11px] text-slate-700 dark:text-slate-200 mt-0.5 break-all">
                {instance.instance_name}
              </p>
            </div>
          </div>

          {/* Ações */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
            {!instance.is_default && (
              <button
                onClick={onSetDefault}
                disabled={busy !== null}
                className="px-3 py-1.5 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs font-semibold hover:bg-violet-200 dark:hover:bg-violet-900/50 disabled:opacity-50"
              >
                ⭐ Marcar como padrão
              </button>
            )}
            {(instance.status === 'qr_pending' || instance.status === 'error') && (
              <button
                onClick={onRefreshQr}
                disabled={busy !== null}
                className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 disabled:opacity-50"
              >
                🔄 Gerar QR
              </button>
            )}
            {instance.status === 'connected' && (
              <button
                onClick={onDisconnect}
                disabled={busy !== null}
                className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50"
              >
                Desconectar
              </button>
            )}
            <button
              onClick={onForceReset}
              disabled={busy !== null}
              className="px-3 py-1.5 rounded-lg bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700 disabled:opacity-50"
            >
              🔥 Reset total
            </button>
            <button
              onClick={onDestroy}
              disabled={busy !== null}
              className="px-3 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-xs font-medium disabled:opacity-50 ml-auto"
            >
              Remover número
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: InstanceStatus }) {
  const map: Record<InstanceStatus, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-slate-100 text-slate-600', text: '⚪', label: 'Não configurado' },
    qr_pending: { bg: 'bg-amber-100 text-amber-700', text: '🟡', label: 'Aguardando QR' },
    connected: { bg: 'bg-emerald-100 text-emerald-700', text: '🟢', label: 'Conectado' },
    disconnected: { bg: 'bg-slate-100 text-slate-600', text: '⚪', label: 'Desconectado' },
    error: { bg: 'bg-rose-100 text-rose-700', text: '🔴', label: 'Erro' },
  }
  const m = map[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${m.bg} dark:bg-opacity-20`}
    >
      <span>{m.text}</span>
      <span>{m.label}</span>
    </span>
  )
}

function RoleChip({
  active,
  emoji,
  label,
  title,
}: {
  active: boolean
  emoji: string
  label: string
  title: string
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
        active
          ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
          : 'bg-slate-100 dark:bg-slate-700/50 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 line-through opacity-70'
      }`}
    >
      <span>{emoji}</span>
      <span>{label}</span>
    </span>
  )
}

function RoleToggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-900/70 cursor-pointer transition">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 accent-emerald-600"
      />
      <div className="text-sm flex-1">
        <p className="font-medium text-slate-900 dark:text-slate-100">{label}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{hint}</p>
      </div>
    </label>
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

function QRImage({ src }: { src: string }) {
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
