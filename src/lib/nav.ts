export type NavSubItem = { label: string; href: string }
export type NavItem = { 
  label: string
  href: string
  icon: string
  roles: string[]
  children?: NavSubItem[]
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Inicio',         href: '/dashboard',              icon: 'home',      roles: ['admin','doctor','esthetician','receptionist','viewer'] },
  { label: 'Recepção',       href: '/dashboard/recepcao',     icon: 'userCheck', roles: ['admin','receptionist'] },
  { label: 'Agenda',         href: '/dashboard/agenda',       icon: 'calendar',  roles: ['admin','doctor','esthetician','receptionist'] },
  { label: 'Lista de Espera',href: '/dashboard/lista-espera', icon: 'clock',     roles: ['admin','doctor','esthetician','receptionist'] },
  { label: 'Pacientes',      href: '/dashboard/pacientes',    icon: 'users',     roles: ['admin','doctor','esthetician','receptionist'] },
  { label: 'Procedimentos',  href: '/dashboard/procedimentos',icon: 'clipboard', roles: ['admin','doctor','esthetician'] },
  { label: 'Prontuario',     href: '/dashboard/prontuario',   icon: 'file',      roles: ['admin','doctor','esthetician'] },
  { label: 'Injetaveis',     href: '/dashboard/injetaveis',   icon: 'syringe',   roles: ['admin','doctor','esthetician'] },
  { label: 'Estoque',        href: '/dashboard/estoque',      icon: 'box',       roles: ['admin','doctor','esthetician'] },
  { label: 'Eva IA',         href: '/dashboard/eva',          icon: 'sparkles',  roles: ['admin','doctor','esthetician','receptionist'] },
  { label: 'WhatsApp',       href: '/dashboard/whatsapp',     icon: 'message',   roles: ['admin','receptionist'] },
  { label: 'CRM',            href: '/dashboard/crm',          icon: 'target',    roles: ['admin','receptionist'] },
  { label: 'Documentos',     href: '/dashboard/documentos',   icon: 'file',      roles: ['admin','doctor','esthetician','receptionist'] },
  { label: 'Anamnese',       href: '/dashboard/anamnese',     icon: 'clipboard', roles: ['admin','doctor','esthetician','receptionist'] },
  { 
    label: 'Financeiro',    
    href: '/dashboard/financeiro',   
    icon: 'dollarSign',
    roles: ['admin'],
    children: [
      { label: 'Dashboard', href: '/dashboard/financeiro' },
      { label: 'Entradas', href: '/dashboard/financeiro/entradas' },
      { label: 'Saídas', href: '/dashboard/financeiro/saidas' },
      { label: 'Relatórios', href: '/dashboard/financeiro/dre' },
    ]
  },
  { label: 'Equipe',         href: '/dashboard/equipe',       icon: 'users',     roles: ['admin'] },
  { label: 'Auditoria',      href: '/dashboard/auditoria',    icon: 'shield',    roles: ['admin'] },
  { label: 'Configuracoes',  href: '/dashboard/config',       icon: 'settings',  roles: ['admin','doctor','esthetician','receptionist','viewer'] },
]

export const BOTTOM_NAV: NavItem[] = [
  { label: 'Início',    href: '/dashboard',           icon: 'home',     roles: ['admin','doctor','esthetician','receptionist','viewer'] },
  { label: 'Agenda',    href: '/dashboard/agenda',    icon: 'calendar', roles: ['admin','doctor','esthetician','receptionist'] },
  { label: 'Pacientes', href: '/dashboard/pacientes', icon: 'users',    roles: ['admin','doctor','esthetician','receptionist'] },
  { label: 'Eva',       href: '/dashboard/eva',       icon: 'sparkles', roles: ['admin','doctor','esthetician','receptionist'] },
  { label: 'Estoque',   href: '/dashboard/estoque',   icon: 'box',      roles: ['admin','doctor','esthetician'] },
]
