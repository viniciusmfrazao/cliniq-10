// Helpers compartilhados pra exibir audit_logs de forma legível, usados
// tanto na Auditoria da clínica (src/app/dashboard/auditoria) quanto no
// painel global do super admin (src/app/admin/logs). Mantidos num só lugar
// pra evitar que as duas telas divirjam quando um novo tipo de entidade for
// auditado.

// Chaves batem com TG_TABLE_NAME (nome real da tabela) -- e o valor gravado
// em entity_type, nao um nome "bonito" singular.
export const ENTITY_LABELS: Record<string, string> = {
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
export const MODULE_LABELS: Record<string, string> = {
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

// Rotulo pra escritas que nao vieram de um usuario logado no app (auth.uid()
// null). Sem isso a tela mostrava "Sistema" pra tudo igual -- trigger
// automatico, cron, edge function ou alguem rodando SQL direto no banco
// ficavam indistinguiveis. Ver log_audit() no banco pra origem de cada valor.
export const ACTOR_SOURCE_CONFIG: Record<string, { label: string; hint: string }> = {
  mcp_ia: { label: 'IA (Supabase MCP)', hint: 'Escrita feita por um assistente de IA conectado direto ao banco via MCP' },
  service_role: { label: 'Automação (backend)', hint: 'Edge Function ou processo de servidor usando a service key' },
  pg_cron: { label: 'Automação (agendada)', hint: 'Job agendado (pg_cron) rodando no banco' },
  sql_direto_ou_dashboard: { label: 'SQL direto / Dashboard', hint: 'Alguem rodou SQL direto ou editou pelo Table Editor do Supabase' },
  desconhecido: { label: 'Origem não identificada', hint: 'Não bateu com nenhum padrão conhecido' },
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

export type AuditLogLike = {
  action: string
  entity_type: string
  details: Record<string, any> | null
}

// Resumo legivel do que mudou numa acao, a partir do details (old/new pra
// update, ou o registro inteiro pra create/delete). Prioriza os campos mais
// relevantes por tipo de entidade antes de cair no diff genérico.
export function summarizeChange(log: AuditLogLike): string | null {
  const d = log.details
  if (!d) return null

  if (log.action === 'create' || log.action === 'delete') {
    if (log.entity_type === 'entradas' || log.entity_type === 'saidas') {
      const valor = formatValue('valor_liquido', (d as any).valor_liquido ?? (d as any).valor)
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
