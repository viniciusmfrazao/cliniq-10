import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendAutomationContent } from '@/lib/whatsapp'
import { buildAppointmentCalendarEvent, generateCalendarLinks, getPublicBaseUrl } from '@/lib/calendar-links'

export const maxDuration = 60

/**
 * GET /api/cron/appointment-reminder-2h
 *
 * Lembrete 2h antes da consulta — roda a cada 30min.
 * Busca agendamentos com start_time entre agora+1h45 e agora+2h15
 * que ainda não receberam o lembrete (reminder_2h_sent_at IS NULL).
 *
 * Usa o mesmo template do D-1 por padrão, ou um template específico
 * se clinic_automations.template_lembrete_2h existir.
 */

const TZ_BR = 'America/Sao_Paulo'

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
    .replace(/\{\{\s*link_confirmacao\s*\}\}/g, vars.link_confirmacao ?? '')
}

const DEFAULT_TEMPLATE_2H = `Oi {{primeiro_nome}}! Passando pra lembrar que daqui a pouco é o seu horário na *{{clinica}}* 🕐

🗓 Hoje às *{{hora}}* com {{profissional}}{{#if endereco}}
📍 {{endereco}}{{/if}}

📅 Adicionar na sua agenda: {{link_agenda}}

Te esperamos! 💕`

// Renderiza {{#if endereco}}...{{/if}} (bloco condicional simples)
function renderConditional(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, inner) =>
    vars[key] ? inner.replace(`{{${key}}}`, vars[key]) : ''
  )
}

// Budget de segurança: a Vercel mata a função em 60s (maxDuration=60). Cada
// envio automatizado passa por whatsapp_pace_send (gap de 15-35s por
// instância), então um lote grande estourava o timeout no meio e o resto
// ficava sem lembrete (a janela desliza com o tempo, então dava pra perder
// o agendamento de vez). Paramos de iniciar novos envios bem antes do
// limite; o cron agora roda a cada 5min (vercel.json) e a janela de 30min
// se sobrepõe entre execuções, dando várias chances de retomar o que sobrou.
const ROUTE_BUDGET_MS = 40_000
const MAX_SENDS_PER_RUN = 15

export async function GET(req: NextRequest) {
  const routeStart = Date.now()
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ ok: false, error: 'cron_not_configured' }, { status: 503 })
  if (auth !== `Bearer ${secret}`) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const now = new Date()
  const windowStart = new Date(now.getTime() + 105 * 60 * 1000) // +1h45
  const windowEnd = new Date(now.getTime() + 135 * 60 * 1000)   // +2h15

  // 1) Agendamentos na janela 2h
  const { data: apps, error: errApps } = await svc
    .from('appointments')
    .select('id, clinic_id, start_time, end_time, status, confirmation_slug, patient_id, professional_id, procedure_id')
    .gte('start_time', windowStart.toISOString())
    .lte('start_time', windowEnd.toISOString())
    .in('status', ['scheduled', 'confirmed', 'pending_confirmation'])
    .is('reminder_2h_sent_at', null)

  if (errApps) return NextResponse.json({ ok: false, error: errApps.message }, { status: 500 })
  if (!apps || apps.length === 0) return NextResponse.json({ ok: true, sent: 0, reason: 'no_appointments_in_window' })

  const clinicIds = [...new Set(apps.map((a: any) => a.clinic_id))]
  const patientIds = [...new Set(apps.map((a: any) => a.patient_id).filter(Boolean))]
  const professionalIds = [...new Set(apps.map((a: any) => a.professional_id).filter(Boolean))]
  const procedureIds = [...new Set(apps.map((a: any) => a.procedure_id).filter(Boolean))]

  // 2) Carregar dados em paralelo
  const [{ data: automations }, { data: waList }, { data: clinics },
         { data: patients }, { data: profs }, { data: procs }] = await Promise.all([
    svc.from('clinic_automations').select('clinic_id, confirma_24h, template_confirma_24h, lembrete_2h, template_lembrete_2h, modo_lembrete_2h, audio_lembrete_2h').in('clinic_id', clinicIds),
    svc.from('clinic_whatsapp').select('clinic_id, instance_name, status, is_default, role_outbound_automation').in('clinic_id', clinicIds),
    svc.from('clinics').select('id, name, settings').in('id', clinicIds),
    patientIds.length ? svc.from('patients').select('id, name, phone').in('id', patientIds) : { data: [] },
    professionalIds.length ? svc.from('users').select('id, name').in('id', professionalIds) : { data: [] },
    procedureIds.length ? svc.from('procedures').select('id, name').in('id', procedureIds) : { data: [] },
  ])

  // Mapas de lookup
  const waMap = new Map<string, any>()
  const score = (w: any) => (w.status === 'connected' ? 10 : 0) + (w.role_outbound_automation ? 4 : 0) + (w.is_default ? 1 : 0)
  for (const w of waList || []) {
    const cur = waMap.get(w.clinic_id)
    if (!cur || score(w) > score(cur)) waMap.set(w.clinic_id, w)
  }
  const autoMap = new Map((automations || []).map((a: any) => [a.clinic_id, a]))
  const clinicMap = new Map((clinics || []).map((c: any) => [c.id, c.name]))
  const clinicSettingsMap = new Map((clinics || []).map((c: any) => [c.id, c.settings as Record<string, unknown> | null | undefined]))
  const patientMap = new Map((patients || []).map((p: any) => [p.id, p]))
  const profMap = new Map((profs || []).map((u: any) => [u.id, u.name]))
  const procMap = new Map((procs || []).map((pr: any) => [pr.id, pr.name]))

  // 3) Enviar para cada agendamento
  const summary = { sent: 0, skipped: 0, errors: [] as string[] }

  let stoppedEarly = false
  for (const app of apps as any[]) {
    if (Date.now() - routeStart > ROUTE_BUDGET_MS || summary.sent >= MAX_SENDS_PER_RUN) {
      stoppedEarly = true
      break
    }

    const wa = waMap.get(app.clinic_id)
    if (!wa || wa.status !== 'connected') { summary.skipped++; continue }

    const auto = autoMap.get(app.clinic_id)

    // Só envia se lembrete_2h estiver ativo
    if (!auto?.lembrete_2h) { summary.skipped++; continue }

    // Usa template específico de 2h — NUNCA o D-1 (que fala "amanhã")
    const modo2h: 'texto' | 'audio' | 'ambos' = auto?.modo_lembrete_2h ?? 'texto'
    const audioUrl2h: string | null = auto?.audio_lembrete_2h ?? null
    if (modo2h === 'audio' && !audioUrl2h) { summary.skipped++; continue }
    const template = auto?.template_lembrete_2h || DEFAULT_TEMPLATE_2H

    const patient = patientMap.get(app.patient_id)
    if (!patient?.phone) { summary.skipped++; continue }

    const dt = formatBrazilDateTime(app.start_time)
    const clinicName2h = clinicMap.get(app.clinic_id) || 'Clínica'
    const endereco2h = String((clinicSettingsMap.get(app.clinic_id) as any)?.address ?? '')

    // Link "adicionar à agenda" — sem OAuth, gerado on-the-fly
    let linkAgenda2h = ''
    if (app.end_time) {
      const event = buildAppointmentCalendarEvent({
        appointmentId: app.id,
        clinicName: clinicName2h,
        professionalName: profMap.get(app.professional_id) || null,
        procedureName: procMap.get(app.procedure_id) || null,
        startTimeISO: app.start_time,
        endTimeISO: app.end_time,
      })
      linkAgenda2h = generateCalendarLinks(getPublicBaseUrl(), event).googleRedirectUrl
    }

    const linkConfirmacao2h = app.confirmation_slug
      ? `${getPublicBaseUrl()}/confirmar/${app.confirmation_slug}`
      : ''

    const rawText = renderTemplate(template, {
      nome: patient.name || '',
      primeiro_nome: firstName(patient.name),
      clinica: clinicName2h,
      profissional: profMap.get(app.professional_id) || 'sua profissional',
      procedimento: procMap.get(app.procedure_id) || 'seu atendimento',
      data: dt.date,
      hora: dt.time,
      dia_semana: dt.weekday,
      endereco: endereco2h,
      link_agenda: linkAgenda2h,
      link_confirmacao: linkConfirmacao2h,
    })
    const text = renderConditional(rawText, { endereco: endereco2h })

    // Lock idempotente
    const { error: errLock } = await svc
      .from('appointments')
      .update({ reminder_2h_sent_at: new Date().toISOString() })
      .eq('id', app.id)
      .is('reminder_2h_sent_at', null)

    if (errLock) { summary.errors.push(`lock ${app.id}: ${errLock.message}`); continue }

    // Texto simples — sem botões. Se a clínica quiser pedir confirmação
    // nesse lembrete, deve incluir {{link_confirmacao}} no template.
    const result = await sendAutomationContent({
      clinicId: app.clinic_id,
      phone: patient.phone,
      mode: modo2h,
      text: text.replace(/\n{3,}/g, '\n\n').trim(),
      audioUrl: audioUrl2h,
      instanceName: wa.instance_name,
    })

    if (result.ok) {
      summary.sent++
    } else {
      // NÃO reverte reminder_2h_sent_at — evita reenvio duplicado.
      summary.errors.push(`send ${app.id}: ${result.error}`)
    }
  }

  return NextResponse.json({ ok: true, ...summary, stoppedEarly })
}
