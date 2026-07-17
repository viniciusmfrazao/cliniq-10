// Helper server-only de integração com a Focus NFe (NFS-e municipal).
// NUNCA importar este arquivo em componentes client — ele lida com tokens.

type FiscalConfig = {
  cnpj: string | null
  inscricao_municipal: string | null
  codigo_municipio_ibge: string | null
  codigo_tributacao_nacional_iss: string | null
  regime_tributario: string | null
  codigo_opcao_simples_nacional: number | null
  ambiente: string
  padrao_nfse: string
  descricao_servico_padrao: string | null
  token_homologacao: string | null
  token_producao: string | null
}

export function focusBaseUrl(ambiente: string) {
  return ambiente === 'producao'
    ? 'https://api.focusnfe.com.br/v2'
    : 'https://homologacao.focusnfe.com.br/v2'
}

export function focusToken(config: FiscalConfig): string | null {
  return config.ambiente === 'producao' ? config.token_producao : config.token_homologacao
}

function authHeader(token: string) {
  // Basic Auth: usuário = token, senha vazia
  return 'Basic ' + Buffer.from(`${token}:`).toString('base64')
}

export function fiscalConfigCompleta(config: FiscalConfig | null): { ok: boolean; faltando: string[] } {
  const faltando: string[] = []
  if (!config) return { ok: false, faltando: ['configuração fiscal não cadastrada'] }
  if (!config.cnpj) faltando.push('CNPJ')
  if (!config.inscricao_municipal) faltando.push('Inscrição Municipal')
  if (!config.codigo_municipio_ibge) faltando.push('Código do município')
  if (!config.codigo_tributacao_nacional_iss) faltando.push('Código de tributação do serviço')
  if (!focusToken(config)) faltando.push(`Token de ${config.ambiente === 'producao' ? 'produção' : 'homologação'}`)
  return { ok: faltando.length === 0, faltando }
}

type EmitirNfseParams = {
  config: FiscalConfig
  ref: string
  valor: number
  dataVenda: string // YYYY-MM-DD
  tomadorCpf: string | null
  tomadorNome: string | null
}

export async function emitirNfseMunicipal({ config, ref, valor, dataVenda, tomadorCpf, tomadorNome }: EmitirNfseParams) {
  const token = focusToken(config)
  if (!token) throw new Error('Token da Focus NFe não configurado para este ambiente')

  const cnpjLimpo = (config.cnpj || '').replace(/\D/g, '')
  const cpfLimpo = (tomadorCpf || '').replace(/\D/g, '')

  const payload: Record<string, unknown> = {
    data_emissao: `${dataVenda}T12:00:00-03:00`,
    natureza_operacao: '1',
    optante_simples_nacional: config.regime_tributario === 'simples_nacional',
    prestador: {
      cnpj: cnpjLimpo,
      inscricao_municipal: config.inscricao_municipal,
      codigo_municipio: config.codigo_municipio_ibge,
    },
    tomador: cpfLimpo
      ? { cpf: cpfLimpo, razao_social: tomadorNome || undefined }
      : undefined,
    servico: {
      valor_servicos: valor,
      iss_retido: false,
      item_lista_servico: config.codigo_tributacao_nacional_iss,
      codigo_tributario_municipio: config.codigo_tributacao_nacional_iss,
      discriminacao: config.descricao_servico_padrao || 'Serviço de estética conforme registro interno',
      codigo_municipio: config.codigo_municipio_ibge,
    },
  }

  if (config.regime_tributario === 'simples_nacional') {
    payload.regime_especial_tributacao = '6' // ME/EPP - Simples Nacional
  }

  const url = `${focusBaseUrl(config.ambiente)}/nfse?ref=${encodeURIComponent(ref)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': authHeader(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = await res.json().catch(() => ({}))
  return { httpStatus: res.status, data }
}

export async function consultarNfseMunicipal(config: FiscalConfig, ref: string) {
  const token = focusToken(config)
  if (!token) throw new Error('Token da Focus NFe não configurado para este ambiente')

  const url = `${focusBaseUrl(config.ambiente)}/nfse/${encodeURIComponent(ref)}`
  const res = await fetch(url, {
    headers: { 'Authorization': authHeader(token) },
  })
  const data = await res.json().catch(() => ({}))
  return { httpStatus: res.status, data }
}
