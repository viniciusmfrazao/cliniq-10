import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendWhatsappMessage, sendWhatsappAudio } from '@/lib/whatsapp'
import { buildAppointmentCalendarEvent, generateCalendarLinks, getPublicBaseUrl } from '@/lib/calendar-links'

export const maxDuration = 60

/**
 * GET /api/cron/appointment-reminder-custom
 *
 * Lembrete personalizado — antecedência configurável por clínica
 * (clinic_automations.lembrete_custom_dias_antes, ex.: 3, 5, 7 dias).
 * Roda a cada 5min. Mensagem só informativa (sem botões de
 * confirmar/cancelar — esse fluxo já roda na véspera, D-1).
 *
 * Cada clínica pode ter um número de dias diferente, então agrupamos
 * as clínicas habilitadas por esse valor e buscamos a janela de dia
 * civil (BRT) correspondente pra cada grupo.
 */

const TZ_BR = 'America/Sao_Paulo'

function getBRTDayBoundsISO(offsetDays: number): { startISO: string; endISO: string } {
  const nowBR = new Date(new Date().toLocaleString('en-US', { timeZone: TZ_BR }))
  const y = nowBR.getFullYear()
  const m = nowBR.getMonth()
  const d = nowBR.getDate() + offsetDays
  const startUTC = new Date(Date.UTC(y, m, d, 3, 0, 0)) // 00:00 BRT = 03:00 UTC
  const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000)
  return { startISO: startUTC.toISOString(), endISO: endUTC.toISOString() }
}

function formatBrazilDateTime(iso: string): { date: string; time: string; weekday: string } {
  const d = new Date(iso)
  return {
    date: new Intl.DateTimeFormat('pt-BR', { timeZone: TZ_BR, day: '2-digit', month: '2-digit', year: 'numeric' }).format(d),
    time: new Intl.DateTimeFormat('pt-BR', { timeZone: TZ_BR, hour: '2-digit', minute: '2-digit', hour12: false }).format(d),
    weekday: new Intl.DateTimeFormat('pt-BR', { timeZone: TZ_BR, weekday: 'long' }).format(d),
  }
}

function firstName(full: string | null | undefined): string {
  return (full || '').trim().split(/\s+/)[0]
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template
    .replace(/\{\{\s*nome\s*\}\}/g, vars.nome)
    .replace(/\{\{\s*primeiro_nome\s*\}\}/g, vars.primeiro_nome)
    .replace(/\{\{\s*clinica\s*\}\}/g, vars.clinica)
    .replace(/\{\{\s*profissional\s*\}\}/g, vars.profissional)
    .replace(/\{\{\s*procedimento\s*\}\}/g, vars.procedimento)
    .replace(/\{\{\s*data\s*\}\}/g, vars.data)
    .replace(/\{\{\s*hora\s*\}\}/g, vars.hora)
    .replace(/\{\{\s*dia_semana\s*\}\}/g, vars.dia_semana)
    .replace(/\{\{\s*endereco\s*\}\}/g, vars.endereco ?? '')
    .replace(/\{\{\s*link_agenda\s*\}\}/g, vars.link_agenda ?? '')
}

const DEFAULT_TEMPLATE_CUSTOM = `Oi {{primeiro_nome}}! Passando pra lembrar do seu horário na *{{clinica}}* 🗓

*{{dia_semana}}, {{data}}* às *{{hora}}* com {{profissional}}

📅 Adicionar na sua agenda: {{link_agenda}}

Te esperamos! 💕`

type AutomationRow = {
  clinic_id: string
  lembrete_custom: boolean | null
  lembrete_custom_dias_antes?: number | null
  lembrete_custom_hora?: number | null
  template_lembrete_custom: string | null
  modo_lembrete_custom?: 'texto' | 'audio' | 'ambos' | null
  audio_lembrete_custom?: string | null
}

type AppointmentRow = {
  id: string
  clinic_id: string
  start_time: string
  end_time: string | null
  status: string
  reminder_custom_sent_at: string | null
  patient_id: string | null
  professional_id: string | null
  procedure_id: string | null
}

type PatientRow = { id: string; name: string; phone: string | null }
type UserRow = { id: string; name: string }
type ProcedureRow = { id: string; name: string }
type ClinicRow = { id: string; name: string; settings?: Record<string, unknown> | null }
type WaRow = { clinic_id: string; status: string; instance_name?: string | null; is_default?: boolean | null; role_outbound_automation?: boolean | null }

const ROUTE_BUDGET_MS = 40_000
const MAX_SENDS_PER_RUN = 15

export async function GET(req: NextRequest) {
  const routeStart = Date.now()
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ ok: false, error: 'cron_not_configured' }, { status: 503 })
  if (auth !== `Bearer ${secret}`) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const dryRun = url.searchParams.get('dry') === '1'

  const svc = createServiceClient()
  const nowBR = new Date(new Date().toLocaleString('en-US', { timeZone: TZ_BR }))
  const currentHour = nowBR.getHours()

  // 1) Clínicas com o lembrete personalizado ligado e template/áudio preenchido,
  //    cujo horário configurado já chegou.
  const { data: automations, error: errAuto } = await svc
    .from('clinic_automations')
    .select('clinic_id, lembrete_custom, lembrete_custom_dias_antes, lembrete_custom_hora, template_lembrete_custom, modo_lembrete_custom, audio_lembrete_custom')
    .eq('lembrete_custom', true)

  if (errAuto) {
    return NextResponse.json({ ok: false, stage: 'load_automations', error: errAuto.message }, { status: 500 })
  }

  const enabledClinics =
    (automations as AutomationRow[] | null)?.filter((a) => {
      const modo = a.modo_lembrete_custom ?? 'texto'
      const hasTemplate = !!a.template_lembrete_custom && a.template_lembrete_custom.trim().length > 0
      const hasAudio = !!a.audio_lembrete_custom
      if (modo === 'audio' && !hasAudio) return false
      if (modo !== 'audio' && !hasTemplate) return false
      const targetHour = a.lembrete_custom_hora ?? 20
      return currentHour >= targetHour
    }) ?? []

  if (enabledClinics.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, reason: 'no_clinics_with_reminder_enabled' })
  }

  const clinicIds = enabledClinics.map((c) => c.clinic_id)

  // 2) WhatsApp conectado + nomes/endereços das clínicas
  const [{ data: waList }, { data: clinicList }] = await Promise.all([
    svc.from('clinic_whatsapp').select('clinic_id, instance_name, status, is_default, role_outbound_automation').in('clinic_id', clinicIds),
    svc.from('clinics').select('id, name, settings').in('id', clinicIds),
  ])

  const waByClinic = new Map<string, WaRow>()
  const score = (w: WaRow) => (w.status === 'connected' ? 10 : 0) + (w.role_outbound_automation ? 4 : 0) + (w.is_default ? 1 : 0)
  for (const w of (waList as WaRow[] | null) ?? []) {
    const cur = waByClinic.get(w.clinic_id)
    if (!cur || score(w) > score(cur)) waByClinic.set(w.clinic_id, w)
  }

  const clinicNameById = new Map<string, string>()
  const clinicAddressById = new Map<string, string>()
  for (const c of (clinicList as ClinicRow[] | null) ?? []) {
    clinicNameById.set(c.id, c.name)
    clinicAddressById.set(c.id, String((c.settings as any)?.address ?? ''))
  }

  // 3) Agrupa clínicas pelo número de dias configurado e busca a janela
  //    de dia civil (BRT) correspondente pra cada grupo.
  const clinicIdsByOffset = new Map<number, string[]>()
  for (const c of enabledClinics) {
    const offset = Math.min(60, Math.max(1, c.lembrete_custom_dias_antes ?? 3))
    const list = clinicIdsByOffset.get(offset) ?? []
    list.push(c.clinic_id)
    clinicIdsByOffset.set(offset, list)
  }

  const windowsUsed: number[] = Array.from(clinicIdsByOffset.keys())
  let apps: AppointmentRow[] = []
  for (const [offset, ids] of clinicIdsByOffset) {
    const { startISO, endISO } = getBRTDayBoundsISO(offset)
    const { data, error: errApps } = await svc
      .from('appointments')
      .select('id, clinic_id, start_time, end_time, status, reminder_custom_sent_at, patient_id, professional_id, procedure_id')
      .in('clinic_id', ids)
      .gte('start_time', startISO)
      .lt('start_time', endISO)
      .in('status', ['scheduled', 'confirmed', 'pending_confirmation'])
      .is('reminder_custom_sent_at', null)

    if (errApps) {
      return NextResponse.json({ ok: false, stage: 'load_appointments', offset, error: errApps.message }, { status: 500 })
    }
    apps = apps.concat((data as AppointmentRow[] | null) ?? [])
  }

  if (apps.length === 0) {
    return NextResponse.json({ ok: true, windowsUsed, clinicsChecked: enabledClinics.length, processed: 0, reason: 'no_pending_appointments' })
  }

  // 4) Dados auxiliares em batch
  const patientIds = Array.from(new Set(apps.map((a) => a.patient_id).filter(Boolean) as string[]))
  const professionalIds = Array.from(new Set(apps.map((a) => a.professional_id).filter(Boolean) as string[]))
  const procedureIds = Array.from(new Set(apps.map((a) => a.procedure_id).filter(Boolean) as string[]))

  const [{ data: patientList }, { data: profList }, { data: procList }] = await Promise.all([
    patientIds.length ? svc.from('patients').select('id, name, phone').in('id', patientIds) : Promise.resolve({ data: [] as PatientRow[] }),
    professionalIds.length ? svc.from('users').select('id, name').in('id', professionalIds) : Promise.resolve({ data: [] as UserRow[] }),
    procedureIds.length ? svc.from('procedures').select('id, name').in('id', procedureIds) : Promise.resolve({ data: [] as ProcedureRow[] }),
  ])

  const patientById = new Map<string, PatientRow>()
  for (const p of (patientList as PatientRow[] | null) ?? []) patientById.set(p.id, p)
  const profById = new Map<string, UserRow>()
  for (const u of (profList as UserRow[] | null) ?? []) profById.set(u.id, u)
  const procById = new Map<string, ProcedureRow>()
  for (const pr of (procList as ProcedureRow[] | null) ?? []) procById.set(pr.id, pr)

  const templateByClinic = new Map<string, string>()
  const modeByClinic = new Map<string, 'texto' | 'audio' | 'ambos'>()
  const audioByClinic = new Map<string, string>()
  for (const c of enabledClinics) {
    templateByClinic.set(c.clinic_id, c.template_lembrete_custom || DEFAULT_TEMPLATE_CUSTOM)
    modeByClinic.set(c.clinic_id, c.modo_lembrete_custom ?? 'texto')
    if (c.audio_lembrete_custom) audioByClinic.set(c.clinic_id, c.audio_lembrete_custom)
  }

  const summary = {
    windowsUsed,
    dryRun,
    clinicsChecked: enabledClinics.length,
    appointmentsScanned: apps.length,
    sent: 0,
    skippedNoPhone: 0,
    skippedClinicNotConnected: 0,
    skippedNoTemplate: 0,
    errors: [] as Array<{ clinic_id: string; appointment_id: string; error: string }>,
  }

  let stoppedEarly = false
  for (const app of apps) {
    if (Date.now() - routeStart > ROUTE_BUDGET_MS || summary.sent >= MAX_SENDS_PER_RUN) {
      stoppedEarly = true
      break
    }

    const wa = waByClinic.get(app.clinic_id)
    if (!wa || wa.status !== 'connected') { summary.skippedClinicNotConnected++; continue }

    const modo = modeByClinic.get(app.clinic_id) ?? 'texto'
    const template = templateByClinic.get(app.clinic_id)
    if (modo !== 'audio' && !template) { summary.skippedNoTemplate++; continue }

    const patient = app.patient_id ? patientById.get(app.patient_id) : null
    if (!patient || !patient.phone) { summary.skippedNoPhone++; continue }

    const prof = app.professional_id ? profById.get(app.professional_id) : null
    const proc = app.procedure_id ? procById.get(app.procedure_id) : null
    const clinicName = clinicNameById.get(app.clinic_id) || 'Clínica'
    const dt = formatBrazilDateTime(app.start_time)
    const endereco = clinicAddressById.get(app.clinic_id) ?? ''

    let linkAgenda = ''
    if (app.end_time) {
      const event = buildAppointmentCalendarEvent({
        appointmentId: app.id,
        clinicName,
        professionalName: prof?.name ?? null,
        procedureName: proc?.name ?? null,
        startTimeISO: app.start_time,
        endTimeISO: app.end_time,
      })
      linkAgenda = generateCalendarLinks(getPublicBaseUrl(), event).googleRedirectUrl
    }

    const bodyText = template ? renderTemplate(template, {
      nome: patient.name || '',
      primeiro_nome: firstName(patient.name),
      clinica: clinicName,
      profissional: prof?.name || 'sua profissional',
      procedimento: proc?.name || 'seu atendimento',
      data: dt.date,
      hora: dt.time,
      dia_semana: dt.weekday,
      endereco,
      link_agenda: linkAgenda,
    }).replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '') : ''

    if (dryRun) { summary.sent++; continue }

    // Lock idempotente
    const { error: errLock } = await svc
      .from('appointments')
      .update({ reminder_custom_sent_at: new Date().toISOString() })
      .eq('id', app.id)
      .is('reminder_custom_sent_at', null)

    if (errLock) {
      summary.errors.push({ clinic_id: app.clinic_id, appointment_id: app.id, error: `lock_update: ${errLock.message}` })
      continue
    }

    // Mensagem só informativa — sem botões (a confirmação já roda em D-1).
    let result: Awaited<ReturnType<typeof sendWhatsappMessage>> | null = null

    if (modo !== 'audio') {
      result = await sendWhatsappMessage({
        clinicId: app.clinic_id,
        phone: patient.phone,
        message: bodyText,
        purpose: 'automation',
        instanceName: wa.instance_name ?? undefined,
      })
    }

    if ((modo === 'audio' || modo === 'ambos') && (!result || result.ok)) {
      result = await sendWhatsappAudio({
        clinicId: app.clinic_id,
        phone: patient.phone,
        audio: audioByClinic.get(app.clinic_id)!,
        purpose: 'automation',
        instanceName: wa.instance_name ?? undefined,
      })
    }

    if (!result) {
      result = { ok: false, code: 'evolution_error', error: 'Modo de envio inválido' }
    }

    if (result.ok) {
      summary.sent++
    } else {
      // Falha transitória (pacer anti-ban): desfaz a trava pra retomar no próximo ciclo.
      if (result.code === 'rate_limited') {
        await svc.from('appointments').update({ reminder_custom_sent_at: null }).eq('id', app.id)
      }
      summary.errors.push({ clinic_id: app.clinic_id, appointment_id: app.id, error: result.error })
    }
  }

  return NextResponse.json({ ok: true, ...summary, stoppedEarly })
}
