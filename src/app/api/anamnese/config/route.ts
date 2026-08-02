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

  if (!userData?.clinic_id) return NextResponse.json({ error: 'Clínica não encontrada' }, { status: 400 })
  if (!['admin','super_admin','manager'].includes(userData?.role || '')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const body = await request.json()
  const { titulo, subtitulo, cor_primaria, secoes_ativas, perguntas_extras, campos_identificacao, ativo } = body

  // Se está desativando a ficha padrão, precisa sobrar pelo menos 1 modelo
  // customizado ativo — nunca pode ficar sem nenhuma ficha disponível pra enviar.
  if (ativo === false) {
    const { count } = await supabase
      .from('anamnese_templates')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', userData.clinic_id)
      .eq('ativo', true)
    if (!count) {
      return NextResponse.json(
        { error: 'Crie e ative pelo menos 1 modelo antes de desativar a ficha padrão.' },
        { status: 400 },
      )
    }
  }

  const { error } = await supabase
    .from('anamnese_config')
    .upsert({
      clinic_id: userData.clinic_id,
      titulo,
      subtitulo,
      cor_primaria,
      secoes_ativas,
      perguntas_extras,
      campos_identificacao: campos_identificacao || [],
      ativo: ativo !== false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'clinic_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

// PATCH /api/anamnese/config — toggle rápido só do campo `ativo`, sem
// mexer no resto da config (usado na lista de Modelos, onde a padrão
// aparece como mais uma linha com toggle ativo/inativo).
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users')
    .select('clinic_id, role')
    .eq('id', user.id)
    .single()

  if (!userData?.clinic_id) return NextResponse.json({ error: 'Clínica não encontrada' }, { status: 400 })
  if (!['admin','super_admin','manager'].includes(userData?.role || '')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { ativo } = await request.json()
  if (typeof ativo !== 'boolean') {
    return NextResponse.json({ error: 'Campo ativo é obrigatório' }, { status: 400 })
  }

  if (ativo === false) {
    const { count } = await supabase
      .from('anamnese_templates')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', userData.clinic_id)
      .eq('ativo', true)
    if (!count) {
      return NextResponse.json(
        { error: 'Crie e ative pelo menos 1 modelo antes de desativar a ficha padrão.' },
        { status: 400 },
      )
    }
  }

  const { error } = await supabase
    .from('anamnese_config')
    .upsert({ clinic_id: userData.clinic_id, ativo, updated_at: new Date().toISOString() }, { onConflict: 'clinic_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
