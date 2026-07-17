import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import FiscalForm from './fiscal-form'

export const dynamic = 'force-dynamic'

export default async function FiscalPage() {
  const supabase = await createClient()
  const user = await getCachedUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users').select('clinic_id, role').eq('id', user.id).single()

  if (!['admin', 'super_admin'].includes(userData?.role || '')) redirect('/dashboard')

  const { data: clinic } = await supabase
    .from('clinics')
    .select('id, settings')
    .eq('id', userData!.clinic_id)
    .single()

  const activeModules: string[] = clinic?.settings?.active_modules || []
  if (!activeModules.includes('nfse')) redirect('/dashboard/config')

  // Busca config existente via rota server-only (mascara tokens antes de chegar no client)
  const { data: config } = await supabase
    .from('clinic_fiscal_config')
    .select('cnpj, inscricao_municipal, codigo_municipio_ibge, codigo_tributacao_nacional_iss, regime_tributario, codigo_opcao_simples_nacional, ambiente, padrao_nfse, token_homologacao, token_producao, updated_at, inscricao_estadual, ncm_padrao, cfop_padrao, csosn_padrao, descricao_produto_padrao, cnpj_nfe, razao_social_nfe, logradouro_nfe, numero_nfe, bairro_nfe, municipio_nfe, uf_nfe, cep_nfe, token_homologacao_nfe, token_producao_nfe, cst_icms_padrao, aliquota_icms_padrao, cst_pis_padrao, aliquota_pis_padrao, cst_cofins_padrao, aliquota_cofins_padrao')
    .eq('clinic_id', userData!.clinic_id)
    .maybeSingle()

  // Nunca manda o token completo pro client — só um indicador de presença + últimos 4 chars
  const mask = (t: string | null | undefined) => (t ? `••••${t.slice(-4)}` : null)

  const initialConfig = config ? {
    cnpj: config.cnpj,
    inscricao_municipal: config.inscricao_municipal,
    codigo_municipio_ibge: config.codigo_municipio_ibge,
    codigo_tributacao_nacional_iss: config.codigo_tributacao_nacional_iss,
    regime_tributario: config.regime_tributario,
    codigo_opcao_simples_nacional: config.codigo_opcao_simples_nacional,
    ambiente: config.ambiente,
    padrao_nfse: config.padrao_nfse,
    token_homologacao_mask: mask(config.token_homologacao),
    token_producao_mask: mask(config.token_producao),
    updated_at: config.updated_at,
    inscricao_estadual: config.inscricao_estadual,
    ncm_padrao: config.ncm_padrao,
    cfop_padrao: config.cfop_padrao,
    csosn_padrao: config.csosn_padrao,
    descricao_produto_padrao: config.descricao_produto_padrao,
    cnpj_nfe: config.cnpj_nfe,
    razao_social_nfe: config.razao_social_nfe,
    logradouro_nfe: config.logradouro_nfe,
    numero_nfe: config.numero_nfe,
    bairro_nfe: config.bairro_nfe,
    municipio_nfe: config.municipio_nfe,
    uf_nfe: config.uf_nfe,
    cep_nfe: config.cep_nfe,
    token_homologacao_nfe_mask: mask(config.token_homologacao_nfe),
    token_producao_nfe_mask: mask(config.token_producao_nfe),
    cst_icms_padrao: config.cst_icms_padrao,
    aliquota_icms_padrao: config.aliquota_icms_padrao,
    cst_pis_padrao: config.cst_pis_padrao,
    aliquota_pis_padrao: config.aliquota_pis_padrao,
    cst_cofins_padrao: config.cst_cofins_padrao,
    aliquota_cofins_padrao: config.aliquota_cofins_padrao,
  } : null

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-6">
        <Link
          href="/dashboard/config"
          className="text-sm text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
        >
          <Icon name="chevronLeft" className="w-4 h-4" />
          Voltar
        </Link>
      </div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Nota Fiscal (NFS-e e NFe)</h1>
        <p className="text-slate-500 mt-1">
          Cadastro fiscal da clínica para emissão via Focus NFe — serviço (NFS-e) e produto
          (NFe). Os tokens ficam armazenados apenas no servidor — nunca são exibidos por
          completo aqui.
        </p>
      </div>
      <FiscalForm clinicId={userData!.clinic_id} initialConfig={initialConfig} />
    </div>
  )
}
