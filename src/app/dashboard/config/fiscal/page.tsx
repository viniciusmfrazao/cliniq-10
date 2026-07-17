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
    .select('cnpj, inscricao_municipal, codigo_municipio_ibge, codigo_tributacao_nacional_iss, regime_tributario, codigo_opcao_simples_nacional, ambiente, padrao_nfse, token_homologacao, token_producao, updated_at')
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
        <h1 className="text-2xl font-bold text-slate-900">Nota Fiscal (NFS-e)</h1>
        <p className="text-slate-500 mt-1">
          Cadastro fiscal da clínica para emissão de NFS-e via Focus NFe. Os tokens ficam armazenados
          apenas no servidor — nunca são exibidos por completo aqui.
        </p>
      </div>
      <FiscalForm clinicId={userData!.clinic_id} initialConfig={initialConfig} />
    </div>
  )
}
