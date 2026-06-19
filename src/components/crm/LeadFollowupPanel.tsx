'use client'

import { useEffect, useState } from 'react'

type Followup = {
  id: string
  scheduled_at: string
  type: string
  note: string | null
}

type Contact = {
  id: string
  type: string
  note: string
  created_at: string
  created_by_user: { name: string } | null
}

type Props = {
  leadId: string
  leadName: string
  evaNextFollowupAt?: string | null
  evaFollowupCount?: number | null
  evaPauseUntil?: string | null
  /** Eva ativa na clínica. Quando false, não mostra banners de follow-up automático. */
  evaActive?: boolean
  /** Chamado quando algo muda (criar/concluir follow-up) para o CRM pai recarregar. */
  onUpdate?: () => void
}

const TYPE_ICONS: Record<string, string> = {
  whatsapp: '💬',
  call: '📞',
  email: '📧',
  note: '📝',
  other: '📌',
}

const TYPE_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  call: 'Ligação',
  email: 'Email',
  note: 'Anotação',
  other: 'Outro',
}

function formatRelativeTime(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now()
  if (diff <= 0) return 'agora'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h >= 24) return `em ${Math.floor(h / 24)}d`
  if (h > 0) return `em ${h}h${m > 0 ? ` ${m}min` : ''}`
  return `em ${m}min`
}

export default function LeadFollowupPanel({ leadId, leadName, evaNextFollowupAt, evaFollowupCount, evaPauseUntil, evaActive = true, onUpdate }: Props) {
  const [tab, setTab] = useState<'followups' | 'contacts'>('followups')
  const [followups, setFollowups] = useState<Followup[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(false)

  // Formulário de novo follow-up
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ scheduled_at: '', type: 'whatsapp', note: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Formulário de novo contato
  const [showContactForm, setShowContactForm] = useState(false)
  const [contactForm, setContactForm] = useState({ type: 'note', note: '' })
  const [savingContact, setSavingContact] = useState(false)

  async function loadFollowups() {
    setLoading(true)
    try {
      const resp = await fetch(`/api/crm/followups?lead_id=${leadId}`)
      const data = await resp.json()
      setFollowups(data.data || [])
    } finally { setLoading(false) }
  }

  async function loadContacts() {
    try {
      const resp = await fetch(`/api/crm/contacts?lead_id=${leadId}`)
      const data = await resp.json()
      setContacts(data.data || [])
    } catch {}
  }

  useEffect(() => {
    loadFollowups()
    loadContacts()
  }, [leadId])

  async function handleSaveFollowup() {
    if (!form.scheduled_at) return
    setSaving(true)
    setSaveError(null)
    try {
      const resp = await fetch('/api/crm/followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // datetime-local é horário local (browser). Convertendo p/ ISO UTC,
        // o horário gravado bate com o que a secretária digitou (sem -3h).
        body: JSON.stringify({
          lead_id: leadId,
          ...form,
          scheduled_at: new Date(form.scheduled_at).toISOString(),
        }),
      })
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        setSaveError(data?.error || 'Não foi possível salvar o follow-up. Tente novamente.')
        return
      }
      setForm({ scheduled_at: '', type: 'whatsapp', note: '' })
      setShowForm(false)
      await loadFollowups()
      onUpdate?.()
    } catch {
      setSaveError('Erro de conexão ao salvar. Tente novamente.')
    } finally { setSaving(false) }
  }

  async function handleComplete(id: string) {
    await fetch('/api/crm/followups', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    await loadFollowups()
    await loadContacts()
    onUpdate?.()
  }

  async function handleSaveContact() {
    if (!contactForm.note.trim()) return
    setSavingContact(true)
    try {
      await fetch('/api/crm/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId, ...contactForm }),
      })
      setContactForm({ type: 'note', note: '' })
      setShowContactForm(false)
      await loadContacts()
    } finally { setSavingContact(false) }
  }

  const isOverdue = (s: string) => new Date(s) < new Date()

  return (
    <div className="mt-3 border-t border-slate-100 dark:border-slate-700 pt-3">
      {/* Banner: status do followup automático da Eva */}
      {!evaActive ? (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-500 dark:text-slate-400">
          <span>🔕</span>
          <span>Eva desativada nesta clínica — os follow-ups manuais abaixo são enviados por você.</span>
        </div>
      ) : evaPauseUntil && new Date(evaPauseUntil) > new Date() ? (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg text-xs text-amber-700 dark:text-amber-300">
          <span>⏸️</span>
          <span>Eva pausada até {new Date(evaPauseUntil).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })} — followup manual agendado</span>
        </div>
      ) : evaNextFollowupAt && new Date(evaNextFollowupAt) > new Date() ? (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 rounded-lg text-xs text-violet-700 dark:text-violet-300">
          <span className="animate-pulse">🤖</span>
          <span>Eva enviará followup automático <strong>{formatRelativeTime(evaNextFollowupAt)}</strong> · estágio {(evaFollowupCount ?? 0) + 1} de 5</span>
        </div>
      ) : evaNextFollowupAt && new Date(evaNextFollowupAt) <= new Date() ? (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-lg text-xs text-emerald-700 dark:text-emerald-300">
          <span>✅</span>
          <span>Eva enviou followup automático (estágio {evaFollowupCount ?? 0} de 5) · aguardando resposta do lead</span>
        </div>
      ) : null}

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-3">
        <button onClick={() => setTab('followups')}
          className={`text-xs px-3 py-1 rounded-lg font-medium transition ${tab === 'followups' ? 'bg-amber-100 text-amber-700' : 'text-slate-500 hover:bg-slate-100'}`}>
          🔔 Follow-ups {followups.length > 0 && <span className="ml-1 bg-amber-500 text-white rounded-full px-1.5 text-[10px]">{followups.length}</span>}
        </button>
        <button onClick={() => setTab('contacts')}
          className={`text-xs px-3 py-1 rounded-lg font-medium transition ${tab === 'contacts' ? 'bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
          📋 Histórico {contacts.length > 0 && <span className="ml-1 text-slate-400">({contacts.length})</span>}
        </button>
      </div>

      {/* Follow-ups */}
      {tab === 'followups' && (
        <div className="space-y-2">
          {loading && <p className="text-xs text-slate-400">Carregando...</p>}
          {!loading && followups.length === 0 && (
            <p className="text-xs text-slate-400 italic">Nenhum follow-up agendado</p>
          )}
          {followups.map(f => (
            <div key={f.id} className={`flex items-start gap-2 p-2 rounded-lg border ${isOverdue(f.scheduled_at) ? 'border-red-200 bg-red-50 dark:bg-red-900/10' : 'border-slate-100 bg-slate-50 dark:bg-slate-700/30'}`}>
              <span className="text-base">{TYPE_ICONS[f.type] || '📌'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                  {new Date(f.scheduled_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  {isOverdue(f.scheduled_at) && <span className="ml-1 text-red-500 text-[10px]">• atrasado</span>}
                </p>
                {f.note && <p className="text-xs text-slate-500 truncate">{f.note}</p>}
              </div>
              <button onClick={() => handleComplete(f.id)}
                className="text-[10px] px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded font-medium transition">
                ✓
              </button>
            </div>
          ))}

          {/* Formulário novo follow-up */}
          {showForm ? (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 rounded-xl space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
                  className="col-span-2 text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white"
                />
                <select
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none bg-white"
                >
                  {Object.entries(TYPE_LABELS).filter(([k]) => k !== 'note').map(([k, v]) => (
                    <option key={k} value={k}>{TYPE_ICONS[k]} {v}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Observação (opcional)"
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  className="text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white"
                />
              </div>
              {saveError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">
                  {saveError}
                </p>
              )}
              <div className="flex gap-2">
                <button onClick={handleSaveFollowup} disabled={!form.scheduled_at || saving}
                  className="flex-1 text-xs py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg font-medium transition">
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
                <button onClick={() => setShowForm(false)}
                  className="text-xs px-3 py-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowForm(true)}
              className="w-full text-xs py-1.5 border border-dashed border-amber-300 text-amber-600 hover:bg-amber-50 rounded-lg transition font-medium">
              + Agendar follow-up
            </button>
          )}
        </div>
      )}

      {/* Histórico de contatos */}
      {tab === 'contacts' && (
        <div className="space-y-2">
          {contacts.length === 0 && (
            <p className="text-xs text-slate-400 italic">Nenhum contato registrado</p>
          )}
          {contacts.map(c => (
            <div key={c.id} className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-700/30">
              <span className="text-sm">{TYPE_ICONS[c.type] || '📌'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-700 dark:text-slate-200">{c.note}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {new Date(c.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  {c.created_by_user?.name && ` · ${c.created_by_user.name}`}
                </p>
              </div>
            </div>
          ))}

          {/* Formulário novo contato */}
          {showContactForm ? (
            <div className="p-3 bg-slate-50 dark:bg-slate-700/30 border border-slate-200 rounded-xl space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={contactForm.type}
                  onChange={e => setContactForm(f => ({ ...f, type: e.target.value }))}
                  className="text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none bg-white"
                >
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{TYPE_ICONS[k]} {v}</option>
                  ))}
                </select>
                <div />
                <textarea
                  placeholder="Descreva o contato realizado..."
                  value={contactForm.note}
                  onChange={e => setContactForm(f => ({ ...f, note: e.target.value }))}
                  rows={2}
                  className="col-span-2 text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-400 bg-white resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveContact} disabled={!contactForm.note.trim() || savingContact}
                  className="flex-1 text-xs py-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg font-medium transition">
                  {savingContact ? 'Salvando...' : 'Registrar contato'}
                </button>
                <button onClick={() => setShowContactForm(false)}
                  className="text-xs px-3 py-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowContactForm(true)}
              className="w-full text-xs py-1.5 border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 rounded-lg transition font-medium">
              + Registrar contato
            </button>
          )}
        </div>
      )}
    </div>
  )
}
