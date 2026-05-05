import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUserClinic, canManageIntegrations } from '@/lib/auth-helpers'
import {
  buildWebhookUrl,
  createInstance,
  deleteInstance,
  generateInstanceName,
  getQRCode,
} from '@/lib/evolution'

/**
 * POST /api/whatsapp/instance/force-reset
 *
 * Caso de uso: a instance da Evolution esta em estado corrompido (sessao
 * fantasma, pareamento sumiu do celular, mensagens nao chegam nem saem).
 *
 * Diferente do DELETE normal:
 *  1. Apaga a instance antiga na Evolution (ignora erro/404).
 *  2. Aguarda 500ms pra Evolution liberar o slot.
 *  3. Cria uma instance NOVA com nome diferente (timestamp suffix)
 *     pra garantir que nao haja resquicios do socket Baileys antigo.
 *  4. Configura webhook + busca QR.
 *  5. Atualiza clinic_whatsapp e retorna QR direto.
 *
 * Idempotente: pode ser chamado quantas vezes precisar.
 */
export async function POST() {
  const ctx = await getCurrentUserClinic()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!canManageIntegrations(ctx.role)) {
    return NextResponse.json(
      { error: 'Apenas admin/gerente da clínica podem resetar o WhatsApp' },
      { status: 403 },
    )
  }

  const svc = createServiceClient()

  // 1) Pega o estado atual
  const { data: existing } = await svc
    .from('clinic_whatsapp')
    .select('clinic_id, instance_name, webhook_token')
    .eq('clinic_id', ctx.clinicId)
    .maybeSingle()

  // 2) Apaga instance antiga na Evolution (best-effort)
  if (existing?.instance_name) {
    await deleteInstance(existing.instance_name).catch((e) => {
      console.warn('[force-reset] deleteInstance falhou:', e)
    })
    // Pequena espera pra Evolution liberar o slot
    await new Promise((r) => setTimeout(r, 500))
  }

  // 3) Gera nome NOVO com timestamp pra evitar conflito de estado
  //    Formato: cliniq-<8chars>-<base36 timestamp>
  const baseInstance = generateInstanceName(ctx.clinicId)
  const suffix = Date.now().toString(36)
  const newInstanceName = `${baseInstance}-${suffix}`
  const newToken = crypto.randomUUID().replace(/-/g, '')
  const webhookUrl = buildWebhookUrl(newInstanceName, newToken)

  // 4) Cria nova instance na Evolution
  const created = await createInstance({
    instanceName: newInstanceName,
    webhookUrl,
  })
  if (!created.ok) {
    return NextResponse.json(
      {
        error: created.error || 'Falha ao criar instância na Evolution',
        evolution_status: created.status,
      },
      { status: 502 },
    )
  }

  // 5) Atualiza clinic_whatsapp pra apontar pra nova instance
  const upsertPayload = {
    clinic_id: ctx.clinicId,
    instance_name: newInstanceName,
    webhook_token: newToken,
    status: 'qr_pending' as const,
    phone_number: null,
    qr_code: null,
    qr_expires_at: null,
    connected_at: null,
    last_event_at: null,
    health_warning: false,
    health_reason: null,
  }

  const { error: upsertError } = await svc
    .from('clinic_whatsapp')
    .upsert(upsertPayload, { onConflict: 'clinic_id' })

  if (upsertError) {
    return NextResponse.json(
      { error: `db: ${upsertError.message}` },
      { status: 500 },
    )
  }

  // 6) Busca QR (mesma janela de pareamento — ~50s pra escanear)
  const qr = await getQRCode(newInstanceName)
  if (qr.ok && qr.data?.base64) {
    await svc
      .from('clinic_whatsapp')
      .update({
        qr_code: qr.data.base64,
        qr_expires_at: new Date(Date.now() + 50_000).toISOString(),
      })
      .eq('clinic_id', ctx.clinicId)
  }

  return NextResponse.json({
    ok: true,
    instance_name: newInstanceName,
    qr_code: qr.ok && qr.data?.base64 ? qr.data.base64 : null,
    message: 'Reset feito. Escaneie o novo QR code agora.',
  })
}
