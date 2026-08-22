import { NextRequest, NextResponse } from 'next/server'
import { isSuperAdmin } from '@/lib/super-admin'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

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

  // Criar instância na Evolution API — sem "number": o createInstance() usado
  // no fluxo da clinica (ja validado em producao) tambem nao manda, e mandar
  // pode fazer a Evolution tentar pairing-code em vez de QR.
  const resp = await fetch(`${evUrl}/instance/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: evKey },
    body: JSON.stringify({
      instanceName,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    }),
  })

  const alreadyExists =
    !resp.ok && /already in use|already exists|name is already|duplicate|conflict/i.test(await resp.clone().text())

  if (!resp.ok && !alreadyExists) {
    const err = await resp.text()
    return NextResponse.json({ error: `Evolution API: ${err.slice(0, 200)}` }, { status: 500 })
  }

  // O /instance/create nem sempre devolve o QR pronto (depende da versao da
  // Evolution) — o fluxo que ja funciona pra clinica busca explicitamente
  // via GET /instance/connect/{nome} logo em seguida. Fazemos o mesmo aqui.
  let qrBase64: string | null = null
  try {
    const qrResp = await fetch(`${evUrl}/instance/connect/${encodeURIComponent(instanceName)}`, {
      method: 'GET',
      headers: { apikey: evKey },
    })
    if (qrResp.ok) {
      const qrData = await qrResp.json()
      qrBase64 = qrData.base64 ?? null
    }
  } catch {
    // segue sem QR — front mostra aviso pra tentar de novo
  }

  // Salvar no banco como instância do Clinike (sem clinic_id específico — usar a clínica teste)
  const { data: clinicTeste } = await svc
    .from('clinics')
    .select('id')
    .eq('name', 'Clinica Clinike Teste')
    .maybeSingle()

  if (clinicTeste) {
    const { data: existing } = await svc
      .from('clinic_whatsapp')
      .select('id')
      .eq('instance_name', instanceName)
      .maybeSingle()

    if (!existing) {
      await svc.from('clinic_whatsapp').insert({
        clinic_id: clinicTeste.id,
        instance_name: instanceName,
        status: 'qr_pending',
        phone_number: phoneClean,
        is_default: false,
        auto_reply_enabled: false,
        role_inbound: false,
        role_outbound_automation: false,
      })
    }
  }

  return NextResponse.json({
    ok: true,
    instanceName,
    qrcode: qrBase64,
    message: qrBase64
      ? `Instância ${instanceName} criada. Escaneie o QR Code para conectar.`
      : `Instância ${instanceName} criada, mas a Evolution não devolveu QR agora.`,
  })
}
