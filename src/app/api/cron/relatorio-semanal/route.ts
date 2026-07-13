import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendWhatsappMessage } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function fmt(v: number) { return v.toLocaleString('pt-BR') }
function fmtMoney(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function parsePhones(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((p: any) => String(p).trim()).filter(Boolean)
  }
  if (typeof raw === 'string') {
    return raw.split(',').map(p => p.trim()).filter(Boolean)
  }
  return []
}

// Budget de segurança: a Vercel mata a função em 60s (maxDuration=60).
const ROUTE_BUDGET_MS = 40_000

export async function GET(req: NextRequest) {
  const routeStart = Date.now()
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const svc = createServiceClient()
  const nowBR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const currentHour = nowBR.getHours()
  const dayOfWeek = nowBR.getDay() // 0=dom, 1=seg
  const todayISO = nowBR.toISOString().slice(0, 10)

  const { data: automations } = await svc
    .from('clinic_automations')
    .select('clinic_id, relatorio_telefones, relatorio_hora, relatorio_dia, last_relatorio_sent_at')
    .eq('relatorio_semanal', true)
    .eq('relatorio_dia', dayOfWeek)

  if (!automations?.length) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'no clinics for this weekday', dayOfWeek })
  }

  const results: any[] = []

  let stoppedEarly = false
  for (const auto of automations) {
    if (Date.now() - routeStart > ROUTE_BUDGET_MS) { stoppedEarly = true; break }

    // Janela de hora: compara só a hora, ignora os minutos
    // ex: configurado '10:00' aceita execucoes entre 10:00 e 10:59
    const configHour = parseInt(String(auto.relatorio_hora ?? '10:00').split(':')[0], 10)
    if (isNaN(configHour) || currentHour !== configHour) {
      results.push({ clinic_id: auto.clinic_id, skipped: 'hour_mismatch', expected: configHour, got: currentHour })
      continue
    }

    // Idempotencia: se ja enviou hoje, pula
    const lastSent = auto.last_relatorio_sent_at ? String(auto.last_relatorio_sent_at).slice(0, 10) : null
    if (lastSent === todayISO) {
      results.push({ clinic_id: auto.clinic_id, skipped: 'already_sent_today' })
      continue
    }

    const clinicId = auto.clinic_id
    const phones = parsePhones(auto.relatorio_telefones)
    if (!phones.length) {
      results.push({ clinic_id: clinicId, skipped: 'no_phones' })
      continue
    }

    // Periodo: ultimos 7 dias
    const endDate = new Date(nowBR)
    endDate.setHours(23, 59, 59, 999)
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - 7)

    const dateLabel = `${startDate.toLocaleDateString('pt-BR')} a ${nowBR.toLocaleDateString('pt-BR')}`

    const { data: clinic } = await svc.from('clinics').select('name').eq('id', clinicId).single()
    const clinicName = clinic?.name || 'Clinica'

    // Agendamentos
    const { data: appts } = await svc
      .from('appointments').select('id, status')
      .eq('clinic_id', clinicId)
      .gte('start_time', startDate.toISOString())
      .lt('start_time', endDate.toISOString())

    const total = appts?.length || 0
    const realizados = appts?.filter((a: any) => a.status === 'completed').length || 0
    const cancelados = appts?.filter((a: any) => a.status === 'cancelled').length || 0
    const naoCompareceu = appts?.filter((a: any) => a.status === 'no_show').length || 0

    // Faturamento
    const { data: entradas } = await svc
      .from('entradas').select('valor_bruto')
      .eq('clinic_id', clinicId)
      .gte('data_venda', startDate.toISOString().slice(0, 10))
      .lte('data_venda', endDate.toISOString().slice(0, 10))

    const faturamento = (entradas || []).reduce((s: number, e: any) => s + Number(e.valor_bruto || 0), 0)
    const ticketMedio = realizados > 0 ? faturamento / realizados : 0

    // Novos pacientes
    const { count: novos } = await svc
      .from('patients').select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .gte('created_at', startDate.toISOString())
      .lt('created_at', endDate.toISOString())

    // Procedimentos realizados
    const { data: procData } = await svc
      .from('appointments').select('procedures(name)')
      .eq('clinic_id', clinicId).eq('status', 'completed')
      .gte('start_time', startDate.toISOString())
      .lt('start_time', endDate.toISOString())

    const procCount: Record<string, number> = {}
    for (const a of procData || []) {
      const name = (a.procedures as any)?.name
      if (name) procCount[name] = (procCount[name] || 0) + 1
    }
    const topProcs = Object.entries(procCount).sort((a, b) => b[1] - a[1]).slice(0, 8)

    // Estoque baixo (tabela correta: products)
    const { data: stockData } = await svc
      .from('products').select('name, current_stock, min_stock')
      .eq('clinic_id', clinicId)
      .eq('is_active', true)

    const lowStock = (stockData || []).filter(
      (s: any) => s.min_stock !== null && Number(s.current_stock) <= Number(s.min_stock)
    )

    const linhas = [
      `📊 *Relatorio Semanal — ${clinicName}*`,
      `📅 ${dateLabel}`,
      ``,
      `*Agendamentos*`,
      `• Total agendado: ${fmt(total)}`,
      `• ✅ Realizados: ${fmt(realizados)}`,
      `• ❌ Cancelamentos: ${fmt(cancelados)}`,
      `• 👻 Nao compareceram: ${fmt(naoCompareceu)}`,
      `• 🆕 Novos pacientes: ${fmt(novos || 0)}`,
      ``,
      `*Financeiro*`,
      `• 💰 Faturamento: ${fmtMoney(faturamento)}`,
      realizados > 0 ? `• 💳 Ticket medio: ${fmtMoney(ticketMedio)}` : null,
      ``,
      topProcs.length > 0
        ? `*🏆 Procedimentos realizados:*\n${topProcs.map(([n, c]) => `• ${n} — ${c}x`).join('\n')}`
        : null,
      ``,
      lowStock.length > 0
        ? `*📦 Estoque com baixo nivel:*\n${lowStock.map((s: any) => `• ${s.name} — ${s.current_stock} un`).join('\n')}`
        : `*📦 Estoque:* ✅ Tudo em dia!`,
    ].filter(l => l !== null).join('\n')

    // Trava atômica ANTES de enviar: o UPDATE só pega a linha se ela ainda
    // NÃO foi marcada hoje — condição avaliada no banco, não no JS. Isso
    // corrige o reenvio a cada 10min (a SELECT inicial retornava
    // last_relatorio_sent_at stale, então o check em JS nunca barrava) e
    // também protege contra duas execuções concorrentes: quem "perde" o
    // update recebe 0 linhas e pula o envio.
    const todayStartBR = `${todayISO}T00:00:00-03:00`
    const { data: lockedRows } = await svc
      .from('clinic_automations')
      .update({ last_relatorio_sent_at: new Date().toISOString() })
      .eq('clinic_id', clinicId)
      .eq('relatorio_semanal', true)
      .or(`last_relatorio_sent_at.is.null,last_relatorio_sent_at.lt.${todayStartBR}`)
      .select('clinic_id')
    if (!lockedRows || lockedRows.length === 0) {
      results.push({ clinic_id: clinicId, skipped: 'already_sent_today_or_locked' })
      continue
    }

    let sentForClinic = 0
    const sendResults: any[] = []
    for (const phone of phones) {
      try {
        const r = await sendWhatsappMessage({ clinicId, phone, message: linhas, purpose: 'automation' })
        if (r.ok) {
          sentForClinic++
          sendResults.push({ phone, ok: true })
        } else {
          sendResults.push({ phone, ok: false, error: (r as any).error })
        }
      } catch (e: any) {
        sendResults.push({ phone, ok: false, error: String(e?.message || e) })
      }
    }

    results.push({
      clinic_id: clinicId,
      clinic: clinicName,
      phones: phones.length,
      sent: sentForClinic,
      realizados,
      faturamento,
      sendResults,
    })
  }

  const totalSent = results.reduce((s, r) => s + (r.sent || 0), 0)
  return NextResponse.json({ ok: true, sent: totalSent, clinics: results.length, stoppedEarly, results })
}
