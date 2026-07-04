import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendWhatsappMessage } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function renderTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || `{{${key}}}`)
}

function getCurrentHourBRT(): number {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })).getHours()
}

function getDateBRT(offsetDays = 0): string {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().split('T')[0]
}

// Só dispara para agendamentos cujo procedimento contenha "retorno" no nome
function isRetorno(procName: string): boolean {
  return procName.toLowerCase().includes('retorno')
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const force = searchParams.get('force') === '1'
  const dryRun = searchParams.get('dry') === '1'

  const currentHour = getCurrentHourBRT()

  const svc = createServiceClient()

  // Buscar clínicas com pós-venda ativo
  const { data: automations } = await svc
    .from('clinic_automations')
    .select(`
      clinic_id,
      pos_venda_hora,
      template_pos_venda,
      pos_venda_seq
    `)
    .eq('pos_venda_ativo', true)

  if (!automations?.length) return NextResponse.json({ ok: true, reason: 'sem_clinicas', enviados: 0 })

  const results: any[] = []

  for (const auto of automations) {
    const targetHour = Number(auto.pos_venda_hora ?? 10)
    if (!force && currentHour !== targetHour) {
      results.push({ clinic_id: auto.clinic_id, skipped: 'fora_do_horario' })
      continue
    }

    if (!auto.template_pos_venda) {
      results.push({ clinic_id: auto.clinic_id, skipped: 'sem_template' })
      continue
    }

    // WhatsApp da clínica
    const { data: wa } = await svc
      .from('clinic_whatsapp')
      .select('instance_name, status')
      .eq('clinic_id', auto.clinic_id)
      .eq('status', 'connected')
      .limit(1)
      .maybeSingle()

    if (!wa) { results.push({ clinic_id: auto.clinic_id, skipped: 'sem_whatsapp' }); continue }

    const { data: clinic } = await svc
      .from('clinics').select('name').eq('id', auto.clinic_id).maybeSingle()
    const clinicName = clinic?.name || 'Clínica'

    // ── MENSAGEM 1: retornos concluídos ontem ──────────────────────────
    const ontem = getDateBRT(-1)
    const { data: aptsOntem } = await svc
      .from('appointments')
      .select('id, patient_id, patients(name, phone), procedures(name), users(name)')
      .eq('clinic_id', auto.clinic_id)
      .eq('status', 'completed')
      .gte('start_time', `${ontem}T00:00:00`)
      .lt('start_time', `${ontem}T23:59:59`)

    for (const apt of aptsOntem || []) {
      const procName = (apt.procedures as any)?.name || ''
      if (!isRetorno(procName)) continue

      const patient = apt.patients as any
      if (!patient?.phone) continue

      const vars = {
        primeiro_nome: (patient.name || '').split(' ')[0],
        nome: patient.name || '',
        procedimento: procName,
        profissional: (apt.users as any)?.name || 'sua profissional',
        clinica: clinicName,
      }

      const msg = renderTemplate(auto.template_pos_venda || '', vars)
      if (!dryRun) await sendWhatsappMessage({ clinicId: auto.clinic_id, phone: patient.phone, message: msg, purpose: 'automation' })
      results.push({ clinic_id: auto.clinic_id, patient: patient.name, type: 'msg1', proc: procName })
    }

    // ── MENSAGENS SEQUÊNCIA: X dias após o retorno concluído ───────────
    const seqItems = auto.pos_venda_seq || []
    for (const seqItem of seqItems) {
      if (!seqItem.ativo || !seqItem.dias || !seqItem.template) continue

      const diaAlvo = getDateBRT(-seqItem.dias)
      const { data: aptsSeq } = await svc
        .from('appointments')
        .select('id, patient_id, patients(name, phone), procedures(name), users(name)')
        .eq('clinic_id', auto.clinic_id)
        .eq('status', 'completed')
        .gte('start_time', `${diaAlvo}T00:00:00`)
        .lt('start_time', `${diaAlvo}T23:59:59`)

      for (const apt of aptsSeq || []) {
        const procName = (apt.procedures as any)?.name || ''
        if (!isRetorno(procName)) continue

        const patient = apt.patients as any
        if (!patient?.phone) continue

        const vars = {
          primeiro_nome: (patient.name || '').split(' ')[0],
          nome: patient.name || '',
          procedimento: procName,
          profissional: (apt.users as any)?.name || 'sua profissional',
          clinica: clinicName,
        }

        const msg = renderTemplate(seqItem.template, vars)
        if (!dryRun) await sendWhatsappMessage({ clinicId: auto.clinic_id, phone: patient.phone, message: msg, purpose: 'automation' })
        results.push({ clinic_id: auto.clinic_id, patient: patient.name, type: `seq_${seqItem.dias}d`, proc: procName })
      }
    }
  }

  return NextResponse.json({ ok: true, dryRun, currentHour, enviados: results.filter(r => !r.skipped).length, results })
}
