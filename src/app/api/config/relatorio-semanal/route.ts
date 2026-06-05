import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { clinic_id, relatorio_semanal, relatorio_telefones, relatorio_hora, relatorio_dia } = body
  if (!clinic_id) return NextResponse.json({ error: 'clinic_id required' }, { status: 400 })
  const svc = createServiceClient()
  const { error } = await svc.from('clinic_automations').upsert({
    clinic_id,
    relatorio_semanal: !!relatorio_semanal,
    relatorio_telefones: relatorio_telefones || null,
    relatorio_hora: relatorio_hora || '10:00',
    relatorio_dia: relatorio_dia ?? 1,
  }, { onConflict: 'clinic_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
