import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { notifyAppointmentReminder } from '@/lib/n8n'

// Cron job para enviar lembretes (executar a cada hora)
// Configure no Vercel: Settings > Cron Jobs
// Ou use o n8n para chamar este endpoint periodicamente

export async function GET(request: Request) {
  // Verificar token de autorização (para segurança)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now = new Date()
  const results = {
    reminders_24h: 0,
    reminders_2h: 0,
    birthdays: 0,
    errors: [] as string[]
  }

  try {
    // 1. LEMBRETES DE 24 HORAS
    const tomorrow = new Date(now)
    tomorrow.setHours(now.getHours() + 24)
    const tomorrowStart = new Date(tomorrow)
    tomorrowStart.setMinutes(0, 0, 0)
    const tomorrowEnd = new Date(tomorrow)
    tomorrowEnd.setMinutes(59, 59, 999)

    const { data: appointments24h } = await supabase
      .from('appointments')
      .select(`
        id, start_time, status,
        patients(name, phone),
        users(name),
        procedures(name),
        clinics(name)
      `)
      .gte('start_time', tomorrowStart.toISOString())
      .lte('start_time', tomorrowEnd.toISOString())
      .in('status', ['scheduled', 'confirmed'])

    for (const apt of appointments24h || []) {
      const patient = Array.isArray(apt.patients) ? apt.patients[0] : apt.patients
      const user = Array.isArray(apt.users) ? apt.users[0] : apt.users
      const procedure = Array.isArray(apt.procedures) ? apt.procedures[0] : apt.procedures
      
      if (patient?.phone) {
        await notifyAppointmentReminder({
          id: apt.id,
          patient_name: patient.name,
          patient_phone: patient.phone,
          professional_name: user?.name || 'Profissional',
          procedure_name: procedure?.name || 'Consulta',
          start_time: apt.start_time,
          hours_until: 24
        })
        results.reminders_24h++
      }
    }

    // 2. LEMBRETES DE 2 HORAS
    const in2hours = new Date(now)
    in2hours.setHours(now.getHours() + 2)
    const in2hoursStart = new Date(in2hours)
    in2hoursStart.setMinutes(0, 0, 0)
    const in2hoursEnd = new Date(in2hours)
    in2hoursEnd.setMinutes(59, 59, 999)

    const { data: appointments2h } = await supabase
      .from('appointments')
      .select(`
        id, start_time, status,
        patients(name, phone),
        users(name),
        procedures(name)
      `)
      .gte('start_time', in2hoursStart.toISOString())
      .lte('start_time', in2hoursEnd.toISOString())
      .in('status', ['scheduled', 'confirmed'])

    for (const apt of appointments2h || []) {
      const patient = Array.isArray(apt.patients) ? apt.patients[0] : apt.patients
      const user = Array.isArray(apt.users) ? apt.users[0] : apt.users
      const procedure = Array.isArray(apt.procedures) ? apt.procedures[0] : apt.procedures
      
      if (patient?.phone) {
        await notifyAppointmentReminder({
          id: apt.id,
          patient_name: patient.name,
          patient_phone: patient.phone,
          professional_name: user?.name || 'Profissional',
          procedure_name: procedure?.name || 'Consulta',
          start_time: apt.start_time,
          hours_until: 2
        })
        results.reminders_2h++
      }
    }

    // 3. ANIVERSARIANTES — movido para /api/cron/birthdays
    // (multi-tenant, com dedupe, opt-in e horário configurável por clínica)

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    results.errors.push(errorMessage)
  }

  return NextResponse.json({
    success: true,
    timestamp: now.toISOString(),
    results
  })
}
