import { NextRequest, NextResponse } from 'next/server'
import { isSuperAdmin } from '@/lib/super-admin'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const ok = await isSuperAdmin()
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { phone, name } = await req.json()
  if (!phone) return NextResponse.json({ error: 'Número obrigatório' }, { status: 400 })

  const svc = createServiceClient()

  // Buscar configurações da Evolution API
  const { data: settings } = await svc
    .from('app_settings')
    .select('key, value')
    .in('key', ['evolution_url', 'evolution_master_key'])

  const cfg: Record<string, string> = {}
  for (const s of (settings || [])) cfg[s.key] = s.value

  const evUrl = cfg['evolution_url'] || 'https://evolution-api-production-7853.up.railway.app'
  const evKey = cfg['evolution_master_key'] || ''

  const phoneClean = phone.replace(/\D/g, '')
  const instanceName = name?.trim() || `clinike-billing-${phoneClean.slice(-6)}`

  // Criar instância na Evolution API
  const resp = await fetch(`${evUrl}/instance/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: evKey },
    body: JSON.stringify({
      instanceName,
      number: phoneClean,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    }),
  })

  if (!resp.ok) {
    const err = await resp.text()
    return NextResponse.json({ error: `Evolution API: ${err.slice(0, 200)}` }, { status: 500 })
  }

  const data = await resp.json()

  // Salvar no banco como instância do Clinike (sem clinic_id específico — usar a clínica teste)
  const { data: clinicTeste } = await svc
    .from('clinics')
    .select('id')
    .eq('name', 'Clinica Clinike Teste')
    .maybeSingle()

  if (clinicTeste) {
    await svc.from('clinic_whatsapp').insert({
      clinic_id: clinicTeste.id,
      instance_name: instanceName,
      status: 'disconnected',
      phone_number: phoneClean,
      is_default: false,
      auto_reply_enabled: false,
      role_inbound: false,
      role_outbound_automation: false,
    })
  }

  return NextResponse.json({
    ok: true,
    instanceName,
    qrcode: data.qrcode?.base64 || null,
    message: `Instância ${instanceName} criada. Escaneie o QR Code para conectar.`,
  })
}
