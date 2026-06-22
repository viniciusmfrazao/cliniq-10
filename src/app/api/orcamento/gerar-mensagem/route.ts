import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/orcamento/gerar-mensagem
 * Delega para a edge function ia-prontuario (action: mensagem_orcamento)
 * que já tem ANTHROPIC_API_KEY configurada.
 * Body: { orcamentoId: string }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'nao_autenticado' }, { status: 401 })

  const { data: userRow } = await supabase
    .from('users').select('id, clinic_id').eq('id', user.id).maybeSingle()
  if (!userRow?.clinic_id) return NextResponse.json({ ok: false, error: 'sem_clinica' }, { status: 403 })

  const clinicId = userRow.clinic_id as string

  let body: { orcamentoId?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'json_invalido' }, { status: 400 }) }

  const { orcamentoId } = body
  if (!orcamentoId) return NextResponse.json({ ok: false, error: 'orcamentoId_obrigatorio' }, { status: 400 })

  // Buscar session token para autenticar na edge function
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return NextResponse.json({ ok: false, error: 'sem_sessao' }, { status: 401 })

  const edgeUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ia-prontuario`

  try {
    const resp = await fetch(edgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action: 'mensagem_orcamento',
        orcamentoId,
        clinicId,
      }),
    })

    const data = await resp.json()

    if (!resp.ok || !data.mensagem) {
      return NextResponse.json({ ok: false, error: data.error || 'ia_sem_resposta' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, mensagem: data.mensagem })
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'erro_conexao_edge' }, { status: 500 })
  }
}
