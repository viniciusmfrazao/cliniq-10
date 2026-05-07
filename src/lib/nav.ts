export type NavSubItem = { label: string; href: string }
export type NavItem = { 
  label: string
  href: string
  icon: string
  roles: string[]
  children?: NavSubItem[]
}

// Grupos de roles (usados pra montar `roles` de cada item de forma legível
// e garantir que TODOS os papéis da clínica vejam o menu certo).
//
// Roles existentes (definidas em src/lib/constants.ts):
//   admin, super_admin, doctor, biomedic, nurse, esthetician,
//   physiotherapist, nutritionist, psychologist, receptionist,
//   financial, manager, assistant, viewer
const ALL_PROFESSIONALS = [
  'doctor',
  'biomedic',
  'nurse',
  'esthetician',
  'physiotherapist',
  'nutritionist',
  'psychologist',
]
const RECEPTION = ['receptionist', 'assistant']
// super_admin sempre entra junto com admin: ele eh o nivel mais alto e
// nao faz sentido ele perder acesso a nada que admin tenha.
const MANAGEMENT = ['admin', 'super_admin', 'manager']
// Financial = financeiro/contábil
const FINANCIAL = ['admin', 'super_admin', 'manager', 'financial']
const ALL_STAFF = [
  ...MANAGEMENT,
  ...ALL_PROFESSIONALS,
  ...RECEPTION,
  'financial',
  'viewer',
]
// Roles tipicamente "admin only" — incluem super_admin pelo mesmo motivo
const ADMIN_ONLY = ['admin', 'super_admin']

export const NAV_ITEMS: NavItem[] = [
  { label: 'Inicio',          href: '/dashboard',              icon: 'home',      roles: ALL_STAFF },
  { label: 'Recepção',        href: '/dashboard/recepcao',     icon: 'userCheck', roles: [...MANAGEMENT, ...RECEPTION] },
  { label: 'Agenda',          href: '/dashboard/agenda',       icon: 'calendar',  roles: [...MANAGEMENT, ...ALL_PROFESSIONALS, ...RECEPTION, 'financial', 'viewer'] },
  { label: 'Lista de Espera', href: '/dashboard/lista-espera', icon: 'clock',     roles: [...MANAGEMENT, ...ALL_PROFESSIONALS, ...RECEPTION] },
  // "Pacientes" agora unifica cadastro + prontuário + consultas + anamneses
  // + injetáveis em uma "Central do Paciente" com tabs (em /pacientes/[id]).
  // Por isso removemos o item separado de "Prontuario" da sidebar.
  { label: 'Pacientes',       href: '/dashboard/pacientes',    icon: 'users',     roles: [...MANAGEMENT, ...ALL_PROFESSIONALS, ...RECEPTION, 'financial', 'viewer'] },
  { label: 'Procedimentos',   href: '/dashboard/procedimentos',icon: 'clipboard', roles: [...MANAGEMENT, ...ALL_PROFESSIONALS] },
  { label: 'Injetaveis',      href: '/dashboard/injetaveis',   icon: 'syringe',   roles: [...MANAGEMENT, 'doctor', 'biomedic', 'nurse', 'esthetician'] },
  { label: 'Estoque',         href: '/dashboard/estoque',      icon: 'box',       roles: [...MANAGEMENT, ...ALL_PROFESSIONALS] },
  { label: 'Eva IA',          href: '/dashboard/eva',          icon: 'sparkles',  roles: [...MANAGEMENT, ...ALL_PROFESSIONALS, ...RECEPTION] },
  { label: 'WhatsApp',        href: '/dashboard/whatsapp',     icon: 'message',   roles: [...MANAGEMENT, ...RECEPTION] },
  { label: 'CRM',             href: '/dashboard/crm',          icon: 'target',    roles: [...MANAGEMENT, ...RECEPTION] },
  { label: 'Documentos',      href: '/dashboard/documentos',   icon: 'file',      roles: [...MANAGEMENT, ...ALL_PROFESSIONALS, ...RECEPTION] },
  {
    label: 'Financeiro',
    href: '/dashboard/financeiro',
    icon: 'dollarSign',
    roles: FINANCIAL,
    children: [
      { label: 'Dashboard', href: '/dashboard/financeiro' },
      { label: 'Entradas', href: '/dashboard/financeiro/entradas' },
      { label: 'Saídas', href: '/dashboard/financeiro/saidas' },
      { label: 'Relatórios', href: '/dashboard/financeiro/dre' },
    ]
  },
  { label: 'Equipe',          href: '/dashboard/equipe',       icon: 'users',     roles: ADMIN_ONLY },
  { label: 'Auditoria',       href: '/dashboard/auditoria',    icon: 'shield',    roles: ADMIN_ONLY },
  { label: 'Configuracoes',   href: '/dashboard/config',       icon: 'settings',  roles: ALL_STAFF },
]

export const BOTTOM_NAV: NavItem[] = [
  { label: 'Início',    href: '/dashboard',           icon: 'home',     roles: ALL_STAFF },
  { label: 'Agenda',    href: '/dashboard/agenda',    icon: 'calendar', roles: [...MANAGEMENT, ...ALL_PROFESSIONALS, ...RECEPTION, 'financial', 'viewer'] },
  { label: 'Pacientes', href: '/dashboard/pacientes', icon: 'users',    roles: [...MANAGEMENT, ...ALL_PROFESSIONALS, ...RECEPTION, 'financial', 'viewer'] },
  { label: 'Eva',       href: '/dashboard/eva',       icon: 'sparkles', roles: [...MANAGEMENT, ...ALL_PROFESSIONALS, ...RECEPTION] },
  { label: 'Estoque',   href: '/dashboard/estoque',   icon: 'box',      roles: [...MANAGEMENT, ...ALL_PROFESSIONALS] },
]
