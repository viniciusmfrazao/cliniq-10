'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

// Validação client-side (feedback instantâneo, sem chamar o servidor). A validação
// autoritativa — incluindo consulta na base da Focus — acontece em /api/config/fiscal/validar.
function cnpjValido(cnpjBruto: string): boolean {
  const cnpj = (cnpjBruto || '').replace(/\D/g, '')
  if (cnpj.length !== 14) return false
  if (/^(\d)\1{13}$/.test(cnpj)) return false
  const calc = (base: string, pesos: number[]) => {
    const soma = base.split('').reduce((acc, d, i) => acc + Number(d) * pesos[i], 0)
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }
  const d1 = calc(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  if (d1 !== Number(cnpj[12])) return false
  const d2 = calc(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return d2 === Number(cnpj[13])
}

type InitialConfig = {
  cnpj: string | null
  inscricao_municipal: string | null
  codigo_municipio_ibge: string | null
  codigo_tributacao_nacional_iss: string | null
  regime_tributario: string | null
  codigo_opcao_simples_nacional: number | null
  ambiente: string
  padrao_nfse: string
  token_homologacao_mask: string | null
  token_producao_mask: string | null
  updated_at: string | null
  inscricao_estadual: string | null
  ncm_padrao: string | null
  cfop_padrao: string | null
  csosn_padrao: string | null
  descricao_produto_padrao: string | null
  cnpj_nfe: string | null
  razao_social_nfe: string | null
  logradouro_nfe: string | null
  numero_nfe: string | null
  bairro_nfe: string | null
  municipio_nfe: string | null
  uf_nfe: string | null
  cep_nfe: string | null
  token_homologacao_nfe_mask: string | null
  token_producao_nfe_mask: string | null
  cst_icms_padrao: string | null
  aliquota_icms_padrao: number | null
  cst_pis_padrao: string | null
  aliquota_pis_padrao: number | null
  cst_cofins_padrao: string | null
  aliquota_cofins_padrao: number | null
  isento_inscricao_municipal: boolean | null
  emite_nfse: boolean | null
  ibs_cbs_classificacao_padrao: string | null
  ibs_cbs_situacao_padrao: string | null
} | null

type Props = {
  clinicId: string
  initialConfig: InitialConfig
}

export default function FiscalForm({ initialConfig }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [validando, setValidando] = useState(false)
  const [resultadoValidacao, setResultadoValidacao] = useState<{ ok: boolean; erros: string[]; avisos: string[] } | null>(null)

  const [cnpj, setCnpj] = useState(initialConfig?.cnpj || '')
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState(initialConfig?.inscricao_municipal || '')
  const [codigoMunicipio, setCodigoMunicipio] = useState(initialConfig?.codigo_municipio_ibge || '')
  const [codigoTributacao, setCodigoTributacao] = useState(initialConfig?.codigo_tributacao_nacional_iss || '')
  const [regimeTributario, setRegimeTributario] = useState(initialConfig?.regime_tributario || 'simples_nacional')
  const [codigoSimples, setCodigoSimples] = useState(String(initialConfig?.codigo_opcao_simples_nacional ?? ''))
  const [ambiente, setAmbiente] = useState(initialConfig?.ambiente || 'homologacao')
  const [padraoNfse, setPadraoNfse] = useState(initialConfig?.padrao_nfse || 'municipal')
  const [tokenHomologacao, setTokenHomologacao] = useState('')
  const [tokenProducao, setTokenProducao] = useState('')
  const [inscricaoEstadual, setInscricaoEstadual] = useState(initialConfig?.inscricao_estadual || '')
  const [ncmPadrao, setNcmPadrao] = useState(initialConfig?.ncm_padrao || '')
  const [cfopPadrao, setCfopPadrao] = useState(initialConfig?.cfop_padrao || '5102')
  const [csosnPadrao, setCsosnPadrao] = useState(initialConfig?.csosn_padrao || '102')
  const [descricaoProdutoPadrao, setDescricaoProdutoPadrao] = useState(
    initialConfig?.descricao_produto_padrao || 'Venda de produto conforme registro interno'
  )
  const [cnpjDiferente, setCnpjDiferente] = useState(!!initialConfig?.cnpj_nfe)
  const [cnpjNfe, setCnpjNfe] = useState(initialConfig?.cnpj_nfe || '')
  const [razaoSocialNfe, setRazaoSocialNfe] = useState(initialConfig?.razao_social_nfe || '')
  const [logradouroNfe, setLogradouroNfe] = useState(initialConfig?.logradouro_nfe || '')
  const [numeroNfe, setNumeroNfe] = useState(initialConfig?.numero_nfe || '')
  const [bairroNfe, setBairroNfe] = useState(initialConfig?.bairro_nfe || '')
  const [municipioNfe, setMunicipioNfe] = useState(initialConfig?.municipio_nfe || '')
  const [ufNfe, setUfNfe] = useState(initialConfig?.uf_nfe || '')
  const [cepNfe, setCepNfe] = useState(initialConfig?.cep_nfe || '')
  const [tokenHomologacaoNfe, setTokenHomologacaoNfe] = useState('')
  const [tokenProducaoNfe, setTokenProducaoNfe] = useState('')
  const [cstIcmsPadrao, setCstIcmsPadrao] = useState(initialConfig?.cst_icms_padrao || '')
  const [aliquotaIcmsPadrao, setAliquotaIcmsPadrao] = useState(String(initialConfig?.aliquota_icms_padrao ?? ''))
  const [cstPisPadrao, setCstPisPadrao] = useState(initialConfig?.cst_pis_padrao || '07')
  const [aliquotaPisPadrao, setAliquotaPisPadrao] = useState(String(initialConfig?.aliquota_pis_padrao ?? '0'))
  const [cstCofinsPadrao, setCstCofinsPadrao] = useState(initialConfig?.cst_cofins_padrao || '07')
  const [aliquotaCofinsPadrao, setAliquotaCofinsPadrao] = useState(String(initialConfig?.aliquota_cofins_padrao ?? '0'))
  const [isentoIM, setIsentoIM] = useState(!!initialConfig?.isento_inscricao_municipal)
  const [emiteNfse, setEmiteNfse] = useState(initialConfig?.emite_nfse !== false)
  const [ibsCbsClassificacao, setIbsCbsClassificacao] = useState(initialConfig?.ibs_cbs_classificacao_padrao || '')
  const [ibsCbsSituacao, setIbsCbsSituacao] = useState(initialConfig?.ibs_cbs_situacao_padrao || '')

  async function handleValidar() {
    setValidando(true)
    setResultadoValidacao(null)
    try {
      const res = await fetch('/api/config/fiscal/validar', { method: 'POST' })
      const data = await res.json()
      setResultadoValidacao(data)
      if (data.ok) {
        toast.success('Dados válidos')
      } else {
        toast.error('Encontrei problemas nos dados fiscais')
      }
    } catch (err) {
      toast.error('Erro ao validar', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setValidando(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/config/fiscal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cnpj,
          inscricao_municipal: inscricaoMunicipal,
          codigo_municipio_ibge: codigoMunicipio,
          codigo_tributacao_nacional_iss: codigoTributacao,
          regime_tributario: regimeTributario,
          codigo_opcao_simples_nacional: codigoSimples ? parseInt(codigoSimples) : null,
          ambiente,
          padrao_nfse: padraoNfse,
          token_homologacao: tokenHomologacao,
          token_producao: tokenProducao,
          inscricao_estadual: inscricaoEstadual,
          ncm_padrao: ncmPadrao,
          cfop_padrao: cfopPadrao,
          csosn_padrao: csosnPadrao,
          descricao_produto_padrao: descricaoProdutoPadrao,
          cnpj_nfe: cnpjDiferente ? cnpjNfe : null,
          razao_social_nfe: cnpjDiferente ? razaoSocialNfe : null,
          logradouro_nfe: logradouroNfe,
          numero_nfe: numeroNfe,
          bairro_nfe: bairroNfe,
          municipio_nfe: municipioNfe,
          uf_nfe: ufNfe,
          cep_nfe: cepNfe,
          token_homologacao_nfe: tokenHomologacaoNfe,
          token_producao_nfe: tokenProducaoNfe,
          cst_icms_padrao: cstIcmsPadrao,
          aliquota_icms_padrao: aliquotaIcmsPadrao,
          cst_pis_padrao: cstPisPadrao,
          aliquota_pis_padrao: aliquotaPisPadrao,
          cst_cofins_padrao: cstCofinsPadrao,
          aliquota_cofins_padrao: aliquotaCofinsPadrao,
          isento_inscricao_municipal: isentoIM,
          emite_nfse: emiteNfse,
          ibs_cbs_classificacao_padrao: ibsCbsClassificacao,
          ibs_cbs_situacao_padrao: ibsCbsSituacao,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao salvar')
      }
      toast.success('Configuração fiscal salva')
      setTokenHomologacao('')
      setTokenProducao('')
      setTokenHomologacaoNfe('')
      setTokenProducaoNfe('')
      router.refresh()
    } catch (err) {
      toast.error('Erro ao salvar', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="card p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Dados fiscais da clínica</h2>
          <label className="flex items-center gap-2 text-xs text-slate-600 mt-2">
            <input type="checkbox" checked={!emiteNfse} onChange={e => setEmiteNfse(!e.target.checked)} />
            Esta clínica não emite NFS-e (só vende produto, via NFe)
          </label>
        </div>

        {emiteNfse && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">CNPJ</label>
            <input value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="00.000.000/0000-00"
              className="input w-full text-sm" />
            {cnpj.replace(/\D/g, '').length === 14 && !cnpjValido(cnpj) && (
              <p className="text-xs text-rose-600 mt-1">Dígito verificador não confere — confira o CNPJ</p>
            )}
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Inscrição Municipal (CCM)</label>
            <input value={inscricaoMunicipal} onChange={e => setInscricaoMunicipal(e.target.value)}
              disabled={isentoIM} placeholder={isentoIM ? 'Isento' : undefined}
              className="input w-full text-sm disabled:bg-slate-50 disabled:text-slate-400" />
            <label className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
              <input type="checkbox" checked={isentoIM} onChange={e => setIsentoIM(e.target.checked)} />
              Isento de Inscrição Municipal
            </label>
          </div>
        </div>
        )}

        {emiteNfse && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Código do município (IBGE, 7 dígitos)</label>
            <input value={codigoMunicipio} onChange={e => setCodigoMunicipio(e.target.value)}
              placeholder="Ex: 3170206 (Uberlândia)" className="input w-full text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Código de tributação do serviço (ISS)</label>
            <input value={codigoTributacao} onChange={e => setCodigoTributacao(e.target.value)}
              className="input w-full text-sm" />
          </div>
        </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Regime tributário</label>
            <select value={regimeTributario} onChange={e => setRegimeTributario(e.target.value)}
              className="input w-full text-sm">
              <option value="simples_nacional">Simples Nacional</option>
              <option value="lucro_presumido">Lucro Presumido</option>
              <option value="lucro_real">Lucro Real</option>
            </select>
            <p className="text-xs text-slate-400 mt-1">Usado tanto pra NFS-e quanto pra NFe</p>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Ambiente ativo</label>
            <select value={ambiente} onChange={e => setAmbiente(e.target.value)}
              className="input w-full text-sm">
              <option value="homologacao">Homologação (testes)</option>
              <option value="producao">Produção</option>
            </select>
          </div>
        </div>

        {emiteNfse && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Código opção Simples Nacional</label>
            <input value={codigoSimples} onChange={e => setCodigoSimples(e.target.value)} type="number"
              className="input w-full text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Padrão de NFS-e</label>
            <select value={padraoNfse} onChange={e => setPadraoNfse(e.target.value)}
              className="input w-full text-sm">
              <option value="municipal">Municipal (padrão específico da prefeitura)</option>
              <option value="nacional">NFS-e Nacional</option>
            </select>
          </div>
        </div>
        )}
      </div>

      <div className="card p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Tokens da Focus NFe</h2>
          <p className="text-xs text-slate-500 mt-1">
            Ficam armazenados apenas no servidor. Deixe em branco para manter o token atual.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">
              Token de Homologação {initialConfig?.token_homologacao_mask && (
                <span className="text-slate-400">(atual: {initialConfig.token_homologacao_mask})</span>
              )}
            </label>
            <input value={tokenHomologacao} onChange={e => setTokenHomologacao(e.target.value)} type="password"
              placeholder={initialConfig?.token_homologacao_mask ? 'Deixe em branco para manter' : 'Cole o token aqui'}
              className="input w-full text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">
              Token de Produção {initialConfig?.token_producao_mask && (
                <span className="text-slate-400">(atual: {initialConfig.token_producao_mask})</span>
              )}
            </label>
            <input value={tokenProducao} onChange={e => setTokenProducao(e.target.value)} type="password"
              placeholder={initialConfig?.token_producao_mask ? 'Deixe em branco para manter' : 'Cole o token aqui'}
              className="input w-full text-sm" />
          </div>
        </div>
      </div>

      <div className="card p-6 space-y-4 border-amber-100">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">NFe (produto)</h2>
          <p className="text-xs text-slate-500 mt-1">
            Emissão real de NFe (nota de produto). Se a clínica usa o mesmo CNPJ pra serviço e
            produto, deixa "CNPJ diferente" desligado — usa o CNPJ e token da NFS-e acima. Se
            usa um CNPJ separado (ex: uma empresa só pra venda de produto), liga o toggle.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={cnpjDiferente} onChange={e => setCnpjDiferente(e.target.checked)} />
          Esta clínica usa um CNPJ diferente para NFe (produto)
        </label>

        {cnpjDiferente && (
          <div className="grid grid-cols-2 gap-3 bg-amber-50/50 p-3 rounded-xl">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">CNPJ (NFe)</label>
              <input value={cnpjNfe} onChange={e => setCnpjNfe(e.target.value)} className="input w-full text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Razão Social (NFe)</label>
              <input value={razaoSocialNfe} onChange={e => setRazaoSocialNfe(e.target.value)} className="input w-full text-sm" />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Inscrição Estadual</label>
            <input value={inscricaoEstadual} onChange={e => setInscricaoEstadual(e.target.value)}
              placeholder="Ou 'ISENTO' se aplicável" className="input w-full text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">NCM padrão do produto</label>
            <input value={ncmPadrao} onChange={e => setNcmPadrao(e.target.value)}
              placeholder="Ex: 33049900 (cosméticos)" className="input w-full text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">CFOP padrão</label>
            <input value={cfopPadrao} onChange={e => setCfopPadrao(e.target.value)}
              className="input w-full text-sm" />
          </div>
          {regimeTributario === 'simples_nacional' ? (
            <div>
              <label className="text-xs text-slate-500 mb-1 block">CSOSN padrão (ICMS — Simples Nacional)</label>
              <input value={csosnPadrao} onChange={e => setCsosnPadrao(e.target.value)}
                className="input w-full text-sm" />
            </div>
          ) : (
            <div>
              <label className="text-xs text-slate-500 mb-1 block">CST do ICMS (Regime Normal)</label>
              <input value={cstIcmsPadrao} onChange={e => setCstIcmsPadrao(e.target.value)}
                placeholder="Ex: 00, 40, 60" className="input w-full text-sm" />
            </div>
          )}
        </div>

        {regimeTributario !== 'simples_nacional' && (
          <div className="bg-amber-50/50 p-3 rounded-xl space-y-3">
            <p className="text-xs text-amber-700">
              Regime Normal (Lucro Presumido/Real) precisa de alíquotas reais, não só um código —
              confirma esses valores com o contador da clínica antes de emitir de verdade.
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Alíquota ICMS (%)</label>
                <input value={aliquotaIcmsPadrao} onChange={e => setAliquotaIcmsPadrao(e.target.value)}
                  type="number" step="0.01" className="input w-full text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">CST PIS</label>
                <input value={cstPisPadrao} onChange={e => setCstPisPadrao(e.target.value)} className="input w-full text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Alíquota PIS (%)</label>
                <input value={aliquotaPisPadrao} onChange={e => setAliquotaPisPadrao(e.target.value)}
                  type="number" step="0.01" className="input w-full text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">CST COFINS</label>
                <input value={cstCofinsPadrao} onChange={e => setCstCofinsPadrao(e.target.value)} className="input w-full text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Alíquota COFINS (%)</label>
                <input value={aliquotaCofinsPadrao} onChange={e => setAliquotaCofinsPadrao(e.target.value)}
                  type="number" step="0.01" className="input w-full text-sm" />
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="text-xs text-slate-500 mb-1 block">Descrição padrão do produto na nota</label>
          <input value={descricaoProdutoPadrao} onChange={e => setDescricaoProdutoPadrao(e.target.value)}
            className="input w-full text-sm" />
        </div>

        <div className="bg-amber-50/50 p-3 rounded-xl space-y-3">
          <p className="text-xs text-amber-700">
            Reforma Tributária (IBS/CBS) — exigido pela SEFAZ desde 2026, além do ICMS/PIS/COFINS
            acima. Os dois códigos são pareados por regra tributária real (o par certo depende do
            seu regime/operação) — confirma com o contador ou o suporte da Focus antes de
            preencher. Não deixe em branco nem copie um valor de exemplo sem confirmar.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Situação Tributária IBS/CBS (CST) *</label>
              <input value={ibsCbsSituacao} onChange={e => setIbsCbsSituacao(e.target.value)}
                className="input w-full text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Classificação Tributária IBS/CBS (cClassTrib) *</label>
              <input value={ibsCbsClassificacao} onChange={e => setIbsCbsClassificacao(e.target.value)}
                className="input w-full text-sm" />
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100">
          <p className="text-xs text-slate-500 mb-2">
            Endereço do emitente (obrigatório pra NFe — diferente da NFS-e, que não exige)
          </p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Logradouro</label>
              <input value={logradouroNfe} onChange={e => setLogradouroNfe(e.target.value)} className="input w-full text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Número</label>
              <input value={numeroNfe} onChange={e => setNumeroNfe(e.target.value)} className="input w-full text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Bairro</label>
              <input value={bairroNfe} onChange={e => setBairroNfe(e.target.value)} className="input w-full text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Município</label>
              <input value={municipioNfe} onChange={e => setMunicipioNfe(e.target.value)} placeholder="Nome da cidade" className="input w-full text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">UF</label>
              <input value={ufNfe} onChange={e => setUfNfe(e.target.value.toUpperCase().slice(0, 2))} maxLength={2} className="input w-full text-sm" />
            </div>
          </div>
          <div className="mt-3">
            <label className="text-xs text-slate-500 mb-1 block">CEP</label>
            <input value={cepNfe} onChange={e => setCepNfe(e.target.value)} className="input w-full text-sm max-w-[200px]" />
          </div>
        </div>

        {cnpjDiferente && (
          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-500 mb-2">
              Tokens de NFe (só preencher se o CNPJ de NFe for diferente — outra empresa na Focus)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">
                  Token de Homologação (NFe) {initialConfig?.token_homologacao_nfe_mask && (
                    <span className="text-slate-400">(atual: {initialConfig.token_homologacao_nfe_mask})</span>
                  )}
                </label>
                <input value={tokenHomologacaoNfe} onChange={e => setTokenHomologacaoNfe(e.target.value)} type="password"
                  placeholder="Cole o token aqui" className="input w-full text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">
                  Token de Produção (NFe) {initialConfig?.token_producao_nfe_mask && (
                    <span className="text-slate-400">(atual: {initialConfig.token_producao_nfe_mask})</span>
                  )}
                </label>
                <input value={tokenProducaoNfe} onChange={e => setTokenProducaoNfe(e.target.value)} type="password"
                  placeholder="Cole o token aqui" className="input w-full text-sm" />
              </div>
            </div>
          </div>
        )}
      </div>

      {resultadoValidacao && (
        <div className={`card p-4 space-y-2 ${resultadoValidacao.ok ? 'border-emerald-200' : 'border-rose-200'}`}>
          {resultadoValidacao.erros.map((e, i) => (
            <p key={`erro-${i}`} className="text-sm text-rose-700 flex items-start gap-2">
              <span>✕</span> {e}
            </p>
          ))}
          {resultadoValidacao.avisos.map((a, i) => (
            <p key={`aviso-${i}`} className="text-sm text-slate-600 flex items-start gap-2">
              <span>ℹ</span> {a}
            </p>
          ))}
          {resultadoValidacao.ok && resultadoValidacao.erros.length === 0 && resultadoValidacao.avisos.length === 0 && (
            <p className="text-sm text-emerald-700">Dados válidos</p>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button onClick={handleValidar} disabled={validando}
          className="flex items-center gap-2 border border-slate-200 text-slate-700 px-5 py-2.5 rounded-xl font-semibold hover:bg-slate-50 transition disabled:opacity-60 text-sm">
          {validando && <LoadingSpinner size="sm" />}
          Validar dados
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-emerald-700 transition disabled:opacity-60 text-sm">
          {saving && <LoadingSpinner size="sm" />}
          Salvar configuração
        </button>
      </div>
    </div>
  )
}
