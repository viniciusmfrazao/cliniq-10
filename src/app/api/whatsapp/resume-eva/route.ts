import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/whatsapp'

type Body = {
  phone?: string
  lead_id?: string
}

/**
 * POST /api/whatsapp/resume-eva
 *
 * Devolve o atendimento pra Eva depois que humano assumiu a conversa.
 *
 * Limpa no(s) lead(s) correspondente(s):
 *   - eva_pause_until = null
 *   - needs_human_review = false
 *   - human_review_reason = null
 *
 * Aceita filtro por phone (preferido — pega todos os leads do telefone)
 * ou por lead_id especifico.
 */
export async function POST(req: NextRequest) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  if (!body.phone && !body.lead_id) {
    return NextResponse.json(
      { ok: false, error: 'phone ou lead_id é obrigatório' },
      { status: 400 },
    )
  }

  // Auth: precisa estar logado e pertencer a uma clinica
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
  }
  const { data: userRow } = await supabase
    .from('users')
    .select('clinic_id')
    .eq('id', user.id)
    .maybeSingle()
  if (!userRow?.clinic_id) {
    return NextResponse.json({ ok: false, error: 'Usuário sem clínica' }, { status: 403 })
  }
  const clinicId = userRow.clinic_id as string

  const svc = createServiceClient()
  let query = svc
    .from('leads')
    .update({
      eva_pause_until: null,
      needs_human_review: false,
      human_review_reason: null,
    })
    .eq('clinic_id', clinicId)

  if (body.lead_id) {
    query = query.eq('id', body.lead_id)
  } else if (body.phone) {
    const normalized = normalizePhone(body.phone)
    query = query.eq('phone', normalized)
  }

  const { data: updated, error } = await query.select('id, phone, name')

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    updated_count: updated?.length ?? 0,
    leads: updated ?? [],
  })
}
