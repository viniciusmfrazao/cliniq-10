import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

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
  const body = await req.json()

  const {
    cnpj, inscricao_municipal, codigo_municipio_ibge, codigo_tributacao_nacional_iss,
    regime_tributario, codigo_opcao_simples_nacional, ambiente, padrao_nfse,
    token_homologacao, token_producao,
    inscricao_estadual, ncm_padrao, cfop_padrao, csosn_padrao, descricao_produto_padrao,
    cnpj_nfe, razao_social_nfe, logradouro_nfe, numero_nfe, bairro_nfe, municipio_nfe,
    uf_nfe, cep_nfe, token_homologacao_nfe, token_producao_nfe,
  } = body

  const update: Record<string, unknown> = {
    clinic_id: clinicId,
    cnpj: cnpj || null,
    inscricao_municipal: inscricao_municipal || null,
    codigo_municipio_ibge: codigo_municipio_ibge || null,
    codigo_tributacao_nacional_iss: codigo_tributacao_nacional_iss || null,
    regime_tributario: regime_tributario || 'simples_nacional',
    codigo_opcao_simples_nacional: codigo_opcao_simples_nacional || null,
    ambiente: ambiente === 'producao' ? 'producao' : 'homologacao',
    padrao_nfse: padrao_nfse === 'nacional' ? 'nacional' : 'municipal',
    updated_at: new Date().toISOString(),
    updated_by: user.id,
    inscricao_estadual: inscricao_estadual || null,
    ncm_padrao: ncm_padrao || null,
    cfop_padrao: cfop_padrao || '5102',
    csosn_padrao: csosn_padrao || '102',
    descricao_produto_padrao: descricao_produto_padrao || 'Venda de produto conforme registro interno',
    cnpj_nfe: cnpj_nfe || null,
    razao_social_nfe: razao_social_nfe || null,
    logradouro_nfe: logradouro_nfe || null,
    numero_nfe: numero_nfe || null,
    bairro_nfe: bairro_nfe || null,
    municipio_nfe: municipio_nfe || null,
    uf_nfe: uf_nfe || null,
    cep_nfe: cep_nfe || null,
  }

  if (typeof token_homologacao_nfe === 'string' && token_homologacao_nfe.trim()) {
    update.token_homologacao_nfe = token_homologacao_nfe.trim()
  }
  if (typeof token_producao_nfe === 'string' && token_producao_nfe.trim()) {
    update.token_producao_nfe = token_producao_nfe.trim()
  }

  // Só sobrescreve os tokens se o usuário digitou algo novo (campo em branco = mantém o atual)
  if (typeof token_homologacao === 'string' && token_homologacao.trim()) {
    update.token_homologacao = token_homologacao.trim()
  }
  if (typeof token_producao === 'string' && token_producao.trim()) {
    update.token_producao = token_producao.trim()
  }

  const { error } = await supabase
    .from('clinic_fiscal_config')
    .upsert(update, { onConflict: 'clinic_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
