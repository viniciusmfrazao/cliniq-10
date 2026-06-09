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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const force = searchParams.get('force') === '1'
  const dryRun = searchParams.get('dry') === '1'

  const currentHour = getCurrentHourBRT()

  const svc = createServiceClient()

  // Buscar clínicas com contato-pos ativo
  const { data: automations } = await svc
    .from('clinic_automations')
    .select(`
      clinic_id,
      contato_pos_hora,
      template_contato_pos,
      contato_pos_excluir_categorias,
      contato_pos_seq
    `)
    .eq('contato_pos_procedimento', true)

  if (!automations?.length) return NextResponse.json({ ok: true, reason: 'sem_clinicas', enviados: 0 })

  const results: any[] = []

  for (const auto of automations) {
    const targetHour = Number(auto.contato_pos_hora ?? 10)
    if (!force && currentHour !== targetHour) {
      results.push({ clinic_id: auto.clinic_id, skipped: 'fora_do_horario' })
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

    const excluirCats: string[] = auto.contato_pos_excluir_categorias || []
    const EXCLUIR_NOMES = ['avalia', 'retorno', 'consulta', ...excluirCats.map((c: string) => c.toLowerCase())]

    // ── MENSAGEM 1: atendimentos de ontem ──────────────────────────────
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
      if (EXCLUIR_NOMES.some(e => procName.toLowerCase().includes(e))) continue

      const patient = apt.patients as any
      if (!patient?.phone) continue

      const vars = {
        primeiro_nome: (patient.name || '').split(' ')[0],
        nome: patient.name || '',
        procedimento: procName,
        profissional: (apt.users as any)?.name || 'sua profissional',
        clinica: clinicName,
      }

      const msg = renderTemplate(auto.template_contato_pos || '', vars)
      if (!dryRun) await sendWhatsappMessage({ clinicId: auto.clinic_id, phone: patient.phone, message: msg, purpose: 'automation' })
      results.push({ clinic_id: auto.clinic_id, patient: patient.name, type: 'msg1', proc: procName })
    }

    // ── MENSAGENS SEQUÊNCIA: X dias após o procedimento ────────────────
    const seqItems = auto.contato_pos_seq || []
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
        if (EXCLUIR_NOMES.some(e => procName.toLowerCase().includes(e))) continue

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
