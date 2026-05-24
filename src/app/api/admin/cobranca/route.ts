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

  // Buscar dados da clínica — usa clinic_phone como destino da cobrança
  const { data: clinic } = await svc
    .from('clinics')
    .select('id, name, plan_price, plan_expires_at, clinic_phone, billing_whatsapp')
    .eq('id', clinic_id)
    .single()

  if (!clinic) return NextResponse.json({ error: 'Clínica não encontrada' }, { status: 404 })
  if (!clinic.plan_price) return NextResponse.json({ error: 'Valor do plano não configurado' }, { status: 400 })

  // Destino: clinic_phone (número da clínica) ou billing_whatsapp como fallback
  const destino = clinic.clinic_phone || clinic.billing_whatsapp
  if (!destino) return NextResponse.json({ error: 'Número da clínica não configurado. Cadastre o telefone da clínica.' }, { status: 400 })

  // Buscar configurações globais do Clinike
  const { data: settings } = await svc
    .from('app_settings')
    .select('key, value')
    .in('key', ['clinike_billing_instance', 'clinike_billing_from_number', 'evolution_master_key', 'evolution_url'])

  const cfg: Record<string, string> = {}
  for (const s of (settings || [])) cfg[s.key] = s.value

  const evUrl = cfg['evolution_url'] || 'https://evolution-api-production-7853.up.railway.app'
  const evKey = cfg['evolution_master_key'] || ''

  // Instância de saída: configurada globalmente ou primeira conectada
  let instance = cfg['clinike_billing_instance'] || ''
  if (!instance) {
    const { data: wa } = await svc
      .from('clinic_whatsapp')
      .select('instance_name')
      .eq('status', 'connected')
      .limit(1)
      .maybeSingle()
    instance = wa?.instance_name || ''
  }

  if (!instance) return NextResponse.json({ error: 'Nenhuma instância WhatsApp configurada para envio' }, { status: 400 })

  const vencimento = clinic.plan_expires_at
    ? new Date(clinic.plan_expires_at).toLocaleDateString('pt-BR')
    : 'Próximo mês'

  const txid = `CLK${clinic_id.slice(0, 10).replace(/-/g, '').toUpperCase()}`
  const pixPayload = gerarPixEMV({
    chave: PIX_CHAVE, nome: PIX_NOME, cidade: PIX_CIDADE,
    valor: clinic.plan_price, txid,
    descricao: `Clinike - ${clinic.name.slice(0, 30)}`,
  })

  const mensagem = pixParaWhatsApp({
    nomePagador: clinic.name,
    valor: clinic.plan_price,
    vencimento,
    pixPayload,
  })

  const phone = String(destino).replace(/\D/g, '')
  const phoneFmt = phone.startsWith('55') ? phone : `55${phone}`

  const resp = await fetch(`${evUrl}/message/sendText/${instance}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: evKey },
    body: JSON.stringify({ number: phoneFmt, text: mensagem }),
  })

  if (!resp.ok) {
    const err = await resp.text()
    return NextResponse.json({ error: `Evolution API: ${err.slice(0, 200)}` }, { status: 500 })
  }

  await svc.from('clinics').update({ last_charge_sent_at: new Date().toISOString() }).eq('id', clinic_id)

  return NextResponse.json({ ok: true, pixPayload, phone: phoneFmt, instance })
}
