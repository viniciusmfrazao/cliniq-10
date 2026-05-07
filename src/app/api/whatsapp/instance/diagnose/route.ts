import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUserClinic, canManageIntegrations } from '@/lib/auth-helpers'
import {
  buildWebhookUrl,
  getConnectionState,
  getWebhookInfo,
  setInstanceWebhook,
} from '@/lib/evolution'
import { resolveClinicInstanceForApi } from '@/lib/whatsapp-route-helpers'

/**
 * Endpoint de diagnóstico do WhatsApp da clínica.
 * Lista lado a lado: o que esperamos x o que a Evolution tem configurado.
 *
 * Multi-numero: aceita ?instance_name= pra escolher; senao opera na default.
 *
 * GET  -> só lê e devolve o snapshot.
 * POST -> tenta refixar o webhook (replay do setInstanceWebhook).
 */
export async function GET(req: NextRequest) {
  const ctx = await getCurrentUserClinic()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!canManageIntegrations(ctx.role)) {
    return NextResponse.json(
      { error: 'Apenas admin/gerente podem ver o diagnóstico' },
      { status: 403 },
    )
  }

  const svc = createServiceClient()
  const baseRow = await resolveClinicInstanceForApi(svc, req, ctx.clinicId)
  if (!baseRow) {
    return NextResponse.json(
      {
        ok: true,
        message: 'Nenhuma instance configurada ainda para esta clínica',
        local: null,
      },
      { status: 200 },
    )
  }

  // Carrega campos extras pra montar o relatorio
  const { data: row } = await svc
    .from('clinic_whatsapp')
    .select(
      'instance_name, webhook_token, status, phone_number, last_event_at, connected_at',
    )
    .eq('id', baseRow.id)
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

  const [stateRes, webhookRes, logsRes] = await Promise.all([
    getConnectionState(row.instance_name),
    getWebhookInfo(row.instance_name),
    svc
      .from('evolution_webhook_logs')
      .select('id, event, status_code, error, created_at, body')
      .eq('instance', row.instance_name)
      .order('created_at', { ascending: false })
      .limit(10),
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
    recent_webhook_logs: logsRes.error
      ? { error: logsRes.error.message }
      : (logsRes.data ?? []).map((l) => ({
          id: l.id,
          at: l.created_at,
          event: l.event,
          status: l.status_code,
          error: l.error,
          summary: summarizeBody(l.body),
        })),
  })
}

function summarizeBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') return { raw: body }
  const b = body as Record<string, unknown>
  const data = (b.data as Record<string, unknown> | undefined) ?? {}
  const key = data.key as Record<string, unknown> | undefined
  const message = data.message as Record<string, unknown> | undefined
  return {
    event: b.event,
    instance: b.instance,
    fromMe: key?.fromMe,
    remoteJid: key?.remoteJid,
    pushName: data.pushName,
    text:
      typeof message?.conversation === 'string'
        ? (message.conversation as string).slice(0, 80)
        : undefined,
    state: data.state,
  }
}

export async function POST(req: NextRequest) {
  const ctx = await getCurrentUserClinic()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!canManageIntegrations(ctx.role)) {
    return NextResponse.json(
      { error: 'Apenas admin/gerente podem refixar o webhook' },
      { status: 403 },
    )
  }

  const svc = createServiceClient()
  const row = await resolveClinicInstanceForApi(svc, req, ctx.clinicId)

  if (!row || !row.webhook_token) {
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
