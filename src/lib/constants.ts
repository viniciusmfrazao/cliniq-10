/**
 * Constantes e labels para o sistema
 * Use estas constantes ao invés de strings hardcoded
 */

// ============================================
// ROLES - Funções dos usuários
// ============================================

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  doctor: 'Médico(a)',
  dentist: 'Dentista',
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

export const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  doctor: 'bg-blue-100 text-blue-700',
  dentist: 'bg-sky-100 text-sky-800',
  biomedic: 'bg-teal-100 text-teal-700',
  nurse: 'bg-cyan-100 text-cyan-700',
  esthetician: 'bg-pink-100 text-pink-700',
  physiotherapist: 'bg-orange-100 text-orange-700',
  nutritionist: 'bg-lime-100 text-lime-700',
  psychologist: 'bg-indigo-100 text-indigo-700',
  receptionist: 'bg-green-100 text-green-700',
  financial: 'bg-amber-100 text-amber-700',
  manager: 'bg-rose-100 text-rose-700',
  assistant: 'bg-sky-100 text-sky-700',
  viewer: 'bg-slate-100 text-slate-700',
}

// Roles que podem atender pacientes (aparecem na agenda)
// NOTA: 'admin' NÃO é profissional - é apenas administrador
export const PROFESSIONAL_ROLES = [
  'doctor',
  'biomedic',
  'nurse',
  'esthetician',
  'physiotherapist',
  'nutritionist',
  'psychologist',
  'dentist'
] as const

// ============================================
// APPOINTMENT STATUS - Status de agendamentos
// ============================================

export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  checked_in: 'Check-in',
  in_progress: 'Em atendimento',
  completed: 'Realizado',
  cancelled: 'Cancelado',
  no_show: 'Não compareceu',
  pending_confirmation: 'Aguardando confirmação',
}

export const APPOINTMENT_STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  scheduled: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
  confirmed: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  checked_in: { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-300' },
  in_progress: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
  no_show: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
  pending_confirmation: { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-300' },
}

// ============================================
// LEAD STATUS - Status de leads (CRM)
// ============================================

export const LEAD_STATUS_LABELS: Record<string, string> = {
  new: 'Novo Lead',
  contacted: 'Contatado',
  scheduled: 'Agendou',
  converted: 'Convertido',
  lost: 'Perdido',
}

export const LEAD_STATUS_COLORS: Record<string, string> = {
  new: 'bg-slate-100 text-slate-700',
  contacted: 'bg-blue-100 text-blue-700',
  scheduled: 'bg-amber-100 text-amber-700',
  converted: 'bg-emerald-100 text-emerald-700',
  lost: 'bg-red-100 text-red-700',
}

export const LEAD_SOURCES: Record<string, { label: string; icon: string }> = {
  instagram: { label: 'Instagram', icon: '📸' },
  whatsapp: { label: 'WhatsApp', icon: '💬' },
  indication: { label: 'Indicação', icon: '👥' },
  google: { label: 'Google', icon: '🔍' },
  facebook: { label: 'Facebook', icon: '📘' },
  website: { label: 'Site', icon: '🌐' },
  other: { label: 'Outro', icon: '📌' },
}

// ============================================
// DOCUMENT STATUS - Status de documentos
// ============================================

export const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  viewed: 'Visualizado',
  signed: 'Assinado',
  expired: 'Expirado',
  cancelled: 'Cancelado',
}

export const DOCUMENT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  viewed: 'bg-blue-100 text-blue-700',
  signed: 'bg-emerald-100 text-emerald-700',
  expired: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-700',
}

// ============================================
// FORMAS DE PAGAMENTO
// ============================================

export const PAYMENT_METHODS = [
  { id: 'pix', label: 'PIX' },
  { id: 'dinheiro', label: 'Dinheiro' },
  { id: 'debito', label: 'Cartão Débito' },
  { id: 'credito', label: 'Cartão Crédito' },
  { id: 'transferencia', label: 'Transferência' },
  { id: 'boleto', label: 'Boleto' },
] as const

export const CARD_BRANDS = [
  'Visa',
  'Mastercard',
  'Elo',
  'Hipercard',
  'American Express',
  'Outro'
] as const

// ============================================
// CATEGORIAS DRE (Demonstração de Resultado)
// ============================================

export const DRE_CATEGORIES = {
  receitas: [
    'Procedimentos',
    'Consultas',
    'Produtos',
    'Outros'
  ],
  despesas: [
    'Aluguel',
    'Salários',
    'Materiais',
    'Marketing',
    'Equipamentos',
    'Serviços',
    'Impostos',
    'Outros'
  ]
} as const

// ============================================
// PRIORIDADES
// ============================================

export const PRIORITY_LABELS: Record<string, string> = {
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
}

export const PRIORITY_COLORS: Record<string, string> = {
  normal: 'bg-slate-100 text-slate-700',
  alta: 'bg-amber-100 text-amber-700',
  urgente: 'bg-red-100 text-red-700',
}

// ============================================
// GENDER
// ============================================

export const GENDER_LABELS: Record<string, string> = {
  M: 'Masculino',
  F: 'Feminino',
  O: 'Outro',
}

// ============================================
// HORÁRIOS
// ============================================

export const BUSINESS_HOURS = {
  start: 7,  // 07:00
  end: 21,   // 21:00
  interval: 30, // minutos
} as const

export const HOUR_SLOTS = Array.from(
  { length: BUSINESS_HOURS.end - BUSINESS_HOURS.start }, 
  (_, i) => i + BUSINESS_HOURS.start
)

