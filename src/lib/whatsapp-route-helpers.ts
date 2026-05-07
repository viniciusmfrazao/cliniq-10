import type { NextRequest } from 'next/server'
import type { createServiceClient } from '@/lib/supabase/server'

export type ClinicWhatsappRow = {
  id: string
  instance_name: string
  status: string
  webhook_token: string | null
  is_default: boolean | null
}

/**
 * Resolve a instance alvo de uma rota /api/whatsapp/instance/* a partir de:
 *   1. ?instance_name=... na URL
 *   2. body.instance_name (caso ja consumimos o body fora — passe via override)
 *   3. is_default = true da clinica
 *   4. Mais antiga da clinica (fallback)
 *
 * Retorna null se a clinica nao tem nenhuma instance.
 */
export async function resolveClinicInstanceForApi(
  svc: ReturnType<typeof createServiceClient>,
  req: NextRequest,
  clinicId: string,
  override?: string | null,
): Promise<ClinicWhatsappRow | null> {
  const url = new URL(req.url)
  const queryName = url.searchParams.get('instance_name')
  const targetName = override || queryName

  if (targetName) {
    const { data } = await svc
      .from('clinic_whatsapp')
      .select('id, instance_name, status, webhook_token, is_default')
      .eq('clinic_id', clinicId)
      .eq('instance_name', targetName)
      .maybeSingle()
    return (data as ClinicWhatsappRow | null) ?? null
  }

  // Tenta is_default
  const { data: def } = await svc
    .from('clinic_whatsapp')
    .select('id, instance_name, status, webhook_token, is_default')
    .eq('clinic_id', clinicId)
    .eq('is_default', true)
    .maybeSingle()

  if (def) return def as ClinicWhatsappRow

  // Fallback: a mais antiga
  const { data: any } = await svc
    .from('clinic_whatsapp')
    .select('id, instance_name, status, webhook_token, is_default')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  return (any as ClinicWhatsappRow | null) ?? null
}
