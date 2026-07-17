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
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao salvar')
      }
      toast.success('Configuração fiscal salva')
      setTokenHomologacao('')
      setTokenProducao('')
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
        <h2 className="text-sm font-semibold text-slate-900">Dados fiscais da clínica</h2>

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
              className="input w-full text-sm" />
          </div>
        </div>

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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Regime tributário</label>
            <select value={regimeTributario} onChange={e => setRegimeTributario(e.target.value)}
              className="input w-full text-sm">
              <option value="simples_nacional">Simples Nacional</option>
              <option value="lucro_presumido">Lucro Presumido</option>
              <option value="lucro_real">Lucro Real</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Código opção Simples Nacional</label>
            <input value={codigoSimples} onChange={e => setCodigoSimples(e.target.value)} type="number"
              className="input w-full text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Padrão de NFS-e</label>
            <select value={padraoNfse} onChange={e => setPadraoNfse(e.target.value)}
              className="input w-full text-sm">
              <option value="municipal">Municipal (padrão específico da prefeitura)</option>
              <option value="nacional">NFS-e Nacional</option>
            </select>
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
          <h2 className="text-sm font-semibold text-slate-900">NFe (produto) — em construção</h2>
          <p className="text-xs text-amber-600 mt-1">
            Estes campos ficam salvos e prontos, mas o envio real de NFe pra Focus ainda não foi
            implementado. Usa o mesmo token acima (a empresa na Focus cobre os dois tipos de nota).
          </p>
        </div>

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
          <div>
            <label className="text-xs text-slate-500 mb-1 block">CSOSN padrão (Simples Nacional)</label>
            <input value={csosnPadrao} onChange={e => setCsosnPadrao(e.target.value)}
              className="input w-full text-sm" />
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-1 block">Descrição padrão do produto na nota</label>
          <input value={descricaoProdutoPadrao} onChange={e => setDescricaoProdutoPadrao(e.target.value)}
            className="input w-full text-sm" />
        </div>
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
