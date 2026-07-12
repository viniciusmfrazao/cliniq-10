import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendAutomationContent } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Budget de segurança: a Vercel mata a função em 60s (maxDuration acima).
// O envio automatizado passa por whatsapp_pace_send (gap de 15-35s por
// instância), então cada mensagem pode levar até ~35s. Paramos de iniciar
// novos envios bem antes do limite pra função encerrar graciosamente —
// o que sobrar fica pra ser pego no próximo ciclo do cron (que agora roda
// a cada 5min, não mais 1x/hora).
const ROUTE_BUDGET_MS = 40_000
const MAX_SENDS_PER_RUN = 15

function renderTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || `{{${key}}}`)
}

function getCurrentHourBRT(): number {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })).getHours()
}

// Limites (início/fim, ISO UTC) de um único dia civil em BRT, com offset em
// dias a partir de hoje. BRT é UTC-3 fixo (sem horário de verão desde 2019).
function getBRTDayBoundsISO(offsetDays: number): { startISO: string; endISO: string } {
  const nowBR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const y = nowBR.getFullYear()
  const m = nowBR.getMonth()
  const d = nowBR.getDate() + offsetDays
  const startUTC = new Date(Date.UTC(y, m, d, 3, 0, 0)) // 00:00 BRT = 03:00 UTC
  const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000) // próximo 00:00 BRT (exclusivo)
  return { startISO: startUTC.toISOString(), endISO: endUTC.toISOString() }
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
      modo_contato_pos,
      audio_contato_pos,
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

    // ── MENSAGEM 1: atendimentos concluídos ONTEM (dia civil BRT) ───────
    // A janela larga (lookback de 3 dias até "agora") pegava atendimento de
    // HOJE também, mas o template pressupõe "ontem" — paciente que fez
    // procedimento de manhã recebia a mensagem de pós-venda à tarde do
    // mesmo dia. Restrito ao dia civil de ontem; catch-up continua via
    // contato_pos_sent_at IS NULL + cron a cada 5min pelo resto do dia.
    const { startISO: ontemStart, endISO: ontemEnd } = getBRTDayBoundsISO(-1)
    const { data: aptsOntem } = await svc
      .from('appointments')
      .select('id, patient_id, patients(name, phone), procedures(name), users(name)')
      .eq('clinic_id', auto.clinic_id)
      .eq('status', 'completed')
      .gte('start_time', ontemStart)
      .lt('start_time', ontemEnd)
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

      const modo1: 'texto' | 'audio' | 'ambos' = (auto as any).modo_contato_pos ?? 'texto'
      const msg = renderTemplate(auto.template_contato_pos || '', vars)
      if (!dryRun) {
        const sendResult = await sendAutomationContent({ clinicId: auto.clinic_id, phone: patient.phone, mode: modo1, text: msg, audioUrl: (auto as any).audio_contato_pos })
        if (sendResult.ok) {
          sendsThisRun++
        } else {
          // Falha transitória (pacer anti-ban): desfaz a trava pra o
          // próximo ciclo tentar de novo — sem isso ficava marcado como
          // "enviado" sem a mensagem ter saído de fato.
          if (sendResult.code === 'rate_limited') {
            await svc.from('appointments').update({ contato_pos_sent_at: null }).eq('id', apt.id)
          }
          results.push({ clinic_id: auto.clinic_id, patient: patient.name, type: 'msg1', proc: procName, error: sendResult.error })
          continue
        }
      }
      results.push({ clinic_id: auto.clinic_id, patient: patient.name, type: 'msg1', proc: procName })
    }

    // ── MENSAGENS SEQUÊNCIA: X dias após o procedimento ────────────────
    const seqItems = auto.contato_pos_seq || []
    for (const seqItem of seqItems) {
      if (!seqItem.ativo || !seqItem.dias || (!seqItem.template && !seqItem.audioUrl)) continue

      const tipo = `legado_seq_${seqItem.dias}d`
      // Janela larga de 5 dias de lookback pegava atendimento fora do dia
      // que o template da sequência pressupõe (ex.: "faz 7 dias que você
      // fez X"), disparando a mensagem cedo ou tarde demais. Restrito ao
      // dia civil exato "hoje - X dias"; catch-up dentro do próprio dia
      // continua garantido pelo unique(appointment_id, tipo) em
      // pos_venda_sent_log + cron a cada 5min.
      const { startISO: diaAlvoStart, endISO: diaAlvoEnd } = getBRTDayBoundsISO(-seqItem.dias)
      const { data: aptsSeq } = await svc
        .from('appointments')
        .select('id, patient_id, patients(name, phone), procedures(name), users(name)')
        .eq('clinic_id', auto.clinic_id)
        .eq('status', 'completed')
        .gte('start_time', diaAlvoStart)
        .lt('start_time', diaAlvoEnd)

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

        const modoSeq: 'texto' | 'audio' | 'ambos' = seqItem.modo ?? 'texto'
        const msg = seqItem.template ? renderTemplate(seqItem.template, vars) : ''
        if (!dryRun) {
          const sendResult = await sendAutomationContent({ clinicId: auto.clinic_id, phone: patient.phone, mode: modoSeq, text: msg, audioUrl: seqItem.audioUrl })
          if (sendResult.ok) {
            sendsThisRun++
          } else {
            // Falha transitória (pacer anti-ban): desfaz o lock (apaga a
            // linha de log) pra o próximo ciclo tentar de novo — sem isso
            // ficava marcado como "enviado" sem a mensagem ter saído.
            if (sendResult.code === 'rate_limited') {
              await svc.from('pos_venda_sent_log').delete().eq('clinic_id', auto.clinic_id).eq('appointment_id', apt.id).eq('tipo', tipo)
            }
            results.push({ clinic_id: auto.clinic_id, patient: patient.name, type: tipo, proc: procName, error: sendResult.error })
            continue
          }
        }
        results.push({ clinic_id: auto.clinic_id, patient: patient.name, type: tipo, proc: procName })
      }
    }
  }

  return NextResponse.json({ ok: true, dryRun, currentHour, stoppedEarly, sendsThisRun, enviados: results.filter(r => !r.skipped).length, results })
}
