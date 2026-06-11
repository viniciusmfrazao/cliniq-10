import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users')
    .select('clinic_id, role')
    .eq('id', user.id)
    .single()

  if (!['admin','super_admin','manager'].includes(userData?.role || '')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const body = await request.json()
  const { titulo, subtitulo, cor_primaria, secoes_ativas, perguntas_extras } = body

  const { error } = await supabase
    .from('anamnese_config')
    .upsert({
      clinic_id: userData.clinic_id,
      titulo,
      subtitulo,
      cor_primaria,
      secoes_ativas,
      perguntas_extras,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'clinic_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
