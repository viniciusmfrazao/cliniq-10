import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendWhatsappMessage } from '@/lib/whatsapp'

/**
 * GET /api/cron/birthdays
 *
 * Cron de aniversários — roda 1x por dia às 09h BRT (12h UTC).
 * Plano Hobby da Vercel limita cron a uma execução por dia.
 *
 * A cada dia, pra cada clínica:
 *  1) Confere toggle aniversario=true e template_aniversario preenchido.
 *  2) Confere clinic_whatsapp.status = 'connected'.
 *  3) Pega aniversariantes do dia que ainda não receberam mensagem este ano.
 *  4) Filtra opt-in se a clínica exigir (aniversario_optin_required=true).
 *  5) Pra cada aniversariante:
 *       - Renderiza o template
 *       - Envia via Evolution
 *       - Loga em birthday_messages_log (UNIQUE garante idempotência)
 *
 * O campo aniversario_hora segue na tabela mas só vale como referência visual
 * (UI mostra "envio às 9h"). Quando migrarmos pro plano Pro, voltamos a
 * checar a hora customizada.
 *
 * Auth: Header Authorization: Bearer ${CRON_SECRET}.
 *       Vercel Cron seta esse header automaticamente quando CRON_SECRET
 *       está definido nas env vars do projeto.
 */

const TZ_BR = 'America/Sao_Paulo'

function getBRHour(): number {
  // hora atual no fuso de Brasília
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ_BR,
    hour: '2-digit',
    hour12: false,
  })
  return parseInt(fmt.format(new Date()), 10)
}

function getBRYear(): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ_BR,
    year: 'numeric',
  })
  return parseInt(fmt.format(new Date()), 10)
}

function firstName(full: string | null | undefined): string {
  if (!full) return ''
  return full.trim().split(/\s+/)[0]
}

function renderTemplate(
  template: string,
  vars: { nome: string; primeiro_nome: string; clinica: string; idade: number | null },
): string {
  return template
    .replace(/\{\{\s*nome\s*\}\}/g, vars.nome)
    .replace(/\{\{\s*primeiro_nome\s*\}\}/g, vars.primeiro_nome)
    .replace(/\{\{\s*clinica\s*\}\}/g, vars.clinica)
    .replace(/\{\{\s*idade\s*\}\}/g, vars.idade != null ? String(vars.idade) : '')
}

type ClinicSettings = {
  clinic_id: string
  aniversario: boolean
  aniversario_hora: number
  aniversario_optin_required: boolean
  template_aniversario: string | null
}

type WhatsappRow = {
  clinic_id: string
  status: string
}

type Patient = {
  id: string
  clinic_id: string
  name: string
  phone: string
  birth_date: string
  whatsapp_opt_in: boolean | null
}

type ClinicNameRow = { id: string; name: string }

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron/birthdays] CRON_SECRET ausente em runtime')
    return NextResponse.json({ ok: false, error: 'cron_not_configured' }, { status: 503 })
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const dryRun = url.searchParams.get('dry') === '1'
  const currentHour = getBRHour()
  const year = getBRYear()

  const svc = createServiceClient()

  // 1) Carrega clínicas com aniversário ligado e template preenchido.
  // (aniversario_hora não é mais filtrado — Vercel Hobby roda só 1x/dia.)
  const { data: automations, error: errAuto } = await svc
    .from('clinic_automations')
    .select(
      'clinic_id, aniversario, aniversario_hora, aniversario_optin_required, template_aniversario',
    )
    .eq('aniversario', true)

  if (errAuto) {
    return NextResponse.json(
      { ok: false, stage: 'load_automations', error: errAuto.message },
      { status: 500 },
    )
  }

  const matchingClinics = (automations as ClinicSettings[] | null)?.filter(
    (a) => a.template_aniversario && a.template_aniversario.trim().length > 0,
  )

  if (!matchingClinics || matchingClinics.length === 0) {
    return NextResponse.json({
      ok: true,
      currentHour,
      year,
      processed: 0,
      reason: 'no_clinics_with_birthday_enabled',
    })
  }

  // 2) Pra essas clínicas, busca: nome da clínica + status do whatsapp
  const clinicIds = matchingClinics.map((c) => c.clinic_id)

  const [{ data: whatsapps }, { data: clinicNames }] = await Promise.all([
    svc
      .from('clinic_whatsapp')
      .select('clinic_id, instance_name, status, is_default, role_outbound_automation')
      .in('clinic_id', clinicIds),
    svc.from('clinics').select('id, name').in('id', clinicIds),
  ])

  // Multi-numero: prioriza connected + role_outbound_automation pra cada clinica
  const waByClinic = new Map<string, WhatsappRow>()
  type WaScored = WhatsappRow & { is_default?: boolean | null; role_outbound_automation?: boolean | null }
  const score = (w: WaScored) =>
    (w.status === 'connected' ? 10 : 0) +
    (w.role_outbound_automation === true ? 4 : 0) +
    (w.is_default ? 1 : 0)
  for (const w of (whatsapps as WaScored[] | null) ?? []) {
    const cur = waByClinic.get(w.clinic_id) as WaScored | undefined
    if (!cur || score(w) > score(cur)) waByClinic.set(w.clinic_id, w)
  }

  const nameByClinic = new Map<string, string>()
  for (const c of (clinicNames as ClinicNameRow[] | null) ?? []) nameByClinic.set(c.id, c.name)

  // 3) Pra cada clínica conectada, processa aniversariantes
  const summary = {
    currentHour,
    year,
    dryRun,
    clinicsChecked: matchingClinics.length,
    clinicsSkipped: 0,
    sent: 0,
    skippedOptOut: 0,
    skippedAlreadySent: 0,
    errors: [] as Array<{ clinic_id: string; patient_id?: string; error: string }>,
  }

  for (const automation of matchingClinics) {
    const wa = waByClinic.get(automation.clinic_id)
    if (!wa || wa.status !== 'connected') {
      summary.clinicsSkipped++
      continue
    }

    const clinicName = nameByClinic.get(automation.clinic_id) || 'Clínica'

    // Buscar aniversariantes do dia da clínica (fuso BR)
    // Usa a view birthday_today_pending que já filtra os que ainda não receberam este ano
    const { data: birthdaysRaw, error: errBdays } = await svc
      .from('birthday_today_pending')
      .select('patient_id, clinic_id, name, phone, birth_date, whatsapp_opt_in, age, year')
      .eq('clinic_id', automation.clinic_id)

    if (errBdays) {
      summary.errors.push({ clinic_id: automation.clinic_id, error: errBdays.message })
      continue
    }

    type ViewRow = {
      patient_id: string
      clinic_id: string
      name: string
      phone: string
      birth_date: string
      whatsapp_opt_in: boolean | null
      age: number | null
      year: number
    }

    const birthdays = (birthdaysRaw as ViewRow[] | null) ?? []

    for (const b of birthdays) {
      // Opt-in respeitado se a clínica exige
      if (automation.aniversario_optin_required && b.whatsapp_opt_in !== true) {
        summary.skippedOptOut++
        continue
      }

      const fullName = b.name || ''
      const fname = firstName(fullName)
      const text = renderTemplate(automation.template_aniversario || '', {
        nome: fullName,
        primeiro_nome: fname,
        clinica: clinicName,
        idade: b.age,
      })

      if (dryRun) {
        summary.sent++
        continue
      }

      // Enfileira o registro ANTES de mandar (UNIQUE garante 1 vez/ano)
      // Se duas execuções concorrentes tentarem o mesmo paciente, só uma passa.
      const { data: lockRow, error: errInsert } = await svc
        .from('birthday_messages_log')
        .insert({
          clinic_id: automation.clinic_id,
          patient_id: b.patient_id,
          year: b.year,
          status: 'skipped',
          message: text,
        })
        .select('id')
        .maybeSingle()

      if (errInsert) {
        // Conflito de unique = outra execução já está cuidando, ou já enviado
        if ((errInsert as { code?: string }).code === '23505') {
          summary.skippedAlreadySent++
          continue
        }
        summary.errors.push({
          clinic_id: automation.clinic_id,
          patient_id: b.patient_id,
          error: `lock_insert: ${errInsert.message}`,
        })
        continue
      }

      // Tenta enviar
      const result = await sendWhatsappMessage({
        clinicId: automation.clinic_id,
        phone: b.phone,
        message: text,
        purpose: 'automation',
        instanceName: (waByClinic.get(automation.clinic_id) as any)?.instance_name,
      })

      if (result.ok) {
        await svc
          .from('birthday_messages_log')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', lockRow!.id)
        summary.sent++
      } else {
        await svc
          .from('birthday_messages_log')
          .update({ status: 'error', error: result.error })
          .eq('id', lockRow!.id)
        summary.errors.push({
          clinic_id: automation.clinic_id,
          patient_id: b.patient_id,
          error: result.error,
        })
      }
    }
  }

  return NextResponse.json({ ok: true, ...summary })
}
