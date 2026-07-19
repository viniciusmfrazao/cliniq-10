export type NavSubItem = { label: string; href: string }
export type NavItem = { 
  label: string
  href: string
  icon: string
  roles: string[]
  /** Se presente, o item tambem aparece pra quem tiver QUALQUER uma dessas
   *  permissoes, mesmo que o papel nao esteja em `roles` (ex: financeiro
   *  liberado por permissao individual pra um profissional). */
  anyPermissions?: string[]
  children?: NavSubItem[]
}

const ALL_PROFESSIONALS = ['doctor','dentist','biomedic','nurse','esthetician','physiotherapist','nutritionist','psychologist']
const RECEPTION = ['receptionist', 'assistant']
const MANAGEMENT = ['admin', 'super_admin', 'manager']
const FINANCIAL = ['admin', 'super_admin', 'manager', 'financial']
const ALL_STAFF = [...MANAGEMENT, ...ALL_PROFESSIONALS, ...RECEPTION, 'financial', 'viewer', 'comercial']
const ADMIN_ONLY = ['admin', 'super_admin']

export const NAV_ITEMS: NavItem[] = [
  // ── Operacional diário ──────────────────────────────────────────────────
  { label: 'Início',          href: '/dashboard',               icon: 'home',      roles: ALL_STAFF },
  { label: 'Agenda',          href: '/dashboard/agenda',        icon: 'calendar',  roles: [...MANAGEMENT, ...ALL_PROFESSIONALS, ...RECEPTION, 'financial', 'viewer', 'comercial'] },
  { label: 'Recepção',        href: '/dashboard/recepcao',      icon: 'userCheck', roles: [...MANAGEMENT, ...RECEPTION] },
  { label: 'Lista de Espera', href: '/dashboard/lista-espera',  icon: 'clock',     roles: [...MANAGEMENT, ...ALL_PROFESSIONALS, ...RECEPTION] },
  { label: 'Pacientes',       href: '/dashboard/pacientes',     icon: 'users',     roles: [...MANAGEMENT, ...ALL_PROFESSIONALS, ...RECEPTION, 'financial', 'viewer'] },

  // ── Clínico ─────────────────────────────────────────────────────────────
  { label: 'Procedimentos',   href: '/dashboard/procedimentos', icon: 'clipboard', roles: [...MANAGEMENT, ...ALL_PROFESSIONALS] },
  { label: 'Injetaveis',      href: '/dashboard/injetaveis',    icon: 'syringe',   roles: [...MANAGEMENT, 'doctor', 'dentist', 'biomedic', 'nurse', 'esthetician'] },
  { label: 'Documentos',      href: '/dashboard/documentos',    icon: 'file',      roles: [...MANAGEMENT, ...ALL_PROFESSIONALS, ...RECEPTION] },

  // ── Comercial / IA ──────────────────────────────────────────────────────
  { label: 'WhatsApp',        href: '/dashboard/whatsapp',      icon: 'message',   roles: [...MANAGEMENT, ...RECEPTION, 'comercial'] },
  { label: 'Eva IA',          href: '/dashboard/eva',           icon: 'sparkles',  roles: [...MANAGEMENT, ...ALL_PROFESSIONALS, ...RECEPTION] },
  { label: 'CRM',             href: '/dashboard/crm',           icon: 'target',    roles: [...MANAGEMENT, ...RECEPTION, 'comercial'] },

  // ── Gestão ──────────────────────────────────────────────────────────────
  { label: 'Estoque',         href: '/dashboard/estoque',       icon: 'box',       roles: [...MANAGEMENT, ...ALL_PROFESSIONALS] },
  {
    label: 'Financeiro',
    href: '/dashboard/financeiro',
    icon: 'dollarSign',
    roles: FINANCIAL,
    anyPermissions: ['financial_view_all', 'financial_view_own', 'all'],
    children: [
      { label: 'Dashboard',   href: '/dashboard/financeiro' },
      { label: 'Entradas',    href: '/dashboard/financeiro/entradas' },
      { label: 'Saídas',      href: '/dashboard/financeiro/saidas' },
      { label: 'Relatórios',  href: '/dashboard/financeiro/dre' },
    ]
  },
  { label: 'Minhas Comissões', href: '/dashboard/comissoes/minhas', icon: 'dollarSign', roles: ALL_PROFESSIONALS },
  { label: 'Equipe',          href: '/dashboard/equipe',        icon: 'users',     roles: ADMIN_ONLY },
  { label: 'Auditoria',       href: '/dashboard/auditoria',     icon: 'shield',    roles: ADMIN_ONLY },
  { label: 'Configuracoes',   href: '/dashboard/config',        icon: 'settings',  roles: ALL_STAFF },
]

export const BOTTOM_NAV: NavItem[] = [
  { label: 'Início',    href: '/dashboard',             icon: 'home',     roles: ALL_STAFF },
  { label: 'Agenda',    href: '/dashboard/agenda',      icon: 'calendar', roles: [...MANAGEMENT, ...ALL_PROFESSIONALS, ...RECEPTION, 'financial', 'viewer', 'comercial'] },
  { label: 'Pacientes', href: '/dashboard/pacientes',   icon: 'users',    roles: [...MANAGEMENT, ...ALL_PROFESSIONALS, ...RECEPTION, 'financial', 'viewer'] },
  { label: 'Recepção',  href: '/dashboard/recepcao',    icon: 'inbox',    roles: [...MANAGEMENT, ...RECEPTION] },
  { label: 'Financeiro',href: '/dashboard/financeiro',  icon: 'dollar',   roles: FINANCIAL, anyPermissions: ['financial_view_all', 'financial_view_own', 'all'] },
]
