import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { gerarPixEMV, pixParaWhatsApp } from '@/lib/pix'

export const dynamic = 'force-dynamic'

const PIX_CHAVE = '09561895633'
const PIX_NOME = 'Clinike'
const PIX_CIDADE = 'Uberlandia'
const DIAS_ALERTA = 7 // Cobrar X dias antes do vencimento

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const svc = createServiceClient()
  const agora = new Date()
  const limite = new Date(agora.getTime() + DIAS_ALERTA * 24 * 60 * 60 * 1000)

  // Buscar clínicas que vencem nos próximos 7 dias E ainda não receberam cobrança hoje
  const { data: clinics } = await svc
    .from('clinics')
    .select('id, name, plan_price, plan_expires_at, billing_whatsapp, last_charge_sent_at')
    .is('deleted_at', null)
    .not('plan_price', 'is', null)
    .not('billing_whatsapp', 'is', null)
    .lte('plan_expires_at', limite.toISOString())
    .gte('plan_expires_at', agora.toISOString())

  const resultados: Array<{ clinic: string; status: string; error?: string }> = []

  const { data: evSettings } = await svc
    .from('app_settings').select('value').eq('key', 'evolution_master_key').maybeSingle()
  const evUrl = process.env.EVOLUTION_API_URL || 'https://evolution-api-production-7853.up.railway.app'
  const evKey = evSettings?.value || ''

  const { data: waInstance } = await svc
    .from('clinic_whatsapp').select('instance_name').eq('status', 'connected').limit(1).maybeSingle()
  const instance = waInstance?.instance_name || 'cliniq-182d37af-mpeka046'

  for (const clinic of (clinics || [])) {
    // Não cobrar se já enviou hoje
    if (clinic.last_charge_sent_at) {
      const lastSent = new Date(clinic.last_charge_sent_at)
      if (lastSent.toDateString() === agora.toDateString()) {
        resultados.push({ clinic: clinic.name, status: 'skip_already_sent_today' })
        continue
      }
    }

    try {
      const vencimento = new Date(clinic.plan_expires_at!).toLocaleDateString('pt-BR')
      const txid = `CLK${clinic.id.slice(0, 10).replace(/-/g, '').toUpperCase()}`
      const pixPayload = gerarPixEMV({
        chave: PIX_CHAVE, nome: PIX_NOME, cidade: PIX_CIDADE,
        valor: clinic.plan_price!, txid,
        descricao: `Clinike - ${clinic.name.slice(0, 30)}`,
      })
      const mensagem = pixParaWhatsApp({
        nomePagador: clinic.name, valor: clinic.plan_price!,
        vencimento, pixPayload,
      })

      const phone = String(clinic.billing_whatsapp).replace(/\D/g, '')
      const phoneFmt = phone.startsWith('55') ? phone : `55${phone}`

      const resp = await fetch(`${evUrl}/message/sendText/${instance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: evKey },
        body: JSON.stringify({ number: phoneFmt, text: mensagem }),
      })

      if (resp.ok) {
        await svc.from('clinics').update({ last_charge_sent_at: agora.toISOString() }).eq('id', clinic.id)
        resultados.push({ clinic: clinic.name, status: 'sent', error: undefined })
      } else {
        resultados.push({ clinic: clinic.name, status: 'error', error: `HTTP ${resp.status}` })
      }
    } catch (e: any) {
      resultados.push({ clinic: clinic.name, status: 'error', error: e.message })
    }
  }

  return NextResponse.json({ ok: true, processados: resultados.length, resultados })
}
