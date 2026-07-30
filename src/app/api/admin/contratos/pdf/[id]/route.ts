import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/super-admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/contratos/pdf/[id]
 * Retorna uma signed URL temporária (10min) pro PDF do contrato assinado,
 * pra o super admin baixar/enviar ao cliente.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const ok = await isSuperAdmin()
  if (!ok) return NextResponse.json({ ok: false, error: 'nao_autorizado' }, { status: 403 })

  const svc = createServiceClient()

  const { data: contract, error } = await svc
    .from('platform_contracts')
    .select('pdf_path, status')
    .eq('id', params.id)
    .maybeSingle()

  if (error || !contract) {
    return NextResponse.json({ ok: false, error: 'contrato_nao_encontrado' }, { status: 404 })
  }
  if (!contract.pdf_path) {
    return NextResponse.json({ ok: false, error: 'pdf_ainda_nao_gerado' }, { status: 404 })
  }

  const { data: signed, error: signErr } = await svc
    .storage
    .from('contracts')
    .createSignedUrl(contract.pdf_path, 600)

  if (signErr || !signed) {
    return NextResponse.json({ ok: false, error: 'erro_ao_gerar_link' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, url: signed.signedUrl })
}
