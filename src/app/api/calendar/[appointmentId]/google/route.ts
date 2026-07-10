import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateGoogleCalendarUrl, loadAppointmentCalendarEvent } from '@/lib/calendar-links'

export const dynamic = 'force-dynamic'

/**
 * GET /api/calendar/[appointmentId]/google
 *
 * Redireciona (302) pro link real do Google Calendar. Existe só pra dar um
 * link curto e limpo pra usar em mensagens de texto (WhatsApp) — a URL
 * direta do Google fica gigante e feia (título/local/descrição
 * URL-encoded). Na UI (botões), o link direto do Google pode ser usado sem
 * problema, já que não aparece como texto visível.
 *
 * Público (sem auth) por design, mesmo raciocínio do endpoint .ics.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { appointmentId: string } },
) {
  const { appointmentId } = params
  const svc = createServiceClient()

  const result = await loadAppointmentCalendarEvent(svc, appointmentId)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status })
  }

  return NextResponse.redirect(generateGoogleCalendarUrl(result.event), { status: 302 })
}
