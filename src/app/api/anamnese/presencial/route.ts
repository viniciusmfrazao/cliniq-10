import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

/**
 * POST /api/anamnese/presencial
 *
 * Cria uma anamnese para preenchimento presencial (sem enviar WhatsApp).
 * Retorna o link direto para abrir no tablet/celular da clínica.
 *
 * Body: { patientId: string }
 */

const ANAMNESE_TTL_DAYS = 7

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
  if (!user) return NextResponse.json({ ok: false, error: 'nao_autenticado' }, { status: 401 })

  const { data: userRow } = await supabase
    .from('users').select('id, clinic_id').eq('id', user.id).maybeSingle()
  if (!userRow?.clinic_id) return NextResponse.json({ ok: false, error: 'sem_clinica' }, { status: 403 })

  const { patientId } = await req.json()
  if (!patientId) return NextResponse.json({ ok: false, error: 'patientId_obrigatorio' }, { status: 400 })

  const svc = createServiceClient()

  // Reusar anamnese ativa se houver
  const nowIso = new Date().toISOString()
  const { data: existing } = await svc
    .from('anamneses')
    .select('id, token')
    .eq('clinic_id', userRow.clinic_id)
    .eq('patient_id', patientId)
    .in('status', ['pending', 'viewed'])
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let token: string

  if (existing) {
    token = existing.token
  } else {
    token = generateToken()
    const expiresAt = new Date(Date.now() + ANAMNESE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const { error } = await svc.from('anamneses').insert({
      clinic_id: userRow.clinic_id,
      patient_id: patientId,
      status: 'pending',
      sent_by: userRow.id,
      token,
      expires_at: expiresAt,
    })
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    token,
    link: `${siteUrl(req)}/anamnese/${token}`,
  })
}
