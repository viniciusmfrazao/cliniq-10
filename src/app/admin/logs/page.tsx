'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'

type LogEntry = {
  id: string
  clinic_id: string | null
  clinic_name?: string
  user_id: string | null
  user_name?: string
  action: string
  entity_type: string
  entity_id: string | null
  entity_name: string | null
  details: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [clinics, setClinics] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [groupNearby, setGroupNearby] = useState(true)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState({
    clinic_id: '',
    action: '',
    entity_type: '',
    search: '',
    dateFrom: '',
    dateTo: '',
    origin: '',
  })

  useEffect(() => {
    fetch('/api/admin/clinics')
      .then(res => (res.ok ? res.json() : []))
      .then((data: any[]) => setClinics(Array.isArray(data) ? data.map(c => ({ id: c.id, name: c.name })) : []))
      .catch(() => setClinics([]))
  }, [])

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filters.clinic_id) params.set('clinic_id', filters.clinic_id)
      if (filters.action) params.set('action', filters.action)
      if (filters.entity_type) params.set('entity_type', filters.entity_type)
      if (filters.search) params.set('search', filters.search)
      if (filters.dateFrom) params.set('date_from', filters.dateFrom)
      if (filters.dateTo) params.set('date_to', filters.dateTo)
      if (filters.origin) params.set('origin', filters.origin)

      const res = await fetch(`/api/admin/logs?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data)
      }
    } catch (error) {
      console.error('Error fetching logs:', error)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchLogs, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [autoRefresh, fetchLogs])

  const getActionColor = (action: string) => {
    if (action.includes('create') || action.includes('insert')) return 'bg-emerald-100 text-emerald-700'
    if (action.includes('update') || action.includes('edit')) return 'bg-blue-100 text-blue-700'
    if (action.includes('delete') || action.includes('remove')) return 'bg-red-100 text-red-700'
    if (action.includes('login') || action.includes('auth')) return 'bg-purple-100 text-purple-700'
    return 'bg-slate-100 text-slate-700'
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  // Agrupa entradas consecutivas (na lista já ordenada por created_at desc)
  // do mesmo usuário + mesma clínica + mesma entidade dentro de uma janela de 60s.
  // Ex: usuário arrastou o card 2x no Kanban em 14s -> vira 1 linha com "2x".
  function groupLogs(list: LogEntry[]): LogEntry[][] {
    const groups: LogEntry[][] = []
    for (const log of list) {
      const currentGroup = groups[groups.length - 1]
      const prev = currentGroup?.[currentGroup.length - 1]
      if (prev) {
        const sameKey = prev.clinic_id === log.clinic_id &&
          prev.user_id === log.user_id &&
          prev.entity_type === log.entity_type &&
          prev.entity_id === log.entity_id
        const gapSeconds = (new Date(prev.created_at).getTime() - new Date(log.created_at).getTime()) / 1000
        if (sameKey && gapSeconds >= 0 && gapSeconds <= 60) {
          currentGroup.push(log)
          continue
        }
      }
      groups.push([log])
    }
    return groups
  }

  function toggleGroup(key: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const displayGroups = groupNearby ? groupLogs(logs) : logs.map(l => [l])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Logs do Sistema</h1>
          <p className="text-slate-500 dark:text-slate-400">
            Monitoramento em tempo real de todas as atividades
          </p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={groupNearby}
              onChange={e => setGroupNearby(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-600"
            />
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Agrupar ações próximas (60s)
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-600"
            />
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Auto-refresh (5s)
            </span>
          </label>
          <button
            onClick={fetchLogs}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
          >
            Atualizar
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Buscar</label>
            <input
              type="text"
              placeholder="Buscar nos logs..."
              value={filters.search}
              onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Clínica</label>
            <select
              value={filters.clinic_id}
              onChange={e => setFilters(prev => ({ ...prev, clinic_id: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            >
              <option value="">Todas</option>
              {clinics.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Ação</label>
            <select
              value={filters.action}
              onChange={e => setFilters(prev => ({ ...prev, action: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            >
              <option value="">Todas</option>
              <option value="create">Criar</option>
              <option value="update">Atualizar</option>
              <option value="delete">Excluir</option>
              <option value="login">Login</option>
              <option value="view">Visualizar</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Tipo</label>
            <select
              value={filters.entity_type}
              onChange={e => setFilters(prev => ({ ...prev, entity_type: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            >
              <option value="">Todos</option>
              <option value="appointment">Agendamento</option>
              <option value="patient">Paciente</option>
              <option value="user">Usuário</option>
              <option value="clinic">Clínica</option>
              <option value="procedure">Procedimento</option>
              <option value="lead">Lead</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Origem</label>
            <select
              value={filters.origin}
              onChange={e => setFilters(prev => ({ ...prev, origin: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            >
              <option value="">Todas</option>
              <option value="user">👤 Usuários</option>
              <option value="system">🤖 Sistema</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Data Início</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={e => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Data Fim</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={e => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ clinic_id: '', action: '', entity_type: '', search: '', dateFrom: '', dateTo: '' })}
              className="w-full px-3 py-2 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm transition"
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-sm text-slate-500">Total de Logs</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{logs.length}</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800 p-4">
          <p className="text-sm text-emerald-600">Criações</p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
            {logs.filter(l => l.action.includes('create') || l.action.includes('insert')).length}
          </p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
          <p className="text-sm text-blue-600">Atualizações</p>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
            {logs.filter(l => l.action.includes('update')).length}
          </p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-4">
          <p className="text-sm text-red-600">Exclusões</p>
          <p className="text-2xl font-bold text-red-700 dark:text-red-400">
            {logs.filter(l => l.action.includes('delete')).length}
          </p>
        </div>
        <div className="bg-violet-50 dark:bg-violet-900/20 rounded-xl border border-violet-200 dark:border-violet-800 p-4">
          <p className="text-sm text-violet-600">🤖 Ações de Sistema</p>
          <p className="text-2xl font-bold text-violet-700 dark:text-violet-400">
            {logs.filter(l => !l.user_id).length}
          </p>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            Nenhum log encontrado
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-700/50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                    Data/Hora
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                    Clínica
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                    Usuário
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                    Ação
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                    Tipo
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                    Entidade
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                    IP
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {displayGroups.map((group) => {
                  const log = group[0] // mais recente do grupo
                  const groupKey = log.id
                  const isExpanded = expandedGroups.has(groupKey)
                  const hasMultiple = group.length > 1
                  return (
                    <Fragment key={groupKey}>
                      <tr
                        className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 ${hasMultiple ? 'cursor-pointer' : ''}`}
                        onClick={() => hasMultiple && toggleGroup(groupKey)}
                      >
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {hasMultiple && (
                              <span className="text-slate-400 text-xs">{isExpanded ? '▾' : '▸'}</span>
                            )}
                            {formatDate(log.created_at)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">
                          {log.clinic_name || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">
                          {log.user_name ? (
                            <span>👤 {log.user_name}</span>
                          ) : (
                            <span className="text-xs px-2 py-1 rounded-full font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                              🤖 Sistema
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${getActionColor(log.action)}`}>
                            {log.action}
                          </span>
                          {hasMultiple && (
                            <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-200 font-semibold">
                              {group.length}x
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                          {log.entity_type}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">
                          {log.entity_name || log.entity_id?.slice(0, 8) || '-'}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                          {log.ip_address || '-'}
                        </td>
                      </tr>
                      {hasMultiple && isExpanded && group.map((sub, i) => (
                        <tr key={`${groupKey}-${i}`} className="bg-slate-50/60 dark:bg-slate-900/30">
                          <td className="px-4 py-2 pl-9 text-xs text-slate-500 whitespace-nowrap">
                            ↳ {formatTime(sub.created_at)}
                          </td>
                          <td className="px-4 py-2" />
                          <td className="px-4 py-2 text-xs text-slate-500">
                            {sub.user_name ? `👤 ${sub.user_name}` : '🤖 Sistema'}
                          </td>
                          <td className="px-4 py-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getActionColor(sub.action)}`}>
                              {sub.action}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-xs text-slate-500">{sub.entity_type}</td>
                          <td className="px-4 py-2 text-xs text-slate-600">{sub.entity_name || '-'}</td>
                          <td className="px-4 py-2" />
                        </tr>
                      ))}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
