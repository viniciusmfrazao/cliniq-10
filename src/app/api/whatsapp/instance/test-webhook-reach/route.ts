import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUserClinic, canManageIntegrations } from '@/lib/auth-helpers'
import { buildWebhookUrl } from '@/lib/evolution'

/**
 * POST /api/whatsapp/instance/test-webhook-reach
 *
 * Faz uma chamada de teste do servidor Vercel pra propria URL do webhook
 * com payload simulado de connection.update. Se a entry aparecer em
 * evolution_webhook_logs, o endpoint esta funcional.
 *
 * Util pra distinguir:
 *   - "webhook handler quebrado" (nao deveria chegar log)
 *   - "Evolution server nao chama webhook" (chega quando testamos do
 *     proprio Vercel, mas nao quando deveria vir da Evolution)
 */
export async function POST() {
  const ctx = await getCurrentUserClinic()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!canManageIntegrations(ctx.role)) {
    return NextResponse.json({ error: 'Apenas admin/gerente' }, { status: 403 })
  }

  const svc = createServiceClient()
  const { data: row } = await svc
    .from('clinic_whatsapp')
    .select('instance_name, webhook_token')
    .eq('clinic_id', ctx.clinicId)
    .maybeSingle()

  if (!row?.instance_name || !row?.webhook_token) {
    return NextResponse.json(
      { error: 'WhatsApp nao configurado nessa clinica' },
      { status: 404 },
    )
  }

  const url = buildWebhookUrl(row.instance_name, row.webhook_token)

  const fakePayload = {
    event: 'connection.update',
    instance: row.instance_name,
    data: { state: 'open', _test: true, _at: new Date().toISOString() },
    sender: '__self_test__',
    server_url: 'https://test.local',
    apikey: '__test__',
  }

  const startedAt = Date.now()
  let status = 0
  let body = ''
  let error: string | null = null

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fakePayload),
    })
    status = r.status
    body = (await r.text()).slice(0, 500)
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }

  const elapsed = Date.now() - startedAt

  // Aguarda 1s e olha se um log apareceu
  await new Promise((r) => setTimeout(r, 1000))
  const { data: latestLogs } = await svc
    .from('evolution_webhook_logs')
    .select('id, event, created_at, status_code, error')
    .eq('instance', row.instance_name)
    .gte('created_at', new Date(startedAt - 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(5)

  const reached = (latestLogs?.length ?? 0) > 0

  return NextResponse.json({
    ok: true,
    test: {
      url,
      status,
      body,
      error,
      elapsed_ms: elapsed,
    },
    reached_handler: reached,
    recent_logs: latestLogs ?? [],
    interpretation: reached
      ? 'OK: o endpoint do webhook esta acessivel a partir do Vercel. Se a Evolution real nao esta gerando logs, o problema esta no servidor da Evolution (rede, firewall, ou nao esta disparando os eventos).'
      : 'PROBLEMA: a chamada do Vercel pra ele mesmo nao gerou log. Pode ser rota inexistente, token errado, ou erro 500 no handler.',
  })
}
