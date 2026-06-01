import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendWhatsappMessage } from '@/lib/whatsapp'
import { logEva } from '@/lib/eva-logger'

/**
 * GET /api/cron/contato-pos
 *
 * Cron de contato pós-procedimento — roda 1x por hora.
 *
 * Para cada clínica com contato_pos_procedimento=true:
 *   1) Verifica se agora é a hora configurada (contato_pos_hora, BRT)
 *   2) Busca TODOS os appointments do DIA ANTERIOR com status='completed'
 *      e contato_pos_sent_at IS NULL
 *   3) Filtra: exclui procedimentos cujas categorias estão em contato_pos_excluir_categorias
 *      (default: 'Atendimento', 'Atendimento ' — cobre Avaliação, Retorno, Consulta)
 *      Também exclui por nome: palavras como "avaliação", "retorno", "consulta"
 *   4) Envia o template pra cada paciente e marca contato_pos_sent_at
 *
 * Variáveis do template: {nome}, {primeiro_nome}, {procedimento}, {profissional}, {clinica}
 * Auth: Authorization: Bearer ${CRON_SECRET}
 */

const TZ = 'America/Sao_Paulo'

const DEFAULT_TEMPLATE = `Oi {primeiro_nome}! 💜

Passando pra saber como você está após o seu atendimento de {procedimento} aqui na {clinica}.

Sentiu algum desconforto? Tem alguma dúvida? É só chamar! Estamos à disposição 🤍`

// Nomes de procedimento que indicam consulta/avaliação — sempre excluídos
const EXCLUDE_NAME_PATTERNS = [
  /avalia[çc][aã]o/i,
  /consulta/i,
  /retorno/i,
  /triagem/i,
]

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] || `{${key}}`)
}

function getCurrentHourBRT(): number {
  return parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', hour12: false })
      .format(new Date()),
    10,
  )
}

function getYesterdayRangeBRT(): { start: string; end: string } {
  // Calcula início e fim do dia anterior em BRT como UTC ISO strings
  const now = new Date()
  const brFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const todayBRT = brFormatter.format(now) // YYYY-MM-DD

  // Ontem BRT
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayBRT = brFormatter.format(yesterday)

  // 00:00 e 23:59:59 de ontem em BRT → UTC
  const start = new Date(`${yesterdayBRT}T00:00:00-03:00`).toISOString()
  const end = new Date(`${yesterdayBRT}T23:59:59-03:00`).toISOString()

  return { start, end }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ ok: false, error: 'cron_not_configured' }, { status: 503 })
  if (auth !== `Bearer ${secret}`) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const dryRun = url.searchParams.get('dry') === '1'
  const force = url.searchParams.get('force') === '1' // ignora verificação de hora

  const currentHour = getCurrentHourBRT()
  const svc = createServiceClient()

  // Clínicas com contato pós ativo
  const { data: automations } = await svc
    .from('clinic_automations')
    .select('clinic_id, contato_pos_hora, template_contato_pos, contato_pos_excluir_categorias')
    .eq('contato_pos_procedimento', true)

  if (!automations || automations.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, reason: 'no_clinics_enabled' })
  }

  const clinicIds = (automations as any[]).map((a) => a.clinic_id)

  // Verificar módulo automacoes ativo
  const { data: clinicsData } = await svc
    .from('clinics').select('id, settings, name').in('id', clinicIds)

  const clinicMap = new Map<string, { name: string; hasModule: boolean }>(
    ((clinicsData ?? []) as any[]).map((c) => {
      const modules: string[] = c.settings?.active_modules || []
      return [c.id, {
        name: c.name,
        hasModule: modules.length === 0 || modules.includes('automacoes'),
      }]
    })
  )

  // WhatsApp conectado por clínica
  const { data: waList } = await svc
    .from('clinic_whatsapp')
    .select('clinic_id, instance_name, status, is_default, role_outbound_automation')
    .in('clinic_id', clinicIds)
    .eq('status', 'connected')

  const waByClinic = new Map<string, any>()
  for (const w of (waList ?? []) as any[]) {
    const score = (r: any) => (r.role_outbound_automation ? 2 : 0) + (r.is_default ? 1 : 0)
    const existing = waByClinic.get(w.clinic_id)
    if (!existing || score(w) > score(existing)) waByClinic.set(w.clinic_id, w)
  }

  const { start: rangeStart, end: rangeEnd } = getYesterdayRangeBRT()
  const results: any[] = []
  let skippedWrongHour = 0

  for (const auto of automations as any[]) {
    const { clinic_id, contato_pos_hora, template_contato_pos, contato_pos_excluir_categorias } = auto

    const clinic = clinicMap.get(clinic_id)
    if (!clinic?.hasModule) continue

    const wa = waByClinic.get(clinic_id)
    if (!wa) { results.push({ clinic_id, skipped: 'wa_not_connected' }); continue }

    // Verificar se é a hora certa pra essa clínica
    const targetHour = contato_pos_hora ?? 10
    if (!force && currentHour !== targetHour) {
      skippedWrongHour++
      continue
    }

    // Categorias a excluir (default cobre "Atendimento" e variações com espaço)
    const excludeCats: string[] = contato_pos_excluir_categorias ?? ['Atendimento', 'Atendimento ']

    // Buscar atendimentos do dia anterior finalizados
    const { data: appointments } = await svc
      .from('appointments')
      .select(`
        id, start_time,
        patients(id, name, phone),
        procedures(id, name, category),
        professionals:users!appointments_professional_id_fkey(name)
      `)
      .eq('clinic_id', clinic_id)
      .eq('status', 'completed')
      .is('contato_pos_sent_at', null)
      .gte('start_time', rangeStart)
      .lte('start_time', rangeEnd)
      .limit(200)

    for (const apt of (appointments ?? []) as any[]) {
      const proc = apt.procedures as any
      const patient = apt.patients as any

      // Filtro de categoria
      const procCategory = (proc?.category || '').trim()
      if (excludeCats.some(cat => cat.trim().toLowerCase() === procCategory.toLowerCase())) {
        results.push({ apt_id: apt.id, skipped: `categoria_excluida:${procCategory}` })
        continue
      }

      // Filtro por nome do procedimento (avaliação, retorno, consulta, etc.)
      const procName = proc?.name || ''
      if (EXCLUDE_NAME_PATTERNS.some(p => p.test(procName))) {
        results.push({ apt_id: apt.id, skipped: `nome_excluido:${procName}` })
        continue
      }

      const rawPhone = patient?.phone || ''
      if (!rawPhone) { results.push({ apt_id: apt.id, skipped: 'no_phone' }); continue }

      const vars = {
        nome: patient.name || '',
        primeiro_nome: (patient.name || '').split(' ')[0],
        procedimento: procName || 'seu procedimento',
        profissional: apt.professionals?.name || '',
        clinica: clinic.name,
      }

      const message = fillTemplate(template_contato_pos?.trim() || DEFAULT_TEMPLATE, vars)

      if (!dryRun) {
        // Marca antes de enviar (idempotência)
        await svc.from('appointments')
          .update({ contato_pos_sent_at: new Date().toISOString() })
          .eq('id', apt.id)

        const result = await sendWhatsappMessage({
          clinicId: clinic_id, phone: rawPhone, message, purpose: 'automation',
        })

        void logEva({
          clinic_id, phone: rawPhone,
          source: 'cron-contato-pos',
          event: 'contato_pos_procedimento',
          status: result.ok ? 'ok' : 'error',
          details: { apt_id: apt.id, procedure: vars.procedimento, target_hour: targetHour },
          error_message: result.ok ? null : (result.error ?? 'unknown'),
        })

        results.push({ apt_id: apt.id, clinic_id, procedure: vars.procedimento, sent: result.ok })
      } else {
        results.push({ apt_id: apt.id, clinic_id, procedure: vars.procedimento, dry_run: true })
      }
    }
  }

  return NextResponse.json({
    ok: true, dryRun, currentHour,
    processed: results.filter(r => r.sent || r.dry_run).length,
    sent: results.filter(r => r.sent).length,
    skipped: results.filter(r => r.skipped).length,
    skipped_wrong_hour: skippedWrongHour,
    date_range: { start: rangeStart, end: rangeEnd },
    results,
  })
}
