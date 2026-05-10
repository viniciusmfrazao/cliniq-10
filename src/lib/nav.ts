export type NavSubItem = { label: string; href: string }
export type NavItem = { 
  label: string
  href: string
  icon: string
  roles: string[]
  children?: NavSubItem[]
}

const ALL_PROFESSIONALS = ['doctor','biomedic','nurse','esthetician','physiotherapist','nutritionist','psychologist']
const RECEPTION = ['receptionist', 'assistant']
const MANAGEMENT = ['admin', 'super_admin', 'manager']
const FINANCIAL = ['admin', 'super_admin', 'manager', 'financial']
const ALL_STAFF = [...MANAGEMENT, ...ALL_PROFESSIONALS, ...RECEPTION, 'financial', 'viewer']
const ADMIN_ONLY = ['admin', 'super_admin']

export const NAV_ITEMS: NavItem[] = [
  // ── Operacional diário ──────────────────────────────────────────────────
  { label: 'Início',          href: '/dashboard',               icon: 'home',      roles: ALL_STAFF },
  { label: 'Agenda',          href: '/dashboard/agenda',        icon: 'calendar',  roles: [...MANAGEMENT, ...ALL_PROFESSIONALS, ...RECEPTION, 'financial', 'viewer'] },
  { label: 'Recepção',        href: '/dashboard/recepcao',      icon: 'userCheck', roles: [...MANAGEMENT, ...RECEPTION] },
  { label: 'Lista de Espera', href: '/dashboard/lista-espera',  icon: 'clock',     roles: [...MANAGEMENT, ...ALL_PROFESSIONALS, ...RECEPTION] },
  { label: 'Pacientes',       href: '/dashboard/pacientes',     icon: 'users',     roles: [...MANAGEMENT, ...ALL_PROFESSIONALS, ...RECEPTION, 'financial', 'viewer'] },

  // ── Clínico ─────────────────────────────────────────────────────────────
  { label: 'Procedimentos',   href: '/dashboard/procedimentos', icon: 'clipboard', roles: [...MANAGEMENT, ...ALL_PROFESSIONALS] },
  { label: 'Injetaveis',      href: '/dashboard/injetaveis',    icon: 'syringe',   roles: [...MANAGEMENT, 'doctor', 'biomedic', 'nurse', 'esthetician'] },
  { label: 'Documentos',      href: '/dashboard/documentos',    icon: 'file',      roles: [...MANAGEMENT, ...ALL_PROFESSIONALS, ...RECEPTION] },

  // ── Comercial / IA ──────────────────────────────────────────────────────
  { label: 'WhatsApp',        href: '/dashboard/whatsapp',      icon: 'message',   roles: [...MANAGEMENT, ...RECEPTION] },
  { label: 'Eva IA',          href: '/dashboard/eva',           icon: 'sparkles',  roles: [...MANAGEMENT, ...ALL_PROFESSIONALS, ...RECEPTION] },
  { label: 'CRM',             href: '/dashboard/crm',           icon: 'target',    roles: [...MANAGEMENT, ...RECEPTION] },

  // ── Gestão ──────────────────────────────────────────────────────────────
  { label: 'Estoque',         href: '/dashboard/estoque',       icon: 'box',       roles: [...MANAGEMENT, ...ALL_PROFESSIONALS] },
  {
    label: 'Financeiro',
    href: '/dashboard/financeiro',
    icon: 'dollarSign',
    roles: FINANCIAL,
    children: [
      { label: 'Dashboard',   href: '/dashboard/financeiro' },
      { label: 'Entradas',    href: '/dashboard/financeiro/entradas' },
      { label: 'Saídas',      href: '/dashboard/financeiro/saidas' },
      { label: 'Relatórios',  href: '/dashboard/financeiro/dre' },
    ]
  },
  { label: 'Equipe',          href: '/dashboard/equipe',        icon: 'users',     roles: ADMIN_ONLY },
  { label: 'Auditoria',       href: '/dashboard/auditoria',     icon: 'shield',    roles: ADMIN_ONLY },
  { label: 'Configuracoes',   href: '/dashboard/config',        icon: 'settings',  roles: ALL_STAFF },
]

export const BOTTOM_NAV: NavItem[] = [
  { label: 'Início',    href: '/dashboard',           icon: 'home',     roles: ALL_STAFF },
  { label: 'Agenda',    href: '/dashboard/agenda',    icon: 'calendar', roles: [...MANAGEMENT, ...ALL_PROFESSIONALS, ...RECEPTION, 'financial', 'viewer'] },
  { label: 'Pacientes', href: '/dashboard/pacientes', icon: 'users',    roles: [...MANAGEMENT, ...ALL_PROFESSIONALS, ...RECEPTION, 'financial', 'viewer'] },
  { label: 'WhatsApp',  href: '/dashboard/whatsapp',  icon: 'message',  roles: [...MANAGEMENT, ...RECEPTION] },
  { label: 'Eva',       href: '/dashboard/eva',       icon: 'sparkles', roles: [...MANAGEMENT, ...ALL_PROFESSIONALS, ...RECEPTION] },
]
