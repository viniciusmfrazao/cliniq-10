'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'

type AuditLog = {
  id: string
  user_id: string
  action: string
  entity_type: string
  entity_id: string | null
  entity_name: string | null
  details: Record<string, any> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
  user: { name: string; email: string } | null
}

type Props = {
  logs: AuditLog[]
  users: { id: string; name: string }[]
}

const ACTION_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  create: { label: 'Criou', icon: 'plus', color: 'bg-emerald-100 text-emerald-700' },
  update: { label: 'Editou', icon: 'edit', color: 'bg-blue-100 text-blue-700' },
  delete: { label: 'Excluiu', icon: 'trash', color: 'bg-red-100 text-red-700' },
  view: { label: 'Visualizou', icon: 'eye', color: 'bg-slate-100 text-slate-700' },
  login: { label: 'Login', icon: 'user', color: 'bg-violet-100 text-violet-700' },
  logout: { label: 'Logout', icon: 'logOut', color: 'bg-slate-100 text-slate-700' },
  export: { label: 'Exportou', icon: 'download', color: 'bg-amber-100 text-amber-700' },
  send: { label: 'Enviou', icon: 'send', color: 'bg-cyan-100 text-cyan-700' },
  check_in: { label: 'Check-in', icon: 'userCheck', color: 'bg-emerald-100 text-emerald-700' },
  status_change: { label: 'Alterou status', icon: 'refresh', color: 'bg-amber-100 text-amber-700' },
}

const ENTITY_LABELS: Record<string, string> = {
  patient: 'Paciente',
  appointment: 'Agendamento',
  evolution: 'Evolução',
  product: 'Produto',
  stock_movement: 'Movimentação',
  lead: 'Lead',
  document: 'Documento',
  user: 'Usuário',
  procedure: 'Procedimento',
  medical_record: 'Prontuário',
  waiting_list: 'Lista de espera',
}

export default function AuditList({ logs, users }: Props) {
  const [filters, setFilters] = useState({
    user: '',
    action: '',
    entity: '',
    dateFrom: '',
    dateTo: '',
    search: '',
  })
  const [showDetails, setShowDetails] = useState<string | null>(null)

  const filteredLogs = logs.filter(log => {
    if (filters.user && log.user_id !== filters.user) return false
    if (filters.action && log.action !== filters.action) return false
    if (filters.entity && log.entity_type !== filters.entity) return false
    if (filters.dateFrom && new Date(log.created_at) < new Date(filters.dateFrom)) return false
    if (filters.dateTo && new Date(log.created_at) > new Date(filters.dateTo + 'T23:59:59')) return false
    if (filters.search) {
      const search = filters.search.toLowerCase()
      const matchName = log.entity_name?.toLowerCase().includes(search)
      const matchUser = log.user?.name?.toLowerCase().includes(search)
      if (!matchName && !matchUser) return false
    }
    return true
  })

  const uniqueActions = [...new Set(logs.map(l => l.action))]
  const uniqueEntities = [...new Set(logs.map(l => l.entity_type))]

  function formatDate(date: string) {
    return new Date(date).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function getActionConfig(action: string) {
    return ACTION_CONFIG[action] || { label: action, icon: 'info', color: 'bg-slate-100 text-slate-700' }
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="card p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="label">Buscar</label>
            <input
              type="text"
              className="input"
              placeholder="Nome, usuário..."
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Usuário</label>
            <select
              className="input"
              value={filters.user}
              onChange={e => setFilters(f => ({ ...f, user: e.target.value }))}
            >
              <option value="">Todos</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Ação</label>
            <select
              className="input"
              value={filters.action}
              onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}
            >
              <option value="">Todas</option>
              {uniqueActions.map(a => (
                <option key={a} value={a}>{ACTION_CONFIG[a]?.label || a}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Entidade</label>
            <select
              className="input"
              value={filters.entity}
              onChange={e => setFilters(f => ({ ...f, entity: e.target.value }))}
            >
              <option value="">Todas</option>
              {uniqueEntities.map(e => (
                <option key={e} value={e}>{ENTITY_LABELS[e] || e}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">De</label>
            <input
              type="date"
              className="input"
              value={filters.dateFrom}
              onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Até</label>
            <input
              type="date"
              className="input"
              value={filters.dateTo}
              onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))}
            />
          </div>
        </div>
        
        {Object.values(filters).some(v => v) && (
          <button
            onClick={() => setFilters({ user: '', action: '', entity: '', dateFrom: '', dateTo: '', search: '' })}
            className="mt-3 text-sm text-violet-600 hover:underline"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-slate-900">{filteredLogs.length}</p>
          <p className="text-xs text-slate-500">Registros</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-emerald-600">
            {filteredLogs.filter(l => l.action === 'create').length}
          </p>
          <p className="text-xs text-slate-500">Criações</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">
            {filteredLogs.filter(l => l.action === 'update').length}
          </p>
          <p className="text-xs text-slate-500">Edições</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-red-600">
            {filteredLogs.filter(l => l.action === 'delete').length}
          </p>
          <p className="text-xs text-slate-500">Exclusões</p>
        </div>
      </div>

      {/* Lista */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Data/Hora</th>
                <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Usuário</th>
                <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Ação</th>
                <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Entidade</th>
                <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Registro</th>
                <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    Nenhum registro encontrado
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const config = getActionConfig(log.action)
                  return (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600">{formatDate(log.created_at)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center">
                            <span className="text-xs font-semibold text-violet-700">
                              {log.user?.name?.charAt(0) || '?'}
                            </span>
                          </div>
                          <span className="text-sm text-slate-900">{log.user?.name || 'Sistema'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
                          <Icon name={config.icon} className="w-3 h-3" />
                          {config.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600">
                          {ENTITY_LABELS[log.entity_type] || log.entity_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-900">{log.entity_name || '-'}</span>
                      </td>
                      <td className="px-4 py-3">
                        {log.details && (
                          <button
                            onClick={() => setShowDetails(showDetails === log.id ? null : log.id)}
                            className="text-xs text-violet-600 hover:underline"
                          >
                            {showDetails === log.id ? 'Ocultar' : 'Detalhes'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Detalhes */}
      {showDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Detalhes da Ação</h3>
              <button onClick={() => setShowDetails(null)} className="p-2 text-slate-400 hover:text-slate-600">
                <Icon name="x" className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <pre className="text-xs bg-slate-50 p-4 rounded-lg overflow-x-auto">
                {JSON.stringify(
                  filteredLogs.find(l => l.id === showDetails)?.details,
                  null,
                  2
                )}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
