import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendWhatsappMessage } from '@/lib/whatsapp'

function generateToken(): string {
  const bytes = new Uint8Array(24)
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 32)
}

function siteUrl(req: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    new URL(req.url).origin
  )
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users')
    .select('clinic_id, id')
    .eq('id', user.id)
    .single()
  if (!userData?.clinic_id) return NextResponse.json({ error: 'Clínica não encontrada' }, { status: 400 })

  const body = await req.json()
  const telefone = (body.telefone || '').replace(/\D/g, '')
  if (!telefone || telefone.length < 10) {
    return NextResponse.json({ error: 'Telefone inválido' }, { status: 400 })
  }

  const svc = createServiceClient()

  // Busca nome da clínica
  const { data: clinic } = await svc
    .from('clinics')
    .select('name')
    .eq('id', userData.clinic_id)
    .maybeSingle()
  const clinicName = clinic?.name || 'a clínica'

  // Cria anamnese de teste com patient_id nulo — usa um paciente fake
  // Procura o primeiro paciente da clínica para ter um contexto válido
  const { data: paciente } = await svc
    .from('patients')
    .select('id, name')
    .eq('clinic_id', userData.clinic_id)
    .limit(1)
    .maybeSingle()

  const token = generateToken()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // expira em 1 dia

  const { error: errCreate } = await svc
    .from('anamneses')
    .insert({
      clinic_id: userData.clinic_id,
      patient_id: paciente?.id || null,
      status: 'pending',
      sent_by: userData.id,
      token,
      expires_at: expiresAt,
    })

  if (errCreate) {
    return NextResponse.json({ error: errCreate.message }, { status: 500 })
  }

  const link = `${siteUrl(req)}/anamnese/${token}`

  // Envia via WhatsApp
  const result = await sendWhatsappMessage({
    clinicId: userData.clinic_id,
    phone: telefone,
    message: `🧪 *TESTE — ${clinicName}*\n\nEste é um envio de teste da ficha de anamnese.\n\n${link}\n\nO link expira em 24h.`,
    purpose: 'automation',
  })

  if (!result.ok) {
    // Mesmo sem WhatsApp, retorna o link para copiar
    return NextResponse.json({ ok: true, link, sent: false, reason: result.error })
  }

  return NextResponse.json({ ok: true, link, sent: true })
}
