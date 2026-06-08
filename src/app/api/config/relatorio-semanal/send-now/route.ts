import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendWhatsappMessage } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function fmt(v: number) { return v.toLocaleString('pt-BR') }
function fmtMoney(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false, error: 'nao_autenticado' }, { status: 401 })

    const svc = createServiceClient()

    const { data: userRow } = await svc.from('users').select('clinic_id').eq('id', user.id).maybeSingle()
    if (!userRow?.clinic_id) return NextResponse.json({ ok: false, error: 'sem_clinica' }, { status: 403 })

    const clinicId = userRow.clinic_id

    const { data: automation } = await svc
      .from('clinic_automations')
      .select('relatorio_semanal, relatorio_telefones')
      .eq('clinic_id', clinicId)
      .maybeSingle()

    if (!automation?.relatorio_semanal) {
      return NextResponse.json({ ok: false, error: 'relatorio_desativado' }, { status: 400 })
    }

    const telRaw = automation.relatorio_telefones
    const phones: string[] = Array.isArray(telRaw)
      ? telRaw.map((p: string) => p.trim()).filter(Boolean)
      : (typeof telRaw === 'string' ? telRaw : '').split(',').map((p: string) => p.trim()).filter(Boolean)

    if (!phones.length) {
      return NextResponse.json({ ok: false, error: 'sem_telefones' }, { status: 400 })
    }

    const nowBR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
    const endDate = new Date(nowBR)
    endDate.setHours(23, 59, 59, 999)
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - 7)

    const dateLabel = `${startDate.toLocaleDateString('pt-BR')} a ${nowBR.toLocaleDateString('pt-BR')}`

    const { data: clinic } = await svc.from('clinics').select('name').eq('id', clinicId).single()
    const clinicName = clinic?.name || 'Clínica'

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
      .gte('created_at', startDate.toISOString())
      .lt('created_at', endDate.toISOString())

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

    // Estoque baixo
    const { data: stockData } = await svc
      .from('products').select('name, current_stock, min_stock')
      .eq('clinic_id', clinicId)
      .eq('is_active', true)

    const lowStock = (stockData || []).filter(
      (s: any) => s.min_stock !== null && Number(s.current_stock) <= Number(s.min_stock)
    )

    const linhas = [
      `📊 *Relatório — ${clinicName}*`,
      `📅 ${dateLabel}`,
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
        : null,
      ``,
      lowStock.length > 0
        ? `*📦 Estoque com baixo nível:*\n${lowStock.map((s: any) => `• ${s.name} — ${s.current_stock} un`).join('\n')}`
        : `*📦 Estoque:* ✅ Tudo em dia!`,
    ].filter(l => l !== null).join('\n')

    let sent = 0
    const results: Array<{ phone: string; ok: boolean; error?: string }> = []
    for (const phone of phones) {
      try {
        const r = await sendWhatsappMessage({ clinicId, phone, message: linhas, purpose: 'automation' })
        if (r.ok) {
          sent++
          results.push({ phone, ok: true })
        } else {
          results.push({ phone, ok: false, error: (r as any).error || 'erro_desconhecido' })
        }
      } catch (e: any) {
        console.error('Erro ao enviar para', phone, e)
        results.push({ phone, ok: false, error: String(e?.message || e) })
      }
    }

    return NextResponse.json({
      ok: sent > 0,
      sent,
      total: phones.length,
      results,
      ...(sent === 0 ? { error: results[0]?.error || 'nenhum_envio' } : {}),
    })
  } catch (e: any) {
    console.error('[send-now] erro:', e)
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 })
  }
}




