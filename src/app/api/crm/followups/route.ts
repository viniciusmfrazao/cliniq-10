import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
}

// GET — listar follow-ups pendentes do dia (para badge e lista de alertas)
export async function GET(req: NextRequest) {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const leadId = searchParams.get('lead_id')
  const today = searchParams.get('today') === 'true'

  let query = supabase
    .from('lead_followups')
    .select(`
      id, lead_id, scheduled_at, type, note, done_at,
      lead:leads(id, name, phone, status),
      created_by_user:users!lead_followups_created_by_fkey(name),
      done_by_user:users!lead_followups_done_by_fkey(name)
    `)
    .is('done_at', null)
    .order('scheduled_at', { ascending: true })

  if (leadId) query = query.eq('lead_id', leadId)
  if (today) {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const end = new Date(); end.setHours(23, 59, 59, 999)
    query = query.gte('scheduled_at', start.toISOString()).lte('scheduled_at', end.toISOString())
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST — criar follow-up
export async function POST(req: NextRequest) {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { lead_id, scheduled_at, type, note } = await req.json()
  if (!lead_id || !scheduled_at) return NextResponse.json({ error: 'lead_id e scheduled_at obrigatórios' }, { status: 400 })

  // Buscar clinic_id do usuário
  const { data: userData } = await supabase.from('users').select('clinic_id').eq('auth_id', user.id).single()
  if (!userData?.clinic_id) return NextResponse.json({ error: 'Clínica não encontrada' }, { status: 400 })

  const { data: userRow } = await supabase.from('users').select('id').eq('auth_id', user.id).single()

  const { data, error } = await supabase.from('lead_followups').insert({
    clinic_id: userData.clinic_id,
    lead_id,
    scheduled_at,
    type: type || 'whatsapp',
    note: note || null,
    created_by: userRow?.id || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Atualizar next_contact_at e pausar Eva automática até o horário do followup
  // Motivo: se a equipe agendou para falar com o lead, a Eva não deve falar antes
  // eva_pause_until = horário do followup manual (o cron já respeita esse campo)
  await supabase.from('leads').update({
    next_contact_at: scheduled_at,
    eva_pause_until: scheduled_at,
    eva_next_followup_at: null, // cancela fila automática da Eva
  }).eq('id', lead_id)

  return NextResponse.json({ ok: true, data })
}

// PATCH — marcar como concluído
export async function PATCH(req: NextRequest) {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, note } = await req.json()
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const { data: userRow } = await supabase.from('users').select('id, clinic_id').eq('auth_id', user.id).single()

  // Marcar follow-up como feito
  const { data: followup, error } = await supabase
    .from('lead_followups')
    .update({ done_at: new Date().toISOString(), done_by: userRow?.id || null })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Registrar no histórico de contatos
  if (followup && userRow) {
    await supabase.from('lead_contacts').insert({
      clinic_id: userRow.clinic_id,
      lead_id: followup.lead_id,
      created_by: userRow.id,
      type: followup.type,
      note: note || followup.note || 'Follow-up concluído',
      followup_id: followup.id,
    })

    // Atualizar last_contact_at e liberar Eva para o próximo ciclo de followup
    // Agenda próximo followup automático da Eva daqui a 4h
    const evaNextAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
    await supabase.from('leads').update({
      last_contact_at: new Date().toISOString(),
      eva_pause_until: null,            // libera Eva
      eva_next_followup_at: evaNextAt,  // recomeça o ciclo a partir de agora
      eva_followup_count: 0,            // zera contagem (humano já fez contato)
    }).eq('id', followup.lead_id)
  }

  return NextResponse.json({ ok: true })
}
