import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendWhatsappMessage } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function fmtMoney(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
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
      .select('alerta_despesas, alerta_despesas_dias_antes, relatorio_telefones')
      .eq('clinic_id', clinicId)
      .maybeSingle()

    if (!automation?.alerta_despesas) {
      return NextResponse.json({ ok: false, error: 'alerta_despesas_desativado' }, { status: 400 })
    }

    const phones: string[] = Array.isArray(automation.relatorio_telefones)
      ? automation.relatorio_telefones.map((p: string) => p.trim()).filter(Boolean)
      : (typeof automation.relatorio_telefones === 'string'
        ? automation.relatorio_telefones.split(',').map((p: string) => p.trim()).filter(Boolean)
        : [])

    if (!phones.length) {
      return NextResponse.json({ ok: false, error: 'sem_telefones' }, { status: 400 })
    }

    const nowBR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
    const todayISO = nowBR.toISOString().slice(0, 10)
    const diasAntes = automation.alerta_despesas_dias_antes ?? 1
    const limite = new Date(nowBR)
    limite.setDate(limite.getDate() + diasAntes)
    const limiteISO = limite.toISOString().slice(0, 10)

    const { data: despesas } = await svc
      .from('saidas')
      .select('id, descricao, valor, data_vencimento, fornecedor, categoria_dre')
      .eq('clinic_id', clinicId)
      .eq('pago', false)
      .not('data_vencimento', 'is', null)
      .gte('data_vencimento', todayISO)
      .lte('data_vencimento', limiteISO)
      .order('data_vencimento', { ascending: true })

    if (!despesas?.length) {
      return NextResponse.json({ ok: false, error: 'sem_despesas_na_janela' }, { status: 400 })
    }

    const hoje = despesas.filter(d => d.data_vencimento === todayISO)
    const emBreve = despesas.filter(d => d.data_vencimento !== todayISO)

    const linhas: string[] = []
    linhas.push('🔔 *Alerta de Despesas*')
    linhas.push('')

    if (hoje.length > 0) {
      linhas.push('⚠️ *Vencem HOJE:*')
      for (const d of hoje) {
        linhas.push(`• ${d.descricao}${d.fornecedor ? ` (${d.fornecedor})` : ''} — *${fmtMoney(Number(d.valor))}*`)
      }
      const totalHoje = hoje.reduce((s, d) => s + Number(d.valor), 0)
      linhas.push(`   💰 Total hoje: *${fmtMoney(totalHoje)}*`)
    }

    if (emBreve.length > 0) {
      if (hoje.length > 0) linhas.push('')
      linhas.push('📅 *Vencem em breve:*')
      for (const d of emBreve) {
        linhas.push(`• ${fmtDate(d.data_vencimento)} — ${d.descricao}${d.fornecedor ? ` (${d.fornecedor})` : ''} — *${fmtMoney(Number(d.valor))}*`)
      }
      const totalBreve = emBreve.reduce((s, d) => s + Number(d.valor), 0)
      linhas.push(`   💰 Total em breve: *${fmtMoney(totalBreve)}*`)
    }

    if (hoje.length > 0 && emBreve.length > 0) {
      const totalGeral = despesas.reduce((s, d) => s + Number(d.valor), 0)
      linhas.push('')
      linhas.push(`📊 Total a pagar: *${fmtMoney(totalGeral)}*`)
    }

    linhas.push('')
    linhas.push('_Acesse o financeiro do Clinike para marcar como pago._')

    const message = linhas.join('\n')

    let sent = 0
    const results: Array<{ phone: string; ok: boolean; error?: string }> = []
    for (const phone of phones) {
      try {
        const r = await sendWhatsappMessage({ clinicId, phone, message, purpose: 'automation' })
        if (r.ok) {
          sent++
          results.push({ phone, ok: true })
        } else {
          results.push({ phone, ok: false, error: (r as any).error || 'erro_desconhecido' })
        }
      } catch (e: any) {
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
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 })
  }
}
