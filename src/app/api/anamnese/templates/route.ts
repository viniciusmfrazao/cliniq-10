import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function getAuthedClinic(requireManage = true) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) }

  const { data: userData } = await supabase
    .from('users')
    .select('clinic_id, role')
    .eq('id', user.id)
    .single()

  if (!userData?.clinic_id) return { error: NextResponse.json({ error: 'Clínica não encontrada' }, { status: 400 }) }
  if (requireManage && !['admin', 'super_admin', 'manager'].includes(userData?.role || '')) {
    return { error: NextResponse.json({ error: 'Sem permissão' }, { status: 403 }) }
  }

  return { supabase, clinicId: userData.clinic_id as string }
}

export async function GET() {
  // Leitura liberada pra qualquer usuário da clínica (não só admin/manager):
  // é usada também pelo seletor de ficha no envio pela agenda, que qualquer
  // atendente pode fazer.
  const auth = await getAuthedClinic(false)
  if (auth.error) return auth.error
  const { supabase, clinicId } = auth

  const { data, error } = await supabase
    .from('anamnese_templates')
    .select('*, anamnese_template_fields(count)')
    .eq('clinic_id', clinicId)
    .order('ordem', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Ficha padrão: ativa por padrão se a clínica nunca configurou nada.
  const { data: config } = await supabase
    .from('anamnese_config')
    .select('ativo')
    .eq('clinic_id', clinicId)
    .maybeSingle()
  const padraoAtiva = config?.ativo !== false

  return NextResponse.json({ templates: data, padraoAtiva })
}

export async function POST(request: Request) {
  const auth = await getAuthedClinic(true)
  if (auth.error) return auth.error
  const { supabase, clinicId } = auth

  const body = await request.json()
  const nome = (body?.nome || '').trim()
  if (!nome) return NextResponse.json({ error: 'Nome da ficha é obrigatório' }, { status: 400 })

  const { data, error } = await supabase
    .from('anamnese_templates')
    .insert({
      clinic_id: clinicId,
      nome,
      descricao: body?.descricao || null,
      cor_primaria: body?.cor_primaria || '#b89a6a',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ template: data })
}
