// Helper server-only de integração com a Focus NFe (NFS-e municipal).
// NUNCA importar este arquivo em componentes client — ele lida com tokens.

export function validarCnpj(cnpjBruto: string): boolean {
  const cnpj = (cnpjBruto || '').replace(/\D/g, '')
  if (cnpj.length !== 14) return false
  if (/^(\d)\1{13}$/.test(cnpj)) return false // todos os dígitos iguais

  const calcDigito = (base: string, pesos: number[]) => {
    const soma = base.split('').reduce((acc, d, i) => acc + Number(d) * pesos[i], 0)
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

  const d1 = calcDigito(cnpj.slice(0, 12), pesos1)
  if (d1 !== Number(cnpj[12])) return false
  const d2 = calcDigito(cnpj.slice(0, 13), pesos2)
  if (d2 !== Number(cnpj[13])) return false

  return true
}

export function validarFormatoFiscal(config: {
  cnpj: string | null
  inscricao_municipal: string | null
  codigo_municipio_ibge: string | null
  codigo_tributacao_nacional_iss: string | null
}): string[] {
  const erros: string[] = []
  if (!config.cnpj || !validarCnpj(config.cnpj)) erros.push('CNPJ inválido (dígito verificador não bate)')
  if (!config.inscricao_municipal?.trim()) erros.push('Inscrição Municipal não preenchida')
  if (!config.codigo_municipio_ibge || !/^\d{7}$/.test(config.codigo_municipio_ibge)) {
    erros.push('Código do município deve ter exatamente 7 dígitos (padrão IBGE)')
  }
  if (!config.codigo_tributacao_nacional_iss?.trim()) erros.push('Código de tributação do serviço não preenchido')
  return erros
}


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
  inscricao_estadual: string | null
  ncm_padrao: string | null
  cfop_padrao: string | null
  csosn_padrao: string | null
  descricao_produto_padrao: string | null
  // Campos dedicados de NFe — usados quando a clínica tem um CNPJ diferente pra produto.
  // Quando nulos, cai no CNPJ/token de NFS-e acima (caso de CNPJ único pros dois tipos).
  cnpj_nfe: string | null
  razao_social_nfe: string | null
  logradouro_nfe: string | null
  numero_nfe: string | null
  bairro_nfe: string | null
  municipio_nfe: string | null
  uf_nfe: string | null
  cep_nfe: string | null
  token_homologacao_nfe: string | null
  token_producao_nfe: string | null
  // Regime Normal (Lucro Presumido/Real) usa CST + base/alíquota reais em vez de CSOSN
  cst_icms_padrao: string | null
  aliquota_icms_padrao: number | null
  cst_pis_padrao: string | null
  aliquota_pis_padrao: number | null
  cst_cofins_padrao: string | null
  aliquota_cofins_padrao: number | null
}

// Resolve qual CNPJ usar pra NFe: o dedicado se existir, senão o mesmo da NFS-e
function cnpjNfe(config: FiscalConfig): string | null {
  return config.cnpj_nfe || config.cnpj
}

function tokenNfe(config: FiscalConfig): string | null {
  const dedicado = config.ambiente === 'producao' ? config.token_producao_nfe : config.token_homologacao_nfe
  return dedicado || focusToken(config)
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

export function fiscalConfigCompletaNfe(config: FiscalConfig | null): { ok: boolean; faltando: string[] } {
  const faltando: string[] = []
  if (!config) return { ok: false, faltando: ['configuração fiscal não cadastrada'] }
  if (!validarCnpj(cnpjNfe(config) || '')) faltando.push('CNPJ (de NFe, ou o mesmo de NFS-e)')
  if (!config.inscricao_estadual) faltando.push('Inscrição Estadual')
  if (!config.ncm_padrao) faltando.push('NCM padrão do produto')
  if (!config.cfop_padrao) faltando.push('CFOP padrão')
  if (!(config.municipio_nfe || config.codigo_municipio_ibge)) faltando.push('Município do emitente (NFe)')
  if (!config.uf_nfe) faltando.push('UF do emitente (NFe)')
  if (!tokenNfe(config)) faltando.push(`Token de NFe (ou de NFS-e) para ${config.ambiente === 'producao' ? 'produção' : 'homologação'}`)

  if (config.regime_tributario === 'simples_nacional') {
    if (!config.csosn_padrao) faltando.push('CSOSN padrão (ICMS — Simples Nacional)')
  } else {
    // Lucro Presumido/Real: precisa de CST + alíquota real, não dá pra assumir um valor
    if (!config.cst_icms_padrao) faltando.push('CST do ICMS (regime não é Simples Nacional)')
    if (config.aliquota_icms_padrao == null) faltando.push('Alíquota do ICMS (regime não é Simples Nacional)')
  }

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

// Consultas de referência (município + código tributário) usadas pra validar os dados
// cadastrados antes de tentar emitir de fato — evita descobrir um erro de digitação só
// na hora da nota real.
export async function consultarMunicipioFocus(config: FiscalConfig, codigoIbge: string) {
  const token = focusToken(config)
  if (!token) throw new Error('Token da Focus NFe não configurado para este ambiente')
  const url = `${focusBaseUrl(config.ambiente)}/municipios/${encodeURIComponent(codigoIbge)}`
  const res = await fetch(url, { headers: { 'Authorization': authHeader(token) } })
  const data = await res.json().catch(() => ({}))
  return { httpStatus: res.status, data }
}

export async function consultarCodigoTributarioFocus(config: FiscalConfig, codigoIbge: string, codigo: string) {
  const token = focusToken(config)
  if (!token) throw new Error('Token da Focus NFe não configurado para este ambiente')
  const url = `${focusBaseUrl(config.ambiente)}/municipios/${encodeURIComponent(codigoIbge)}/codigos_tributarios_municipio/${encodeURIComponent(codigo)}`
  const res = await fetch(url, { headers: { 'Authorization': authHeader(token) } })
  const data = await res.json().catch(() => ({}))
  return { httpStatus: res.status, data }
}

// ── NFe (produto) ──────────────────────────────────────────────────────────
// Campos baseados nos exemplos oficiais da Focus (focusnfe.com.br/php e
// doc.focusnfe.com.br/reference/emitir_nfe). Como é uma nota fiscal de produto de
// verdade (efeito tributário real), o item CSOSN/CFOP/NCM usado aqui vem do "padrão"
// configurado pela clínica — sem catálogo de produto ainda, é tratado como 1 item por
// venda. Recomendo validar com o contador da clínica antes de usar em produção,
// principalmente os campos de PIS/COFINS abaixo (usei CST 07 - isento, comum pra
// optantes do Simples Nacional, mas isso pode variar).
type EmitirNfeParams = {
  config: FiscalConfig
  ref: string
  valor: number
  dataVenda: string // YYYY-MM-DD
  destinatarioCpf: string | null
  destinatarioNome: string | null
}

export async function emitirNfeProduto({ config, ref, valor, dataVenda, destinatarioCpf, destinatarioNome }: EmitirNfeParams) {
  const token = tokenNfe(config)
  if (!token) throw new Error('Token de NFe não configurado para este ambiente')

  const cnpjLimpo = (cnpjNfe(config) || '').replace(/\D/g, '')
  const cpfLimpo = (destinatarioCpf || '').replace(/\D/g, '')
  const razaoSocial = config.razao_social_nfe || undefined
  const regimeTributarioEmitente = config.regime_tributario === 'simples_nacional' ? 1 : 3

  const isSimples = config.regime_tributario === 'simples_nacional'

  // ICMS: Simples Nacional usa CSOSN (só código — o recolhimento é via DAS, não
  // calculado nota a nota). Regime Normal (Lucro Presumido/Real) usa CST + base de
  // cálculo + alíquota + valor real do imposto.
  const icmsBlock: Record<string, unknown> = isSimples
    ? {
        icms_origem: '0',
        icms_situacao_tributaria: config.csosn_padrao || '102',
      }
    : {
        icms_origem: '0',
        icms_situacao_tributaria: config.cst_icms_padrao,
        icms_modalidade_base_calculo: '3', // valor da operação
        icms_base_calculo: valor.toFixed(2),
        icms_aliquota: (config.aliquota_icms_padrao ?? 0).toFixed(2),
        icms_valor: (valor * ((config.aliquota_icms_padrao ?? 0) / 100)).toFixed(2),
      }

  const pisCofinsBlock: Record<string, unknown> = {
    pis_situacao_tributaria: config.cst_pis_padrao || '07',
    cofins_situacao_tributaria: config.cst_cofins_padrao || '07',
    ...(config.aliquota_pis_padrao ? {
      pis_base_calculo: valor.toFixed(2),
      pis_aliquota_percentual: config.aliquota_pis_padrao.toFixed(2),
      pis_valor: (valor * (config.aliquota_pis_padrao / 100)).toFixed(2),
    } : {}),
    ...(config.aliquota_cofins_padrao ? {
      cofins_base_calculo: valor.toFixed(2),
      cofins_aliquota_percentual: config.aliquota_cofins_padrao.toFixed(2),
      cofins_valor: (valor * (config.aliquota_cofins_padrao / 100)).toFixed(2),
    } : {}),
  }

  const payload: Record<string, unknown> = {
    natureza_operacao: 'Venda de mercadoria',
    data_emissao: `${dataVenda}T12:00:00-03:00`,
    tipo_documento: 1, // 1 = saída (venda)
    finalidade_emissao: 1, // normal
    local_destino: 1, // operação interna (mesmo estado) — assume padrão
    consumidor_final: 1,
    presenca_comprador: 1, // presencial

    cnpj_emitente: cnpjLimpo,
    nome_emitente: razaoSocial,
    logradouro_emitente: config.logradouro_nfe || undefined,
    numero_emitente: config.numero_nfe || undefined,
    bairro_emitente: config.bairro_nfe || undefined,
    municipio_emitente: config.municipio_nfe || undefined,
    uf_emitente: config.uf_nfe || undefined,
    cep_emitente: (config.cep_nfe || '').replace(/\D/g, '') || undefined,
    inscricao_estadual_emitente: config.inscricao_estadual || undefined,
    regime_tributario_emitente: regimeTributarioEmitente,

    ...(cpfLimpo ? { cpf_destinatario: cpfLimpo, nome_destinatario: destinatarioNome || undefined } : {}),
    indicador_inscricao_estadual_destinatario: 9, // 9 = não contribuinte (consumidor final pessoa física)

    valor_produtos: valor,
    valor_total: valor,
    valor_frete: 0,
    valor_seguro: 0,
    valor_desconto: 0,
    valor_outras_despesas: 0,
    modalidade_frete: 9, // sem frete

    items: [
      {
        numero_item: '1',
        codigo_produto: ref,
        descricao: config.descricao_produto_padrao || 'Venda de produto conforme registro interno',
        codigo_ncm: config.ncm_padrao,
        cfop: config.cfop_padrao,
        unidade_comercial: 'UN',
        unidade_tributavel: 'UN',
        quantidade_comercial: '1.00',
        quantidade_tributavel: '1.00',
        valor_unitario_comercial: valor.toFixed(2),
        valor_unitario_tributavel: valor.toFixed(2),
        valor_bruto: valor.toFixed(2),
        valor_desconto: '0.00',
        ...icmsBlock,
        ...pisCofinsBlock,
      },
    ],
  }

  const url = `${focusBaseUrl(config.ambiente)}/nfe?ref=${encodeURIComponent(ref)}`
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

export async function consultarNfeProduto(config: FiscalConfig, ref: string) {
  const token = tokenNfe(config)
  if (!token) throw new Error('Token de NFe não configurado para este ambiente')

  const url = `${focusBaseUrl(config.ambiente)}/nfe/${encodeURIComponent(ref)}`
  const res = await fetch(url, {
    headers: { 'Authorization': authHeader(token) },
  })
  const data = await res.json().catch(() => ({}))
  return { httpStatus: res.status, data }
}
