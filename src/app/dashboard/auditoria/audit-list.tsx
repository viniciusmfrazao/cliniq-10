'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import { normalizeText } from '@/lib/text'

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
  actor_source: string | null
  db_user: string | null
  app_name: string | null
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

// Rotulo pra escritas que nao vieram de um usuario logado no app (auth.uid()
// null). Sem isso a tela mostrava "Sistema" pra tudo igual -- trigger
// automatico, cron, edge function ou alguem rodando SQL direto no banco
// ficavam indistinguiveis. Ver log_audit() no banco pra origem de cada valor.
const ACTOR_SOURCE_CONFIG: Record<string, { label: string; hint: string }> = {
  mcp_ia: { label: 'IA (Supabase MCP)', hint: 'Escrita feita por um assistente de IA conectado direto ao banco via MCP' },
  service_role: { label: 'Automação (backend)', hint: 'Edge Function ou processo de servidor usando a service key' },
  pg_cron: { label: 'Automação (agendada)', hint: 'Job agendado (pg_cron) rodando no banco' },
  sql_direto_ou_dashboard: { label: 'SQL direto / Dashboard', hint: 'Alguem rodou SQL direto ou editou pelo Table Editor do Supabase' },
  desconhecido: { label: 'Origem não identificada', hint: 'Não bateu com nenhum padrão conhecido' },
}

// Chaves batem com TG_TABLE_NAME (nome real da tabela), nao com singular
// "bonito" -- o valor gravado em entity_type e sempre o nome da tabela.
const ENTITY_LABELS: Record<string, string> = {
  patients: 'Paciente',
  appointments: 'Agendamento',
  evolutions: 'Evolução',
  products: 'Produto',
  stock_movements: 'Movimentação de estoque',
  leads: 'Lead',
  users: 'Usuário',
  entradas: 'Entrada financeira',
  saidas: 'Saída financeira',
  crm_settings: 'Configuração do CRM',
  clinics: 'Dados da clínica',
}

// Onde no sistema a acao aconteceu -- o "modulo" que a pessoa reconhece na
// navegacao, nao o nome tecnico da tabela.
const MODULE_LABELS: Record<string, string> = {
  patients: 'Pacientes',
  appointments: 'Agenda',
  evolutions: 'Prontuário',
  products: 'Estoque',
  stock_movements: 'Estoque',
  leads: 'CRM',
  users: 'Equipe',
  entradas: 'Financeiro',
  saidas: 'Financeiro',
  crm_settings: 'Configurações · CRM',
  clinics: 'Configurações · Clínica',
}

// Rotulos amigaveis pros campos mais comuns que aparecem no resumo de
// mudanca -- o resto cai no nome cru do campo, sem tradução.
const FIELD_LABELS: Record<string, string> = {
  status: 'status',
  name: 'nome',
  phone: 'telefone',
  email: 'email',
  notes: 'observações',
  valor_liquido: 'valor',
  valor_bruto: 'valor bruto',
  descricao: 'descrição',
  forma_pagamento: 'forma de pagamento',
  data_venda: 'data',
  data: 'data',
  procedimento_nome: 'procedimento',
  paciente_nome: 'paciente',
  custom_stages: 'colunas do CRM',
  converted_stage_id: 'estágio de conversão automática',
  lost_reason: 'motivo de perda',
  interest: 'interesse',
  next_contact_at: 'próximo contato',
}

// Campos que mudam sozinhos o tempo todo (timestamps de "toque") e nunca sao
// o que importa mostrar num resumo -- ignora na comparacao old/new.
const NOISY_FIELDS = new Set([
  'updated_at', 'created_at', 'last_contact_at', 'last_whatsapp_at',
  'patient_replied_at', 'ai_last_analysis', 'eva_next_followup_at',
  'human_review_at', 'converted_at',
])

function formatValue(field: string, value: any): string {
  if (value === null || value === undefined || value === '') return 'vazio'
  if (field.startsWith('valor')) {
    const n = Number(value)
    if (!Number.isNaN(n)) return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }
  if (typeof value === 'object') return '[alterado]'
  const s = String(value)
  return s.length > 40 ? s.slice(0, 40) + '…' : s
}

// Resumo legivel do que mudou numa acao, a partir do details (old/new pra
// update, ou o registro inteiro pra create/delete). Prioriza os campos mais
// relevantes por tipo de entidade antes de cair no diff genérico.
function summarizeChange(log: AuditLog): string | null {
  const d = log.details
  if (!d) return null

  if (log.action === 'create' || log.action === 'delete') {
    const row = log.action === 'delete' ? d : d
    if (log.entity_type === 'entradas' || log.entity_type === 'saidas') {
      const valor = formatValue('valor_liquido', row.valor_liquido ?? row.valor)
      return valor !== 'vazio' ? valor : null
    }
    return null
  }

  if (log.action !== 'update' || !d.old || !d.new) return null

  const changed = Object.keys(d.new).filter(k => {
    if (NOISY_FIELDS.has(k)) return false
    return JSON.stringify(d.old[k]) !== JSON.stringify(d.new[k])
  })
  if (changed.length === 0) return null

  // status em destaque sozinho quando muda -- e o caso mais comum e o mais
  // importante de ver de cara (foi exatamente o que confundiu no CRM)
  if (changed.includes('status')) {
    return `status: ${formatValue('status', d.old.status)} → ${formatValue('status', d.new.status)}`
  }

  return changed.slice(0, 3).map(k => {
    const label = FIELD_LABELS[k] || k
    return `${label}: ${formatValue(k, d.old[k])} → ${formatValue(k, d.new[k])}`
  }).join(' · ')
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
      const search = normalizeText(filters.search)
      const matchName = normalizeText(log.entity_name).includes(search)
      const matchUser = normalizeText(log.user?.name).includes(search)
      const matchChange = normalizeText(summarizeChange(log) || '').includes(search)
      if (!matchName && !matchUser && !matchChange) return false
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
            <label className="label">Onde</label>
            <select
              className="input"
              value={filters.entity}
              onChange={e => setFilters(f => ({ ...f, entity: e.target.value }))}
            >
              <option value="">Todas</option>
              {uniqueEntities.map(e => (
                <option key={e} value={e}>{MODULE_LABELS[e] || e}</option>
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
                <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Onde</th>
                <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Registro</th>
                <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">O que mudou</th>
                <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
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
                        {log.user?.name ? (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center">
                              <span className="text-xs font-semibold text-violet-700">
                                {log.user.name.charAt(0)}
                              </span>
                            </div>
                            <span className="text-sm text-slate-900">{log.user.name}</span>
                          </div>
                        ) : (
                          <div
                            className="flex items-center gap-2"
                            title={log.actor_source ? ACTOR_SOURCE_CONFIG[log.actor_source]?.hint : undefined}
                          >
                            <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
                              <Icon name={log.actor_source === 'mcp_ia' ? 'zap' : 'settings'} className="w-3.5 h-3.5 text-slate-500" />
                            </div>
                            <span className="text-sm text-slate-700">
                              {log.actor_source ? (ACTOR_SOURCE_CONFIG[log.actor_source]?.label || log.actor_source) : 'Sistema (sem detalhe)'}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
                          <Icon name={config.icon} className="w-3 h-3" />
                          {config.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-sm text-slate-900">{MODULE_LABELS[log.entity_type] || log.entity_type}</span>
                          <span className="text-xs text-slate-400">{ENTITY_LABELS[log.entity_type] || log.entity_type}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-900">{log.entity_name || '-'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600">{summarizeChange(log) || '-'}</span>
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
