import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function getClinicIdAndCheckRole(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }

  const { data: userData } = await supabase
    .from('users').select('clinic_id, role').eq('id', user.id).single()

  if (!['admin', 'super_admin', 'manager', 'financial'].includes(userData?.role || '')) {
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) }
  }
  return { clinicId: userData!.clinic_id as string }
}

export async function GET() {
  const supabase = await createClient()
  const auth = await getClinicIdAndCheckRole(supabase)
  if (auth.error) return auth.error

  const { data, error } = await supabase
    .from('clinic_fiscal_servicos')
    .select('*')
    .eq('clinic_id', auth.clinicId)
    .order('is_default', { ascending: false })
    .order('nome', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ servicos: data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const auth = await getClinicIdAndCheckRole(supabase)
  if (auth.error) return auth.error

  const body = await req.json()
  const {
    nome, descricao_servico, item_lista_servico, codigo_tributario_municipio,
    codigo_nbs, ibs_cbs_classificacao_tributaria, ibs_cbs_situacao_tributaria,
    codigo_indicador_operacao, is_default,
  } = body

  if (!nome || !item_lista_servico) {
    return NextResponse.json({ error: 'nome e item_lista_servico são obrigatórios' }, { status: 400 })
  }

  // Só um perfil pode ser default por clínica
  if (is_default) {
    await supabase.from('clinic_fiscal_servicos').update({ is_default: false }).eq('clinic_id', auth.clinicId)
  }

  const { data, error } = await supabase
    .from('clinic_fiscal_servicos')
    .insert({
      clinic_id: auth.clinicId,
      nome,
      descricao_servico: descricao_servico || null,
      item_lista_servico,
      codigo_tributario_municipio: codigo_tributario_municipio || null,
      codigo_nbs: codigo_nbs || null,
      ibs_cbs_classificacao_tributaria: ibs_cbs_classificacao_tributaria || null,
      ibs_cbs_situacao_tributaria: ibs_cbs_situacao_tributaria || null,
      codigo_indicador_operacao: codigo_indicador_operacao || null,
      is_default: !!is_default,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ servico: data })
}
