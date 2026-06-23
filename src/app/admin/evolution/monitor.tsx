'use client'

import { useState, useEffect } from 'react'

type Instance = {
  name: string
  status: string
  owner: string
  connected: boolean
}

type MonitorData = {
  ok: boolean
  evolution_url: string
  instances: Instance[]
  connected: number
  total: number
  warning: string | null
  error?: string
}

export default function EvolutionMonitor() {
  const [data, setData] = useState<MonitorData | null>(null)
  const [loading, setLoading] = useState(true)
  const [cleaning, setCleaning] = useState(false)
  const [cleanResult, setCleanResult] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/evolution-monitor')
      setData(await r.json())
    } catch {
      setData({ ok: false, error: 'Falha ao carregar', evolution_url: '', instances: [], connected: 0, total: 0, warning: null })
    } finally {
      setLoading(false)
    }
  }

  async function cleanDisconnected() {
    if (!confirm('Deletar instâncias órfãs (desconectadas e não registradas no banco)? Instâncias ativas NÃO serão afetadas.')) return
    setCleaning(true)
    setCleanResult(null)
    try {
      const r = await fetch('/api/admin/evolution-monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clean_disconnected' }),
      })
      const result = await r.json()
      setCleanResult(result.message ?? result.error ?? 'Concluído')
      await load()
    } finally {
      setCleaning(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-white">Monitor Evolution</h2>
          <p className="text-xs text-slate-500">Instâncias WhatsApp conectadas ao servidor</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
        >
          {loading ? 'Carregando...' : '↻ Atualizar'}
        </button>
      </div>

      {loading && (
        <div className="text-sm text-slate-500">Carregando status...</div>
      )}

      {!loading && data && (
        <>
          {data.error && (
            <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
              ❌ {data.error}
            </div>
          )}

          {data.ok && (
            <>
              {/* Resumo */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-3 text-center">
                  <div className="text-2xl font-bold text-green-700 dark:text-green-400">{data.connected}</div>
                  <div className="text-xs text-green-600 dark:text-green-500">Conectadas</div>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3 text-center">
                  <div className="text-2xl font-bold text-slate-700 dark:text-slate-300">{data.total}</div>
                  <div className="text-xs text-slate-500">Total</div>
                </div>
                <div className="rounded-lg bg-orange-50 dark:bg-orange-900/20 p-3 text-center">
                  <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">{data.total - data.connected}</div>
                  <div className="text-xs text-orange-600 dark:text-orange-500">Desconectadas</div>
                </div>
              </div>

              {data.warning && (
                <div className="text-sm text-amber-700 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                  ⚠️ {data.warning}
                </div>
              )}

              {/* Lista de instâncias */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {data.instances.map(inst => (
                  <div key={inst.name} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                    <div>
                      <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{inst.name}</span>
                      {inst.owner && <span className="text-xs text-slate-400 ml-2">{inst.owner.replace('@s.whatsapp.net', '')}</span>}
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      inst.connected
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                        : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                    }`}>
                      {inst.connected ? '● conectada' : '○ fechada'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Limpeza */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3">
                <button
                  onClick={cleanDisconnected}
                  disabled={cleaning}
                  className="text-sm px-4 py-2 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-700 dark:text-red-400 transition disabled:opacity-50"
                >
                  {cleaning ? 'Limpando...' : '🧹 Limpar instâncias órfãs'}
                </button>
                {cleanResult && (
                  <span className="text-xs text-slate-500">{cleanResult}</span>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
