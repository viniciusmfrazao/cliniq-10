export type NavItem = { label: string; href: string; icon: string; roles: string[] }

export const NAV_ITEMS: NavItem[] = [
  { label: 'Inicio',         href: '/dashboard',              icon: 'home',      roles: ['admin','doctor','receptionist','esthetician','viewer'] },
  { label: 'Agenda',         href: '/dashboard/agenda',       icon: 'calendar',  roles: ['admin','doctor','receptionist','esthetician'] },
  { label: 'Pacientes',      href: '/dashboard/pacientes',    icon: 'users',     roles: ['admin','doctor','receptionist','esthetician'] },
  { label: 'Procedimentos',  href: '/dashboard/procedimentos',icon: 'clipboard', roles: ['admin','doctor','esthetician'] },
  { label: 'Prontuario',     href: '/dashboard/prontuario',   icon: 'file',      roles: ['admin','doctor','esthetician'] },
  { label: 'Injetaveis',     href: '/dashboard/injetaveis',   icon: 'syringe',   roles: ['admin','doctor','esthetician'] },
  { label: 'Estoque',        href: '/dashboard/estoque',      icon: 'box',       roles: ['admin','doctor','esthetician'] },
  { label: 'Eva IA',         href: '/dashboard/eva',          icon: 'sparkles',  roles: ['admin','doctor','receptionist'] },
  { label: 'WhatsApp',       href: '/dashboard/whatsapp',     icon: 'message',   roles: ['admin','receptionist'] },
  { label: 'CRM',            href: '/dashboard/crm',          icon: 'target',    roles: ['admin','receptionist'] },
  { label: 'Documentos',     href: '/dashboard/documentos',   icon: 'file',      roles: ['admin','doctor','receptionist'] },
  { label: 'Equipe',         href: '/dashboard/equipe',       icon: 'users',     roles: ['admin'] },
  { label: 'Configuracoes',  href: '/dashboard/config',       icon: 'settings',  roles: ['admin'] },
]

export const BOTTOM_NAV: NavItem[] = [
  { label: 'Início',    href: '/dashboard',           icon: 'home',     roles: ['admin','doctor','receptionist','esthetician','viewer'] },
  { label: 'Agenda',    href: '/dashboard/agenda',    icon: 'calendar', roles: ['admin','doctor','receptionist','esthetician'] },
  { label: 'Pacientes', href: '/dashboard/pacientes', icon: 'users',    roles: ['admin','doctor','receptionist','esthetician'] },
  { label: 'Eva',       href: '/dashboard/eva',       icon: 'sparkles', roles: ['admin','doctor','receptionist'] },
  { label: 'WhatsApp',  href: '/dashboard/whatsapp',  icon: 'message',  roles: ['admin','receptionist'] },
]
