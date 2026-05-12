/**
 * Tipos centralizados para o banco de dados
 * Baseado no schema do Supabase
 */

// ============================================
// ENUMS E CONSTANTES
// ============================================

export const USER_ROLES = [
  'admin',
  'doctor',
  'biomedic', 
  'nurse',
  'esthetician',
  'physiotherapist',
  'nutritionist',
  'psychologist',
  'receptionist',
  'financial',
  'manager',
  'assistant',
  'viewer'
] as const

export type UserRole = typeof USER_ROLES[number]

// Roles que podem atender pacientes (aparecem na agenda)
// NOTA: 'admin' NÃO é profissional - apenas administrador do sistema
export const PROFESSIONAL_ROLES: UserRole[] = [
  'doctor',
  'biomedic',
  'nurse',
  'esthetician',
  'physiotherapist',
  'nutritionist',
  'psychologist'
]

export function isProfessional(user: { role: string; professional_role?: string | null }): boolean {
  return PROFESSIONAL_ROLES.includes(user.role as any) || 
         PROFESSIONAL_ROLES.includes(user.professional_role as any)
}

export function getEffectiveProfessionalRole(user: { role: string; professional_role?: string | null }): string {
  if (PROFESSIONAL_ROLES.includes(user.role as any)) return user.role
  if (user.professional_role && PROFESSIONAL_ROLES.includes(user.professional_role as any)) return user.professional_role
  return user.role
}

export const APPOINTMENT_STATUS = [
  'scheduled',
  'confirmed',
  'checked_in',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
  'pending_confirmation'
] as const

export type AppointmentStatus = typeof APPOINTMENT_STATUS[number]

export const LEAD_STATUS = [
  'new',
  'contacted',
  'scheduled',
  'converted',
  'lost'
] as const

export type LeadStatus = typeof LEAD_STATUS[number]

export const LEAD_SOURCES = [
  'instagram',
  'whatsapp',
  'indication',
  'google',
  'facebook',
  'website',
  'other'
] as const

export type LeadSource = typeof LEAD_SOURCES[number]

export const DOCUMENT_STATUS = [
  'pending',
  'viewed',
  'signed',
  'expired',
  'cancelled'
] as const

export type DocumentStatus = typeof DOCUMENT_STATUS[number]

export const EVOLUTION_TYPES = [
  'consultation',
  'procedure',
  'note',
  'prescription',
  'exam'
] as const

export type EvolutionType = typeof EVOLUTION_TYPES[number]

export const INJECTABLE_TYPES = [
  'toxin',
  'filler'
] as const

export type InjectableType = typeof INJECTABLE_TYPES[number]

export const STOCK_MOVEMENT_TYPES = [
  'entrada',
  'saida',
  'ajuste',
  'uso_atendimento'
] as const

export type StockMovementType = typeof STOCK_MOVEMENT_TYPES[number]

// ============================================
// ENTIDADES PRINCIPAIS
// ============================================

export interface User {
  id: string
  clinic_id: string
  name: string
  email: string
  role: UserRole
  permissions?: Record<string, boolean> | string[]
  avatar_url?: string
  active: boolean
  created_at: string
  updated_at: string
  deleted_at?: string
}

export interface Clinic {
  id: string
  name: string
  cnpj?: string
  slug: string
  plan: string
  active_modules?: string[]
  settings?: {
    active_modules?: string[]
    [key: string]: unknown
  }
  brand_color?: string
  logo_url?: string
  trial_ends_at: string
  created_at: string
  updated_at: string
  deleted_at?: string
}

export interface Patient {
  id: string
  clinic_id: string
  name: string
  email?: string
  phone?: string
  cpf?: string
  birth_date?: string
  gender?: 'M' | 'F' | 'O'
  photo_url?: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  notes?: string
  tags?: string[]
  whatsapp_opt_in?: boolean
  created_at: string
  updated_at: string
}

export interface Appointment {
  id: string
  clinic_id: string
  patient_id?: string
  professional_id?: string
  procedure_id?: string
  room_id?: string
  start_time: string
  end_time: string
  status: AppointmentStatus
  notes?: string
  price?: number
  checked_in_at?: string
  created_at: string
  updated_at: string
  // Relations
  patients?: Patient
  procedures?: Procedure
  professional?: User
  rooms?: Room
}

export interface Procedure {
  id: string
  clinic_id: string
  name: string
  description?: string
  duration_minutes: number
  price: number
  category?: string
  active: boolean
  variation?: string
  installment_price?: number
  installments?: number
  professional_ids?: string[]
  includes_return?: boolean
  return_days?: number
  is_promotion?: boolean
  original_price?: number
  promotion_dates?: string[]
  unit?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface Lead {
  id: string
  clinic_id: string
  name: string
  phone?: string
  email?: string
  source: LeadSource
  status: LeadStatus
  stage_order?: number
  interest?: string
  procedure_id?: string
  estimated_value?: number
  assigned_to?: string
  next_contact_at?: string
  last_contact_at?: string
  converted_at?: string
  lost_reason?: string
  conversion_notes?: string
  whatsapp_chat_id?: string
  last_whatsapp_at?: string
  whatsapp_opt_in?: boolean
  ai_score?: number
  ai_priority?: 'hot' | 'warm' | 'cold'
  ai_suggested_action?: string
  ai_last_analysis?: string
  ai_sentiment?: string
  tags?: string[]
  notes?: string
  created_at: string
  updated_at: string
}

export interface Room {
  id: string
  clinic_id: string
  name: string
  color?: string
  active: boolean
  created_at: string
}

export interface Product {
  id: string
  clinic_id: string
  name: string
  brand?: string
  category?: string
  unit?: string
  min_stock?: number
  current_stock: number
  cost_price?: number
  sale_price?: number
  expiry_date?: string
  batch_number?: string
  supplier?: string
  notes?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Evolution {
  id: string
  clinic_id: string
  patient_id: string
  professional_id?: string
  appointment_id?: string
  type: EvolutionType
  title: string
  content?: string
  procedure_name?: string
  photos?: string[]
  created_at: string
}

export interface InjectableApplication {
  id: string
  clinic_id: string
  patient_id: string
  professional_id?: string
  appointment_id?: string
  product_id?: string
  application_date: string
  type: InjectableType
  product_name: string
  product_brand?: string
  lot_number?: string
  total_units?: number
  notes?: string
  photos_before?: string[]
  photos_after?: string[]
  stock_deducted?: boolean
  created_at: string
}

export interface InjectablePoint {
  id: string
  application_id: string
  zone: string
  muscle?: string
  side?: 'left' | 'right' | 'center'
  x_position: number
  y_position: number
  units?: number
  depth?: string
  technique?: string
  notes?: string
}

// ============================================
// FINANCEIRO
// ============================================

export interface Entrada {
  id: string
  clinic_id: string
  data_venda: string
  paciente_id?: string
  paciente_nome?: string
  procedimento_id?: string
  procedimento_nome?: string
  profissional_id?: string
  profissional_nome?: string
  forma_pagamento: string
  bandeira?: string
  valor_bruto: number
  taxa_percentual?: number
  valor_taxa?: number
  valor_liquido: number
  n_parcelas?: number
  observacoes?: string
  created_by?: string
  created_at: string
}

export interface Saida {
  id: string
  clinic_id: string
  data: string
  descricao: string
  categoria_dre?: string
  fornecedor?: string
  valor: number
  forma_pagamento?: string
  observacoes?: string
  created_by?: string
  created_at: string
}

export interface Debito {
  id: string
  clinic_id: string
  paciente_id: string
  valor: number
  descricao?: string
  data_vencimento: string
  status: 'pendente' | 'pago' | 'cancelado'
  data_pagamento?: string
  created_at: string
}

// ============================================
// DOCUMENTOS
// ============================================

export interface DocumentTemplate {
  id: string
  clinic_id: string
  name: string
  description?: string
  content: string
  category?: string
  is_active: boolean
  theme_color?: string
  created_at: string
  updated_at: string
}

export interface DocumentSent {
  id: string
  clinic_id: string
  template_id?: string
  patient_id: string
  appointment_id?: string
  name: string
  content: string
  status: DocumentStatus
  sent_at: string
  viewed_at?: string
  signed_at?: string
  expires_at?: string
  signature_data?: string
  signature_ip?: string
  sent_by?: string
  sign_token?: string
  created_at: string
}

export interface Anamnese {
  id: string
  clinic_id: string
  patient_id: string
  token: string
  status: 'pending' | 'viewed' | 'completed'
  responses?: Record<string, unknown>
  signature_data?: string
  signature_ip?: string
  sent_by?: string
  viewed_at?: string
  completed_at?: string
  expires_at?: string
  created_at: string
}

// ============================================
// OUTROS
// ============================================

export interface WaitingListItem {
  id: string
  clinic_id: string
  patient_id: string
  procedure_id?: string
  professional_id?: string
  preferred_period?: string
  preferred_days?: string[]
  priority?: 'normal' | 'alta' | 'urgente'
  status: 'aguardando' | 'contatado' | 'agendado' | 'cancelado'
  notes?: string
  created_at: string
  contacted_at?: string
  scheduled_appointment_id?: string
}

export interface AuditLog {
  id: string
  clinic_id?: string
  user_id?: string
  action: string
  entity_type: string
  entity_id?: string
  entity_name?: string
  details?: Record<string, unknown>
  ip_address?: string
  user_agent?: string
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  type?: string
  title: string
  message?: string
  link?: string
  read_at?: string
  created_at: string
}

export interface MedicalRecord {
  id: string
  clinic_id: string
  patient_id: string
  blood_type?: string
  allergies?: string[]
  chronic_conditions?: string[]
  medications?: string[]
  emergency_contact_name?: string
  emergency_contact_phone?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface EvaConversation {
  id: string
  clinic_id: string
  phone: string
  role?: 'user' | 'assistant'
  content?: string
  user_message?: string
  assistant_message?: string
  created_at: string
}

// ============================================
// ADMIN
// ============================================

export interface AdminPlan {
  id: string
  name: string
  description?: string
  price_monthly: number
  price_yearly?: number
  modules: string[]
  max_professionals?: number
  active: boolean
  created_at: string
  updated_at: string
}

export interface SuperAdmin {
  id: string
  email: string
  name: string
  created_at: string
}
