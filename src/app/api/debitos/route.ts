import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users')
    .select('clinic_id')
    .eq('id', user.id)
    .single()

  const body = await request.json()

  const { error } = await supabase.from('debitos').insert({
    clinic_id: userData?.clinic_id,
    paciente_id: body.paciente_id || null,
    paciente_nome: body.paciente_nome,
    valor: body.valor,
    descricao: body.descricao || 'Débito',
    data_vencimento: body.data_vencimento,
    status: 'pendente',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
