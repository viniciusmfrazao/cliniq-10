import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthedClinic()
  if (auth.error) return auth.error
  const { supabase, clinicId } = auth

  const { data: template, error } = await supabase
    .from('anamnese_templates')
    .select('*')
    .eq('id', id)
    .eq('clinic_id', clinicId)
    .single()

  if (error || !template) return NextResponse.json({ error: 'Modelo não encontrado' }, { status: 404 })

  const { data: fields } = await supabase
    .from('anamnese_template_fields')
    .select('*')
    .eq('template_id', id)
    .order('ordem', { ascending: true })

  return NextResponse.json({ template, fields: fields || [] })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthedClinic()
  if (auth.error) return auth.error
  const { supabase, clinicId } = auth

  const body = await request.json()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.nome === 'string') {
    if (!body.nome.trim()) return NextResponse.json({ error: 'Nome da ficha é obrigatório' }, { status: 400 })
    updates.nome = body.nome.trim()
  }
  if (typeof body.descricao === 'string' || body.descricao === null) updates.descricao = body.descricao
  if (typeof body.ativo === 'boolean') updates.ativo = body.ativo
  if (typeof body.cor_primaria === 'string') updates.cor_primaria = body.cor_primaria
  if (typeof body.ordem === 'number') updates.ordem = body.ordem

  const { data, error } = await supabase
    .from('anamnese_templates')
    .update(updates)
    .eq('id', id)
    .eq('clinic_id', clinicId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ template: data })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthedClinic()
  if (auth.error) return auth.error
  const { supabase, clinicId } = auth

  // Não apaga se já existirem respostas usando esse modelo — evita perder histórico.
  const { count } = await supabase
    .from('anamneses')
    .select('id', { count: 'exact', head: true })
    .eq('template_id', id)

  if (count && count > 0) {
    return NextResponse.json({
      error: 'Esse modelo já tem fichas respondidas. Desative em vez de excluir para manter o histórico.',
    }, { status: 400 })
  }

  const { error } = await supabase
    .from('anamnese_templates')
    .delete()
    .eq('id', id)
    .eq('clinic_id', clinicId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
