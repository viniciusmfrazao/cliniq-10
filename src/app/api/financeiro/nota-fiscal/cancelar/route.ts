import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cancelarNfseMunicipal, baixarXmlAutorizado, focusToken } from '@/lib/focus-nfe'

export const dynamic = 'force-dynamic'

// Cancelamento de NFS-e — ação séria e irreversível, por isso restrita a admin/super_admin
// (mais estrita que a emissão, que também libera manager/financial).
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users').select('clinic_id, role').eq('id', user.id).single()

  if (!['admin', 'super_admin'].includes(userData?.role || '')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const clinicId = userData!.clinic_id
  const { entrada_id, justificativa } = await req.json()

  if (!entrada_id) return NextResponse.json({ error: 'entrada_id é obrigatório' }, { status: 400 })
  if (!justificativa || justificativa.trim().length < 15 || justificativa.trim().length > 255) {
    return NextResponse.json({ error: 'justificativa deve ter entre 15 e 255 caracteres' }, { status: 400 })
  }

  const { data: entrada } = await supabase
    .from('entradas')
    .select('id, clinic_id, nota_fiscal_ref, nota_fiscal_status')
    .eq('id', entrada_id)
    .eq('clinic_id', clinicId)
    .single()

  if (!entrada) return NextResponse.json({ error: 'entrada não encontrada' }, { status: 404 })
  if (entrada.nota_fiscal_status !== 'autorizada') {
    return NextResponse.json({ error: 'só é possível cancelar uma nota já autorizada' }, { status: 400 })
  }
  if (!entrada.nota_fiscal_ref) {
    return NextResponse.json({ error: 'esta entrada não tem referência de emissão' }, { status: 400 })
  }

  const { data: config } = await supabase
    .from('clinic_fiscal_config')
    .select('*')
    .eq('clinic_id', clinicId)
    .maybeSingle()

  if (!config) return NextResponse.json({ error: 'configuração fiscal não encontrada' }, { status: 400 })

  const { data } = await cancelarNfseMunicipal(config, entrada.nota_fiscal_ref, justificativa.trim())

  if (data?.status !== 'cancelado') {
    const mensagem = (data?.erros || []).map((e: { mensagem?: string }) => e.mensagem).filter(Boolean).join('; ')
      || data?.mensagem_sefaz || 'Erro ao cancelar a nota'
    return NextResponse.json({ error: mensagem }, { status: 422 })
  }

  // Arquiva o XML de cancelamento também — é a prova de que a nota foi cancelada.
  let xmlCancelamentoPath: string | null = null
  try {
    const token = focusToken(config)
    if (token && data.caminho_xml_cancelamento) {
      const xml = await baixarXmlAutorizado(data.caminho_xml_cancelamento, config.ambiente, token)
      const path = `${clinicId}/${entrada.id}-cancelamento.xml`
      const { error: uploadError } = await supabase.storage
        .from('notas-fiscais')
        .upload(path, xml, { contentType: 'application/xml', upsert: true })
      if (!uploadError) xmlCancelamentoPath = path
    }
  } catch {
    // silencioso — cancelamento já efetivado, arquivamento do xml de cancelamento fica pendente
  }

  await supabase.from('entradas').update({
    nota_fiscal_status: 'cancelada',
    nota_fiscal_justificativa_cancelamento: justificativa.trim(),
    nota_fiscal_cancelada_em: new Date().toISOString(),
    nota_fiscal_xml_cancelamento_path: xmlCancelamentoPath,
  }).eq('id', entrada.id)

  return NextResponse.json({ success: true })
}
