'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

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
} | null

type Props = {
  clinicId: string
  initialConfig: InitialConfig
}

export default function FiscalForm({ initialConfig }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [saving, setSaving] = useState(false)

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

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-emerald-700 transition disabled:opacity-60 text-sm">
          {saving && <LoadingSpinner size="sm" />}
          Salvar configuração
        </button>
      </div>
    </div>
  )
}
