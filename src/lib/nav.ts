export type NavItem = { label: string; href: string; icon: string; roles: string[] }

export const NAV_ITEMS: NavItem[] = [
  { label: 'Inicio',         href: '/dashboard',              icon: 'home',      roles: ['admin','professional','receptionist','viewer'] },
  { label: 'Agenda',         href: '/dashboard/agenda',       icon: 'calendar',  roles: ['admin','professional','receptionist'] },
  { label: 'Pacientes',      href: '/dashboard/pacientes',    icon: 'users',     roles: ['admin','professional','receptionist'] },
  { label: 'Procedimentos',  href: '/dashboard/procedimentos',icon: 'clipboard', roles: ['admin','professional'] },
  { label: 'Prontuario',     href: '/dashboard/prontuario',   icon: 'file',      roles: ['admin','professional'] },
  { label: 'Injetaveis',     href: '/dashboard/injetaveis',   icon: 'syringe',   roles: ['admin','professional'] },
  { label: 'Estoque',        href: '/dashboard/estoque',      icon: 'box',       roles: ['admin','professional'] },
  { label: 'Eva IA',         href: '/dashboard/eva',          icon: 'sparkles',  roles: ['admin','professional','receptionist'] },
  { label: 'WhatsApp',       href: '/dashboard/whatsapp',     icon: 'message',   roles: ['admin','receptionist'] },
  { label: 'CRM',            href: '/dashboard/crm',          icon: 'target',    roles: ['admin','receptionist'] },
  { label: 'Documentos',     href: '/dashboard/documentos',   icon: 'file',      roles: ['admin','professional','receptionist'] },
  { label: 'Equipe',         href: '/dashboard/equipe',       icon: 'users',     roles: ['admin'] },
  { label: 'Configuracoes',  href: '/dashboard/config',       icon: 'settings',  roles: ['admin'] },
]

export const BOTTOM_NAV: NavItem[] = [
  { label: 'Início',    href: '/dashboard',           icon: 'home',     roles: ['admin','professional','receptionist','viewer'] },
  { label: 'Agenda',    href: '/dashboard/agenda',    icon: 'calendar', roles: ['admin','professional','receptionist'] },
  { label: 'Pacientes', href: '/dashboard/pacientes', icon: 'users',    roles: ['admin','professional','receptionist'] },
  { label: 'Eva',       href: '/dashboard/eva',       icon: 'sparkles', roles: ['admin','professional','receptionist'] },
  { label: 'Estoque',   href: '/dashboard/estoque',   icon: 'box',      roles: ['admin','professional'] },
]
