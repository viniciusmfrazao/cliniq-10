import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(_req: NextRequest, { params }: { params: { slug: string } }) {
  const svc = createServiceClient()

  const { data: apt } = await svc
    .from('appointments')
    .select('id, status, confirmed_at')
    .eq('confirmation_slug', params.slug)
    .maybeSingle()

  if (!apt) {
    return NextResponse.json({ ok: false, error: 'Agendamento não encontrado.' }, { status: 404 })
  }

  if (apt.status === 'cancelled' || apt.status === 'no_show') {
    return NextResponse.json({ ok: false, error: 'Este agendamento foi cancelado.' }, { status: 409 })
  }

  // Já confirmado — retorna ok (idempotente)
  if (apt.confirmed_at || apt.status === 'confirmed') {
    return NextResponse.json({ ok: true, already: true })
  }

  const { error } = await svc
    .from('appointments')
    .update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', apt.id)

  if (error) {
    return NextResponse.json({ ok: false, error: 'Erro ao confirmar.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
