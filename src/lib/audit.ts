import { createClient } from '@/lib/supabase/client'

type AuditAction = 
  | 'create' 
  | 'update' 
  | 'delete' 
  | 'view' 
  | 'login' 
  | 'logout' 
  | 'export' 
  | 'send'
  | 'check_in'
  | 'status_change'

type AuditParams = {
  action: AuditAction
  entityType: string
  entityId?: string
  entityName?: string
  details?: Record<string, any>
  clinicId: string
  userId: string
}

export async function logAudit({
  action,
  entityType,
  entityId,
  entityName,
  details,
  clinicId,
  userId,
}: AuditParams) {
  const supabase = createClient()

  try {
    await supabase.from('audit_logs').insert({
      clinic_id: clinicId,
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      entity_name: entityName || null,
      details: details || null,
      ip_address: null, // Pode ser capturado via API route
      user_agent: typeof window !== 'undefined' ? navigator.userAgent : null,
    })
  } catch (error) {
    console.error('Erro ao registrar auditoria:', error)
  }
}

// Helper para usar em Server Components
export async function logAuditServer(
  supabase: any,
  params: Omit<AuditParams, 'clinicId' | 'userId'> & { clinicId?: string; userId?: string }
) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: userData } = await supabase
    .from('users')
    .select('clinic_id')
    .eq('id', user.id)
    .single()

  if (!userData) return

  try {
    await supabase.from('audit_logs').insert({
      clinic_id: params.clinicId || userData.clinic_id,
      user_id: params.userId || user.id,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      entity_name: params.entityName || null,
      details: params.details || null,
    })
  } catch (error) {
    console.error('Erro ao registrar auditoria:', error)
  }
}
