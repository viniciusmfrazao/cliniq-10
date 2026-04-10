'use client'

import { useState, useEffect } from 'react'
import Icon from '@/components/ui/Icon'

type LogEntry = {
  id: string
  action: string
  details: Record<string, unknown> | null
  user_id: string | null
  created_at: string
  level?: string
}

type ClientLog = {
  timestamp: string
  level: string
  message: string
  context?: Record<string, unknown>
}

export default function LogsViewer({ initialLogs }: { initialLogs: LogEntry[] }) {
  const [activeTab, setActiveTab] = useState<'audit' | 'client'>('client')
  const [clientLogs, setClientLogs] = useState<ClientLog[]>([])
  const [filter, setFilter] = useState('all')

  // Interceptar console.log/error/warn para capturar logs do cliente
  useEffect(() => {
    const logs: ClientLog[] = []
    
    const originalLog = console.log
    const originalError = console.error
    const originalWarn = console.warn

    console.log = (...args) => {
      logs.unshift({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '),
      })
      setClientLogs([...logs].slice(0, 100))
      originalLog.apply(console, args)
    }

    console.error = (...args) => {
      logs.unshift({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '),
      })
      setClientLogs([...logs].slice(0, 100))
      originalError.apply(console, args)
    }

    console.warn = (...args) => {
      logs.unshift({
        timestamp: new Date().toISOString(),
        level: 'warn',
        message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '),
      })
      setClientLogs([...logs].slice(0, 100))
      originalWarn.apply(console, args)
    }

    return () => {
      console.log = originalLog
      console.error = originalError
      console.warn = originalWarn
    }
  }, [])

  const getLevelStyle = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'error': return 'bg-red-100 text-red-700'
      case 'warn': 
      case 'warning': return 'bg-amber-100 text-amber-700'
      case 'info': return 'bg-blue-100 text-blue-700'
      case 'debug': return 'bg-slate-100 text-slate-600'
      default: return 'bg-slate-100 text-slate-600'
    }
  }

  const filteredClientLogs = filter === 'all' 
    ? clientLogs 
    : clientLogs.filter(l => l.level === filter)

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
        <button
          onClick={() => setActiveTab('client')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === 'client' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          <Icon name="activity" className="w-4 h-4 inline mr-2" />
          Logs em tempo real
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === 'audit' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          <Icon name="clock" className="w-4 h-4 inline mr-2" />
          Histórico ({initialLogs.length})
        </button>
      </div>

      {activeTab === 'client' && (
        <>
          {/* Filtros */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Filtrar:</span>
            {['all', 'info', 'warn', 'error'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filter === f
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f === 'all' ? 'Todos' : f.toUpperCase()}
              </button>
            ))}
            <button
              onClick={() => setClientLogs([])}
              className="ml-auto px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200"
            >
              Limpar
            </button>
          </div>

          {/* Logs do cliente */}
          <div className="card overflow-hidden">
            <div className="p-3 border-b border-slate-100 bg-slate-50">
              <p className="text-xs text-slate-500">
                Logs capturados nesta sessão ({filteredClientLogs.length} entradas)
              </p>
            </div>
            <div className="max-h-[500px] overflow-y-auto divide-y divide-slate-50">
              {filteredClientLogs.length === 0 ? (
                <div className="p-8 text-center">
                  <Icon name="activity" className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500">Nenhum log registrado ainda</p>
                  <p className="text-xs text-slate-400 mt-1">Os logs aparecerão aqui em tempo real</p>
                </div>
              ) : (
                filteredClientLogs.map((log, i) => (
                  <div key={i} className="p-3 hover:bg-slate-50 text-sm">
                    <div className="flex items-start gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${getLevelStyle(log.level)}`}>
                        {log.level}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-700 font-mono text-xs break-all">
                      {log.message}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'audit' && (
        <div className="card overflow-hidden">
          <div className="p-3 border-b border-slate-100 bg-slate-50">
            <p className="text-xs text-slate-500">
              Histórico de ações no banco de dados
            </p>
          </div>
          <div className="max-h-[500px] overflow-y-auto divide-y divide-slate-50">
            {initialLogs.length === 0 ? (
              <div className="p-8 text-center">
                <Icon name="clock" className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500">Nenhum log de auditoria</p>
                <p className="text-xs text-slate-400 mt-1">Ações dos usuários aparecerão aqui</p>
              </div>
            ) : (
              initialLogs.map(log => (
                <div key={log.id} className="p-3 hover:bg-slate-50">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900 text-sm">{log.action}</span>
                    <span className="text-xs text-slate-400">
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  {log.details && (
                    <pre className="mt-2 text-xs text-slate-500 bg-slate-50 p-2 rounded overflow-x-auto">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="card p-4">
        <div className="flex items-start gap-3">
          <Icon name="bell" className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-slate-900">Como funcionam os logs</p>
            <ul className="mt-2 text-xs text-slate-600 space-y-1">
              <li>• <strong>Tempo real:</strong> Captura logs do navegador durante sua sessão</li>
              <li>• <strong>Histórico:</strong> Ações gravadas no banco de dados (auditoria)</li>
              <li>• <strong>Erro:</strong> Problemas que precisam de atenção</li>
              <li>• <strong>Warn:</strong> Avisos que podem indicar problemas</li>
              <li>• <strong>Info:</strong> Informações gerais do sistema</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
