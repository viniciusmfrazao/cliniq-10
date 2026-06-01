import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendWhatsappMessage } from '@/lib/whatsapp'
import { logEva } from '@/lib/eva-logger'

/**
 * GET /api/cron/contato-pos
 *
 * Cron de contato pós-procedimento — roda a cada 30min.
 *
 * Para cada clínica com contato_pos_procedimento=true e módulo 'automacoes' ativo:
 *   1) Busca appointments com status='completed' e contato_pos_sent_at IS NULL
 *      cujo updated_at já passou o delay configurado (default 2h)
 *   2) Renderiza o template com os dados do atendimento
 *   3) Envia pelo WhatsApp e marca contato_pos_sent_at (idempotência)
 *
 * Variáveis: {nome}, {primeiro_nome}, {procedimento}, {profissional}, {clinica}
 * Auth: Authorization: Bearer ${CRON_SECRET}
 */

const DEFAULT_TEMPLATE = `Oi {primeiro_nome}! 💜

Passando pra saber como você está após o seu atendimento de {procedimento} aqui na {clinica}.

Sentiu algum desconforto? Tem alguma dúvida? É só chamar! Estamos à disposição 🤍`

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] || `{${key}}`)
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ ok: false, error: 'cron_not_configured' }, { status: 503 })
  if (auth !== `Bearer ${secret}`) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const dryRun = url.searchParams.get('dry') === '1'

  const svc = createServiceClient()

  // 1) Clínicas com contato pós ativo
  const { data: automations } = await svc
    .from('clinic_automations')
    .select('clinic_id, contato_pos_delay_horas, template_contato_pos')
    .eq('contato_pos_procedimento', true)

  if (!automations || automations.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, reason: 'no_clinics_enabled' })
  }

  const clinicIds = (automations as any[]).map((a) => a.clinic_id)

  // Verificar módulo automacoes ativo
  const { data: clinicsData } = await svc
    .from('clinics').select('id, settings').in('id', clinicIds)

  const clinicsWithModule = new Set<string>(
    ((clinicsData ?? []) as any[]).filter((c) => {
      const modules: string[] = c.settings?.active_modules || []
      return modules.length === 0 || modules.includes('automacoes')
    }).map((c) => c.id)
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

  const results: any[] = []
  const nowMs = Date.now()

  for (const auto of automations as any[]) {
    const { clinic_id, contato_pos_delay_horas, template_contato_pos } = auto
    if (!clinicsWithModule.has(clinic_id)) continue
    const wa = waByClinic.get(clinic_id)
    if (!wa) continue

    const delayHoras = contato_pos_delay_horas ?? 2
    const cutoff = new Date(nowMs - delayHoras * 60 * 60 * 1000).toISOString()

    const { data: appointments } = await svc
      .from('appointments')
      .select(`
        id, updated_at,
        patients(id, name, phone),
        procedures(name),
        professionals:users!appointments_professional_id_fkey(name)
      `)
      .eq('clinic_id', clinic_id)
      .eq('status', 'completed')
      .is('contato_pos_sent_at', null)
      .lte('updated_at', cutoff)
      .limit(50)

    // Buscar nome da clínica uma vez
    const { data: clinic } = await svc.from('clinics').select('name').eq('id', clinic_id).maybeSingle()
    const clinicName = (clinic as any)?.name || 'nossa clínica'

    for (const apt of (appointments ?? []) as any[]) {
      const patient = apt.patients as any
      const rawPhone = patient?.phone || ''
      if (!rawPhone) { results.push({ apt_id: apt.id, skipped: 'no_phone' }); continue }

      const vars = {
        nome: patient.name || '',
        primeiro_nome: (patient.name || '').split(' ')[0],
        procedimento: apt.procedures?.name || 'seu procedimento',
        profissional: apt.professionals?.name || '',
        clinica: clinicName,
      }

      const message = fillTemplate(template_contato_pos?.trim() || DEFAULT_TEMPLATE, vars)

      if (!dryRun) {
        await svc.from('appointments')
          .update({ contato_pos_sent_at: new Date().toISOString() })
          .eq('id', apt.id)

        const result = await sendWhatsappMessage({ clinicId: clinic_id, phone: rawPhone, message, purpose: 'automation' })

        void logEva({
          clinic_id, phone: rawPhone,
          source: 'cron-contato-pos',
          event: 'contato_pos_procedimento',
          status: result.ok ? 'ok' : 'error',
          details: { apt_id: apt.id, procedure: vars.procedimento },
          error_message: result.ok ? null : (result.error ?? 'unknown'),
        })

        results.push({ apt_id: apt.id, clinic_id, sent: result.ok })
      } else {
        results.push({ apt_id: apt.id, clinic_id, dry_run: true })
      }
    }
  }

  return NextResponse.json({
    ok: true, dryRun,
    processed: results.length,
    sent: results.filter((r) => r.sent).length,
    skipped: results.filter((r) => r.skipped).length,
    results,
  })
}
