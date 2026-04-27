import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUserClinic, canManageIntegrations } from '@/lib/auth-helpers'
import {
  buildWebhookUrl,
  getConnectionState,
  getWebhookInfo,
  setInstanceWebhook,
} from '@/lib/evolution'

/**
 * Endpoint de diagnóstico do WhatsApp da clínica.
 * Lista lado a lado: o que esperamos x o que a Evolution tem configurado.
 *
 * GET  -> só lê e devolve o snapshot.
 * POST -> tenta refixar o webhook (replay do setInstanceWebhook).
 *
 * Apenas admin/gerente da clínica.
 */
export async function GET() {
  const ctx = await getCurrentUserClinic()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!canManageIntegrations(ctx.role)) {
    return NextResponse.json(
      { error: 'Apenas admin/gerente podem ver o diagnóstico' },
      { status: 403 },
    )
  }

  const svc = createServiceClient()

  const { data: row } = await svc
    .from('clinic_whatsapp')
    .select(
      'instance_name, webhook_token, status, phone_number, last_event_at, connected_at',
    )
    .eq('clinic_id', ctx.clinicId)
    .maybeSingle()

  if (!row) {
    return NextResponse.json(
      {
        ok: true,
        message: 'Nenhuma instance configurada ainda para esta clínica',
        local: null,
      },
      { status: 200 },
    )
  }

  const expectedWebhook = buildWebhookUrl(row.instance_name, row.webhook_token)

  const [stateRes, webhookRes] = await Promise.all([
    getConnectionState(row.instance_name),
    getWebhookInfo(row.instance_name),
  ])

  return NextResponse.json({
    ok: true,
    local: {
      instance_name: row.instance_name,
      status: row.status,
      phone_number: row.phone_number,
      connected_at: row.connected_at,
      last_event_at: row.last_event_at,
      webhook_token_len: row.webhook_token?.length ?? 0,
    },
    expected: {
      webhook_url: expectedWebhook,
    },
    evolution: {
      connection: stateRes.ok
        ? stateRes.data
        : { error: stateRes.error, status: stateRes.status },
      webhook: webhookRes.ok
        ? webhookRes.data
        : { error: webhookRes.error, status: webhookRes.status },
    },
  })
}

export async function POST() {
  const ctx = await getCurrentUserClinic()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!canManageIntegrations(ctx.role)) {
    return NextResponse.json(
      { error: 'Apenas admin/gerente podem refixar o webhook' },
      { status: 403 },
    )
  }

  const svc = createServiceClient()

  const { data: row } = await svc
    .from('clinic_whatsapp')
    .select('instance_name, webhook_token')
    .eq('clinic_id', ctx.clinicId)
    .maybeSingle()

  if (!row) {
    return NextResponse.json(
      { error: 'Nenhuma instance para refixar' },
      { status: 404 },
    )
  }

  const webhookUrl = buildWebhookUrl(row.instance_name, row.webhook_token)
  const r = await setInstanceWebhook({
    instanceName: row.instance_name,
    webhookUrl,
  })
  if (!r.ok) {
    return NextResponse.json(
      { error: r.error, status: r.status, attempted_url: webhookUrl },
      { status: 502 },
    )
  }
  return NextResponse.json({ ok: true, webhook_url: webhookUrl })
}
