import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/super-admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// Ordem inversa das dependências: filhos primeiro.
// orcamento_itens cai por CASCADE ao remover orcamentos.
const ORDER = ['entradas', 'orcamentos', 'appointments', 'patients', 'procedures'] as const

export async function POST(req: NextRequest) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: 'Apenas super admin' }, { status: 403 })
    }

    const { batchId } = await req.json()
    if (!batchId) return NextResponse.json({ error: 'batchId obrigatório' }, { status: 400 })

    const admin = createServiceClient()

    const { data: batch } = await admin
      .from('import_batches').select('id, status, clinic_id').eq('id', batchId).maybeSingle()
    if (!batch) return NextResponse.json({ error: 'Lote não encontrado' }, { status: 404 })
    if (batch.status === 'rolled_back') {
      return NextResponse.json({ error: 'Lote já foi desfeito' }, { status: 400 })
    }

    const removed: Record<string, number> = {}
    const errors: string[] = []

    for (const table of ORDER) {
      const { data, error } = await admin
        .from(table)
        .delete()
        .eq('import_batch_id', batchId)
        .eq('clinic_id', batch.clinic_id)
        .select('id')

      if (error) errors.push(`${table}: ${error.message.slice(0, 180)}`)
      else removed[table] = (data || []).length
    }

    await admin.from('import_batches').update({
      status: errors.length ? 'failed' : 'rolled_back',
      rolled_back_at: new Date().toISOString(),
      errors: errors.length ? errors : null,
    }).eq('id', batchId)

    return NextResponse.json({ ok: errors.length === 0, removed, errors })
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro ao desfazer' },
      { status: 500 }
    )
  }
}
