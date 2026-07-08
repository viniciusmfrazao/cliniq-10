'use client'

import { useState } from 'react'

type Clinic = {
  id: string
  name: string
  cnpj: string | null
  clinic_phone: string | null
  plan: string | null
  plan_price: number | null
  created_at: string
}

type Contract = {
  id: string
  clinic_id: string
  status: 'pending' | 'viewed' | 'signed' | 'cancelled'
  sign_token: string
  sent_at: string | null
  viewed_at: string | null
  signed_at: string | null
  signer_name: string | null
  created_at: string
}

type Row = { clinic: Clinic; contract: Contract | null }

// Usa o domínio atual (teste.clinike.com.br em staging, app.clinike.com.br em produção)
// em vez de fixo, senão o link gerado em staging aponta pra produção (onde o contrato não existe).
function getSiteUrl() {
  if (typeof window !== 'undefined') return window.location.origin
  return 'https://app.clinike.com.br'
}

function StatusBadge({ status }: { status: Contract['status'] | 'none' }) {
  const map: Record<string, string> = {
    none: 'bg-slate-100 text-slate-500',
    pending: 'bg-amber-100 text-amber-700',
    viewed: 'bg-blue-100 text-blue-700',
    signed: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-red-100 text-red-700',
  }
  const label: Record<string, string> = {
    none: 'Sem contrato',
    pending: 'Enviado (não visto)',
    viewed: 'Visualizado',
    signed: 'Assinado ✅',
    cancelled: 'Cancelado',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${map[status]}`}>
      {label[status]}
    </span>
  )
}

export default function ContratosAdminClient({ rows }: { rows: Row[] }) {
  const [state, setState] = useState<Row[]>(rows)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'none' | 'pending' | 'signed'>('all')

  async function handleGenerate(clinicId: string) {
    setLoadingId(clinicId)
    try {
      const res = await fetch('/api/admin/contratos/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        alert(data.error || 'Erro ao gerar contrato')
        return
      }
      const link = `${getSiteUrl()}/assinar-contrato/${data.token}`
      await navigator.clipboard.writeText(link).catch(() => {})
      setState(prev => prev.map(r => r.clinic.id === clinicId
        ? { ...r, contract: { id: '', clinic_id: clinicId, status: 'pending', sign_token: data.token, sent_at: new Date().toISOString(), viewed_at: null, signed_at: null, signer_name: null, created_at: new Date().toISOString() } }
        : r
      ))
      alert(`Link gerado e copiado:\n${link}`)
    } catch {
      alert('Erro ao gerar contrato')
    } finally {
      setLoadingId(null)
    }
  }

  function copyLink(token: string) {
    const link = `${getSiteUrl()}/assinar-contrato/${token}`
    navigator.clipboard.writeText(link).catch(() => {})
    alert(`Link copiado:\n${link}`)
  }

  function waLink(phone: string | null, token: string) {
    const link = `${getSiteUrl()}/assinar-contrato/${token}`
    const msg = encodeURIComponent(`Olá! Segue o contrato de adesão à Clinike para assinatura digital:\n\n${link}`)
    const digits = (phone || '').replace(/\D/g, '')
    return digits ? `https://wa.me/${digits.startsWith('55') ? digits : '55' + digits}?text=${msg}` : `https://wa.me/?text=${msg}`
  }

  const filtered = state.filter(r => {
    if (filter === 'all') return true
    if (filter === 'none') return !r.contract
    if (filter === 'pending') return r.contract && (r.contract.status === 'pending' || r.contract.status === 'viewed')
    if (filter === 'signed') return r.contract?.status === 'signed'
    return true
  })

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Contratos</h1>
        <p className="text-sm text-slate-500">Gere e envie o contrato de adesão para cada clínica, com dados de cadastro preenchidos automaticamente.</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['all', 'none', 'pending', 'signed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              filter === f ? 'bg-violet-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {f === 'all' ? 'Todas' : f === 'none' ? 'Sem contrato' : f === 'pending' ? 'Pendentes' : 'Assinados'}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {filtered.length === 0 && (
            <p className="text-center text-slate-500 py-8 text-sm">Nenhuma clínica encontrada para esse filtro.</p>
          )}
          {filtered.map(({ clinic, contract }) => (
            <div key={clinic.id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-slate-900 dark:text-white truncate">{clinic.name}</p>
                  <StatusBadge status={contract?.status || 'none'} />
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  CNPJ: {clinic.cnpj || 'não informado'} • Plano: {clinic.plan || '—'}
                  {contract?.signed_at && (
                    <> • Assinado em {new Date(contract.signed_at).toLocaleDateString('pt-BR')} por {contract.signer_name}</>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {!contract && (
                  <button
                    onClick={() => handleGenerate(clinic.id)}
                    disabled={loadingId === clinic.id}
                    className="px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50"
                  >
                    {loadingId === clinic.id ? 'Gerando...' : 'Gerar contrato'}
                  </button>
                )}

                {contract && contract.status !== 'signed' && (
                  <>
                    <button
                      onClick={() => copyLink(contract.sign_token)}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                    >
                      Copiar link
                    </button>
                    <a
                      href={waLink(clinic.clinic_phone, contract.sign_token)}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold transition"
                    >
                      Enviar WhatsApp
                    </a>
                  </>
                )}

                {contract && contract.status === 'signed' && (
                  <a
                    href={`${getSiteUrl()}/assinar-contrato/${contract.sign_token}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                  >
                    Ver assinado
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
