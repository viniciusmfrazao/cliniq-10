import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendWhatsappMessage } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function fmt(v: number) { return v.toLocaleString('pt-BR') }
function fmtMoney(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const svc = createServiceClient()
  const nowBR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const hour = `${String(nowBR.getHours()).padStart(2,'0')}:${String(nowBR.getMinutes()).padStart(2,'0')}`
  const dayOfWeek = nowBR.getDay() // 0=dom, 1=seg

  const { data: automations } = await svc
    .from('clinic_automations')
    .select('clinic_id, relatorio_telefones, relatorio_hora, relatorio_dia')
    .eq('relatorio_semanal', true)
    .eq('relatorio_dia', dayOfWeek)
    .eq('relatorio_hora', hour)

  if (!automations?.length) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'no clinics scheduled now' })
  }

  const results = []

  for (const auto of automations) {
    const clinicId = auto.clinic_id
    const phones: string[] = (auto.relatorio_telefones || '')
      .split(',').map((p: string) => p.trim()).filter(Boolean)
    if (!phones.length) continue

    // Período: semana passada (seg a dom)
    const endDate = new Date(nowBR)
    endDate.setHours(0, 0, 0, 0)
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - 7)

    const dateLabel = `${startDate.toLocaleDateString('pt-BR')} a ${new Date(endDate.getTime() - 86400000).toLocaleDateString('pt-BR')}`

    const { data: clinic } = await svc.from('clinics').select('name').eq('id', clinicId).single()
    const clinicName = clinic?.name || 'Clínica'

    // Agendamentos
    const { data: appts } = await svc
      .from('appointments').select('id, status')
      .eq('clinic_id', clinicId)
      .gte('start_time', startDate.toISOString())
      .lt('start_time', endDate.toISOString())

    const total = appts?.length || 0
    const realizados = appts?.filter(a => a.status === 'completed').length || 0
    const cancelados = appts?.filter(a => a.status === 'cancelled').length || 0
    const naoCompareceu = appts?.filter(a => a.status === 'no_show').length || 0

    // Faturamento
    const { data: entradas } = await svc
      .from('entradas').select('valor_bruto')
      .eq('clinic_id', clinicId)
      .gte('created_at', startDate.toISOString())
      .lt('created_at', endDate.toISOString())

    const faturamento = (entradas || []).reduce((s, e) => s + Number(e.valor_bruto || 0), 0)
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

    // Estoque baixo
    const { data: stockItems } = await svc
      .from('stock_items').select('name, quantity, min_quantity')
      .eq('clinic_id', clinicId).not('min_quantity', 'is', null)

    const lowStock = (stockItems || []).filter(
      s => Number(s.quantity) <= Number(s.min_quantity)
    )

    const linhas = [
      `📊 *Relatório Semanal — ${clinicName}*`,
      `📅 Semana de ${dateLabel}`,
      ``,
      `*Agendamentos*`,
      `• Total agendado: ${fmt(total)}`,
      `• ✅ Realizados: ${fmt(realizados)}`,
      `• ❌ Cancelamentos: ${fmt(cancelados)}`,
      `• 👻 Não compareceram: ${fmt(naoCompareceu)}`,
      `• 🆕 Novos pacientes: ${fmt(novos || 0)}`,
      ``,
      `*Financeiro*`,
      `• 💰 Faturamento: ${fmtMoney(faturamento)}`,
      realizados > 0 ? `• 💳 Ticket médio: ${fmtMoney(ticketMedio)}` : null,
      ``,
      topProcs.length > 0
        ? `*🏆 Procedimentos realizados:*\n${topProcs.map(([n, c]) => `• ${n} — ${c}x`).join('\n')}`
        : `*Procedimentos:* Nenhum realizado na semana`,
      ``,
      lowStock.length > 0
        ? `*📦 Estoque com baixo nível:*\n${lowStock.map(s => `• ${s.name} — ${s.quantity} un`).join('\n')}`
        : `*📦 Estoque:* ✅ Tudo em dia!`,
    ].filter(l => l !== null).join('\n')

    for (const phone of phones) {
      try {
        await sendWhatsappMessage({ clinicId, phone, message: linhas, purpose: 'any' })
      } catch (e) {
        console.error('Erro ao enviar relatório para', phone, e)
      }
    }

    results.push({ clinic: clinicName, phones: phones.length, realizados, faturamento })
  }

  return NextResponse.json({ ok: true, sent: results.length, results })
}
