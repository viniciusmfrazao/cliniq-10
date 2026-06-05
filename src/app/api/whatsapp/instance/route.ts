import { NextRequest, NextResponse } from 'next/server'
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
/**
 * Body opcional:
 *   - instance_name: provisiona/reutiliza essa instance especifica.
 *     Se nao vier, usa a default da clinica (ou cria a primeira).
 *   - label: apelido visivel pro numero novo.
 *   - assigned_to: user dono (multi-secretaria).
 *   - role_inbound / role_outbound_automation / role_outbound_manual: papeis.
 */
export async function POST(req: NextRequest) {
  const ctx = await getCurrentUserClinic()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!canManageIntegrations(ctx.role)) {
    return NextResponse.json(
      { error: 'Apenas admin/gerente da clínica podem configurar o WhatsApp' },
      { status: 403 },
    )
  }

  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    body = {}
  }
  const requestedInstance =
    typeof body.instance_name === 'string' ? body.instance_name : undefined
  const label = typeof body.label === 'string' ? body.label : null
  const assignedTo =
    typeof body.assigned_to === 'string' ? body.assigned_to : null
  const isAddingNew = !!body.add_new

  const svc = createServiceClient()

  // Busca a instance especifica se requisitada, senao a default (ou primeira)
  let existing: {
    id?: string
    clinic_id: string
    instance_name: string
    webhook_token: string
    status: string
  } | null = null
  if (requestedInstance) {
    const { data } = await svc
      .from('clinic_whatsapp')
      .select('id, clinic_id, instance_name, webhook_token, status')
      .eq('clinic_id', ctx.clinicId)
      .eq('instance_name', requestedInstance)
      .maybeSingle()
    existing = data ?? null
  } else if (!isAddingNew) {
    // Tenta is_default; senao, qualquer uma da clinica
    const { data: def } = await svc
      .from('clinic_whatsapp')
      .select('id, clinic_id, instance_name, webhook_token, status')
      .eq('clinic_id', ctx.clinicId)
      .eq('is_default', true)
      .maybeSingle()
    if (def) {
      existing = def
    } else {
      const { data: any } = await svc
        .from('clinic_whatsapp')
        .select('id, clinic_id, instance_name, webhook_token, status')
        .eq('clinic_id', ctx.clinicId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      existing = any ?? null
    }
  }

  // Se for "adicionar novo", valida limite por plano
  if (isAddingNew) {
    const limitCheck = await checkPlanLimit(svc, ctx.clinicId)
    if (!limitCheck.ok) {
      return NextResponse.json(
        { error: limitCheck.error, code: 'plan_limit' },
        { status: 402 },
      )
    }
  }

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
    // Primeira instance da clinica vira default automaticamente
    const { count } = await svc
      .from('clinic_whatsapp')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', ctx.clinicId)
    const isFirst = (count ?? 0) === 0
    const { error } = await svc.from('clinic_whatsapp').insert({
      clinic_id: ctx.clinicId,
      instance_name: instanceName,
      webhook_token: webhookToken,
      status,
      is_default: isFirst,
      label,
      assigned_to: assignedTo,
      // 1º número: assume tudo (Eva + automação + manual)
      // 2º+ número: entra sem nenhum papel — clínica configura manualmente
      role_inbound: isFirst,
      role_outbound_automation: isFirst,
      role_outbound_manual: isFirst,
      // Eva SEMPRE começa desligada — clínica ativa manualmente após configurar
      auto_reply_enabled: false,
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
      .eq('instance_name', instanceName)
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
 * Retorna estado atual das instances da clínica.
 *
 * Multi-numero: aceita ?instance_name=... pra retornar uma instance especifica.
 * Sem param, retorna lista completa em `instances`. Pra compat retroativa,
 * tambem inclui campos da is_default no nivel raiz.
 */
export async function GET(req: NextRequest) {
  const ctx = await getCurrentUserClinic()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const url = new URL(req.url)
  const filterInstance = url.searchParams.get('instance_name')

  const svc = createServiceClient()

  let query = svc
    .from('clinic_whatsapp')
    .select(
      'id, instance_name, phone_number, status, qr_code, qr_expires_at, connected_at, last_event_at, auto_reply_enabled, is_default, role_inbound, role_outbound_automation, role_outbound_manual, label, assigned_to, created_at',
    )
    .eq('clinic_id', ctx.clinicId)
  if (filterInstance) query = query.eq('instance_name', filterInstance)

  const { data: rows } = await query.order('created_at', { ascending: true })
  const list = rows ?? []

  if (list.length === 0) {
    return NextResponse.json({
      configured: false,
      status: 'pending' as const,
      instances: [],
    })
  }

  // Lazy sync com Evolution: pra cada instance que ainda nao está conectada,
  // verifica o estado real e atualiza o banco.
  for (const row of list) {
    if (row.status === 'connected') continue
    const state = await getConnectionState(row.instance_name)
    if (state.ok && state.data.instance?.state) {
      const mapped = mapEvolutionStateToStatus(state.data.instance.state)
      if (mapped !== row.status) {
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
          .eq('id', row.id)
        row.status = mapped
      }
    }
  }

  const instances = list.map(row => ({
    id: row.id,
    instance_name: row.instance_name,
    phone_number: row.phone_number,
    status: row.status,
    qr_code: row.status === 'qr_pending' ? row.qr_code : null,
    qr_expires_at: row.status === 'qr_pending' ? row.qr_expires_at : null,
    connected_at: row.connected_at,
    last_event_at: row.last_event_at,
    auto_reply_enabled: row.auto_reply_enabled !== false,
    is_default: row.is_default === true,
    role_inbound: row.role_inbound === true,
    role_outbound_automation: row.role_outbound_automation === true,
    role_outbound_manual: row.role_outbound_manual === true,
    label: row.label,
    assigned_to: row.assigned_to,
  }))

  // Compat: campos no nivel raiz refletem a is_default (ou a primeira)
  const main = instances.find(i => i.is_default) ?? instances[0]

  return NextResponse.json({
    configured: true,
    status: main.status,
    instance_name: main.instance_name,
    phone_number: main.phone_number,
    qr_code: main.qr_code,
    qr_expires_at: main.qr_expires_at,
    connected_at: main.connected_at,
    last_event_at: main.last_event_at,
    auto_reply_enabled: main.auto_reply_enabled,
    instances,
  })
}

/**
 * Apaga uma instance especifica (Evolution + banco).
 * Aceita ?instance_name= pra escolher; sem ele, apaga a default.
 *
 * Se a default for removida e ainda houver outros numeros, promove um deles
 * automaticamente (o mais antigo).
 */
export async function DELETE(req: NextRequest) {
  const ctx = await getCurrentUserClinic()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!canManageIntegrations(ctx.role)) {
    return NextResponse.json(
      { error: 'Apenas admin/gerente podem remover a instance' },
      { status: 403 },
    )
  }

  const url = new URL(req.url)
  const filterInstance = url.searchParams.get('instance_name')

  const svc = createServiceClient()

  let row: { id: string; instance_name: string; is_default: boolean } | null = null
  if (filterInstance) {
    const { data } = await svc
      .from('clinic_whatsapp')
      .select('id, instance_name, is_default')
      .eq('clinic_id', ctx.clinicId)
      .eq('instance_name', filterInstance)
      .maybeSingle()
    row = data
  } else {
    const { data } = await svc
      .from('clinic_whatsapp')
      .select('id, instance_name, is_default')
      .eq('clinic_id', ctx.clinicId)
      .eq('is_default', true)
      .maybeSingle()
    row = data
  }

  if (!row) return NextResponse.json({ ok: true })

  // Tenta apagar na Evolution; ignora erro pra permitir limpeza mesmo com Evolution off
  await deleteInstance(row.instance_name).catch(() => null)

  await svc.from('clinic_whatsapp').delete().eq('id', row.id)

  // Se removemos a default, promove a mais antiga remanescente
  if (row.is_default) {
    const { data: next } = await svc
      .from('clinic_whatsapp')
      .select('id')
      .eq('clinic_id', ctx.clinicId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (next?.id) {
      await svc
        .from('clinic_whatsapp')
        .update({ is_default: true })
        .eq('id', next.id)
    }
  }

  return NextResponse.json({ ok: true })
}

/**
 * Atualiza propriedades de uma instance: papeis (inbound/outbound automation/manual),
 * label, assigned_to ou marcar como default.
 *
 * Body: {
 *   instance_name: string (obrigatorio)
 *   label?: string
 *   assigned_to?: string|null
 *   role_inbound?: boolean
 *   role_outbound_automation?: boolean
 *   role_outbound_manual?: boolean
 *   is_default?: true   // marca essa como default (e desmarca a anterior)
 * }
 */
export async function PATCH(req: NextRequest) {
  const ctx = await getCurrentUserClinic()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!canManageIntegrations(ctx.role)) {
    return NextResponse.json(
      { error: 'Apenas admin/gerente podem editar' },
      { status: 403 },
    )
  }

  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const instanceName =
    typeof body.instance_name === 'string' ? body.instance_name : null
  if (!instanceName) {
    return NextResponse.json(
      { error: 'instance_name é obrigatório' },
      { status: 400 },
    )
  }

  const svc = createServiceClient()

  const { data: target } = await svc
    .from('clinic_whatsapp')
    .select('id, is_default')
    .eq('clinic_id', ctx.clinicId)
    .eq('instance_name', instanceName)
    .maybeSingle()

  if (!target) {
    return NextResponse.json(
      { error: 'Numero nao encontrado nesta clinica' },
      { status: 404 },
    )
  }

  const updates: Record<string, unknown> = {}
  if (typeof body.label === 'string' || body.label === null) {
    updates.label = body.label as string | null
  }
  if (typeof body.assigned_to === 'string' || body.assigned_to === null) {
    updates.assigned_to = body.assigned_to as string | null
  }
  if (typeof body.role_inbound === 'boolean') {
    updates.role_inbound = body.role_inbound
  }
  if (typeof body.role_outbound_automation === 'boolean') {
    updates.role_outbound_automation = body.role_outbound_automation
  }
  if (typeof body.role_outbound_manual === 'boolean') {
    updates.role_outbound_manual = body.role_outbound_manual
  }

  // Promover pra default exige desmarcar a anterior numa transacao logica
  if (body.is_default === true && !target.is_default) {
    await svc
      .from('clinic_whatsapp')
      .update({ is_default: false })
      .eq('clinic_id', ctx.clinicId)
      .eq('is_default', true)
    updates.is_default = true
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, noop: true })
  }

  const { error } = await svc
    .from('clinic_whatsapp')
    .update(updates)
    .eq('id', target.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

/**
 * Verifica se a clinica pode adicionar mais um numero pelo limite do plano.
 * Se nao tem plano associado, default = 1 (so um numero).
 */
async function checkPlanLimit(
  svc: ReturnType<typeof createServiceClient>,
  clinicId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { count: existingCount } = await svc
    .from('clinic_whatsapp')
    .select('id', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)

  const { data: clinic } = await svc
    .from('clinics')
    .select('plan_id, settings')
    .eq('id', clinicId)
    .maybeSingle()

  let maxNumbers = 1
  const settings =
    clinic?.settings && typeof clinic.settings === 'object'
      ? (clinic.settings as Record<string, unknown>)
      : null
  const clinicOverride = Number(settings?.max_whatsapp_numbers_override)
  if (Number.isFinite(clinicOverride) && clinicOverride > 0) {
    maxNumbers = Math.floor(clinicOverride)
  }
  if (clinic?.plan_id) {
    const { data: plan } = await svc
      .from('admin_plans')
      .select('max_whatsapp_numbers')
      .eq('id', clinic.plan_id)
      .maybeSingle()
    if (maxNumbers <= 1 && plan?.max_whatsapp_numbers && plan.max_whatsapp_numbers > 0) {
      maxNumbers = plan.max_whatsapp_numbers
    }
  }

  if ((existingCount ?? 0) >= maxNumbers) {
    return {
      ok: false,
      error:
        `Seu plano permite ate ${maxNumbers} numero${maxNumbers > 1 ? 's' : ''} de WhatsApp. ` +
        `Pra adicionar mais, fale com seu gestor de conta ou faça upgrade.`,
    }
  }
  return { ok: true }
}
