import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendWhatsappMessage } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Janela máxima pra olhar pra trás em busca de retornos concluídos.
// Cobre a mensagem principal (dia anterior), sequências em dias (até 60d)
// e sequências em horas (até 168h = 7 dias). Evita varrer o histórico todo.
const LOOKBACK_DAYS = 60

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

type SeqItem = {
  valor: number
  unidade: 'dias' | 'horas'
  ativo: boolean
  template: string
  // formato antigo (compatibilidade, caso alguma clínica já tenha salvo assim)
  dias?: number
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const force = searchParams.get('force') === '1'
  const dryRun = searchParams.get('dry') === '1'

  const currentHour = getCurrentHourBRT()
  const now = new Date()

  const svc = createServiceClient()

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
    if (!auto.template_pos_venda) {
      results.push({ clinic_id: auto.clinic_id, skipped: 'sem_template' })
      continue
    }

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

    // Busca única de todos os retornos concluídos dentro da janela de lookback
    const desde = getDateBRT(-LOOKBACK_DAYS)
    const { data: retornos } = await svc
      .from('appointments')
      .select('id, patient_id, start_time, patients(name, phone), procedures(name), users(name)')
      .eq('clinic_id', auto.clinic_id)
      .eq('status', 'completed')
      .gte('start_time', `${desde}T00:00:00`)
      .order('start_time', { ascending: false })

    const retornosFiltrados = (retornos || []).filter(apt => isRetorno((apt.procedures as any)?.name || ''))
    if (!retornosFiltrados.length) { results.push({ clinic_id: auto.clinic_id, skipped: 'sem_retornos' }); continue }

    // Já enviados (dedupe): busca o log de uma vez pra essa clínica
    const aptIds = retornosFiltrados.map(a => a.id)
    const { data: logRows } = await svc
      .from('pos_venda_sent_log')
      .select('appointment_id, tipo')
      .eq('clinic_id', auto.clinic_id)
      .in('appointment_id', aptIds)
    const jaEnviado = new Set((logRows || []).map(r => `${r.appointment_id}::${r.tipo}`))

    async function marcarEnviado(appointmentId: string, tipo: string) {
      if (dryRun) return
      await svc.from('pos_venda_sent_log').insert({ clinic_id: auto.clinic_id, appointment_id: appointmentId, tipo }).select().maybeSingle()
    }

    async function enviarPara(apt: any, template: string, tipo: string) {
      const patient = apt.patients as any
      if (!patient?.phone) return false
      const procName = (apt.procedures as any)?.name || ''
      const vars = {
        primeiro_nome: (patient.name || '').split(' ')[0],
        nome: patient.name || '',
        procedimento: procName,
        profissional: (apt.users as any)?.name || 'sua profissional',
        clinica: clinicName,
      }
      const msg = renderTemplate(template, vars)
      if (!dryRun) await sendWhatsappMessage({ clinicId: auto.clinic_id, phone: patient.phone, message: msg, purpose: 'automation' })
      results.push({ clinic_id: auto.clinic_id, patient: patient.name, type: tipo, proc: procName })
      return true
    }

    // ── MENSAGEM 1: dispara no horário configurado, retornos concluídos ontem ──
    const targetHour = Number(auto.pos_venda_hora ?? 10)
    if (force || currentHour === targetHour) {
      const ontem = getDateBRT(-1)
      for (const apt of retornosFiltrados) {
        const dataApt = apt.start_time.slice(0, 10)
        if (dataApt !== ontem) continue
        if (jaEnviado.has(`${apt.id}::main`)) continue
        const enviou = await enviarPara(apt, auto.template_pos_venda || '', 'msg1')
        if (enviou) await marcarEnviado(apt.id, 'main')
      }
    }

    // ── MENSAGENS SEQUÊNCIA: em dias (respeita o horário) ou em horas (checa toda hora) ──
    const seqItems: SeqItem[] = auto.pos_venda_seq || []
    for (let idx = 0; idx < seqItems.length; idx++) {
      const seqItem = seqItems[idx]
      if (!seqItem.ativo || !seqItem.template) continue
      const tipoLog = `seq_${idx}`
      const unidade = seqItem.unidade || 'dias' // compat com formato antigo (só "dias")
      const valor = seqItem.valor ?? seqItem.dias ?? 0
      if (!valor) continue

      if (unidade === 'horas') {
        // Checa a cada execução do cron (independe do horário configurado):
        // qualquer retorno cujo tempo decorrido já passou do valor em horas
        // e que ainda não foi enviado.
        for (const apt of retornosFiltrados) {
          if (jaEnviado.has(`${apt.id}::${tipoLog}`)) continue
          const horasPassadas = (now.getTime() - new Date(apt.start_time).getTime()) / 36e5
          if (horasPassadas < valor) continue
          const enviou = await enviarPara(apt, seqItem.template, `${tipoLog}_${valor}h`)
          if (enviou) await marcarEnviado(apt.id, tipoLog)
        }
      } else {
        // dias: mantém o comportamento original, só dispara no horário configurado
        if (!force && currentHour !== targetHour) continue
        const diaAlvo = getDateBRT(-valor)
        for (const apt of retornosFiltrados) {
          const dataApt = apt.start_time.slice(0, 10)
          if (dataApt !== diaAlvo) continue
          if (jaEnviado.has(`${apt.id}::${tipoLog}`)) continue
          const enviou = await enviarPara(apt, seqItem.template, `${tipoLog}_${valor}d`)
          if (enviou) await marcarEnviado(apt.id, tipoLog)
        }
      }
    }
  }

  return NextResponse.json({ ok: true, dryRun, currentHour, enviados: results.filter(r => !r.skipped).length, results })
}
