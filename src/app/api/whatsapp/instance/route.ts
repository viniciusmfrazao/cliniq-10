import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUserClinic, canManageIntegrations } from '@/lib/auth-helpers'
import {
  buildWebhookUrl,
  createInstance,
  deleteInstance,
  generateInstanceName,
  getConnectionState,
  mapEvolutionStateToStatus,
  probeInstance,
  setInstanceWebhook,
} from '@/lib/evolution'

/**
 * Provisiona (ou reutiliza) a instance da clínica do usuário logado.
 *
 * Estratégia idempotente:
 * 1. Decide o nome (reusa do banco se já tiver, senão gera).
 * 2. Faz probeInstance pra ver se ela já existe na Evolution.
 *    - Existe -> só atualiza o webhook pra apontar pra cá (usuário trocou domínio,
 *      veio de migração antiga, etc) e já refaz o estado local.
 *    - Não existe -> cria do zero com webhook embutido.
 * 3. Garante row em clinic_whatsapp.
 */
export async function POST() {
  const ctx = await getCurrentUserClinic()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!canManageIntegrations(ctx.role)) {
    return NextResponse.json(
      { error: 'Apenas admin/gerente da clínica podem configurar o WhatsApp' },
      { status: 403 },
    )
  }

  const svc = createServiceClient()

  const { data: existing } = await svc
    .from('clinic_whatsapp')
    .select('clinic_id, instance_name, webhook_token, status')
    .eq('clinic_id', ctx.clinicId)
    .maybeSingle()

  const instanceName = existing?.instance_name ?? generateInstanceName(ctx.clinicId)
  const webhookToken =
    existing?.webhook_token ?? crypto.randomUUID().replace(/-/g, '')
  const webhookUrl = buildWebhookUrl(instanceName, webhookToken)

  // 1) Sondar se a instance já existe na Evolution
  const probe = await probeInstance(instanceName)
  if (!probe.ok) {
    return NextResponse.json(
      {
        error: humanizeEvolutionError(probe.error, probe.status),
        evolution_status: probe.status,
      },
      { status: 502 },
    )
  }

  let liveState: 'open' | 'connecting' | 'close' | 'unknown' = 'unknown'

  if (probe.data.exists) {
    // 2a) Existe -> só (re)setar webhook
    liveState = (probe.data.state as typeof liveState) ?? 'unknown'
    const wh = await setInstanceWebhook({ instanceName, webhookUrl })
    if (!wh.ok) {
      // Não falhamos a operação; o webhook pode ser corrigido depois,
      // mas avisamos no payload pra debug.
      console.warn('[whatsapp/instance] setInstanceWebhook falhou:', wh.error)
    }
  } else {
    // 2b) Não existe -> criar
    const created = await createInstance({ instanceName, webhookUrl })
    if (!created.ok) {
      return NextResponse.json(
        {
          error: humanizeEvolutionError(created.error, created.status),
          evolution_status: created.status,
        },
        { status: 502 },
      )
    }
    liveState = 'connecting'
  }

  // 3) Garantir row no banco com status sincronizado
  const status = mapEvolutionStateToStatus(liveState)
  if (!existing) {
    const { error } = await svc.from('clinic_whatsapp').insert({
      clinic_id: ctx.clinicId,
      instance_name: instanceName,
      webhook_token: webhookToken,
      status,
    })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  } else {
    await svc
      .from('clinic_whatsapp')
      .update({
        status,
        last_event_at: new Date().toISOString(),
      })
      .eq('clinic_id', ctx.clinicId)
  }

  return NextResponse.json({
    ok: true,
    instance_name: instanceName,
    status,
  })
}

/**
 * Tradução amigável de erros mais comuns da Evolution.
 */
function humanizeEvolutionError(error: string, status?: number): string {
  if (status === 401 || status === 403 || /unauthorized|forbidden|invalid api/i.test(error)) {
    return `Evolution rejeitou a master key (${status ?? 'sem status'}). Verifique URL e Master API Key em /admin/evolution.`
  }
  if (status === 404 || /not found/i.test(error)) {
    return `Evolution não encontrou o recurso (${status ?? '404'}). URL pode estar errada em /admin/evolution.`
  }
  return `Evolution: ${error}`
}

/**
 * Retorna estado atual da instance da clínica.
 * Sincroniza com a Evolution se status local diverge (lazy refresh).
 */
export async function GET() {
  const ctx = await getCurrentUserClinic()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const svc = createServiceClient()

  const { data: row } = await svc
    .from('clinic_whatsapp')
    .select(
      'instance_name, phone_number, status, qr_code, qr_expires_at, connected_at, last_event_at',
    )
    .eq('clinic_id', ctx.clinicId)
    .maybeSingle()

  if (!row) {
    return NextResponse.json({
      configured: false,
      status: 'pending' as const,
    })
  }

  // Lazy sync com Evolution se ainda não está conectado
  let status = row.status as string
  if (status !== 'connected') {
    const state = await getConnectionState(row.instance_name)
    if (state.ok && state.data.instance?.state) {
      const mapped = mapEvolutionStateToStatus(state.data.instance.state)
      if (mapped !== status) {
        const updates: Record<string, unknown> = {
          status: mapped,
          last_event_at: new Date().toISOString(),
        }
        if (mapped === 'connected') {
          updates.connected_at = new Date().toISOString()
          updates.qr_code = null
          updates.qr_expires_at = null
        }
        await svc
          .from('clinic_whatsapp')
          .update(updates)
          .eq('clinic_id', ctx.clinicId)
        status = mapped
      }
    }
  }

  return NextResponse.json({
    configured: true,
    status,
    instance_name: row.instance_name,
    phone_number: row.phone_number,
    qr_code: status === 'qr_pending' ? row.qr_code : null,
    qr_expires_at: status === 'qr_pending' ? row.qr_expires_at : null,
    connected_at: row.connected_at,
    last_event_at: row.last_event_at,
  })
}

/**
 * Apaga a instance (Evolution + banco).
 * Útil pra "resetar" o WhatsApp da clínica.
 */
export async function DELETE() {
  const ctx = await getCurrentUserClinic()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!canManageIntegrations(ctx.role)) {
    return NextResponse.json(
      { error: 'Apenas admin/gerente podem remover a instance' },
      { status: 403 },
    )
  }

  const svc = createServiceClient()
  const { data: row } = await svc
    .from('clinic_whatsapp')
    .select('instance_name')
    .eq('clinic_id', ctx.clinicId)
    .maybeSingle()

  if (!row) return NextResponse.json({ ok: true })

  // Tenta apagar na Evolution; ignora erro pra permitir limpeza mesmo com Evolution off
  await deleteInstance(row.instance_name).catch(() => null)

  await svc.from('clinic_whatsapp').delete().eq('clinic_id', ctx.clinicId)

  return NextResponse.json({ ok: true })
}
