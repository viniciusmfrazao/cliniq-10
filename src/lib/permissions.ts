/**
 * Definicao central de permissoes por papel/role.
 *
 * Os ids de permission seguem o padrao `<modulo>_<acao>` (snake_case)
 * e batem com o que `users.permissions` aceita.
 */

export type PermissionId =
  | 'agenda_view' | 'agenda_edit'
  | 'patients_view' | 'patients_edit'
  | 'records_view' | 'records_edit'
  | 'stock_view' | 'stock_edit'
  | 'financial_view' | 'financial_edit'
  | 'crm_view' | 'crm_edit'
  | 'team_manage' | 'reports_view' | 'settings'

export type PermissionGroupId =
  | 'agenda' | 'pacientes' | 'prontuario' | 'estoque'
  | 'financeiro' | 'crm' | 'sistema'

export type IconName =
  | 'calendar' | 'users' | 'file' | 'box'
  | 'dollarSign' | 'target' | 'settings'

export type PermissionGroup = {
  id: PermissionGroupId
  label: string
  description: string
  icon: IconName
  color: string
  permissions: { id: PermissionId; label: string; description: string }[]
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'agenda',
    label: 'Agenda',
    description: 'Visualização e gestão de agendamentos',
    icon: 'calendar',
    color: 'emerald',
    permissions: [
      { id: 'agenda_view', label: 'Ver agenda', description: 'Visualizar todos os agendamentos da clínica' },
      { id: 'agenda_edit', label: 'Criar/editar agendamentos', description: 'Marcar, remarcar, cancelar e mover horários' },
    ],
  },
  {
    id: 'pacientes',
    label: 'Pacientes',
    description: 'Cadastro e dados gerais',
    icon: 'users',
    color: 'blue',
    permissions: [
      { id: 'patients_view', label: 'Ver pacientes', description: 'Listar e abrir fichas de pacientes' },
      { id: 'patients_edit', label: 'Cadastrar/editar pacientes', description: 'Cadastrar novos pacientes e alterar dados de contato' },
    ],
  },
  {
    id: 'prontuario',
    label: 'Prontuário',
    description: 'Histórico clínico e atendimentos',
    icon: 'file',
    color: 'violet',
    permissions: [
      { id: 'records_view', label: 'Ver prontuários', description: 'Acessar histórico clínico, anamneses e evoluções' },
      { id: 'records_edit', label: 'Escrever prontuários', description: 'Registrar evoluções, anamneses e finalizar atendimentos' },
    ],
  },
  {
    id: 'estoque',
    label: 'Estoque',
    description: 'Produtos e movimentações',
    icon: 'box',
    color: 'amber',
    permissions: [
      { id: 'stock_view', label: 'Ver estoque', description: 'Consultar quantidades e relatório de produtos' },
      { id: 'stock_edit', label: 'Gerenciar estoque', description: 'Entradas, saídas, ajustes e cadastro de produtos' },
    ],
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    description: 'Recebimentos e despesas',
    icon: 'dollarSign',
    color: 'green',
    permissions: [
      { id: 'financial_view', label: 'Ver financeiro', description: 'Consultar entradas, saídas e relatórios' },
      { id: 'financial_edit', label: 'Lançamentos financeiros', description: 'Registrar pagamentos, despesas e baixar contas' },
    ],
  },
  {
    id: 'crm',
    label: 'CRM',
    description: 'Leads e pipeline comercial',
    icon: 'target',
    color: 'pink',
    permissions: [
      { id: 'crm_view', label: 'Ver leads', description: 'Visualizar pipeline e conversas com leads' },
      { id: 'crm_edit', label: 'Gerenciar leads', description: 'Mover etapa, atribuir responsáveis e responder conversas' },
    ],
  },
  {
    id: 'sistema',
    label: 'Sistema',
    description: 'Equipe, relatórios e configurações',
    icon: 'settings',
    color: 'slate',
    permissions: [
      { id: 'team_manage', label: 'Gerenciar equipe', description: 'Convidar, desativar e editar permissões de membros' },
      { id: 'reports_view', label: 'Ver relatórios', description: 'Acessar relatórios gerais da clínica' },
      { id: 'settings', label: 'Configurações da clínica', description: 'Alterar dados da clínica, automações e WhatsApp' },
    ],
  },
]

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  super_admin: 'Super Admin',
  doctor: 'Médico(a)',
  biomedic: 'Biomédico(a)',
  nurse: 'Enfermeiro(a)',
  esthetician: 'Esteticista',
  physiotherapist: 'Fisioterapeuta',
  nutritionist: 'Nutricionista',
  psychologist: 'Psicólogo(a)',
  receptionist: 'Recepcionista',
  financial: 'Financeiro',
  manager: 'Gerente',
  assistant: 'Assistente',
  viewer: 'Visualizador',
}

export const ROLE_DESCRIPTIONS: Record<string, string> = {
  doctor: 'Atende pacientes, escreve prontuários e maneja agenda',
  biomedic: 'Realiza procedimentos invasivos, escreve prontuários',
  nurse: 'Auxilia atendimentos, prepara salas e medicações',
  esthetician: 'Realiza procedimentos estéticos não-invasivos',
  physiotherapist: 'Atende pacientes em fisioterapia',
  nutritionist: 'Atende pacientes em nutrição',
  psychologist: 'Atende pacientes em terapia',
  receptionist: 'Atende ligações, marca consultas e cuida do CRM',
  financial: 'Cuida de financeiro, faturamento e relatórios',
  manager: 'Gerencia equipe e operação da clínica',
  assistant: 'Auxiliar geral — agenda e cadastro',
  viewer: 'Apenas visualização — sem edição',
}

/** Lista de papeis editaveis na pagina de defaults (exclui admin/super_admin). */
export const EDITABLE_ROLES: string[] = [
  'doctor', 'biomedic', 'nurse', 'esthetician',
  'physiotherapist', 'nutritionist', 'psychologist',
  'receptionist', 'financial', 'manager', 'assistant', 'viewer',
]

/** Permissoes padrao "de fabrica" por papel — usado como fallback. */
export const FACTORY_DEFAULTS: Record<string, PermissionId[]> = {
  doctor: ['agenda_view', 'agenda_edit', 'patients_view', 'patients_edit', 'records_view', 'records_edit', 'stock_view'],
  dentist: ['agenda_view', 'agenda_edit', 'patients_view', 'patients_edit', 'records_view', 'records_edit', 'stock_view'],
  biomedic: ['agenda_view', 'agenda_edit', 'patients_view', 'patients_edit', 'records_view', 'records_edit', 'stock_view'],
  nurse: ['agenda_view', 'agenda_edit', 'patients_view', 'patients_edit', 'records_view', 'records_edit', 'stock_view'],
  esthetician: ['agenda_view', 'agenda_edit', 'patients_view', 'records_view', 'records_edit', 'stock_view'],
  physiotherapist: ['agenda_view', 'agenda_edit', 'patients_view', 'patients_edit', 'records_view', 'records_edit'],
  nutritionist: ['agenda_view', 'agenda_edit', 'patients_view', 'patients_edit', 'records_view', 'records_edit'],
  psychologist: ['agenda_view', 'agenda_edit', 'patients_view', 'patients_edit', 'records_view', 'records_edit'],
  receptionist: ['agenda_view', 'agenda_edit', 'patients_view', 'patients_edit', 'crm_view', 'crm_edit'],
  financial: ['agenda_view', 'patients_view', 'financial_view', 'financial_edit', 'reports_view'],
  manager: ['agenda_view', 'agenda_edit', 'patients_view', 'stock_view', 'stock_edit', 'financial_view', 'reports_view', 'crm_view', 'crm_edit'],
  assistant: ['agenda_view', 'agenda_edit', 'patients_view', 'patients_edit'],
  viewer: ['agenda_view', 'patients_view'],
}

export const COLOR_STYLES: Record<string, { bg: string; text: string; ring: string; soft: string }> = {
  emerald: { bg: 'bg-emerald-500', text: 'text-emerald-700', ring: 'ring-emerald-500', soft: 'bg-emerald-50' },
  blue: { bg: 'bg-blue-500', text: 'text-blue-700', ring: 'ring-blue-500', soft: 'bg-blue-50' },
  violet: { bg: 'bg-violet-500', text: 'text-violet-700', ring: 'ring-violet-500', soft: 'bg-violet-50' },
  amber: { bg: 'bg-amber-500', text: 'text-amber-700', ring: 'ring-amber-500', soft: 'bg-amber-50' },
  green: { bg: 'bg-green-500', text: 'text-green-700', ring: 'ring-green-500', soft: 'bg-green-50' },
  pink: { bg: 'bg-pink-500', text: 'text-pink-700', ring: 'ring-pink-500', soft: 'bg-pink-50' },
  slate: { bg: 'bg-slate-500', text: 'text-slate-700', ring: 'ring-slate-500', soft: 'bg-slate-50' },
}

export const ALL_PERMISSION_IDS: PermissionId[] = PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.id),
)
