import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { consultarNfeProduto } from '@/lib/focus-nfe'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users').select('clinic_id, role').eq('id', user.id).single()

  if (!['admin', 'super_admin', 'manager', 'financial'].includes(userData?.role || '')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const clinicId = userData!.clinic_id
  const entradaId = req.nextUrl.searchParams.get('entrada_id')
  if (!entradaId) return NextResponse.json({ error: 'entrada_id é obrigatório' }, { status: 400 })

  const { data: entrada } = await supabase
    .from('entradas')
    .select('id, clinic_id, nota_fiscal_ref, nota_fiscal_status')
    .eq('id', entradaId)
    .eq('clinic_id', clinicId)
    .single()

  if (!entrada) return NextResponse.json({ error: 'entrada não encontrada' }, { status: 404 })
  if (!entrada.nota_fiscal_ref) {
    return NextResponse.json({ error: 'esta entrada ainda não teve emissão iniciada' }, { status: 400 })
  }

  const { data: config } = await supabase
    .from('clinic_fiscal_config')
    .select('*')
    .eq('clinic_id', clinicId)
    .maybeSingle()

  if (!config) return NextResponse.json({ error: 'configuração fiscal não encontrada' }, { status: 400 })

  const { httpStatus, data } = await consultarNfeProduto(config, entrada.nota_fiscal_ref)

  if (httpStatus === 404) {
    return NextResponse.json({ status: entrada.nota_fiscal_status })
  }

  if (data?.status === 'autorizado') {
    await supabase.from('entradas').update({
      nota_fiscal_status: 'autorizada',
      nota_fiscal_numero: data.numero || null,
      nota_fiscal_url_pdf: data.caminho_danfe || data.url || null,
      nota_fiscal_erro: null,
      nota_fiscal_emitida_em: data.data_emissao || new Date().toISOString(),
    }).eq('id', entrada.id)
    return NextResponse.json({ status: 'autorizada', numero: data.numero, url_pdf: data.caminho_danfe || data.url })
  }

  if (data?.status === 'erro_autorizacao' || data?.status === 'rejeitado') {
    const mensagem = (data.erros || []).map((e: { mensagem?: string }) => e.mensagem).filter(Boolean).join('; ')
      || data.mensagem_sefaz || 'Erro na autorização'
    await supabase.from('entradas').update({
      nota_fiscal_status: 'erro',
      nota_fiscal_erro: mensagem,
    }).eq('id', entrada.id)
    return NextResponse.json({ status: 'erro', erro: mensagem })
  }

  return NextResponse.json({ status: 'processando' })
}
