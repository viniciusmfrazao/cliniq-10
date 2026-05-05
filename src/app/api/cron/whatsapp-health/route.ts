import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getConnectionState } from '@/lib/evolution'

/**
 * GET /api/cron/whatsapp-health
 *
 * Roda 1x por hora. Pra cada clinic_whatsapp:
 *  - Chama Evolution getConnectionState(instance_name)
 *  - Se Evolution retorna 'close' ou erro -> marca status='disconnected'
 *  - Se Evolution retorna 'open' MAS last_event_at > 24h -> health_warning=true
 *    (provavel sessao fantasma — Baileys parece OK mas nao recebe nada)
 *  - Se tudo OK -> health_warning=false
 *
 * Usa health_reason pra explicar o motivo no banner.
 *
 * Auth: Header Authorization: Bearer ${CRON_SECRET}.
 */

type Row = {
  id: string
  clinic_id: string
  instance_name: string | null
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
    .select('id, clinic_id, instance_name, status, last_event_at, health_warning')
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
    skipped: 0,
    errors: [] as Array<{ clinic_id: string; error: string }>,
  }

  const nowMs = Date.now()

  for (const r of list) {
    if (!r.instance_name) {
      summary.skipped++
      continue
    }

    const probe = await getConnectionState(r.instance_name)

    let nextStatus = r.status
    let nextWarning = false
    let nextReason: string | null = null

    if (!probe.ok) {
      // Erro de comunicacao (404 = instance sumiu, outros = config/rede)
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
        // Evolution explicitamente fechou: phantom session ou logout no celular
        if (r.status === 'connected') {
          nextStatus = 'disconnected'
          summary.auto_disconnected++
        }
        nextWarning = true
        nextReason = 'evolution_state_close'
        summary.phantom_session++
      } else if (evoState === 'open') {
        // Evolution diz que ta open. Verifica se realmente recebe eventos.
        if (r.status !== 'connected') {
          // Status de banco desatualizado pra pior — corrige
          nextStatus = 'connected'
        }

        const lastMs = r.last_event_at ? new Date(r.last_event_at).getTime() : 0
        const ageMs = nowMs - lastMs

        if (lastMs > 0 && ageMs > STALE_MS) {
          // Aberto mas mudo ha > 24h — sessao fantasma provavel
          nextWarning = true
          nextReason = `no_events_${Math.floor(ageMs / (60 * 60 * 1000))}h`
          summary.stale_no_events++
        } else {
          summary.healthy++
        }
      } else if (evoState === 'connecting') {
        // QR pendente
        nextStatus = 'qr_pending'
        nextWarning = false
        nextReason = null
      }
    }

    const { error: errUpd } = await svc
      .from('clinic_whatsapp')
      .update({
        status: nextStatus,
        health_warning: nextWarning,
        health_reason: nextReason,
        health_checked_at: new Date().toISOString(),
      })
      .eq('id', r.id)

    if (errUpd) {
      summary.errors.push({ clinic_id: r.clinic_id, error: `update: ${errUpd.message}` })
    }
  }

  return NextResponse.json({ ok: true, ...summary })
}
