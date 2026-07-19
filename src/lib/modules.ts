export type ModuleId = 
  | 'odontograma'
  | 'recepcao'
  | 'agenda'
  | 'lista_espera'
  | 'pacientes'
  | 'procedimentos'
  | 'prontuario'
  | 'injetaveis'
  | 'estoque'
  | 'eva_ia'
  | 'whatsapp'
  | 'crm'
  | 'documentos'
  | 'financeiro'
  | 'equipe'
  | 'auditoria'
  | 'ia_prontuario'
  | 'automacoes'
  | 'nfse'

export type Module = {
  id: ModuleId
  name: string
  description: string
  icon: string
  category: 'core' | 'clinical' | 'commercial' | 'admin'
  defaultEnabled: boolean
}

export const AVAILABLE_MODULES: Module[] = [
  // Core - Sempre incluídos
  { 
    id: 'agenda', 
    name: 'Agenda', 
    description: 'Agendamento de consultas e procedimentos',
    icon: '📅',
    category: 'core',
    defaultEnabled: true
  },
  { 
    id: 'pacientes', 
    name: 'Pacientes', 
    description: 'Cadastro e gestão de pacientes',
    icon: '👥',
    category: 'core',
    defaultEnabled: true
  },
  { 
    id: 'recepcao', 
    name: 'Recepção', 
    description: 'Painel de check-in e recepção',
    icon: '🏥',
    category: 'core',
    defaultEnabled: true
  },

  // Clinical
  { 
    id: 'procedimentos', 
    name: 'Procedimentos', 
    description: 'Catálogo de procedimentos e preços',
    icon: '📋',
    category: 'clinical',
    defaultEnabled: true
  },
  { 
    id: 'prontuario', 
    name: 'Prontuário', 
    description: 'Prontuário eletrônico e evoluções',
    icon: '📄',
    category: 'clinical',
    defaultEnabled: true
  },
  { 
    id: 'injetaveis', 
    name: 'Injetáveis', 
    description: 'Mapa de aplicação de toxina e preenchimento',
    icon: '💉',
    category: 'clinical',
    defaultEnabled: true
  },
  { 
    id: 'documentos', 
    name: 'Documentos', 
    description: 'Termos, consentimentos e anamnese',
    icon: '📑',
    category: 'clinical',
    defaultEnabled: true
  },
  { 
    id: 'odontograma', 
    name: 'Odontograma', 
    description: 'Mapa dental interativo — adulto e leite. Ideal para clínicas odontológicas.',
    icon: '🦷',
    category: 'clinical',
    defaultEnabled: false
  },
  { 
    id: 'lista_espera', 
    name: 'Lista de Espera', 
    description: 'Gestão de fila de espera',
    icon: '⏳',
    category: 'clinical',
    defaultEnabled: false
  },
  { 
    id: 'estoque', 
    name: 'Estoque', 
    description: 'Controle de produtos e insumos',
    icon: '📦',
    category: 'clinical',
    defaultEnabled: false
  },

  // Commercial
  { 
    id: 'crm', 
    name: 'CRM', 
    description: 'Gestão de leads e funil de vendas',
    icon: '🎯',
    category: 'commercial',
    defaultEnabled: false
  },
  { 
    id: 'whatsapp', 
    name: 'WhatsApp', 
    description: 'Integração com WhatsApp Business',
    icon: '💬',
    category: 'commercial',
    defaultEnabled: false
  },
  {
    id: 'ia_prontuario',
    name: 'IA no Prontuário',
    description: 'Resumo do histórico e sugestão de conduta com IA no atendimento',
    icon: '🤖',
    category: 'clinical',
    defaultEnabled: false
  },
  { 
    id: 'eva_ia', 
    name: 'Eva IA', 
    description: 'Assistente virtual com inteligência artificial',
    icon: '✨',
    category: 'commercial',
    defaultEnabled: false
  },

  // Admin
  { 
    id: 'financeiro', 
    name: 'Financeiro', 
    description: 'Entradas, saídas e relatórios financeiros',
    icon: '💰',
    category: 'admin',
    defaultEnabled: true
  },
  { 
    id: 'equipe', 
    name: 'Equipe', 
    description: 'Gestão de profissionais e usuários',
    icon: '👨‍⚕️',
    category: 'admin',
    defaultEnabled: true
  },
  { 
    id: 'auditoria', 
    name: 'Auditoria', 
    description: 'Logs de atividades do sistema',
    icon: '🛡️',
    category: 'admin',
    defaultEnabled: false
  },
  {
    id: 'nfse',
    name: 'Nota Fiscal (NFS-e)',
    description: 'Emissão de nota fiscal de serviço para os procedimentos, direto das Entradas',
    icon: '🧾',
    category: 'admin',
    defaultEnabled: false
  },
]

export const MODULE_CATEGORIES = {
  core: { name: 'Básico', description: 'Módulos essenciais' },
  clinical: { name: 'Clínico', description: 'Gestão clínica e atendimento' },
  commercial: { name: 'Comercial', description: 'Vendas e relacionamento' },
  admin: { name: 'Administrativo', description: 'Gestão e controle' },
}

export function getDefaultModules(): ModuleId[] {
  return AVAILABLE_MODULES
    .filter(m => m.defaultEnabled)
    .map(m => m.id)
}

export function getModuleById(id: ModuleId): Module | undefined {
  return AVAILABLE_MODULES.find(m => m.id === id)
}

export function getModulesByCategory(category: Module['category']): Module[] {
  return AVAILABLE_MODULES.filter(m => m.category === category)
}

// Mapeamento de módulos para rotas do menu
export const MODULE_ROUTES: Record<ModuleId, string[]> = {
  recepcao: ['/dashboard/recepcao'],
  agenda: ['/dashboard/agenda'],
  lista_espera: ['/dashboard/lista-espera'],
  pacientes: ['/dashboard/pacientes'],
  procedimentos: ['/dashboard/procedimentos'],
  // O módulo "prontuario" foi fundido com "pacientes" (Central do Paciente
  // tem tab Evoluções). Mantemos o ID por compat com planos já configurados
  // — quem tem só `prontuario` ativo continua vendo a Central via Pacientes.
  prontuario: ['/dashboard/pacientes'],
  injetaveis: ['/dashboard/injetaveis'],
  estoque: ['/dashboard/estoque'],
  eva_ia: ['/dashboard/eva'],
  whatsapp: ['/dashboard/whatsapp'],
  crm: ['/dashboard/crm'],
  documentos: ['/dashboard/documentos'],
  financeiro: ['/dashboard/financeiro', '/dashboard/financeiro/entradas', '/dashboard/financeiro/saidas', '/dashboard/financeiro/dre'],
  equipe: ['/dashboard/equipe'],
  auditoria: ['/dashboard/auditoria'],
  odontograma: [],  // tab dentro da ficha do paciente, sem rota própria
  ia_prontuario: [], // feature dentro do atendimento, sem rota própria
  automacoes: ['/dashboard/config/automacoes'],
  nfse: ['/dashboard/config/fiscal'],
}

// Verifica se uma rota está habilitada para os módulos ativos
export function isRouteEnabled(route: string, activeModules: ModuleId[]): boolean {
  // Rotas sempre disponíveis (home, config, ajuda)
  const alwaysAvailable = ['/dashboard', '/dashboard/config', '/dashboard/como-funciona']
  if (alwaysAvailable.includes(route)) return true
  
  // Verifica se a rota pertence a algum módulo ativo
  for (const moduleId of activeModules) {
    const routes = MODULE_ROUTES[moduleId]
    if (routes?.some(r => route.startsWith(r))) {
      return true
    }
  }
  
  return false
}
