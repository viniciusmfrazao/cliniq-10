export type UserRole = 'admin' | 'doctor' | 'receptionist' | 'esthetician' | 'viewer'
export type PlanName = 'starter' | 'pro' | 'clinic_plus'
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'cancelled'
export type ModuleName = 'agenda' | 'patients' | 'medical_records' | 'injectable_maps' | 'stock' | 'documents' | 'eva_ai' | 'whatsapp' | 'crm' | 'dashboard'

export type Clinic = {
  id: string
  name: string
  slug: string
  plan: PlanName
  active_modules: ModuleName[]
  brand_color: string | null
  logo_url: string | null
  trial_ends_at: string
  created_at: string
}

export type AppUser = {
  id: string
  clinic_id: string
  name: string
  email: string
  role: UserRole
  permissions: Record<string, unknown>
  avatar_url: string | null
  active: boolean
}
