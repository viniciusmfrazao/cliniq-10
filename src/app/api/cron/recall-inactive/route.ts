import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendWhatsappMessage } from '@/lib/whatsapp'

/**
 * GET /api/cron/recall-inactive
 *
 * Cron de recall de inativos — roda 1x por dia às 10h BRT (13h UTC).
 *
 * A cada dia, pra cada clínica:
 *  1) Confere toggle recall_inativos=true e template_recall preenchido.
 *  2) Confere clinic_whatsapp.status = 'connected'.
 *  3) Pega pacientes da view patient_last_completed cuja última visita
 *     foi há mais de recall_dias dias (default 150).
 *  4) Filtra os que NÃO receberam recall nos últimos 90 dias
 *     (janela de re-envio configurável via ?cooldown=N).
 *  5) Pra cada paciente:
 *       - Renderiza o template
 *       - Envia via Evolution
 *       - Loga em recall_messages_log
 *
 * Limite de envios por execução pra não floodar o WhatsApp:
 *   default 50 por clínica, configurável via ?limit=N.
 *
 * Auth: Header Authorization: Bearer ${CRON_SECRET}.
 */

const TZ_BR = 'America/Sao_Paulo'
const DEFAULT_COOLDOWN_DAYS = 90
const DEFAULT_LIMIT_PER_CLINIC = 50

type AutomationRow = {
  clinic_id: string
  recall_inativos: boolean | null
  recall_dias: number | null
  template_recall: string | null
}

type WaRow = { clinic_id: string; status: string }
type ClinicRow = { id: string; name: string }
type PatientRow = {
  id: string
  name: string
  phone: string | null
  whatsapp_opt_in: boolean | null
}

type LastVisitRow = {
  patient_id: string
  clinic_id: string
  last_completed_at: string
  procedure_id: string | null
  procedure_name: string | null
  days_since_last: number
}

function firstName(full: string | null | undefined): string {
  if (!full) return ''
  return full.trim().split(/\s+/)[0]
}

function humanizeDuration(days: number): string {
  if (days < 30) return `${days} dias`
  const months = Math.round(days / 30)
  if (months < 12) return months === 1 ? '1 mês' : `${months} meses`
  const years = Math.floor(months / 12)
  const restMonths = months % 12
  if (years === 1 && restMonths === 0) return '1 ano'
  if (restMonths === 0) return `${years} anos`
  return `${years}a ${restMonths}m`
}

function formatBrDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ_BR,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso))
}

function renderTemplate(
  template: string,
  vars: {
    nome: string
    primeiro_nome: string
    clinica: string
    ultimo_procedimento: string
    tempo: string
    ultima_visita: string
    dias_inativo: number
  },
): string {
  return template
    .replace(/\{\{\s*nome\s*\}\}/g, vars.nome)
    .replace(/\{\{\s*primeiro_nome\s*\}\}/g, vars.primeiro_nome)
    .replace(/\{\{\s*clinica\s*\}\}/g, vars.clinica)
    .replace(/\{\{\s*ultimo_procedimento\s*\}\}/g, vars.ultimo_procedimento)
    .replace(/\{\{\s*tempo\s*\}\}/g, vars.tempo)
    .replace(/\{\{\s*ultima_visita\s*\}\}/g, vars.ultima_visita)
    .replace(/\{\{\s*dias_inativo\s*\}\}/g, String(vars.dias_inativo))
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron/recall-inactive] CRON_SECRET ausente em runtime')
    return NextResponse.json({ ok: false, error: 'cron_not_configured' }, { status: 503 })
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const dryRun = url.searchParams.get('dry') === '1'
  const cooldownDays = Math.max(
    1,
    parseInt(url.searchParams.get('cooldown') || String(DEFAULT_COOLDOWN_DAYS), 10),
  )
  const limitPerClinic = Math.max(
    1,
    parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT_PER_CLINIC), 10),
  )

  const svc = createServiceClient()

  // 1) Carrega automations das clínicas com recall ligado
  const { data: automations, error: errAuto } = await svc
    .from('clinic_automations')
    .select('clinic_id, recall_inativos, recall_dias, template_recall')
    .eq('recall_inativos', true)

  if (errAuto) {
    return NextResponse.json(
      { ok: false, stage: 'load_automations', error: errAuto.message },
      { status: 500 },
    )
  }

  const enabledClinics =
    (automations as AutomationRow[] | null)?.filter(
      (a) => a.template_recall && a.template_recall.trim().length > 0,
    ) ?? []

  if (enabledClinics.length === 0) {
    return NextResponse.json({
      ok: true,
      processed: 0,
      reason: 'no_clinics_with_recall_enabled',
    })
  }

  const clinicIds = enabledClinics.map((c) => c.clinic_id)

  // 2) Carrega status WhatsApp + nomes (multi-numero: prioriza outbound_automation conectado)
  const [{ data: waList }, { data: clinicList }] = await Promise.all([
    svc
      .from('clinic_whatsapp')
      .select('clinic_id, status, is_default, role_outbound_automation')
      .in('clinic_id', clinicIds),
    svc.from('clinics').select('id, name').in('id', clinicIds),
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
  for (const c of (clinicList as ClinicRow[] | null) ?? [])
    clinicNameById.set(c.id, c.name)

  const summary = {
    dryRun,
    cooldownDays,
    limitPerClinic,
    clinicsChecked: enabledClinics.length,
    sent: 0,
    skippedClinicNotConnected: 0,
    skippedNoPhone: 0,
    skippedRecentlyContacted: 0,
    skippedNoLastVisit: 0,
    errors: [] as Array<{ clinic_id: string; patient_id?: string; error: string }>,
  }

  // 3) Pra cada clínica, processa
  for (const auto of enabledClinics) {
    const wa = waByClinic.get(auto.clinic_id)
    if (!wa || wa.status !== 'connected') {
      summary.skippedClinicNotConnected++
      continue
    }

    const recallDias = auto.recall_dias && auto.recall_dias > 0 ? auto.recall_dias : 150
    const cutoffDate = new Date(Date.now() - recallDias * 24 * 60 * 60 * 1000).toISOString()

    // 3a) Pacientes com última consulta há mais de N dias
    const { data: lastVisits, error: errLV } = await svc
      .from('patient_last_completed')
      .select('patient_id, clinic_id, last_completed_at, procedure_id, procedure_name, days_since_last')
      .eq('clinic_id', auto.clinic_id)
      .lt('last_completed_at', cutoffDate)
      .order('last_completed_at', { ascending: false })
      .limit(limitPerClinic * 3) // pega mais que o limite, depois filtra cooldown

    if (errLV) {
      summary.errors.push({ clinic_id: auto.clinic_id, error: `last_visits: ${errLV.message}` })
      continue
    }

    const visits = (lastVisits as LastVisitRow[] | null) ?? []
    if (visits.length === 0) {
      continue
    }

    const patientIds = visits.map((v) => v.patient_id)

    // 3b) Pacientes com phone + dados básicos
    const { data: patientsRaw, error: errPat } = await svc
      .from('patients')
      .select('id, name, phone, whatsapp_opt_in')
      .in('id', patientIds)
      .not('phone', 'is', null)

    if (errPat) {
      summary.errors.push({ clinic_id: auto.clinic_id, error: `patients: ${errPat.message}` })
      continue
    }

    const patientById = new Map<string, PatientRow>()
    for (const p of (patientsRaw as PatientRow[] | null) ?? []) {
      if (p.phone && p.phone.trim().length > 0) patientById.set(p.id, p)
    }

    if (patientById.size === 0) continue

    // 3c) Quem recebeu recall nos últimos `cooldownDays` dias
    const cooldownCutoff = new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000).toISOString()
    const { data: recentLogs } = await svc
      .from('recall_messages_log')
      .select('patient_id')
      .eq('clinic_id', auto.clinic_id)
      .in('patient_id', Array.from(patientById.keys()))
      .gte('sent_at', cooldownCutoff)

    const recentlyContacted = new Set<string>()
    for (const r of (recentLogs as { patient_id: string }[] | null) ?? []) {
      recentlyContacted.add(r.patient_id)
    }

    const clinicName = clinicNameById.get(auto.clinic_id) || 'Clínica'

    // 3d) Envia respeitando o limite por clínica
    let sentForThisClinic = 0
    for (const v of visits) {
      if (sentForThisClinic >= limitPerClinic) break

      const patient = patientById.get(v.patient_id)
      if (!patient) {
        summary.skippedNoPhone++
        continue
      }
      if (recentlyContacted.has(v.patient_id)) {
        summary.skippedRecentlyContacted++
        continue
      }

      const tempo = humanizeDuration(v.days_since_last)
      const text = renderTemplate(auto.template_recall || '', {
        nome: patient.name || '',
        primeiro_nome: firstName(patient.name),
        clinica: clinicName,
        ultimo_procedimento: v.procedure_name || 'seu atendimento',
        tempo,
        ultima_visita: formatBrDate(v.last_completed_at),
        dias_inativo: v.days_since_last,
      })

      if (dryRun) {
        summary.sent++
        sentForThisClinic++
        continue
      }

      // Insere o log antes pra evitar reenvio (mesmo se falhar Evolution).
      // Como não temos UNIQUE, usamos check + insert; concorrência é
      // praticamente nula porque é um cron diário.
      const { data: inserted, error: errInsert } = await svc
        .from('recall_messages_log')
        .insert({
          clinic_id: auto.clinic_id,
          patient_id: patient.id,
          last_visit_at: v.last_completed_at,
          days_inactive: v.days_since_last,
          procedure_name: v.procedure_name,
          status: 'skipped',
          message: text,
        })
        .select('id')
        .maybeSingle()

      if (errInsert) {
        summary.errors.push({
          clinic_id: auto.clinic_id,
          patient_id: patient.id,
          error: `lock_insert: ${errInsert.message}`,
        })
        continue
      }

      const result = await sendWhatsappMessage({
        clinicId: auto.clinic_id,
        phone: patient.phone!,
        message: text,
        purpose: 'automation',
      })

      if (result.ok) {
        await svc
          .from('recall_messages_log')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', inserted!.id)
        summary.sent++
        sentForThisClinic++
      } else {
        await svc
          .from('recall_messages_log')
          .update({ status: 'error', error: result.error })
          .eq('id', inserted!.id)
        summary.errors.push({
          clinic_id: auto.clinic_id,
          patient_id: patient.id,
          error: result.error,
        })
      }
    }
  }

  return NextResponse.json({ ok: true, ...summary })
}
