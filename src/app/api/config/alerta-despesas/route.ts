import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: userRow } = await supabase
    .from('users')
    .select('clinic_id, role')
    .eq('id', user.id)
    .single()

  if (!userRow?.clinic_id) return NextResponse.json({ error: 'no clinic' }, { status: 403 })
  if (!['admin', 'manager'].includes(userRow.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { enabled, diasAntes } = body

  const { error } = await supabase
    .from('clinic_automations')
    .update({
      alerta_despesas: !!enabled,
      alerta_despesas_dias_antes: Number(diasAntes ?? 1),
    })
    .eq('clinic_id', userRow.clinic_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
