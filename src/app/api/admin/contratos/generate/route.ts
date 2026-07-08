import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/super-admin'
import { renderPlatformContract, CONTRACT_TEMPLATE_VERSION } from '@/lib/contract-template'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/contratos/generate
 * Gera (ou reaproveita) um link de contrato pendente para a clínica,
 * puxando automaticamente os dados de cadastro dela.
 * Body: { clinicId: string }
 */
export async function POST(req: NextRequest) {
  const ok = await isSuperAdmin()
  if (!ok) return NextResponse.json({ ok: false, error: 'nao_autorizado' }, { status: 403 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let body: { clinicId?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'json_invalido' }, { status: 400 }) }

  const { clinicId } = body
  if (!clinicId) return NextResponse.json({ ok: false, error: 'clinicId_obrigatorio' }, { status: 400 })

  const svc = createServiceClient()

  const { data: clinic, error: clinicErr } = await svc
    .from('clinics')
    .select('id, name, cnpj, clinic_phone, plan, plan_price')
    .eq('id', clinicId)
    .maybeSingle()

  if (clinicErr || !clinic) {
    return NextResponse.json({ ok: false, error: 'clinica_nao_encontrada' }, { status: 404 })
  }

  // Se já existe um contrato pendente/visualizado (ainda não assinado) para essa clínica,
  // reaproveita o mesmo link em vez de criar outro.
  const { data: existing } = await svc
    .from('platform_contracts')
    .select('id, sign_token, status')
    .eq('clinic_id', clinicId)
    .in('status', ['pending', 'viewed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ ok: true, token: existing.sign_token, reused: true })
  }

  const content = renderPlatformContract({
    name: clinic.name,
    cnpj: clinic.cnpj,
    clinic_phone: clinic.clinic_phone,
    plan: clinic.plan,
    plan_price: clinic.plan_price,
  })

  const { data: inserted, error: insertErr } = await svc
    .from('platform_contracts')
    .insert({
      clinic_id: clinicId,
      template_version: CONTRACT_TEMPLATE_VERSION,
      content,
      status: 'pending',
      plan_name: clinic.plan,
      plan_price: clinic.plan_price,
      clinic_snapshot: clinic,
      created_by: user?.id || null,
      sent_at: new Date().toISOString(),
    })
    .select('sign_token')
    .single()

  if (insertErr || !inserted) {
    console.error('[contratos/generate] erro ao inserir:', insertErr?.message)
    return NextResponse.json({ ok: false, error: 'erro_ao_gerar' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, token: inserted.sign_token, reused: false })
}
