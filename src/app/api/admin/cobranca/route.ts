import { NextRequest, NextResponse } from 'next/server'
import { isSuperAdmin } from '@/lib/super-admin'
import { createServiceClient } from '@/lib/supabase/server'
import { gerarPixEMV, pixParaWhatsApp } from '@/lib/pix'

const PIX_CHAVE = '09561895633'
const PIX_NOME = 'Clinike'
const PIX_CIDADE = 'Uberlandia'

export async function POST(req: NextRequest) {
  const ok = await isSuperAdmin()
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { clinic_id } = await req.json()
  if (!clinic_id) return NextResponse.json({ error: 'clinic_id obrigatorio' }, { status: 400 })

  const svc = createServiceClient()

  // Buscar dados da clínica
  const { data: clinic } = await svc
    .from('clinics')
    .select('id, name, plan_price, plan_expires_at, billing_whatsapp')
    .eq('id', clinic_id)
    .single()

  if (!clinic) return NextResponse.json({ error: 'Clínica não encontrada' }, { status: 404 })
  if (!clinic.plan_price) return NextResponse.json({ error: 'Valor do plano não configurado' }, { status: 400 })

  // Buscar WhatsApp para cobrança (billing_whatsapp ou phone do admin)
  let whatsapp = clinic.billing_whatsapp
  if (!whatsapp) {
    const { data: admin } = await svc
      .from('users')
      .select('email')
      .eq('clinic_id', clinic_id)
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle()
    if (!admin) return NextResponse.json({ error: 'Admin não encontrado. Configure o WhatsApp de cobrança.' }, { status: 400 })
  }

  // Buscar instância Evolution para envio
  const { data: settings } = await svc
    .from('app_settings')
    .select('value')
    .eq('key', 'eva_edge_url')
    .maybeSingle()

  const { data: evSettings } = await svc
    .from('app_settings')
    .select('value')
    .eq('key', 'evolution_master_key')
    .maybeSingle()

  const evUrl = process.env.EVOLUTION_API_URL || 'https://evolution-api-production-7853.up.railway.app'
  const evKey = evSettings?.value || process.env.EVOLUTION_API_KEY || ''

  // Buscar primeira instância conectada
  const { data: waInstance } = await svc
    .from('clinic_whatsapp')
    .select('instance_name')
    .eq('status', 'connected')
    .limit(1)
    .maybeSingle()

  const instance = waInstance?.instance_name || 'cliniq-182d37af-mpeka046'

  // Calcular vencimento
  const vencimento = clinic.plan_expires_at
    ? new Date(clinic.plan_expires_at).toLocaleDateString('pt-BR')
    : 'Próximo mês'

  const txid = `CLK${clinic_id.slice(0, 10).replace(/-/g, '').toUpperCase()}`
  const descricao = `Clinike - ${clinic.name.slice(0, 30)}`

  const pixPayload = gerarPixEMV({
    chave: PIX_CHAVE,
    nome: PIX_NOME,
    cidade: PIX_CIDADE,
    valor: clinic.plan_price,
    txid,
    descricao,
  })

  const mensagem = pixParaWhatsApp({
    nomePagador: clinic.name,
    valor: clinic.plan_price,
    vencimento,
    pixPayload,
  })

  // Formatar número
  const phone = String(whatsapp || '').replace(/\D/g, '')
  const phoneFmt = phone.startsWith('55') ? phone : `55${phone}`

  // Enviar mensagem via Evolution API
  const sendUrl = `${evUrl}/message/sendText/${instance}`
  const resp = await fetch(sendUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: evKey },
    body: JSON.stringify({ number: phoneFmt, text: mensagem }),
  })

  if (!resp.ok) {
    const err = await resp.text()
    return NextResponse.json({ error: `Evolution API: ${err.slice(0, 200)}` }, { status: 500 })
  }

  // Registrar envio
  await svc.from('clinics').update({ last_charge_sent_at: new Date().toISOString() }).eq('id', clinic_id)

  return NextResponse.json({ ok: true, pixPayload, phone: phoneFmt })
}
