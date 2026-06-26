import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendWhatsappMessage } from '@/lib/whatsapp'

/**
 * GET /api/cron/recall-inactive
 *
 * Cron de recall de inativos — roda 1x por dia às 10h BRT (13h UTC).
 *
 * LÓGICA MULTI-ETAPA (recall_seq):
 *   Cada clínica pode configurar N etapas, cada uma com {dias, ativo, template}.
 *   O "dias" representa dias sem visita desde a última consulta realizada.
 *
 *   Para cada paciente inativo, o cron determina qual é a próxima etapa a enviar:
 *   - Verifica quais etapas já foram enviadas (via recall_messages_log.step)
 *   - Encontra a primeira etapa NÃO enviada cujo limiar de dias já foi atingido
 *   - Envia essa etapa e registra com o número do step
 *
 *   Se o paciente voltar à clínica, last_completed_at é atualizado e o ciclo reinicia.
 *   As etapas anteriores podem ser enviadas novamente no próximo ciclo de inatividade.
 *
 * FALLBACK LEGADO (recall_dias + template_recall):
 *   Clínicas que ainda não têm recall_seq configurado continuam funcionando com
 *   o comportamento original (1 mensagem, cooldown de 90 dias).
 *
 * Auth: Header Authorization: Bearer ${CRON_SECRET}
 */

const TZ_BR = 'America/Sao_Paulo'
const DEFAULT_LIMIT_PER_CLINIC = 50
// Janela de re-envio por etapa: só reenvia a mesma etapa se o paciente
// voltou E sumiu de novo (controlado pela last_completed_at, não por cooldown fixo)
const LEGACY_COOLDOWN_DAYS = 90

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface RecallStep {
  dias: number
  ativo: boolean
  template: string
  label?: string
}

interface AutomationRow {
  clinic_id: string
  recall_inativos: boolean | null
  recall_dias: number | null
  template_recall: string | null
  recall_seq: RecallStep[] | null
}

interface WaRow {
  clinic_id: string
  instance_name: string
  status: string
  is_default: boolean | null
  role_outbound_automation: boolean | null
}

interface ClinicRow {
  id: string
  name: string
}

interface PatientRow {
  id: string
  name: string
  phone: string | null
}

interface LastVisitRow {
  patient_id: string
  clinic_id: string
  last_completed_at: string
  procedure_id: string | null
  procedure_name: string | null
  days_since_last: number
}

interface LogRow {
  patient_id: string
  step: number
  sent_at: string
  last_visit_at: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function waScore(w: WaRow): number {
  return (
    (w.status === 'connected' ? 10 : 0) +
    (w.role_outbound_automation === true ? 4 : 0) +
    (w.is_default ? 1 : 0)
  )
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Auth
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
  const limitPerClinic = Math.max(
    1,
    parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT_PER_CLINIC), 10),
  )

  const svc = createServiceClient()

  // 1) Clínicas com recall ligado
  const { data: automations, error: errAuto } = await svc
    .from('clinic_automations')
    .select('clinic_id, recall_inativos, recall_dias, template_recall, recall_seq')
    .eq('recall_inativos', true)

  if (errAuto) {
    return NextResponse.json(
      { ok: false, stage: 'load_automations', error: errAuto.message },
      { status: 500 },
    )
  }

  // Filtra clínicas com ao menos uma etapa ativa OU configuração legada
  const enabledClinics = ((automations as AutomationRow[] | null) ?? []).filter((a) => {
    const hasSeq =
      Array.isArray(a.recall_seq) &&
      a.recall_seq.length > 0 &&
      a.recall_seq.some((s) => s.ativo && s.template?.trim())
    const hasLegacy = a.template_recall && a.template_recall.trim().length > 0
    return hasSeq || hasLegacy
  })

  if (enabledClinics.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, reason: 'no_clinics_with_recall_enabled' })
  }

  const clinicIds = enabledClinics.map((c) => c.clinic_id)

  // 2) WhatsApp + nomes das clínicas
  const [{ data: waList }, { data: clinicList }] = await Promise.all([
    svc
      .from('clinic_whatsapp')
      .select('clinic_id, instance_name, status, is_default, role_outbound_automation')
      .in('clinic_id', clinicIds),
    svc.from('clinics').select('id, name').in('id', clinicIds),
  ])

  const waByClinic = new Map<string, WaRow>()
  for (const w of (waList as WaRow[] | null) ?? []) {
    const cur = waByClinic.get(w.clinic_id)
    if (!cur || waScore(w) > waScore(cur)) waByClinic.set(w.clinic_id, w)
  }

  const clinicNameById = new Map<string, string>()
  for (const c of (clinicList as ClinicRow[] | null) ?? []) clinicNameById.set(c.id, c.name)

  const summary = {
    dryRun,
    limitPerClinic,
    clinicsChecked: enabledClinics.length,
    sent: 0,
    skippedClinicNotConnected: 0,
    skippedNoPhone: 0,
    skippedAllStepsDone: 0,
    skippedNoStepReady: 0,
    errors: [] as Array<{ clinic_id: string; patient_id?: string; error: string }>,
    detail: [] as Array<{
      clinic_id: string
      patient_id: string
      step: number
      dias: number
      status: 'sent' | 'skipped_dry'
    }>,
  }

  // 3) Processa cada clínica
  for (const auto of enabledClinics) {
    const wa = waByClinic.get(auto.clinic_id)
    if (!wa || wa.status !== 'connected') {
      summary.skippedClinicNotConnected++
      continue
    }

    const clinicName = clinicNameById.get(auto.clinic_id) || 'Clínica'
    const isMultiStep =
      Array.isArray(auto.recall_seq) &&
      auto.recall_seq.length > 0 &&
      auto.recall_seq.some((s) => s.ativo)

    if (isMultiStep) {
      await processMultiStep({
        auto,
        wa,
        clinicName,
        svc,
        dryRun,
        limitPerClinic,
        summary,
      })
    } else {
      await processLegacy({
        auto,
        wa,
        clinicName,
        svc,
        dryRun,
        limitPerClinic,
        summary,
      })
    }
  }

  return NextResponse.json({ ok: true, ...summary })
}

// ─── Lógica multi-etapa ───────────────────────────────────────────────────────

async function processMultiStep({
  auto,
  wa,
  clinicName,
  svc,
  dryRun,
  limitPerClinic,
  summary,
}: {
  auto: AutomationRow
  wa: WaRow
  clinicName: string
  svc: ReturnType<typeof createServiceClient>
  dryRun: boolean
  limitPerClinic: number
  summary: {
    sent: number
    skippedNoPhone: number
    skippedAllStepsDone: number
    skippedNoStepReady: number
    errors: Array<{ clinic_id: string; patient_id?: string; error: string }>
    detail: Array<{
      clinic_id: string
      patient_id: string
      step: number
      dias: number
      status: 'sent' | 'skipped_dry'
    }>
  }
}) {
  const activeSteps = (auto.recall_seq ?? [])
    .filter((s) => s.ativo && s.template?.trim())
    .sort((a, b) => a.dias - b.dias) // garante ordem crescente

  if (activeSteps.length === 0) return

  // Cutoff = menor número de dias entre as etapas ativas
  const minDias = activeSteps[0].dias
  const cutoffDate = new Date(Date.now() - minDias * 24 * 60 * 60 * 1000).toISOString()

  // Pacientes com última visita antes do menor limiar
  const { data: lastVisits, error: errLV } = await svc
    .from('patient_last_completed')
    .select('patient_id, clinic_id, last_completed_at, procedure_id, procedure_name, days_since_last')
    .eq('clinic_id', auto.clinic_id)
    .lt('last_completed_at', cutoffDate)
    .order('last_completed_at', { ascending: false })
    .limit(limitPerClinic * 5)

  if (errLV) {
    summary.errors.push({ clinic_id: auto.clinic_id, error: `last_visits: ${errLV.message}` })
    return
  }

  const visits = (lastVisits as LastVisitRow[] | null) ?? []
  if (visits.length === 0) return

  const patientIds = visits.map((v) => v.patient_id)

  // Pacientes com telefone
  const { data: patientsRaw, error: errPat } = await svc
    .from('patients')
    .select('id, name, phone')
    .in('id', patientIds)
    .not('phone', 'is', null)

  if (errPat) {
    summary.errors.push({ clinic_id: auto.clinic_id, error: `patients: ${errPat.message}` })
    return
  }

  const patientById = new Map<string, PatientRow>()
  for (const p of (patientsRaw as PatientRow[] | null) ?? []) {
    if (p.phone?.trim()) patientById.set(p.id, p)
  }
  if (patientById.size === 0) return

  // Logs existentes de recall para estes pacientes neste ciclo de inatividade
  // "ciclo" = logs enviados APÓS a última visita do paciente
  // Isso garante que se o paciente voltou e sumiu de novo, as etapas reiniciam
  const { data: existingLogs } = await svc
    .from('recall_messages_log')
    .select('patient_id, step, sent_at, last_visit_at')
    .eq('clinic_id', auto.clinic_id)
    .in('patient_id', Array.from(patientById.keys()))
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })

  // Agrupa logs por patient_id: { patient_id -> Set<step> } para o ciclo atual
  const sentStepsByPatient = new Map<string, Set<number>>()
  const visitByPatient = new Map<string, string>()
  for (const v of visits) visitByPatient.set(v.patient_id, v.last_completed_at)

  for (const log of (existingLogs as LogRow[] | null) ?? []) {
    const lastVisit = visitByPatient.get(log.patient_id)
    // Só conta o log se foi enviado DEPOIS da última visita (mesmo ciclo)
    if (lastVisit && log.sent_at > lastVisit) {
      if (!sentStepsByPatient.has(log.patient_id)) {
        sentStepsByPatient.set(log.patient_id, new Set())
      }
      sentStepsByPatient.get(log.patient_id)!.add(log.step)
    }
  }

  let sentForThisClinic = 0

  for (const v of visits) {
    if (sentForThisClinic >= limitPerClinic) break

    const patient = patientById.get(v.patient_id)
    if (!patient) {
      summary.skippedNoPhone++
      continue
    }

    const sentSteps = sentStepsByPatient.get(v.patient_id) ?? new Set<number>()

    // Encontra a próxima etapa a enviar:
    // - Dias atingidos (days_since_last >= step.dias)
    // - Ainda não enviada neste ciclo
    // O índice do step na sequência original (não filtrada) é usado como número da etapa
    const allActiveSteps = (auto.recall_seq ?? [])
      .map((s, originalIdx) => ({ ...s, stepNumber: originalIdx + 1 }))
      .filter((s) => s.ativo && s.template?.trim())
      .sort((a, b) => a.dias - b.dias)

    const nextStep = allActiveSteps.find(
      (s) => v.days_since_last >= s.dias && !sentSteps.has(s.stepNumber),
    )

    if (!nextStep) {
      // Verifica se todas as etapas elegíveis já foram enviadas
      const eligibleSent = allActiveSteps.filter(
        (s) => v.days_since_last >= s.dias && sentSteps.has(s.stepNumber),
      )
      if (eligibleSent.length > 0) {
        summary.skippedAllStepsDone++
      } else {
        summary.skippedNoStepReady++
      }
      continue
    }

    const tempo = humanizeDuration(v.days_since_last)
    const text = renderTemplate(nextStep.template, {
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
      summary.detail.push({
        clinic_id: auto.clinic_id,
        patient_id: v.patient_id,
        step: nextStep.stepNumber,
        dias: v.days_since_last,
        status: 'skipped_dry',
      })
      continue
    }

    // Insere log com status 'skipped' como lock otimista antes de enviar
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
        step: nextStep.stepNumber,
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
      instanceName: wa.instance_name,
    })

    if (result.ok) {
      await svc
        .from('recall_messages_log')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', inserted!.id)
      summary.sent++
      sentForThisClinic++
      summary.detail.push({
        clinic_id: auto.clinic_id,
        patient_id: v.patient_id,
        step: nextStep.stepNumber,
        dias: v.days_since_last,
        status: 'sent',
      })
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

// ─── Lógica legada (compatibilidade) ──────────────────────────────────────────

async function processLegacy({
  auto,
  wa,
  clinicName,
  svc,
  dryRun,
  limitPerClinic,
  summary,
}: {
  auto: AutomationRow
  wa: WaRow
  clinicName: string
  svc: ReturnType<typeof createServiceClient>
  dryRun: boolean
  limitPerClinic: number
  summary: {
    sent: number
    skippedNoPhone: number
    skippedAllStepsDone: number
    errors: Array<{ clinic_id: string; patient_id?: string; error: string }>
    detail: Array<{
      clinic_id: string
      patient_id: string
      step: number
      dias: number
      status: 'sent' | 'skipped_dry'
    }>
  }
}) {
  const recallDias = auto.recall_dias && auto.recall_dias > 0 ? auto.recall_dias : 150
  const cutoffDate = new Date(Date.now() - recallDias * 24 * 60 * 60 * 1000).toISOString()
  const cooldownCutoff = new Date(
    Date.now() - LEGACY_COOLDOWN_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString()

  const { data: lastVisits, error: errLV } = await svc
    .from('patient_last_completed')
    .select('patient_id, clinic_id, last_completed_at, procedure_id, procedure_name, days_since_last')
    .eq('clinic_id', auto.clinic_id)
    .lt('last_completed_at', cutoffDate)
    .order('last_completed_at', { ascending: false })
    .limit(limitPerClinic * 3)

  if (errLV) {
    summary.errors.push({ clinic_id: auto.clinic_id, error: `last_visits: ${errLV.message}` })
    return
  }

  const visits = (lastVisits as LastVisitRow[] | null) ?? []
  if (visits.length === 0) return

  const patientIds = visits.map((v) => v.patient_id)

  const { data: patientsRaw, error: errPat } = await svc
    .from('patients')
    .select('id, name, phone')
    .in('id', patientIds)
    .not('phone', 'is', null)

  if (errPat) {
    summary.errors.push({ clinic_id: auto.clinic_id, error: `patients: ${errPat.message}` })
    return
  }

  const patientById = new Map<string, PatientRow>()
  for (const p of (patientsRaw as PatientRow[] | null) ?? []) {
    if (p.phone?.trim()) patientById.set(p.id, p)
  }
  if (patientById.size === 0) return

  const { data: recentLogs } = await svc
    .from('recall_messages_log')
    .select('patient_id')
    .eq('clinic_id', auto.clinic_id)
    .in('patient_id', Array.from(patientById.keys()))
    .gte('sent_at', cooldownCutoff)
    .eq('status', 'sent')

  const recentlyContacted = new Set<string>()
  for (const r of (recentLogs as { patient_id: string }[] | null) ?? []) {
    recentlyContacted.add(r.patient_id)
  }

  let sentForThisClinic = 0

  for (const v of visits) {
    if (sentForThisClinic >= limitPerClinic) break

    const patient = patientById.get(v.patient_id)
    if (!patient) {
      summary.skippedNoPhone++
      continue
    }
    if (recentlyContacted.has(v.patient_id)) {
      summary.skippedAllStepsDone++
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
      summary.detail.push({
        clinic_id: auto.clinic_id,
        patient_id: v.patient_id,
        step: 1,
        dias: v.days_since_last,
        status: 'skipped_dry',
      })
      continue
    }

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
        step: 1,
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
      instanceName: wa.instance_name,
    })

    if (result.ok) {
      await svc
        .from('recall_messages_log')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', inserted!.id)
      summary.sent++
      sentForThisClinic++
      summary.detail.push({
        clinic_id: auto.clinic_id,
        patient_id: v.patient_id,
        step: 1,
        dias: v.days_since_last,
        status: 'sent',
      })
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
