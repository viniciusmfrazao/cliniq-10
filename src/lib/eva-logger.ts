/**
 * Helper para registrar logs da Eva na tabela eva_logs.
 * Usado pelo webhook, crons e eva-process via this module.
 * Fire-and-forget — nunca bloqueia o fluxo principal.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export interface EvaLogPayload {
  clinic_id?: string | null
  phone?: string | null
  source: 'webhook' | 'cron-followup' | 'cron-reminder' | 'cron-reminder-2h' | 'cron-reminders' | 'cron-nps' | 'cron-birthdays' | 'cron-recall' | 'cron-contato-pos'
  event: string
  status: 'ok' | 'error' | 'skipped' | 'partial'
  details?: Record<string, unknown> | null
  duration_ms?: number | null
  error_message?: string | null
}

/** Insere um log de forma assíncrona (fire-and-forget, nunca lança). */
export async function logEva(payload: EvaLogPayload): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/insert_eva_log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({
        p_clinic_id: payload.clinic_id ?? null,
        p_phone: payload.phone ? payload.phone.replace(/\D/g, '').slice(-11) : null,
        p_source: payload.source,
        p_event: payload.event,
        p_status: payload.status,
        p_details: payload.details ?? null,
        p_duration_ms: payload.duration_ms ?? null,
        p_error_message: payload.error_message ?? null,
      }),
    })
  } catch {
    // log falhou — nunca deve parar o fluxo principal
  }
}
