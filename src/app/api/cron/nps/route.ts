import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendWhatsappMessage } from '@/lib/whatsapp'

/**
 * GET /api/cron/nps
 *
 * Cron de NPS pós-atendimento — roda 1x por dia às 11h BRT (14h UTC).
 *
 * A cada dia (manhã), pra cada clínica:
 *  1) Confere toggle nps_pos_atendimento=true e template_nps preenchido.
 *  2) Confere clinic_whatsapp.status = 'connected'.
 *  3) Pega appointments do dia anterior (00h-23h59 BRT) com:
 *       status = 'completed'
 *       nps_sent_at IS NULL
 *  4) Pra cada appointment:
 *       - Renderiza o template
 *       - Insere nps_responses (status='skipped', score=null) pra reservar a vaga
 *       - Marca appointments.nps_sent_at = now() (idempotência)
 *       - Envia via Evolution
 *       - Atualiza nps_responses.status='sent' (ou 'error')
 *
 * Resposta 1-5 é capturada no webhook receiver da Evolution
 * (verifica nps_responses pendentes do paciente nas últimas 48h).
 *
 * Limite por execução pra não floodar:
 *   default 100 por clínica, configurável via ?limit=N.
 *
 * Auth: Header Authorization: Bearer ${CRON_SECRET}.
 */

const TZ_BR = 'America/Sao_Paulo'
const DEFAULT_LIMIT_PER_CLINIC = 100

type AutomationRow = {
  clinic_id: string
  nps_pos_atendimento: boolean | null
  template_nps: string | null
}

type WaRow = { clinic_id: string; status: string }
type ClinicRow = { id: string; name: string }
type PatientRow = {
  id: string
  name: string
  phone: string | null
}
type UserRow = { id: string; name: string }

type PendingRow = {
  appointment_id: string
  clinic_id: string
  patient_id: string
  professional_id: string | null
  procedure_id: string | null
  start_time: string
  procedure_name: string | null
}

/** Range de "ontem" no fuso BRT em ISO UTC. Brasil sem DST: UTC-3 fixo. */
function brYesterdayRange(): { startISO: string; endISO: string; dateLabel: string } {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_BR,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)!.value
  const todayY = parseInt(get('year'), 10)
  const todayM = parseInt(get('month'), 10)
  const todayD = parseInt(get('day'), 10)

  // ontem (data BR)
  const yesterday = new Date(Date.UTC(todayY, todayM - 1, todayD - 1))
  const yy = yesterday.getUTCFullYear()
  const ym = String(yesterday.getUTCMonth() + 1).padStart(2, '0')
  const yd = String(yesterday.getUTCDate()).padStart(2, '0')

  // 00:00 BRT = 03:00 UTC
  const startISO = `${yy}-${ym}-${yd}T03:00:00.000Z`
  // 00:00 BRT do dia seguinte (= hoje BRT 00h = 03h UTC)
  const today = new Date(Date.UTC(todayY, todayM - 1, todayD))
  const ty = today.getUTCFullYear()
  const tm = String(today.getUTCMonth() + 1).padStart(2, '0')
  const td = String(today.getUTCDate()).padStart(2, '0')
  const endISO = `${ty}-${tm}-${td}T03:00:00.000Z`

  const dateLabel = `${yd}/${ym}/${yy}`
  return { startISO, endISO, dateLabel }
}

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
    // Sem secret configurado, falha-fechada — evita endpoint publico
    // capaz de disparar mensagens de WhatsApp em massa.
    console.error('[cron/nps] CRON_SECRET ausente em runtime')
    return NextResponse.json({ ok: false, error: 'cron_not_configured' }, { status: 503 })
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const dryRun = url.searchParams.get('dry') === '1'
  const limitPerClinic = Math.max(
    1,
    parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT_PER_CLINIC), 10),
  )

  const svc = createServiceClient()
  const { startISO, endISO, dateLabel } = brYesterdayRange()

  // 1) Carrega automations das clínicas com NPS ligado
  const { data: automations, error: errAuto } = await svc
    .from('clinic_automations')
    .select('clinic_id, nps_pos_atendimento, template_nps')
    .eq('nps_pos_atendimento', true)

  if (errAuto) {
    return NextResponse.json(
      { ok: false, stage: 'load_automations', error: errAuto.message },
      { status: 500 },
    )
  }

  const enabledClinics =
    (automations as AutomationRow[] | null)?.filter(
      (a) => a.template_nps && a.template_nps.trim().length > 0,
    ) ?? []

  if (enabledClinics.length === 0) {
    return NextResponse.json({
      ok: true,
      yesterday: dateLabel,
      processed: 0,
      reason: 'no_clinics_with_nps_enabled',
    })
  }

  const clinicIds = enabledClinics.map((c) => c.clinic_id)

  // 2) Status WhatsApp + nomes (multi-numero: prioriza connected + outbound_automation)
  const [{ data: waList }, { data: clinicList }] = await Promise.all([
    svc
      .from('clinic_whatsapp')
      .select('clinic_id, status, is_default, role_outbound_automation')
      .in('clinic_id', clinicIds),
    svc.from('clinics').select('id, name').in('id', clinicIds),
  ])
  const waByClinic = new Map<string, WaRow>()
  type WaScored = { clinic_id: string; status: string; is_default?: boolean | null; role_outbound_automation?: boolean | null }
  const score = (w: WaScored) =>
    (w.status === 'connected' ? 10 : 0) +
    (w.role_outbound_automation === true ? 4 : 0) +
    (w.is_default ? 1 : 0)
  for (const w of (waList as WaScored[] | null) ?? []) {
    const cur = waByClinic.get(w.clinic_id) as WaScored | undefined
    if (!cur || score(w) > score(cur)) waByClinic.set(w.clinic_id, w as WaRow)
  }
  const clinicNameById = new Map<string, string>()
  for (const c of (clinicList as ClinicRow[] | null) ?? [])
    clinicNameById.set(c.id, c.name)

  // 3) Pega appointments concluídos ontem sem NPS, das clínicas habilitadas
  const { data: pendingRaw, error: errPending } = await svc
    .from('appointments')
    .select(
      'id, clinic_id, patient_id, professional_id, procedure_id, start_time, status, nps_sent_at',
    )
    .in('clinic_id', clinicIds)
    .eq('status', 'completed')
    .is('nps_sent_at', null)
    .gte('start_time', startISO)
    .lt('start_time', endISO)
    .not('patient_id', 'is', null)

  if (errPending) {
    return NextResponse.json(
      { ok: false, stage: 'load_pending', error: errPending.message },
      { status: 500 },
    )
  }

  const apps = (pendingRaw as Array<{
    id: string
    clinic_id: string
    patient_id: string
    professional_id: string | null
    procedure_id: string | null
    start_time: string
  }> | null) ?? []

  if (apps.length === 0) {
    return NextResponse.json({
      ok: true,
      yesterday: dateLabel,
      clinicsChecked: enabledClinics.length,
      processed: 0,
      reason: 'no_completed_appointments_yesterday',
    })
  }

  // 4) Lookups: patients, users, procedures
  const patientIds = Array.from(new Set(apps.map((a) => a.patient_id)))
  const profIds = Array.from(
    new Set(apps.map((a) => a.professional_id).filter(Boolean) as string[]),
  )
  const procIds = Array.from(
    new Set(apps.map((a) => a.procedure_id).filter(Boolean) as string[]),
  )

  const [{ data: patientList }, { data: profList }, { data: procList }] = await Promise.all([
    svc.from('patients').select('id, name, phone').in('id', patientIds),
    profIds.length > 0
      ? svc.from('users').select('id, name').in('id', profIds)
      : Promise.resolve({ data: [] as UserRow[] }),
    procIds.length > 0
      ? svc.from('procedures').select('id, name').in('id', procIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])

  const patientById = new Map<string, PatientRow>()
  for (const p of (patientList as PatientRow[] | null) ?? []) patientById.set(p.id, p)
  const profById = new Map<string, UserRow>()
  for (const u of (profList as UserRow[] | null) ?? []) profById.set(u.id, u)
  const procById = new Map<string, { id: string; name: string }>()
  for (const pr of (procList as { id: string; name: string }[] | null) ?? [])
    procById.set(pr.id, pr)

  // 5) Agrupa por clínica pra respeitar limite
  const appsByClinic = new Map<string, PendingRow[]>()
  for (const a of apps) {
    const list = appsByClinic.get(a.clinic_id) ?? []
    list.push({
      appointment_id: a.id,
      clinic_id: a.clinic_id,
      patient_id: a.patient_id,
      professional_id: a.professional_id,
      procedure_id: a.procedure_id,
      start_time: a.start_time,
      procedure_name: a.procedure_id ? procById.get(a.procedure_id)?.name ?? null : null,
    })
    appsByClinic.set(a.clinic_id, list)
  }

  const summary = {
    yesterday: dateLabel,
    dryRun,
    limitPerClinic,
    clinicsChecked: enabledClinics.length,
    appointmentsScanned: apps.length,
    sent: 0,
    skippedClinicNotConnected: 0,
    skippedNoPhone: 0,
    skippedNoTemplate: 0,
    errors: [] as Array<{ clinic_id: string; appointment_id?: string; error: string }>,
  }

  const templateByClinic = new Map<string, string>()
  for (const c of enabledClinics) {
    if (c.template_nps) templateByClinic.set(c.clinic_id, c.template_nps)
  }

  // 6) Processa cada clínica
  for (const [clinicId, list] of appsByClinic) {
    const wa = waByClinic.get(clinicId)
    if (!wa || wa.status !== 'connected') {
      summary.skippedClinicNotConnected += list.length
      continue
    }

    const template = templateByClinic.get(clinicId)
    if (!template) {
      summary.skippedNoTemplate += list.length
      continue
    }

    const clinicName = clinicNameById.get(clinicId) || 'Clínica'

    let sentForThisClinic = 0
    for (const app of list) {
      if (sentForThisClinic >= limitPerClinic) break

      const patient = patientById.get(app.patient_id)
      if (!patient || !patient.phone || !patient.phone.trim()) {
        summary.skippedNoPhone++
        continue
      }

      const prof = app.professional_id ? profById.get(app.professional_id) : null
      const dt = formatBrazilDateTime(app.start_time)

      const text = renderTemplate(template, {
        nome: patient.name || '',
        primeiro_nome: firstName(patient.name),
        clinica: clinicName,
        profissional: prof?.name || 'sua profissional',
        procedimento: app.procedure_name || 'seu atendimento',
        data: dt.date,
        hora: dt.time,
        dia_semana: dt.weekday,
      })

      if (dryRun) {
        summary.sent++
        sentForThisClinic++
        continue
      }

      // Insere nps_responses ANTES (lock + idempotência por appointment_id UNIQUE)
      const { data: inserted, error: errInsert } = await svc
        .from('nps_responses')
        .insert({
          clinic_id: clinicId,
          patient_id: patient.id,
          appointment_id: app.appointment_id,
          professional_id: app.professional_id,
          procedure_name: app.procedure_name,
          status: 'skipped',
          message: text,
        })
        .select('id')
        .maybeSingle()

      if (errInsert) {
        // Pode ser conflict (já enviado em execução anterior) — segue
        const isDup = /duplicate|unique/i.test(errInsert.message)
        if (!isDup) {
          summary.errors.push({
            clinic_id: clinicId,
            appointment_id: app.appointment_id,
            error: `lock_insert: ${errInsert.message}`,
          })
        }
        continue
      }

      // Marca o appointment como NPS-enviado (segundo guarda contra reenvio)
      await svc
        .from('appointments')
        .update({ nps_sent_at: new Date().toISOString() })
        .eq('id', app.appointment_id)
        .is('nps_sent_at', null)

      const result = await sendWhatsappMessage({
        clinicId,
        phone: patient.phone,
        message: text,
        purpose: 'automation',
        instanceName: (waByClinic.get(clinicId) as any)?.instance_name,
      })

      if (result.ok) {
        await svc
          .from('nps_responses')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', inserted!.id)
        summary.sent++
        sentForThisClinic++
      } else {
        await svc
          .from('nps_responses')
          .update({ status: 'error', error: result.error })
          .eq('id', inserted!.id)
        // Reverte nps_sent_at pra tentar de novo amanhã
        await svc
          .from('appointments')
          .update({ nps_sent_at: null })
          .eq('id', app.appointment_id)
        summary.errors.push({
          clinic_id: clinicId,
          appointment_id: app.appointment_id,
          error: result.error,
        })
      }
    }
  }

  return NextResponse.json({ ok: true, ...summary })
}
