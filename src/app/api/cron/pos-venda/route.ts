import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendAutomationContent } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Janela máxima pra olhar pra trás em busca de retornos concluídos.
// Cobre a mensagem principal (dia anterior), sequências em dias (até 60d)
// e sequências em horas (até 168h = 7 dias). Evita varrer o histórico todo.
const LOOKBACK_DAYS = 60
// Budget de segurança: a Vercel mata a função em 60s (maxDuration=60). Cada
// envio automatizado passa por whatsapp_pace_send (gap de 15-35s), então
// processar muitos retornos numa execução só estourava o timeout no meio.
// Paramos de iniciar novos envios bem antes do limite; o resto é retomado
// no próximo ciclo do cron (agora a cada 5min).
const ROUTE_BUDGET_MS = 40_000
const MAX_SENDS_PER_RUN = 15

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
  modo?: 'texto' | 'audio' | 'ambos'
  audioUrl?: string | null
  // formato antigo (compatibilidade, caso alguma clínica já tenha salvo assim)
  dias?: number
}

export async function GET(request: Request) {
  const routeStart = Date.now()
  const { searchParams } = new URL(request.url)
  const force = searchParams.get('force') === '1'
  const dryRun = searchParams.get('dry') === '1'

  const currentHour = getCurrentHourBRT()
  const now = new Date()

  const svc = createServiceClient()
  let sendsThisRun = 0
  let stoppedEarly = false
  const budgetExceeded = () => Date.now() - routeStart > ROUTE_BUDGET_MS || sendsThisRun >= MAX_SENDS_PER_RUN

  const { data: automations } = await svc
    .from('clinic_automations')
    .select(`
      clinic_id,
      pos_venda_hora,
      template_pos_venda,
      modo_pos_venda,
      audio_pos_venda,
      pos_venda_seq
    `)
    .eq('pos_venda_ativo', true)

  if (!automations?.length) return NextResponse.json({ ok: true, reason: 'sem_clinicas', enviados: 0 })

  const results: any[] = []

  for (const auto of automations) {
    if (budgetExceeded()) { stoppedEarly = true; break }
    const modoPrincipal: 'texto' | 'audio' | 'ambos' = (auto as any).modo_pos_venda ?? 'texto'
    const hasMainContent = modoPrincipal === 'audio' ? !!(auto as any).audio_pos_venda : !!auto.template_pos_venda
    if (!hasMainContent) {
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

    // Trava ANTES de enviar (insert com unique(appointment_id,tipo) já existente
    // na tabela) — se a function morrer no meio do envio, não reenvia no próximo
    // ciclo achando que ainda não foi feito.
    async function travarEnvio(appointmentId: string, tipo: string): Promise<boolean> {
      if (dryRun) return true
      const { error } = await svc.from('pos_venda_sent_log').insert({ clinic_id: auto.clinic_id, appointment_id: appointmentId, tipo })
      return !error // erro = já existe (conflito unique) ou falha — não envia
    }

    async function enviarPara(
      apt: any, template: string, tipo: string, logTipo: string,
      mode: 'texto' | 'audio' | 'ambos' = 'texto', audioUrl?: string | null,
    ) {
      const patient = apt.patients as any
      if (!patient?.phone) return false
      if (!(await travarEnvio(apt.id, logTipo))) return false
      const procName = (apt.procedures as any)?.name || ''
      const vars = {
        primeiro_nome: (patient.name || '').split(' ')[0],
        nome: patient.name || '',
        procedimento: procName,
        profissional: (apt.users as any)?.name || 'sua profissional',
        clinica: clinicName,
      }
      const msg = template ? renderTemplate(template, vars) : ''
      if (!dryRun) {
        await sendAutomationContent({ clinicId: auto.clinic_id, phone: patient.phone, mode, text: msg, audioUrl })
        sendsThisRun++
      }
      results.push({ clinic_id: auto.clinic_id, patient: patient.name, type: tipo, proc: procName })
      return true
    }

    // ── MENSAGEM 1: dispara no horário configurado, retornos concluídos ontem ──
    const targetHour = Number(auto.pos_venda_hora ?? 10)
    if (force || currentHour === targetHour) {
      const ontem = getDateBRT(-1)
      for (const apt of retornosFiltrados) {
        if (budgetExceeded()) { stoppedEarly = true; break }
        const dataApt = apt.start_time.slice(0, 10)
        if (dataApt !== ontem) continue
        if (jaEnviado.has(`${apt.id}::main`)) continue
        await enviarPara(apt, auto.template_pos_venda || '', 'msg1', 'main', modoPrincipal, (auto as any).audio_pos_venda)
      }
    }

    // ── MENSAGENS SEQUÊNCIA: em dias (respeita o horário) ou em horas (checa toda hora) ──
    const seqItems: SeqItem[] = auto.pos_venda_seq || []
    for (let idx = 0; idx < seqItems.length; idx++) {
      const seqItem = seqItems[idx]
      if (!seqItem.ativo || (!seqItem.template && !seqItem.audioUrl)) continue
      const tipoLog = `seq_${idx}`
      const unidade = seqItem.unidade || 'dias' // compat com formato antigo (só "dias")
      const valor = seqItem.valor ?? seqItem.dias ?? 0
      if (!valor) continue

      if (unidade === 'horas') {
        // Checa a cada execução do cron (independe do horário configurado):
        // qualquer retorno cujo tempo decorrido já passou do valor em horas
        // e que ainda não foi enviado.
        for (const apt of retornosFiltrados) {
          if (budgetExceeded()) { stoppedEarly = true; break }
          if (jaEnviado.has(`${apt.id}::${tipoLog}`)) continue
          const horasPassadas = (now.getTime() - new Date(apt.start_time).getTime()) / 36e5
          if (horasPassadas < valor) continue
          await enviarPara(apt, seqItem.template, `${tipoLog}_${valor}h`, tipoLog, seqItem.modo ?? 'texto', seqItem.audioUrl)
        }
      } else {
        // dias: mantém o comportamento original, só dispara no horário configurado
        if (!force && currentHour !== targetHour) continue
        const diaAlvo = getDateBRT(-valor)
        for (const apt of retornosFiltrados) {
          if (budgetExceeded()) { stoppedEarly = true; break }
          const dataApt = apt.start_time.slice(0, 10)
          if (dataApt !== diaAlvo) continue
          if (jaEnviado.has(`${apt.id}::${tipoLog}`)) continue
          await enviarPara(apt, seqItem.template, `${tipoLog}_${valor}d`, tipoLog, seqItem.modo ?? 'texto', seqItem.audioUrl)
        }
      }
      if (stoppedEarly) break
    }
    if (stoppedEarly) break
  }

  return NextResponse.json({ ok: true, dryRun, currentHour, stoppedEarly, sendsThisRun, enviados: results.filter(r => !r.skipped).length, results })
}
