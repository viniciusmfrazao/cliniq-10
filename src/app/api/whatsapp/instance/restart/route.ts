import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUserClinic, canManageIntegrations } from '@/lib/auth-helpers'
import { restartInstance, getConnectionState } from '@/lib/evolution'
import { resolveClinicInstanceForApi } from '@/lib/whatsapp-route-helpers'

/**
 * POST /api/whatsapp/instance/restart
 *
 * Reinicia o socket da instância na Evolution sem desemparelhar o WhatsApp.
 * Caso de uso: quando a sessão fica "fantasma" — outbound funciona (envia
 * mensagens via /message/sendText) mas inbound parou (webhook deixou de
 * receber). O restart força a Evolution a recriar o socket com o WhatsApp.
 *
 * Multi-numero: aceita ?instance_name= ou body.instance_name; senao opera na default.
 */
export async function POST(req: NextRequest) {
  const ctx = await getCurrentUserClinic()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!canManageIntegrations(ctx.role)) {
    return NextResponse.json(
      { error: 'Apenas admin/gerente podem reiniciar a instância' },
      { status: 403 },
    )
  }

  const svc = createServiceClient()

  let bodyInstance: string | null = null
  try {
    const body = (await req.json()) as Record<string, unknown>
    if (typeof body.instance_name === 'string') bodyInstance = body.instance_name
  } catch {}

  const row = await resolveClinicInstanceForApi(svc, req, ctx.clinicId, bodyInstance)
  if (!row) {
    return NextResponse.json(
      { error: 'Nenhuma instance configurada' },
      { status: 404 },
    )
  }

  const r = await restartInstance(row.instance_name)
  if (!r.ok) {
    return NextResponse.json(
      { error: r.error, status: r.status },
      { status: 502 },
    )
  }

  await new Promise((resolve) => setTimeout(resolve, 2500))
  const state = await getConnectionState(row.instance_name)

  return NextResponse.json({
    ok: true,
    instance_name: row.instance_name,
    restart: r.data,
    connection: state.ok ? state.data : { error: state.error },
  })
}
