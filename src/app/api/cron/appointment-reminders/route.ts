import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendWhatsappMessage, sendWhatsappButtons } from '@/lib/whatsapp'
import { logEva } from '@/lib/eva-logger'

/**
 * GET /api/cron/appointment-reminders
 *
 * Cron de lembrete de consulta — roda 1x por dia às 20h BRT (23h UTC).
 * Plano Hobby da Vercel limita cron a uma execução por dia.
 *
 * A cada dia (à noite), pra cada clínica:
 *  1) Confere toggle confirma_24h=true e template_confirma_24h preenchido.
 *  2) Confere clinic_whatsapp.status = 'connected'.
 *  3) Pega appointments do dia seguinte (00h-23h59 BRT) com:
 *       status IN ('scheduled','confirmed','pending_confirmation')
 *       confirmation_sent_at IS NULL
 *  4) Pra cada appointment:
 *       - Renderiza o template
 *       - Envia via Evolution
 *       - Marca confirmation_sent_at = now() (idempotência)
 *
 * Auth: Header Authorization: Bearer ${CRON_SECRET}.
 *       Vercel Cron seta esse header automaticamente quando CRON_SECRET
 *       está definido nas env vars do projeto.
 */

const TZ_BR = 'America/Sao_Paulo'

/** Pega o range UTC pra "amanhã" no fuso BRT. Brasil não tem DST desde 2019, UTC-3 fixo. */
function brTomorrowRange(): { startISO: string; endISO: string; dateLabel: string } {
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

  // amanhã (data BR)
  const tomorrow = new Date(Date.UTC(todayY, todayM - 1, todayD + 1))
  const ty = tomorrow.getUTCFullYear()
  const tm = String(tomorrow.getUTCMonth() + 1).padStart(2, '0')
  const td = String(tomorrow.getUTCDate()).padStart(2, '0')

  // 00:00 BRT = 03:00 UTC (UTC-3 fixo)
  const startISO = `${ty}-${tm}-${td}T03:00:00.000Z`
  // 00:00 BRT do dia seguinte
  const dayAfter = new Date(Date.UTC(ty, parseInt(tm, 10) - 1, parseInt(td, 10) + 1))
  const ay = dayAfter.getUTCFullYear()
  const am = String(dayAfter.getUTCMonth() + 1).padStart(2, '0')
  const ad = String(dayAfter.getUTCDate()).padStart(2, '0')
  const endISO = `${ay}-${am}-${ad}T03:00:00.000Z`

  const dateLabel = `${td}/${tm}/${ty}`
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

// Template padrão — usado quando clínica não configurou template personalizado.
// Variáveis disponíveis: {{nome}}, {{primeiro_nome}}, {{clinica}}, {{profissional}},
// {{procedimento}}, {{data}}, {{hora}}, {{dia_semana}}, {{endereco}}.
// Nota: {{link_confirmacao}} ainda é aceito mas é ignorado (substituído por botões).
const DEFAULT_TEMPLATE_CONFIRMA = `Olá {{primeiro_nome}}! Falo do *{{clinica}}* e gostaria de confirmar seu agendamento marcado para *{{dia_semana}}, {{data}}*:

*{{hora}}* — {{procedimento}} — {{profissional}}

Podemos confirmar?`

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
    link_confirmacao: string
    endereco: string
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
    .replace(/\{\{\s*link_confirmacao\s*\}\}/g, vars.link_confirmacao)
    .replace(/\{\{\s*endereco\s*\}\}/g, vars.endereco)
}

type AutomationRow = {
  clinic_id: string
  confirma_24h: boolean | null
  confirma_24h_hora?: number | null
  template_confirma_24h: string | null
}

type AppointmentRow = {
  id: string
  clinic_id: string
  start_time: string
  status: string
  confirmation_sent_at: string | null
  confirmation_slug: string | null
  patient_id: string | null
  professional_id: string | null
  procedure_id: string | null
}

type PatientRow = { id: string; name: string; phone: string | null }
type UserRow = { id: string; name: string }
type ProcedureRow = { id: string; name: string }
type ClinicRow = { id: string; name: string; settings?: Record<string, unknown> | null }
type WaRow = { clinic_id: string; status: string }

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron/appointment-reminders] CRON_SECRET ausente em runtime')
    return NextResponse.json({ ok: false, error: 'cron_not_configured' }, { status: 503 })
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const dryRun = url.searchParams.get('dry') === '1'

  const svc = createServiceClient()
  const { startISO, endISO, dateLabel } = brTomorrowRange()

  // Hora atual no fuso BRT
  const nowBR = new Date(new Date().toLocaleString('en-US', { timeZone: TZ_BR }))
  const currentHour = nowBR.getHours()

  // 1) Carrega automations das clínicas com lembrete ligado, template preenchido
  //    E cujo horário configurado bate com a hora atual
  const { data: automations, error: errAuto } = await svc
    .from('clinic_automations')
    .select('clinic_id, confirma_24h, confirma_24h_hora, template_confirma_24h')
    .eq('confirma_24h', true)

  if (errAuto) {
    return NextResponse.json(
      { ok: false, stage: 'load_automations', error: errAuto.message },
      { status: 500 },
    )
  }

  const enabledClinics =
    (automations as AutomationRow[] | null)?.filter((a) => {
      if (!a.template_confirma_24h || a.template_confirma_24h.trim().length === 0) return false
      // Usar horário configurado ou padrão 20h
      const targetHour = a.confirma_24h_hora ?? 20
      return targetHour === currentHour
    }) ?? []

  if (enabledClinics.length === 0) {
    return NextResponse.json({
      ok: true,
      tomorrow: dateLabel,
      processed: 0,
      reason: 'no_clinics_with_reminder_enabled',
    })
  }

  const clinicIds = enabledClinics.map((c) => c.clinic_id)

  // 2) Carrega status do whatsapp + nomes das clínicas
  // Multi-numero: prioriza connected + role_outbound_automation
  const [{ data: waList }, { data: clinicList }] = await Promise.all([
    svc
      .from('clinic_whatsapp')
      .select('clinic_id, instance_name, status, is_default, role_outbound_automation')
      .in('clinic_id', clinicIds),
    svc.from('clinics').select('id, name, settings').in('id', clinicIds),
  ])

  const waByClinic = new Map<string, WaRow>()
  type WaScored = WaRow & { is_default?: boolean | null; role_outbound_automation?: boolean | null }
  const score = (w: WaScored) =>
    (w.status === 'connected' ? 10 : 0) +
    (w.role_outbound_automation === true ? 4 : 0) +
    (w.is_default ? 1 : 0)
  for (const w of (waList as WaScored[] | null) ?? []) {
    const cur = waByClinic.get(w.clinic_id) as WaScored | undefined
    if (!cur || score(w) > score(cur)) waByClinic.set(w.clinic_id, w)
  }

  const clinicNameById = new Map<string, string>()
  const clinicAddressById = new Map<string, string>()
  for (const c of (clinicList as ClinicRow[] | null) ?? []) {
    clinicNameById.set(c.id, c.name)
    clinicAddressById.set(c.id, (c.settings as any)?.address ?? '')
  }

  // 3) Carrega appointments de amanhã pra essas clínicas, ainda não confirmados
  const { data: appsRaw, error: errApps } = await svc
    .from('appointments')
    .select(
      'id, clinic_id, start_time, status, confirmation_sent_at, confirmation_slug, patient_id, professional_id, procedure_id',
    )
    .in('clinic_id', clinicIds)
    .gte('start_time', startISO)
    .lt('start_time', endISO)
    .in('status', ['scheduled', 'confirmed', 'pending_confirmation'])
    .is('confirmation_sent_at', null)

  if (errApps) {
    return NextResponse.json(
      { ok: false, stage: 'load_appointments', error: errApps.message },
      { status: 500 },
    )
  }

  const apps = (appsRaw as AppointmentRow[] | null) ?? []

  if (apps.length === 0) {
    return NextResponse.json({
      ok: true,
      tomorrow: dateLabel,
      clinicsChecked: enabledClinics.length,
      processed: 0,
      reason: 'no_pending_appointments',
    })
  }

  // 4) Coleta IDs auxiliares pra um único batch
  const patientIds = Array.from(new Set(apps.map((a) => a.patient_id).filter(Boolean) as string[]))
  const professionalIds = Array.from(
    new Set(apps.map((a) => a.professional_id).filter(Boolean) as string[]),
  )
  const procedureIds = Array.from(
    new Set(apps.map((a) => a.procedure_id).filter(Boolean) as string[]),
  )

  const [{ data: patientList }, { data: profList }, { data: procList }] = await Promise.all([
    patientIds.length > 0
      ? svc.from('patients').select('id, name, phone').in('id', patientIds)
      : Promise.resolve({ data: [] as PatientRow[] }),
    professionalIds.length > 0
      ? svc.from('users').select('id, name').in('id', professionalIds)
      : Promise.resolve({ data: [] as UserRow[] }),
    procedureIds.length > 0
      ? svc.from('procedures').select('id, name').in('id', procedureIds)
      : Promise.resolve({ data: [] as ProcedureRow[] }),
  ])

  const patientById = new Map<string, PatientRow>()
  for (const p of (patientList as PatientRow[] | null) ?? []) patientById.set(p.id, p)

  const profById = new Map<string, UserRow>()
  for (const u of (profList as UserRow[] | null) ?? []) profById.set(u.id, u)

  const procById = new Map<string, ProcedureRow>()
  for (const pr of (procList as ProcedureRow[] | null) ?? []) procById.set(pr.id, pr)

  // 5) Processa cada appointment
  const summary = {
    tomorrow: dateLabel,
    dryRun,
    clinicsChecked: enabledClinics.length,
    appointmentsScanned: apps.length,
    sent: 0,
    skippedNoPhone: 0,
    skippedClinicNotConnected: 0,
    skippedNoTemplate: 0,
    errors: [] as Array<{ clinic_id: string; appointment_id: string; error: string }>,
  }

  // Mapa de templates por clínica
  const templateByClinic = new Map<string, string>()
  for (const c of enabledClinics) {
    if (c.template_confirma_24h) templateByClinic.set(c.clinic_id, c.template_confirma_24h)
  }

  for (const app of apps) {
    const wa = waByClinic.get(app.clinic_id)
    if (!wa || wa.status !== 'connected') {
      summary.skippedClinicNotConnected++
      continue
    }

    const template = templateByClinic.get(app.clinic_id)
    if (!template) {
      summary.skippedNoTemplate++
      continue
    }

    const patient = app.patient_id ? patientById.get(app.patient_id) : null
    if (!patient || !patient.phone) {
      summary.skippedNoPhone++
      continue
    }

    const prof = app.professional_id ? profById.get(app.professional_id) : null
    const proc = app.procedure_id ? procById.get(app.procedure_id) : null
    const clinicName = clinicNameById.get(app.clinic_id) || 'Clínica'

    const dt = formatBrazilDateTime(app.start_time)
    const endereco = clinicAddressById.get(app.clinic_id) ?? ''
    const bodyText = renderTemplate(template, {
      nome: patient.name || '',
      primeiro_nome: firstName(patient.name),
      clinica: clinicName,
      profissional: prof?.name || 'sua profissional',
      procedimento: proc?.name || 'seu atendimento',
      data: dt.date,
      hora: dt.time,
      dia_semana: dt.weekday,
      link_confirmacao: '', // não usado — substituído por botões interativos
      endereco,
    }).replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '')

    if (dryRun) {
      summary.sent++
      continue
    }

    // Marca como enviado ANTES (idempotência: outra execução concorrente
    // não envia de novo). Se o envio falhar, atualiza status.
    const { error: errLock } = await svc
      .from('appointments')
      .update({ confirmation_sent_at: new Date().toISOString() })
      .eq('id', app.id)
      .is('confirmation_sent_at', null)

    if (errLock) {
      summary.errors.push({
        clinic_id: app.clinic_id,
        appointment_id: app.id,
        error: `lock_update: ${errLock.message}`,
      })
      continue
    }

    // Tenta enviar como mensagem com botões; fallback para texto simples
    // se a instância não suportar (ex.: WhatsApp Personal sem Business API).
    let result = await sendWhatsappButtons({
      clinicId: app.clinic_id,
      phone: patient.phone,
      body: bodyText,
      footer: clinicName,
      buttons: [
        { id: 'confirm', text: '✅ Confirmar' },
        { id: 'cancel', text: '❌ Cancelar' },
        { id: 'reschedule', text: '🔄 Reagendar' },
      ],
      purpose: 'automation',
      instanceName: (waByClinic.get(app.clinic_id) as any)?.instance_name,
    })

    if (!result.ok) {
      // Fallback: texto simples com instrução de resposta
      result = await sendWhatsappMessage({
        clinicId: app.clinic_id,
        phone: patient.phone,
        message: bodyText + '\n\nResponda *Confirmar* ou *Cancelar*.',
        purpose: 'automation',
        instanceName: (waByClinic.get(app.clinic_id) as any)?.instance_name,
      })
    }

    if (result.ok) {
      summary.sent++
      void logEva({ clinic_id: app.clinic_id, phone: patient.phone, source: 'cron-reminders', event: 'reminder_sent', status: 'ok', details: { appointment_id: app.id, mode: 'buttons' } })
    } else {
      summary.errors.push({
        clinic_id: app.clinic_id,
        appointment_id: app.id,
        error: result.error,
      })
      void logEva({ clinic_id: app.clinic_id, phone: patient.phone, source: 'cron-reminders', event: 'reminder_sent', status: 'error', error_message: result.error ?? 'unknown', details: { appointment_id: app.id } })
    }
  }

  return NextResponse.json({ ok: true, ...summary })
}
