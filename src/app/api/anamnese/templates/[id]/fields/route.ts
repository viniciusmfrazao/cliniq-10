import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const TIPOS_VALIDOS = ['texto_curto', 'texto_longo', 'sim_nao', 'single_select', 'multi_select', 'numero', 'data']

async function getAuthedClinic() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) }

  const { data: userData } = await supabase
    .from('users')
    .select('clinic_id, role')
    .eq('id', user.id)
    .single()

  if (!userData?.clinic_id) return { error: NextResponse.json({ error: 'Clínica não encontrada' }, { status: 400 }) }
  if (!['admin', 'super_admin', 'manager'].includes(userData?.role || '')) {
    return { error: NextResponse.json({ error: 'Sem permissão' }, { status: 403 }) }
  }

  return { supabase, clinicId: userData.clinic_id as string }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthedClinic()
  if (auth.error) return auth.error
  const { supabase, clinicId } = auth

  // Confirma que o modelo pertence à clínica do usuário
  const { data: template } = await supabase
    .from('anamnese_templates')
    .select('id')
    .eq('id', id)
    .eq('clinic_id', clinicId)
    .single()

  if (!template) return NextResponse.json({ error: 'Modelo não encontrado' }, { status: 404 })

  const body = await request.json()
  const fields = Array.isArray(body?.fields) ? body.fields : []

  for (const f of fields) {
    if (!f.label || !String(f.label).trim()) {
      return NextResponse.json({ error: 'Toda pergunta precisa de um texto' }, { status: 400 })
    }
    if (!TIPOS_VALIDOS.includes(f.tipo)) {
      return NextResponse.json({ error: `Tipo de campo inválido: ${f.tipo}` }, { status: 400 })
    }
  }

  // Substitui tudo de uma vez (mesmo padrão usado hoje pra perguntas_extras)
  const { error: delError } = await supabase
    .from('anamnese_template_fields')
    .delete()
    .eq('template_id', id)

  if (delError) return NextResponse.json({ error: delError.message }, { status: 400 })

  if (fields.length > 0) {
    const rows = fields.map((f: any, idx: number) => ({
      template_id: id,
      secao: (f.secao || 'Geral').trim(),
      ordem: idx,
      label: String(f.label).trim(),
      tipo: f.tipo,
      opcoes: ['single_select', 'multi_select'].includes(f.tipo)
        ? (Array.isArray(f.opcoes) ? f.opcoes : [])
        : null,
      obrigatorio: !!f.obrigatorio,
      ativo: f.ativo !== false,
    }))

    const { error: insError } = await supabase.from('anamnese_template_fields').insert(rows)
    if (insError) return NextResponse.json({ error: insError.message }, { status: 400 })
  }

  await supabase
    .from('anamnese_templates')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', id)

  const { data: saved } = await supabase
    .from('anamnese_template_fields')
    .select('*')
    .eq('template_id', id)
    .order('ordem', { ascending: true })

  return NextResponse.json({ fields: saved || [] })
}
