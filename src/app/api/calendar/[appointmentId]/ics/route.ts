import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateIcsContent, loadAppointmentCalendarEvent } from '@/lib/calendar-links'

export const dynamic = 'force-dynamic'

/**
 * GET /api/calendar/[appointmentId]/ics
 *
 * Gera um arquivo .ics sob demanda a partir dos dados do agendamento —
 * não grava nada, não precisa de OAuth nem conta conectada. Universal:
 * funciona com Google Calendar, Apple Calendar, Outlook, etc.
 *
 * Endpoint público (sem auth) por design — pensado para ser clicado
 * diretamente a partir de um link enviado por WhatsApp. O appointmentId é
 * um UUID não-adivinhável, e o conteúdo exposto é mínimo (procedimento,
 * clínica, horário) — sem dados sensíveis do paciente.
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

  const ics = generateIcsContent(result.event)

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="agendamento.ics"',
      'Cache-Control': 'private, max-age=300',
    },
  })
}
