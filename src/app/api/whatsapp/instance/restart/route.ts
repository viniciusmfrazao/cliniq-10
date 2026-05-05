import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUserClinic, canManageIntegrations } from '@/lib/auth-helpers'
import { restartInstance, getConnectionState } from '@/lib/evolution'

/**
 * POST /api/whatsapp/instance/restart
 *
 * Reinicia o socket da instância na Evolution sem desemparelhar o WhatsApp.
 * Caso de uso: quando a sessão fica "fantasma" — outbound funciona (envia
 * mensagens via /message/sendText) mas inbound parou (webhook deixou de
 * receber). O restart força a Evolution a recriar o socket com o WhatsApp.
 *
 * Mantém o pairing — não precisa escanear QR. Só admin/gerente pode chamar.
 */
export async function POST() {
  const ctx = await getCurrentUserClinic()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!canManageIntegrations(ctx.role)) {
    return NextResponse.json(
      { error: 'Apenas admin/gerente podem reiniciar a instância' },
      { status: 403 },
    )
  }

  const svc = createServiceClient()

  const { data: row } = await svc
    .from('clinic_whatsapp')
    .select('instance_name')
    .eq('clinic_id', ctx.clinicId)
    .maybeSingle()

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

  // Após restart, a Evolution leva ~2-3s pra reabrir socket. Confere o estado
  // pra dar feedback claro pro user.
  await new Promise((resolve) => setTimeout(resolve, 2500))
  const state = await getConnectionState(row.instance_name)

  return NextResponse.json({
    ok: true,
    restart: r.data,
    connection: state.ok ? state.data : { error: state.error },
  })
}
