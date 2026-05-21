import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendWhatsappMessage } from '@/lib/whatsapp'

/**
 * GET /api/cron/nps-imediato
 *
 * Cron que processa a fila de NPS imediato — atendimentos cujo
 * appointments.nps_scheduled_at <= now() e nps_sent_at IS NULL.
 *
 * Roda de 5 em 5 minutos (configurado no vercel.json).
 *
 * O agendamento e feito por trigger SQL quando o atendimento muda
 * pra 'completed' e a flag clinic_automations.nps_imediato esta ligada.
 *
 * Auth: Header Authorization: Bearer ${CRON_SECRET}.
 */

const TZ_BR = 'America/Sao_Paulo'
const DEFAULT_LIMIT = 200

type AutomationRow = {
  clinic_id: string
  nps_pos_atendimento: boolean | null
  template_nps: string | null
}

type WaRow = { clinic_id: string; status: string }
type ClinicRow = { id: string; name: string }
type PatientRow = { id: string; name: string; phone: string | null }
type UserRow = { id: string; name: string }

function formatBrazilDateTime(iso: string): { date: string; time: string; weekday: string } {
  const d = new Date(iso)
  const datePart = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ_BR,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
  const timePart = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ_BR,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
  const weekday = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ_BR,
    weekday: 'long',
  }).format(d)
  return { date: datePart, time: timePart, weekday }
}

function firstName(full: string | null | undefined): string {
  if (!full) return ''
  return full.trim().split(/\s+/)[0]
}

function renderTemplate(
  template: string,
  vars: {
    nome: string
    primeiro_nome: string
    clinica: string
    profissional: string
    procedimento: string
    data: string
    hora: string
    dia_semana: string
  },
): string {
  return template
    .replace(/\{\{\s*nome\s*\}\}/g, vars.nome)
    .replace(/\{\{\s*primeiro_nome\s*\}\}/g, vars.primeiro_nome)
    .replace(/\{\{\s*clinica\s*\}\}/g, vars.clinica)
    .replace(/\{\{\s*profissional\s*\}\}/g, vars.profissional)
    .replace(/\{\{\s*procedimento\s*\}\}/g, vars.procedimento)
    .replace(/\{\{\s*data\s*\}\}/g, vars.data)
    .replace(/\{\{\s*hora\s*\}\}/g, vars.hora)
    .replace(/\{\{\s*dia_semana\s*\}\}/g, vars.dia_semana)
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron/nps-imediato] CRON_SECRET ausente em runtime')
    return NextResponse.json({ ok: false, error: 'cron_not_configured' }, { status: 503 })
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const dryRun = url.searchParams.get('dry') === '1'
  const limit = Math.max(1, parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT), 10))

  const svc = createServiceClient()
  const nowISO = new Date().toISOString()

  // Pega appointments com NPS agendado pra agora ou antes
  const { data: queueRaw, error: errQueue } = await svc
    .from('appointments')
    .select(
      'id, clinic_id, patient_id, professional_id, procedure_id, start_time, status',
    )
    .eq('status', 'completed')
    .is('nps_sent_at', null)
    .not('nps_scheduled_at', 'is', null)
    .lte('nps_scheduled_at', nowISO)
    .not('patient_id', 'is', null)
    .order('nps_scheduled_at', { ascending: true })
    .limit(limit)

  if (errQueue) {
    return NextResponse.json(
      { ok: false, stage: 'load_queue', error: errQueue.message },
      { status: 500 },
    )
  }

  const queue = (queueRaw as Array<{
    id: string
    clinic_id: string
    patient_id: string
    professional_id: string | null
    procedure_id: string | null
    start_time: string
  }> | null) ?? []

  if (queue.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, reason: 'queue_empty' })
  }

  const clinicIds = Array.from(new Set(queue.map((a) => a.clinic_id)))
  const patientIds = Array.from(new Set(queue.map((a) => a.patient_id)))
  const profIds = Array.from(
    new Set(queue.map((a) => a.professional_id).filter(Boolean) as string[]),
  )
  const procIds = Array.from(
    new Set(queue.map((a) => a.procedure_id).filter(Boolean) as string[]),
  )

  const [
    { data: automations },
    { data: waList },
    { data: clinicList },
    { data: patientList },
    { data: profList },
    { data: procList },
  ] = await Promise.all([
    svc
      .from('clinic_automations')
      .select('clinic_id, nps_pos_atendimento, template_nps')
      .in('clinic_id', clinicIds),
    svc
      .from('clinic_whatsapp')
      .select('clinic_id, instance_name, status, is_default, role_outbound_automation')
      .in('clinic_id', clinicIds),
    svc.from('clinics').select('id, name').in('id', clinicIds),
    svc.from('patients').select('id, name, phone').in('id', patientIds),
    profIds.length > 0
      ? svc.from('users').select('id, name').in('id', profIds)
      : Promise.resolve({ data: [] as UserRow[] }),
    procIds.length > 0
      ? svc.from('procedures').select('id, name').in('id', procIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])

  const automationByClinic = new Map<string, AutomationRow>()
  for (const a of (automations as AutomationRow[] | null) ?? [])
    automationByClinic.set(a.clinic_id, a)

  // Multi-numero: prioriza connected + role_outbound_automation
  const waByClinic = new Map<string, WaRow>()
  type WaScored = WaRow & { is_default?: boolean | null; role_outbound_automation?: boolean | null }
  const waScore = (w: WaScored) =>
    (w.status === 'connected' ? 10 : 0) +
    (w.role_outbound_automation === true ? 4 : 0) +
    (w.is_default ? 1 : 0)
  for (const w of (waList as WaScored[] | null) ?? []) {
    const cur = waByClinic.get(w.clinic_id) as WaScored | undefined
    if (!cur || waScore(w) > waScore(cur)) waByClinic.set(w.clinic_id, w)
  }

  const clinicNameById = new Map<string, string>()
  for (const c of (clinicList as ClinicRow[] | null) ?? []) clinicNameById.set(c.id, c.name)

  const patientById = new Map<string, PatientRow>()
  for (const p of (patientList as PatientRow[] | null) ?? []) patientById.set(p.id, p)

  const profById = new Map<string, UserRow>()
  for (const u of (profList as UserRow[] | null) ?? []) profById.set(u.id, u)

  const procById = new Map<string, { id: string; name: string }>()
  for (const pr of (procList as { id: string; name: string }[] | null) ?? [])
    procById.set(pr.id, pr)

  const summary = {
    dryRun,
    queueSize: queue.length,
    sent: 0,
    skippedClinicNotConnected: 0,
    skippedNoPhone: 0,
    skippedNoTemplate: 0,
    skippedAutomationOff: 0,
    errors: [] as Array<{ clinic_id: string; appointment_id?: string; error: string }>,
  }

  for (const app of queue) {
    const auto = automationByClinic.get(app.clinic_id)
    if (!auto || !auto.nps_pos_atendimento || !auto.template_nps?.trim()) {
      // A clinica desligou o NPS no meio do caminho — limpa o agendamento
      summary.skippedAutomationOff++
      if (!dryRun) {
        await svc
          .from('appointments')
          .update({ nps_scheduled_at: null })
          .eq('id', app.id)
      }
      continue
    }

    const wa = waByClinic.get(app.clinic_id)
    if (!wa || wa.status !== 'connected') {
      summary.skippedClinicNotConnected++
      // Nao limpa scheduled_at — tenta de novo no proximo run
      continue
    }

    const patient = patientById.get(app.patient_id)
    if (!patient || !patient.phone || !patient.phone.trim()) {
      summary.skippedNoPhone++
      // Limpa scheduled_at pra nao ficar preso na fila
      if (!dryRun) {
        await svc
          .from('appointments')
          .update({ nps_scheduled_at: null })
          .eq('id', app.id)
      }
      continue
    }

    const prof = app.professional_id ? profById.get(app.professional_id) : null
    const procedureName = app.procedure_id ? procById.get(app.procedure_id)?.name ?? null : null
    const clinicName = clinicNameById.get(app.clinic_id) || 'Clínica'
    const dt = formatBrazilDateTime(app.start_time)

    const text = renderTemplate(auto.template_nps!, {
      nome: patient.name || '',
      primeiro_nome: firstName(patient.name),
      clinica: clinicName,
      profissional: prof?.name || 'sua profissional',
      procedimento: procedureName || 'seu atendimento',
      data: dt.date,
      hora: dt.time,
      dia_semana: dt.weekday,
    })

    if (dryRun) {
      summary.sent++
      continue
    }

    // Lock + idempotencia
    const { data: inserted, error: errInsert } = await svc
      .from('nps_responses')
      .insert({
        clinic_id: app.clinic_id,
        patient_id: patient.id,
        appointment_id: app.id,
        professional_id: app.professional_id,
        procedure_name: procedureName,
        status: 'skipped',
        message: text,
      })
      .select('id')
      .maybeSingle()

    if (errInsert) {
      const isDup = /duplicate|unique/i.test(errInsert.message)
      if (!isDup) {
        summary.errors.push({
          clinic_id: app.clinic_id,
          appointment_id: app.id,
          error: `lock_insert: ${errInsert.message}`,
        })
        continue
      }
      // Se ja existia, segue marcando como enviado
    }

    // Marca scheduled_at como nulo + nps_sent_at = now() (idempotencia)
    await svc
      .from('appointments')
      .update({
        nps_sent_at: new Date().toISOString(),
        nps_scheduled_at: null,
      })
      .eq('id', app.id)
      .is('nps_sent_at', null)

    const result = await sendWhatsappMessage({
      clinicId: app.clinic_id,
      phone: patient.phone,
      message: text,
      purpose: 'automation',
      instanceName: (waByClinic.get(app.clinic_id) as any)?.instance_name,
    })

    if (result.ok) {
      if (inserted?.id) {
        await svc
          .from('nps_responses')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', inserted.id)
      }
      summary.sent++
    } else {
      if (inserted?.id) {
        await svc
          .from('nps_responses')
          .update({ status: 'error', error: result.error })
          .eq('id', inserted.id)
      }
      // NÃO reverte nps_sent_at — evita reenvio duplicado em caso de falha de envio
      summary.errors.push({
        clinic_id: app.clinic_id,
        appointment_id: app.id,
        error: result.error,
      })
    }
  }

  return NextResponse.json({ ok: true, ...summary })
}
