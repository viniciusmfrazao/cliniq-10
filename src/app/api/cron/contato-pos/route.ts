import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendWhatsappMessage } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Budget de segurança: a Vercel mata a função em 60s (maxDuration acima).
// O envio automatizado passa por whatsapp_pace_send (gap de 15-35s por
// instância), então cada mensagem pode levar até ~35s. Paramos de iniciar
// novos envios bem antes do limite pra função encerrar graciosamente —
// o que sobrar fica pra ser pego no próximo ciclo do cron (que agora roda
// a cada 5min, não mais 1x/hora).
const ROUTE_BUDGET_MS = 40_000
const MAX_SENDS_PER_RUN = 4

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
  const routeStart = Date.now()
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
  let sendsThisRun = 0
  let stoppedEarly = false

  outer:
  for (const auto of automations) {
    const targetHour = Number(auto.contato_pos_hora ?? 10)
    // Antes exigia currentHour === targetHour (só disparava numa janela de 1h
    // por dia). Se o cron travasse ou o timeout cortasse o lote, o resto
    // nunca mais era retomado (só no dia seguinte). Agora: dispara a partir
    // da hora configurada e continua tentando o resto do dia, até esvaziar
    // a fila (idempotência garante que não duplica).
    if (!force && currentHour < targetHour) {
      results.push({ clinic_id: auto.clinic_id, skipped: 'fora_do_horario' })
      continue
    }

    if (Date.now() - routeStart > ROUTE_BUDGET_MS || sendsThisRun >= MAX_SENDS_PER_RUN) {
      stoppedEarly = true
      break
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

    // ── MENSAGEM 1: atendimentos concluídos recentemente ────────────────
    // Antes filtrava só "ontem" (dia fixo): se o envio não rolasse naquele
    // único dia, o atendimento nunca mais caía na query e ficava órfão pra
    // sempre. Agora usa uma janela de lookback (3 dias) — como o filtro
    // real de dedupe é contato_pos_sent_at IS NULL, todo run reconsidera o
    // que ainda não foi enviado até conseguir, sem duplicar.
    const lookbackFloor = getDateBRT(-3)
    const { data: aptsOntem } = await svc
      .from('appointments')
      .select('id, patient_id, patients(name, phone), procedures(name), users(name)')
      .eq('clinic_id', auto.clinic_id)
      .eq('status', 'completed')
      .gte('start_time', `${lookbackFloor}T00:00:00`)
      .lt('start_time', new Date().toISOString())
      .is('contato_pos_sent_at', null)

    for (const apt of aptsOntem || []) {
      if (Date.now() - routeStart > ROUTE_BUDGET_MS || sendsThisRun >= MAX_SENDS_PER_RUN) {
        stoppedEarly = true
        break outer
      }

      const procName = (apt.procedures as any)?.name || ''
      if (EXCLUIR_NOMES.some(e => procName.toLowerCase().includes(e))) continue

      const patient = apt.patients as any
      if (!patient?.phone) continue

      // Lock idempotente ANTES do envio (mesmo padrão do msg-agendamento /
      // appointment-reminders): se outra invocação concorrente já pegou
      // esse appointment, o update abaixo não afeta nenhuma linha e pulamos.
      if (!dryRun) {
        const { data: locked } = await svc
          .from('appointments')
          .update({ contato_pos_sent_at: new Date().toISOString() })
          .eq('id', apt.id)
          .is('contato_pos_sent_at', null)
          .select('id')
        if (!locked || locked.length === 0) continue
      }

      const vars = {
        primeiro_nome: (patient.name || '').split(' ')[0],
        nome: patient.name || '',
        procedimento: procName,
        profissional: (apt.users as any)?.name || 'sua profissional',
        clinica: clinicName,
      }

      const msg = renderTemplate(auto.template_contato_pos || '', vars)
      if (!dryRun) {
        await sendWhatsappMessage({ clinicId: auto.clinic_id, phone: patient.phone, message: msg, purpose: 'automation' })
        sendsThisRun++
      }
      results.push({ clinic_id: auto.clinic_id, patient: patient.name, type: 'msg1', proc: procName })
    }

    // ── MENSAGENS SEQUÊNCIA: X dias após o procedimento ────────────────
    const seqItems = auto.contato_pos_seq || []
    for (const seqItem of seqItems) {
      if (!seqItem.ativo || !seqItem.dias || !seqItem.template) continue

      const tipo = `legado_seq_${seqItem.dias}d`
      // Antes buscava só o dia exato "hoje - X dias" — se não enviasse
      // naquele dia, o agendamento nunca mais caía na query (órfão pra
      // sempre). Agora usa uma janela de catch-up de 5 dias; o dedupe real
      // já é feito pelo unique(appointment_id, tipo) em pos_venda_sent_log,
      // então alargar a janela não duplica envio, só evita perder.
      const diaAlvo = getDateBRT(-seqItem.dias)
      const diaAlvoFloor = getDateBRT(-seqItem.dias - 5)
      const { data: aptsSeq } = await svc
        .from('appointments')
        .select('id, patient_id, patients(name, phone), procedures(name), users(name)')
        .eq('clinic_id', auto.clinic_id)
        .eq('status', 'completed')
        .gte('start_time', `${diaAlvoFloor}T00:00:00`)
        .lt('start_time', `${diaAlvo}T23:59:59`)

      for (const apt of aptsSeq || []) {
        if (Date.now() - routeStart > ROUTE_BUDGET_MS || sendsThisRun >= MAX_SENDS_PER_RUN) {
          stoppedEarly = true
          break outer
        }

        const procName = (apt.procedures as any)?.name || ''
        if (EXCLUIR_NOMES.some(e => procName.toLowerCase().includes(e))) continue

        const patient = apt.patients as any
        if (!patient?.phone) continue

        // Dedup via pos_venda_sent_log (mesma tabela usada pela automação
        // nova de pós-venda — unique(appointment_id, tipo) garante que a
        // linha só é inserida uma vez, funcionando como lock atômico).
        if (!dryRun) {
          const { error: lockErr } = await svc
            .from('pos_venda_sent_log')
            .insert({ clinic_id: auto.clinic_id, appointment_id: apt.id, tipo })
          if (lockErr) continue // já enviado (conflito de unique) ou erro — não reenvia
        }

        const vars = {
          primeiro_nome: (patient.name || '').split(' ')[0],
          nome: patient.name || '',
          procedimento: procName,
          profissional: (apt.users as any)?.name || 'sua profissional',
          clinica: clinicName,
        }

        const msg = renderTemplate(seqItem.template, vars)
        if (!dryRun) {
          await sendWhatsappMessage({ clinicId: auto.clinic_id, phone: patient.phone, message: msg, purpose: 'automation' })
          sendsThisRun++
        }
        results.push({ clinic_id: auto.clinic_id, patient: patient.name, type: tipo, proc: procName })
      }
    }
  }

  return NextResponse.json({ ok: true, dryRun, currentHour, stoppedEarly, sendsThisRun, enviados: results.filter(r => !r.skipped).length, results })
}
