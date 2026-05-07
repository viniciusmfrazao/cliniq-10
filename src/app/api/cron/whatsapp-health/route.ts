import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { ensureWebhookHealthy, getConnectionState } from '@/lib/evolution'

/**
 * GET /api/cron/whatsapp-health
 *
 * Roda 4x por hora (a cada 15min). Pra cada clinic_whatsapp:
 *  1. Confere o webhook salvo na Evolution vs URL esperada (NEXT_PUBLIC_APP_URL).
 *     Se diferente, AUTO-CORRIGE chamando setInstanceWebhook (essa eh a causa
 *     classica de "WhatsApp parou de receber mensagens" apos mudanca de dominio).
 *  2. Chama getConnectionState pra detectar phantom session / instance sumida.
 *
 * Resultados sao gravados em clinic_whatsapp.* (health_warning, health_reason,
 * webhook_actual_url, webhook_expected_url, webhook_last_fixed_at) pro banner
 * exibir alerta E pra debug em historico.
 *
 * Auth: Header Authorization: Bearer ${CRON_SECRET}.
 */

type Row = {
  id: string
  clinic_id: string
  instance_name: string | null
  webhook_token: string | null
  status: string
  last_event_at: string | null
  health_warning: boolean | null
}

const STALE_HOURS = 24
const STALE_MS = STALE_HOURS * 60 * 60 * 1000

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron/whatsapp-health] CRON_SECRET ausente em runtime')
    return NextResponse.json({ ok: false, error: 'cron_not_configured' }, { status: 503 })
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const svc = createServiceClient()

  // So checa quem ja foi configurado (status diferente de pending e tem instance_name)
  const { data: rows, error } = await svc
    .from('clinic_whatsapp')
    .select('id, clinic_id, instance_name, webhook_token, status, last_event_at, health_warning')
    .not('instance_name', 'is', null)
    .in('status', ['connected', 'qr_pending', 'disconnected', 'error'])

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const list = (rows as Row[] | null) ?? []

  const summary = {
    total: list.length,
    healthy: 0,
    phantom_session: 0,
    stale_no_events: 0,
    auto_disconnected: 0,
    webhook_drift_fixed: 0,
    webhook_drift_failed: 0,
    skipped: 0,
    errors: [] as Array<{ clinic_id: string; error: string }>,
  }

  const nowMs = Date.now()

  for (const r of list) {
    if (!r.instance_name) {
      summary.skipped++
      continue
    }

    // ---------------------------------------------------------------
    // Etapa 1: drift check da URL do webhook
    // (so faz sentido se a instance ainda existe — abaixo pulamos
    //  caso o connectionState retorne 404)
    // ---------------------------------------------------------------
    let webhookActual: string | null = null
    let webhookExpected: string | null = null
    let webhookFixed = false
    let webhookFixError: string | null = null

    if (r.webhook_token) {
      try {
        const w = await ensureWebhookHealthy({
          instanceName: r.instance_name,
          webhookToken: r.webhook_token,
        })
        webhookActual = w.actualUrl
        webhookExpected = w.expectedUrl
        if (w.drift) {
          if (w.fixed) {
            summary.webhook_drift_fixed++
            webhookFixed = true
          } else {
            summary.webhook_drift_failed++
            webhookFixError = w.error
          }
        }
      } catch (e) {
        webhookFixError = e instanceof Error ? e.message : 'unknown'
      }
    }

    // ---------------------------------------------------------------
    // Etapa 2: connection state probe
    // ---------------------------------------------------------------
    const probe = await getConnectionState(r.instance_name)

    let nextStatus = r.status
    let nextWarning = false
    let nextReason: string | null = null

    if (!probe.ok) {
      if (probe.status === 404) {
        nextStatus = 'disconnected'
        nextWarning = true
        nextReason = 'instance_not_found'
        summary.auto_disconnected++
      } else {
        nextWarning = true
        nextReason = `evolution_error:${probe.error?.slice(0, 80) ?? 'unknown'}`
        summary.errors.push({ clinic_id: r.clinic_id, error: probe.error || 'unknown' })
      }
    } else {
      const evoState = probe.data.instance?.state ?? 'unknown'

      if (evoState === 'close' || evoState === 'unknown') {
        if (r.status === 'connected') {
          nextStatus = 'disconnected'
          summary.auto_disconnected++
        }
        nextWarning = true
        nextReason = 'evolution_state_close'
        summary.phantom_session++
      } else if (evoState === 'open') {
        if (r.status !== 'connected') {
          nextStatus = 'connected'
        }

        const lastMs = r.last_event_at ? new Date(r.last_event_at).getTime() : 0
        const ageMs = nowMs - lastMs

        if (lastMs > 0 && ageMs > STALE_MS) {
          nextWarning = true
          nextReason = `no_events_${Math.floor(ageMs / (60 * 60 * 1000))}h`
          summary.stale_no_events++
        } else {
          summary.healthy++
        }
      } else if (evoState === 'connecting') {
        nextStatus = 'qr_pending'
        nextWarning = false
        nextReason = null
      }
    }

    // ---------------------------------------------------------------
    // Etapa 3: drift do webhook tem prioridade no banner se aconteceu
    // (o admin precisa saber, mesmo que ja tenhamos auto-corrigido)
    // ---------------------------------------------------------------
    if (webhookFixed) {
      nextWarning = true
      nextReason = 'webhook_url_drift_fixed'
    } else if (webhookFixError) {
      nextWarning = true
      nextReason = `webhook_drift_error:${webhookFixError.slice(0, 60)}`
      summary.errors.push({
        clinic_id: r.clinic_id,
        error: `webhook drift: ${webhookFixError}`,
      })
    }

    const updatePayload: Record<string, unknown> = {
      status: nextStatus,
      health_warning: nextWarning,
      health_reason: nextReason,
      health_checked_at: new Date().toISOString(),
    }
    if (webhookActual !== null) updatePayload.webhook_actual_url = webhookActual
    if (webhookExpected !== null) updatePayload.webhook_expected_url = webhookExpected
    if (webhookFixed) updatePayload.webhook_last_fixed_at = new Date().toISOString()

    const { error: errUpd } = await svc
      .from('clinic_whatsapp')
      .update(updatePayload)
      .eq('id', r.id)

    if (errUpd) {
      summary.errors.push({ clinic_id: r.clinic_id, error: `update: ${errUpd.message}` })
    }
  }

  return NextResponse.json({ ok: true, ...summary })
}
