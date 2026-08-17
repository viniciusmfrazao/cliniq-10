import { createServiceClient } from '@/lib/supabase/server'

/**
 * Liga/desliga TODOS os cron jobs deste ambiente sem precisar redeploy.
 *
 * Criado pra cortar custo de compute no staging: os crons rodavam de 5 em 5
 * min, 24/7, igual produção, mesmo sem uso real (ver fatura Vercel ago/2026).
 *
 * Pra reativar: UPDATE app_settings SET value = 'true' WHERE key = 'crons_enabled';
 * (ou pedir pro Claude reativar)
 */
export async function cronsEnabled(): Promise<boolean> {
  try {
    const svc = createServiceClient()
    const { data } = await svc
      .from('app_settings')
      .select('value')
      .eq('key', 'crons_enabled')
      .maybeSingle()

    // Se a flag não existe, default é ligado (não afeta produção sem a flag)
    if (!data) return true
    return data.value !== 'false'
  } catch {
    // Se der erro lendo a flag, não bloqueia o cron (fail-open por segurança)
    return true
  }
}
