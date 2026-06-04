'use client'

import { useState } from 'react'
import Link from 'next/link'

type Clinic = {
  id: string
  name: string
  slug: string | null
  plan: string | null
  plan_price: number | null
  plan_expires_at: string | null
  trial_ends_at: string | null
  clinic_phone: string | null
  billing_whatsapp: string | null
  billing_notes: string | null
  last_charge_sent_at: string | null
  created_at: string
  users_count: number
  patients_count: number
  appointments_count: number
  active_modules: string[]
  admin: { name: string; email: string } | null
  whatsapp: { status: string; instance: string } | null
  users: Array<{ name: string; email: string; role: string }>
}

function getDaysLeft(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function StatusBadge({ clinic }: { clinic: Clinic }) {
  const trialDays = getDaysLeft(clinic.trial_ends_at)
  const expiresDays = getDaysLeft(clinic.plan_expires_at)

  if (trialDays !== null && trialDays > 0) {
    const urgent = trialDays <= 3
    const warning = trialDays <= 7
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
        urgent ? 'bg-red-100 text-red-700 animate-pulse' :
        warning ? 'bg-orange-100 text-orange-700' :
        'bg-amber-100 text-amber-700'
      }`}>
        ⏳ Trial {trialDays}d
      </span>
    )
  }

  if (expiresDays !== null) {
    if (expiresDays < 0) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">⛔ Vencido</span>
    if (expiresDays <= 7) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 animate-pulse">🔴 Vence em {expiresDays}d</span>
    if (expiresDays <= 15) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">🟡 Vence em {expiresDays}d</span>
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">✅ Ativo {expiresDays}d</span>
  }

  if (trialDays !== null && trialDays <= 0) {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">⛔ Trial expirado</span>
  }

  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">— Sem data</span>
}

function WaBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-slate-400">—</span>
  return status === 'connected'
    ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">🟢 Conectado</span>
    : <span className="inline-flex items-center gap-1 text-xs text-red-500 font-medium">🔴 Desconectado</span>
}

export default function ClinicsAdminClient({ clinics }: { clinics: Clinic[] }) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [charging, setCharging] = useState<string | null>(null)
  const [editingWa, setEditingWa] = useState<string | null>(null)
  const [waInputs, setWaInputs] = useState<Record<string, string>>({})
  const [savingWa, setSavingWa] = useState<string | null>(null)
  const [chargeResult, setChargeResult] = useState<Record<string, string>>({})

  const filtered = clinics.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.admin?.email?.toLowerCase().includes(search.toLowerCase())
    const days = getDaysLeft(c.trial_ends_at)
    const expDays = getDaysLeft(c.plan_expires_at)
    let matchStatus = true
    if (filterStatus === 'trial') matchStatus = days !== null && days > 0
    if (filterStatus === 'active') matchStatus = expDays !== null && expDays > 0
    if (filterStatus === 'expired') matchStatus = (days !== null && days <= 0) || (expDays !== null && expDays < 0)
    if (filterStatus === 'alert') matchStatus = (days !== null && days <= 7 && days > 0) || (expDays !== null && expDays <= 7 && expDays >= 0)
    return matchSearch && matchStatus
  })

  async function handleSaveWa(clinic: Clinic) {
    const wa = waInputs[clinic.id] || ''
    if (!wa) return
    setSavingWa(clinic.id)
    const resp = await fetch('/api/admin/clinics/update-billing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinic_id: clinic.id, billing_whatsapp: wa }),
    })
    if (resp.ok) {
      setEditingWa(null)
      window.location.reload()
    } else {
      alert('Erro ao salvar')
    }
    setSavingWa(null)
  }

  async function handleActivate(clinic: Clinic) {
    // Ativar clínica: zera trial e coloca plan_expires_at para 30 dias
    const expires = new Date()
    expires.setDate(expires.getDate() + 30)
    const resp = await fetch('/api/admin/clinics/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinic_id: clinic.id, plan_expires_at: expires.toISOString() }),
    })
    if (resp.ok) window.location.reload()
    else alert('Erro ao ativar clínica')
  }

  async function handleCharge(clinic: Clinic) {
    if (!clinic.clinic_phone && !clinic.billing_whatsapp) {
      setChargeResult(r => ({ ...r, [clinic.id]: '❌ Configure o Telefone da Clínica primeiro (clique em ⚙️ Editar)' }))
      return
    }
    if (!clinic.plan_price) {
      setChargeResult(r => ({ ...r, [clinic.id]: '❌ Configure o valor do plano primeiro' }))
      return
    }
    setCharging(clinic.id)
    try {
      const resp = await fetch('/api/admin/cobranca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinic_id: clinic.id }),
      })
      const data = await resp.json()
      if (data.ok) {
        setChargeResult(r => ({ ...r, [clinic.id]: `✅ Cobrança enviada para ${data.phone}` }))
      } else {
        setChargeResult(r => ({ ...r, [clinic.id]: `❌ ${data.error}` }))
      }
    } catch {
      setChargeResult(r => ({ ...r, [clinic.id]: '❌ Erro ao enviar cobrança' }))
    } finally {
      setCharging(null)
    }
  }

  const alertCount = clinics.filter(c => {
    const d = getDaysLeft(c.trial_ends_at)
    const e = getDaysLeft(c.plan_expires_at)
    return (d !== null && d > 0 && d <= 7) || (e !== null && e >= 0 && e <= 7)
  }).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Clínicas</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{clinics.length} cadastradas{alertCount > 0 && <span className="ml-2 text-red-600 font-semibold animate-pulse">⚠️ {alertCount} vencendo</span>}</p>
        </div>
        <Link href="/admin/clinics/new" className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-medium transition flex items-center gap-1.5 text-sm">
          + <span className="hidden sm:inline">Nova</span> Clínica
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          placeholder="Buscar clínica ou email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="w-full sm:w-auto px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none"
        >
          <option value="">Todos os status</option>
          <option value="trial">Em trial</option>
          <option value="active">Ativos</option>
          <option value="expired">Expirados</option>
          <option value="alert">⚠️ Vencendo em 7 dias</option>
        </select>
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-400">Nenhuma clínica encontrada</div>
        )}
        {filtered.map(clinic => (
          <div key={clinic.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              {/* Coluna principal */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-slate-900 dark:text-white">{clinic.name}</h3>
                  <StatusBadge clinic={clinic} />
                  <WaBadge status={clinic.whatsapp?.status || null} />
                </div>
                {clinic.admin && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    👤 {clinic.admin.name} • {clinic.admin.email}
                  </p>
                )}
                {(clinic.clinic_phone || clinic.billing_whatsapp) && (
                  <p className="text-xs text-slate-400">📱 {clinic.clinic_phone || clinic.billing_whatsapp}</p>
                )}
              </div>

              {/* Coluna de métricas */}
              <div className="flex gap-4 text-center text-xs text-slate-500">
                <div>
                  <div className="font-bold text-slate-800 dark:text-white text-base">{clinic.users_count}</div>
                  <div>usuários</div>
                </div>
                <div>
                  <div className="font-bold text-slate-800 dark:text-white text-base">{clinic.patients_count}</div>
                  <div>pacientes</div>
                </div>
                <div>
                  <div className="font-bold text-slate-800 dark:text-white text-base">{clinic.appointments_count}</div>
                  <div>agendamentos</div>
                </div>
              </div>

              {/* Coluna de plano e cobrança */}
              <div className="flex flex-col items-end gap-2 min-w-[140px]">
                <div className="text-right">
                  <span className="text-xs text-slate-400">Plano: </span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 capitalize">{clinic.plan || '—'}</span>
                  {clinic.plan_price && (
                    <span className="ml-2 text-sm font-bold text-emerald-600">
                      R$ {clinic.plan_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
                {clinic.plan_expires_at && (
                  <div className="text-xs text-slate-400">
                    Vence: {new Date(clinic.plan_expires_at).toLocaleDateString('pt-BR')}
                  </div>
                )}
                {clinic.last_charge_sent_at && (
                  <div className="text-xs text-slate-300">
                    Última cobrança: {new Date(clinic.last_charge_sent_at).toLocaleDateString('pt-BR')}
                  </div>
                )}
                <div className="flex gap-2">
                  {/* Botão Ativar — aparece em qualquer situação sem plan_expires_at ativo */}
                  {!clinic.plan_expires_at || (getDaysLeft(clinic.plan_expires_at) !== null && (getDaysLeft(clinic.plan_expires_at) ?? 1) < 0) ? (
                    <button
                      onClick={() => handleActivate(clinic)}
                      className="text-xs px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition"
                    >
                      ✅ Ativar
                    </button>
                  ) : null}
                  <button
                    onClick={() => handleCharge(clinic)}
                    disabled={charging === clinic.id}
                    className="text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-medium transition"
                  >
                    {charging === clinic.id ? '⏳...' : '💸 Cobrar'}
                  </button>
                  <Link
                    href={`/admin/clinics/${clinic.id}`}
                    className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
                  >
                    ⚙️ Editar
                  </Link>
                </div>
              </div>
            </div>

            {/* Módulos ativos */}
            {clinic.active_modules.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {clinic.active_modules.map(m => (
                  <span key={m} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-md">{m}</span>
                ))}
              </div>
            )}

            {/* Usuários da clínica */}
            <div className="mt-3 border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Usuários ({clinic.users_count})</p>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {clinic.users.slice(0, 5).map((u, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        u.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                        u.role === 'doctor' || u.role === 'biomedic' ? 'bg-purple-100 text-purple-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>{u.role}</span>
                      <span className="text-slate-700 font-medium">{u.name}</span>
                    </div>
                    <button
                      onClick={() => {
                        setEditingWa(clinic.id)
                        // Pré-preencher com número do usuário (extraído do email/nome)
                        setWaInputs(prev => ({ ...prev, [clinic.id]: clinic.billing_whatsapp || '' }))
                      }}
                      className="text-[10px] text-slate-400 hover:text-violet-600 ml-2"
                      title="Usar este usuário para cobrança"
                    >
                      📱
                    </button>
                  </div>
                ))}
                {clinic.users.length === 0 && (
                  <p className="text-xs text-slate-400 italic">Nenhum usuário</p>
                )}
              </div>
            </div>

            {/* Resultado da cobrança */}
            {chargeResult[clinic.id] && (
              <div className={`mt-2 text-xs px-3 py-2 rounded-lg ${chargeResult[clinic.id].startsWith('✅') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {chargeResult[clinic.id]}
              </div>
            )}

            {/* Notas de cobrança */}
            {clinic.billing_notes && (
              <div className="mt-2 text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg">
                📝 {clinic.billing_notes}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
