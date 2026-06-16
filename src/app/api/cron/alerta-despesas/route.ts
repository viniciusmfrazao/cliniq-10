import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendWhatsappMessage } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function parsePhones(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((p: any) => String(p).trim()).filter(Boolean)
  if (typeof raw === 'string') return raw.split(',').map(p => p.trim()).filter(Boolean)
  return []
}

function fmtMoney(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const svc = createServiceClient()

  // Data de hoje no fuso de São Paulo
  const nowBR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const todayISO = nowBR.toISOString().slice(0, 10)

  // Buscar clínicas com alerta_despesas ativo E com telefones configurados
  const { data: automations } = await svc
    .from('clinic_automations')
    .select('clinic_id, relatorio_telefones, alerta_despesas_dias_antes')
    .eq('alerta_despesas', true)

  if (!automations?.length) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'no clinics with alerta_despesas active' })
  }

  const results: any[] = []

  for (const auto of automations) {
    const phones = parsePhones(auto.relatorio_telefones)
    if (phones.length === 0) continue

    const diasAntes = auto.alerta_despesas_dias_antes ?? 1

    // Calcular janela: hoje até hoje + diasAntes
    const limite = new Date(nowBR)
    limite.setDate(limite.getDate() + diasAntes)
    const limiteISO = limite.toISOString().slice(0, 10)

    // Buscar saídas não pagas com vencimento na janela
    const { data: despesas } = await svc
      .from('saidas')
      .select('id, descricao, valor, data_vencimento, fornecedor, categoria_dre')
      .eq('clinic_id', auto.clinic_id)
      .eq('pago', false)
      .not('data_vencimento', 'is', null)
      .gte('data_vencimento', todayISO)
      .lte('data_vencimento', limiteISO)
      .order('data_vencimento', { ascending: true })

    if (!despesas?.length) continue

    // Separar despesas de hoje das que vencem em breve
    const hoje = despesas.filter(d => d.data_vencimento === todayISO)
    const emBreve = despesas.filter(d => d.data_vencimento !== todayISO)

    // Montar mensagem
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
      linhas.push(`📅 *Vencem em breve:*`)
      for (const d of emBreve) {
        linhas.push(`• ${fmtDate(d.data_vencimento)} — ${d.descricao}${d.fornecedor ? ` (${d.fornecedor})` : ''} — *${fmtMoney(Number(d.valor))}*`)
      }
      const totalBreve = emBreve.reduce((s, d) => s + Number(d.valor), 0)
      linhas.push(`   💰 Total em breve: *${fmtMoney(totalBreve)}*`)
    }

    const totalGeral = despesas.reduce((s, d) => s + Number(d.valor), 0)
    if (hoje.length > 0 && emBreve.length > 0) {
      linhas.push('')
      linhas.push(`📊 Total a pagar: *${fmtMoney(totalGeral)}*`)
    }

    linhas.push('')
    linhas.push('_Acesse o financeiro do Clinike para marcar como pago._')

    const message = linhas.join('\n')

    // Enviar para cada telefone configurado
    const envios: any[] = []
    for (const phone of phones) {
      try {
        const r = await sendWhatsappMessage({
          clinicId: auto.clinic_id,
          phone,
          message,
          purpose: 'automation',
        })
        envios.push({ phone, ok: r.ok })
      } catch (e: any) {
        envios.push({ phone, ok: false, error: e?.message })
      }
    }

    results.push({
      clinic_id: auto.clinic_id,
      despesas_hoje: hoje.length,
      despesas_em_breve: emBreve.length,
      envios,
    })
  }

  return NextResponse.json({ ok: true, processados: results.length, results })
}
