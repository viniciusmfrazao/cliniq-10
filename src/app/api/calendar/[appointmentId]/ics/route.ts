import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { buildAppointmentCalendarEvent, generateIcsContent } from '@/lib/calendar-links'

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

  if (!appointmentId || !/^[0-9a-f-]{36}$/i.test(appointmentId)) {
    return NextResponse.json({ ok: false, error: 'invalid_appointment_id' }, { status: 400 })
  }

  const svc = createServiceClient()

  const { data: appointment, error } = await svc
    .from('appointments')
    .select('id, clinic_id, professional_id, procedure_id, start_time, end_time, status')
    .eq('id', appointmentId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  if (!appointment) {
    return NextResponse.json({ ok: false, error: 'appointment_not_found' }, { status: 404 })
  }
  if (['cancelled'].includes(appointment.status)) {
    return NextResponse.json({ ok: false, error: 'appointment_cancelled' }, { status: 410 })
  }
  if (!appointment.end_time) {
    return NextResponse.json({ ok: false, error: 'missing_end_time' }, { status: 422 })
  }

  const [{ data: clinic }, { data: prof }, { data: procedure }] = await Promise.all([
    svc.from('clinics').select('name').eq('id', appointment.clinic_id).maybeSingle(),
    appointment.professional_id
      ? svc.from('users').select('name').eq('id', appointment.professional_id).maybeSingle()
      : Promise.resolve({ data: null }),
    appointment.procedure_id
      ? svc.from('procedures').select('name').eq('id', appointment.procedure_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const event = buildAppointmentCalendarEvent({
    appointmentId: appointment.id,
    clinicName: clinic?.name || 'Clínica',
    professionalName: prof?.name ?? null,
    procedureName: procedure?.name ?? null,
    startTimeISO: appointment.start_time,
    endTimeISO: appointment.end_time,
  })

  const ics = generateIcsContent(event)

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="agendamento.ics"',
      'Cache-Control': 'private, max-age=300',
    },
  })
}
