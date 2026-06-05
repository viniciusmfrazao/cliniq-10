import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUserClinic } from '@/lib/auth-helpers'

export async function POST(req: NextRequest) {
  const ctx = await getCurrentUserClinic()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const { relatorio_semanal, relatorio_telefones, relatorio_hora, relatorio_dia } = body

  const phones = relatorio_telefones
    ? String(relatorio_telefones).split(',').map((p: string) => p.trim()).filter(Boolean)
    : []

  const svc = createServiceClient()

  // Tenta UPDATE primeiro (linha já existe)
  const { data: existing } = await svc
    .from('clinic_automations')
    .select('clinic_id')
    .eq('clinic_id', ctx.clinicId)
    .maybeSingle()

  let error
  if (existing) {
    const res = await svc
      .from('clinic_automations')
      .update({
        relatorio_semanal: !!relatorio_semanal,
        relatorio_telefones: phones,
        relatorio_hora: relatorio_hora || '10:00',
        relatorio_dia: relatorio_dia ?? 1,
      })
      .eq('clinic_id', ctx.clinicId)
    error = res.error
  } else {
    const res = await svc
      .from('clinic_automations')
      .insert({
        clinic_id: ctx.clinicId,
        relatorio_semanal: !!relatorio_semanal,
        relatorio_telefones: phones,
        relatorio_hora: relatorio_hora || '10:00',
        relatorio_dia: relatorio_dia ?? 1,
      })
    error = res.error
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, phones })
}
