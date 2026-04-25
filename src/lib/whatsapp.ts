import { createServiceClient } from '@/lib/supabase/server'
import { getSettings } from '@/lib/app-settings'

export type SendResult =
  | { ok: true; result: unknown }
  | { ok: false; error: string; code: 'not_configured' | 'not_connected' | 'evolution_error' | 'unknown' }

function normalizePhone(raw: string): string {
  let p = raw.replace(/\D/g, '')
  if (!p.startsWith('55')) p = '55' + p
  return p
}

/**
 * Envia mensagem de texto via Evolution API usando a instance da clínica.
 * Multi-tenant: cada clínica tem seu próprio instance_name na tabela clinic_whatsapp.
 */
export async function sendWhatsappMessage(args: {
  clinicId: string
  phone: string
  message: string
}): Promise<SendResult> {
  const { clinicId, phone, message } = args

  const settings = await getSettings(['evolution_url', 'evolution_master_key'])
  if (!settings.evolution_url || !settings.evolution_master_key) {
    return {
      ok: false,
      code: 'not_configured',
      error: 'Evolution API não configurada (super_admin precisa preencher em /admin/evolution)',
    }
  }

  const supabase = createServiceClient()
  const { data: wa } = await supabase
    .from('clinic_whatsapp')
    .select('instance_name, status')
    .eq('clinic_id', clinicId)
    .maybeSingle()

  if (!wa?.instance_name) {
    return {
      ok: false,
      code: 'not_configured',
      error: 'Clínica não tem WhatsApp configurado',
    }
  }
  if (wa.status !== 'connected') {
    return {
      ok: false,
      code: 'not_connected',
      error: `WhatsApp da clínica não está conectado (status: ${wa.status})`,
    }
  }

  const baseUrl = settings.evolution_url.replace(/\/$/, '')
  const url = `${baseUrl}/message/sendText/${wa.instance_name}`
  const body = JSON.stringify({ number: normalizePhone(phone), text: message })

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: settings.evolution_master_key,
        'Content-Type': 'application/json',
      },
      body,
    })

    const text = await r.text()
    if (!r.ok) {
      return { ok: false, code: 'evolution_error', error: `Evolution ${r.status}: ${text}` }
    }

    let parsed: unknown
    try { parsed = JSON.parse(text) } catch { parsed = text }
    return { ok: true, result: parsed }
  } catch (err) {
    return {
      ok: false,
      code: 'unknown',
      error: err instanceof Error ? err.message : 'Erro desconhecido',
    }
  }
}
