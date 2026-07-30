import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/super-admin'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/contratos/cancel
 * Cancela um contrato pendente/visualizado (nunca um já assinado), liberando
 * a clínica pra gerar um novo — necessário quando os dados de cadastro
 * (ex: CNPJ) mudaram depois que o contrato foi gerado, já que o conteúdo
 * fica congelado no `clinic_snapshot` da geração original.
 * Body: { contractId: string }
 */
export async function POST(req: NextRequest) {
  const ok = await isSuperAdmin()
  if (!ok) return NextResponse.json({ ok: false, error: 'nao_autorizado' }, { status: 403 })

  let body: { contractId?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'json_invalido' }, { status: 400 }) }

  const { contractId } = body
  if (!contractId) return NextResponse.json({ ok: false, error: 'contractId_obrigatorio' }, { status: 400 })

  const svc = createServiceClient()

  const { data: contract, error: findErr } = await svc
    .from('platform_contracts')
    .select('id, status')
    .eq('id', contractId)
    .maybeSingle()

  if (findErr || !contract) {
    return NextResponse.json({ ok: false, error: 'contrato_nao_encontrado' }, { status: 404 })
  }
  if (contract.status === 'signed') {
    return NextResponse.json({ ok: false, error: 'contrato_ja_assinado' }, { status: 400 })
  }
  if (contract.status === 'cancelled') {
    return NextResponse.json({ ok: true, alreadyCancelled: true })
  }

  const { error: updateErr } = await svc
    .from('platform_contracts')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', contractId)

  if (updateErr) {
    return NextResponse.json({ ok: false, error: 'erro_ao_cancelar' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
