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

// GET — histórico de contatos de um lead
export async function GET(req: NextRequest) {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const leadId = searchParams.get('lead_id')
  if (!leadId) return NextResponse.json({ error: 'lead_id obrigatório' }, { status: 400 })

  const { data, error } = await supabase
    .from('lead_contacts')
    .select('id, type, note, created_at, created_by_user:users!lead_contacts_created_by_fkey(name)')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST — registrar contato manual
export async function POST(req: NextRequest) {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { lead_id, type, note } = await req.json()
  if (!lead_id || !note) return NextResponse.json({ error: 'lead_id e note obrigatórios' }, { status: 400 })

  const { data: userRow } = await supabase.from('users').select('id, clinic_id').eq('auth_id', user.id).single()
  if (!userRow) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 400 })

  const { data, error } = await supabase.from('lead_contacts').insert({
    clinic_id: userRow.clinic_id,
    lead_id,
    created_by: userRow.id,
    type: type || 'note',
    note,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Atualizar last_contact_at do lead
  await supabase.from('leads').update({ last_contact_at: new Date().toISOString() }).eq('id', lead_id)

  return NextResponse.json({ ok: true, data })
}
