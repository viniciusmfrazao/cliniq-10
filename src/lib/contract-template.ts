/**
 * Template do Contrato de Adesão, Termos de Uso de Software (SaaS) e
 * Acordo de Tratamento de Dados (DPA) da Clinike.
 *
 * O texto das cláusulas foi fornecido pelo advogado responsável e não deve
 * ser alterado por aqui sem revisão jurídica. Este módulo apenas injeta os
 * dados de qualificação das partes (clínica + signatário) no cabeçalho e
 * no bloco de assinatura.
 *
 * IMPORTANTE: ao registrar uma nova versão de texto, incremente
 * CONTRACT_TEMPLATE_VERSION. Contratos já assinados guardam o snapshot
 * completo do texto em `platform_contracts.content`, então mudanças aqui
 * nunca afetam contratos já assinados — apenas os que ainda vão ser gerados.
 */

export const CONTRACT_TEMPLATE_VERSION = 'v1'

export type ContractClinicData = {
  name: string
  cnpj: string | null
  clinic_phone: string | null
  plan: string | null
  plan_price: number | null
}

export type ContractSignerData = {
  signerName?: string | null
  signerCpf?: string | null
  signerRole?: string | null
}

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return 'a combinar'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  essencial: 'Essencial',
  profissional: 'Profissional',
  premium: 'Premium',
  enterprise: 'Enterprise',
}

/**
 * Renderiza o contrato completo. Sem dados de assinatura, gera a versão
 * "para revisão" (usada na tela de assinatura antes do aceite). Com os
 * dados de assinatura preenchidos, gera o snapshot final que é gravado
 * permanentemente após o aceite.
 */
export function renderPlatformContract(
  clinic: ContractClinicData,
  signer: ContractSignerData = {},
  generatedAt: Date = new Date()
): string {
  const planLabel = clinic.plan ? (PLAN_LABELS[clinic.plan] || clinic.plan) : 'não definido'
  const signerName = signer.signerName?.trim() || '[a ser preenchido no ato da assinatura]'
  const signerCpf = signer.signerCpf?.trim() || '[a ser preenchido no ato da assinatura]'
  const signerRole = signer.signerRole?.trim() || '[a ser preenchido no ato da assinatura]'

  return `CONTRATO DE ADESÃO, TERMOS DE USO DE SOFTWARE (SAAS) E ACORDO DE TRATAMENTO DE DADOS (DPA)

Seja bem-vindo à Clinike.

Este instrumento contratual regula os termos, direitos e obrigações para o uso da plataforma Clinike. Ao manifestar o seu aceite eletrônico, efetuar o pagamento da primeira mensalidade ou utilizar as funcionalidades do sistema, você (Contratante) adere integralmente a este documento.

QUALIFICAÇÃO DAS PARTES

CONTRATADA: VINICIUS DE MATOS FRAZÃO, pessoa física, inscrito no CPF sob o nº 095.618.956-33, criador, desenvolvedor e proprietário legal da plataforma Clinike.

CONTRATANTE:
Razão Social / Nome: ${clinic.name}
CNPJ: ${clinic.cnpj || 'não informado'}
Telefone/WhatsApp de contato: ${clinic.clinic_phone || 'não informado'}
Plano contratado: ${planLabel}
Valor da mensalidade vigente na data de adesão: ${formatCurrency(clinic.plan_price)}
Representante legal / responsável pela assinatura: ${signerName}
CPF do representante: ${signerCpf}
Cargo/função do representante na Contratante: ${signerRole}
Data de adesão: ${formatDate(generatedAt)}

CLÁUSULA 1ª — DAS PARTES CONTRATANTES E DA VALIDADE JURÍDICA DOS TERMOS

1.1. CONTRATADA: VINICIUS DE MATOS FRAZÃO, pessoa física, inscrito no CPF sob o nº 095.618.956-33, criador, desenvolvedor e proprietário legal da plataforma Clinike.

Parágrafo Único (Cláusula de Transição Corporativa): A Contratante declara estar ciente e concordar que a operação da Clinike poderá ser transferida, a qualquer momento, para uma Pessoa Jurídica (CNPJ) de titularidade de Vinicius de Matos Frazão ou da qual este faça parte. Essa transição operará a cessão automática dos direitos e obrigações deste contrato para a nova empresa, mantendo-se todas as cláusulas vigentes, mediante simples aviso no sistema.

1.2. CONTRATANTE: Pessoa Física (profissional autônomo da área da saúde/estética) ou Pessoa Jurídica (Clínica de Estética), devidamente qualificada através dos dados preenchidos no formulário de cadastro eletrônico da plataforma e no quadro de qualificação acima.

1.3. TITULARES DE DADOS: Os pacientes e clientes finais da Contratante, cujos dados de identificação, contato e saúde serão inseridos no ecossistema da plataforma para fins de gestão.

1.4. Validade da Aceitação Eletrônica: Este contrato é celebrado em estrita conformidade com o Artigo 107 do Código Civil Brasileiro, que valida a liberdade das formas na declaração de vontade, bem como a legislação nacional que reconhece a validade jurídica de contratos eletrônicos e assinaturas por meio de cliques (clickwrap agreements).

CLÁUSULA 2ª — DO OBJETO E ESCOPO DOS SERVIÇOS

2.1. O objeto deste contrato é a concessão de uma licença de uso temporária, revogável, não exclusiva e intransferível da plataforma Clinike, operada na modalidade SaaS (Software as a Service).

2.2. O acesso ao sistema ocorre 100% em nuvem, por meio de navegadores de internet ou aplicativos homologados (iOS/Android). Não há, sob nenhuma hipótese, venda de licença perpétua ou entrega de código-fonte ao cliente.

2.3. O software abrange módulos gerais e variáveis de gestão, tais como agenda, CRM de pacientes, fluxo de caixa, prontuários, fichas de anamnese, mapas de aplicação de injetáveis, controle de estoque e automações via WhatsApp.

2.4. Modificações no Produto: A Clinike reserva-se o direito de alterar, otimizar, acrescentar ou descontinuar ferramentas e módulos da plataforma para acompanhar a evolução do mercado tecnológico. Tais mudanças serão precedidas de aviso razoável no sistema e não configuram quebra contratual ou direito a indenizações.

CLÁUSULA 3ª — SEGURANÇA JURÍDICA DAS CONTAS E CREDENCIAIS

3.1. Guarda de Senhas: A Contratante é a única e exclusiva responsável por manter o sigilo de suas senhas de acesso. O acesso ao sistema por meio das credenciais da Contratante será considerado, para todos os fins de direito, como operação realizada pela própria Contratante.

3.2. Proibição de Compartilhamento: É expressamente proibido o compartilhamento de uma mesma credencial de usuário por mais de uma pessoa. Caso necessite de acesso para múltiplos funcionários, a Contratante deverá criar usuários individuais adicionais na plataforma.

3.3. Uso Deplorável ou Fraude: A Clinike reserva-se o direito de bloquear imediatamente a conta da Contratante se detectar acessos simultâneos de localizações geográficas incompatíveis, indicando vazamento ou compartilhamento ilícito de senhas.

CLÁUSULA 4ª — DO MODELO COMERCIAL, FATURAMENTO E REAJUSTE AUTOMÁTICO TRANSPARENTE

4.1. Recorrência: O acesso à plataforma é liberado mediante o pagamento de uma assinatura mensal recorrente. O modelo de cobrança é pré-pago, ou seja, o pagamento libera o uso para os próximos 30 (trinta) dias de utilização.

4.2. Gateway de Pagamento: Os pagamentos são processados pela empresa parceira Asaas (intermediadora financeira), por meio de cartão de crédito, Pix ou boleto bancário.

4.3. Suspensão por Inadimplemento: O não pagamento da mensalidade na data de vencimento ensejará a suspensão automática do acesso à plataforma após 5 (cinco) dias corridos de atraso. A liberação ocorrerá apenas após a compensação bancária do débito.

4.4. Regra Geral do Reajuste: O valor do plano contratado será reajustado automaticamente a cada período de 12 (doze) meses, contados a partir da data de início da assinatura, com base na variação acumulada do IPCA/IBGE (Índice Nacional de Preços ao Consumidor Amplo). Caso o IPCA apresente índice negativo (deflação), o valor da mensalidade permanecerá congelado, sendo proibida a redução do preço. Se o IPCA for extinto, será adotado o IGP-M/FGV de forma automática.

4.5. Detalhamento e Transparência na Tela do Usuário: Para garantir a total transparência exigida pela boa-fé contratual, o reajuste será exibido diretamente na interface do sistema da Contratante obedecendo estritamente aos seguintes critérios técnicos:

Aviso Prévio Sistêmico: Faltando 30 (trinta) dias para a aplicação do reajuste, uma notificação em formato de banner ou pop-up explicativo será exibida no painel financeiro da Contratante.

Abertura da Memória de Cálculo: A tela detalhará matematicamente a fórmula aplicada: [Valor Antigo] x (1 + % IPCA Acumulado de 12 meses) = [Novo Valor].

Histórico de Reajustes: A Contratante terá acesso, dentro da sua aba de faturamento, ao histórico contendo a data exata da aplicação do reajuste, a porcentagem oficial utilizada e os valores antigo e novo de forma permanente.

CLÁUSULA 5ª — POLÍTICA DE CANCELAMENTO E RESCISÃO

5.1. Sem Fidelidade: Este contrato vigora por prazo indeterminado, mês a mês, sem período de carência ou fidelidade obrigatória.

5.2. Solicitação de Cancelamento: A Contratante pode solicitar o cancelamento da assinatura a qualquer momento diretamente pelas configurações do sistema. O cancelamento terá efeito ao término do ciclo de 30 dias já pago.

5.3. Regra do Não Reembolso: Não haverá reembolso proporcional ou estorno de valores por dias não utilizados dentro do mês em curso. O cliente mantém o direito de acessar o sistema até o último dia do período faturado.

5.4. Rescisão por Justo Motivo: A Clinike poderá rescindir este contrato imediatamente, bloqueando o acesso do cliente, caso identifique: (i) violação de direitos autorais; (ii) condutas fraudulentas ou ilícitas utilizando a plataforma; (iii) comportamento abusivo contra a equipe de suporte.

CLÁUSULA 6ª — ACORDO DE TRATAMENTO DE DADOS PESSOAIS (DPA)
(Em estrita conformidade com a Lei Geral de Proteção de Dados - LGPD - Lei nº 13.709/2018)

6.1. Natureza dos Dados Sensíveis: A Contratante reconhece que armazena na plataforma dados pessoais sensíveis de saúde de seus pacientes (fichas de anamnese, prontuários, históricos clínicos e fotografias médicas de antes/depois), nos exatos termos do Artigo 5º, Inciso II da Lei nº 13.709/2018.

6.2. Divisão Legal de Papéis (Artigo 5º, VI e VII da LGPD):

A CONTRATANTE atua como CONTROLADORA: Sendo a única responsável legal por estabelecer a base legal adequada (como o consentimento explícito previsto no Artigo 11, I ou a tutela da saúde descrita no Artigo 11, II, "f" da LGPD), bem como por gerenciar e responder a qualquer requisição direta dos titulares dos dados.

A CLINIKE atua como OPERADORA: Processando, organizando e armazenando os dados exclusivamente sob as diretrizes sistêmicas determinadas pela Contratante e para viabilizar as funções do software. A Clinike não utiliza esses dados para fins próprios.

6.3. Subprocessadores Autorizados: Para viabilizar a arquitetura tecnológica, a Contratante autoriza expressamente o compartilhamento e tráfego de dados com as seguintes ferramentas parceiras, conforme permissivo do Marco Civil da Internet:

Supabase Inc. (Hospedagem e banco de dados em nuvem).
Vercel Inc. (Hospedagem da aplicação web).
Evolution API (Estrutura de integração técnica de mensageria).
Anthropic PBC (Provedor do modelo de Inteligência Artificial Claude utilizado pela Eva).
Asaas Gestão Financeira SA (Processamento de dados de faturamento da assinatura).

6.4. Incidentes de Segurança: Em caso de incidentes de segurança confirmados que gerem risco relevante aos titulares, a Clinike notificará a Contratante em prazo razoável para que esta, na qualidade de Controladora, realize as comunicações devidas à ANPD e aos pacientes, em conformidade com o Artigo 48 da LGPD.

6.5. Exclusão e Descarte de Dados: Encerrado o contrato por cancelamento, a Contratante terá o prazo improrrogável de 30 (trinta) dias para exportar seus relatórios e dados clínicos. Decorrido este prazo, e visando o cumprimento do princípio da segurança e eliminação de dados previstos no Artigo 16 da LGPD, a Clinike efetuará a exclusão definitiva e irreversível de todos os dados dos servidores, eximindo-se de qualquer dever de guarda posterior.

CLÁUSULA 7ª — DA INTELIGÊNCIA ARTIFICIAL (EVA IA) E MENSAGERIA

7.1. Natureza da Ferramenta: A funcionalidade Eva IA atua como uma recepcionista virtual inteligente, utilizando modelos de processamento de linguagem natural de terceiros para interagir de forma autônoma com leads e pacientes pelo WhatsApp.

7.2. Isenção por Inatendimentos e Alucinações: A inteligência artificial opera por inferência estatística. A Clinike notifica que o sistema não garante precisão absoluta de 100% nas respostas geradas automaticamente. Fica sob responsabilidade exclusiva da Contratante auditar, supervisionar e corrigir as interações da Eva IA, respondendo civilmente por quaisquer orientações incorretas fornecidas pela automação.

7.3. Transparência Concomitante: Em respeito ao direito de informação, a Contratante obriga-se a informar aos pacientes que a interação inicial via WhatsApp ocorre por meio de uma inteligência artificial automatizada.

7.4. Blindagem Absoluta sobre a Linha do WhatsApp: A integração técnica do sistema utiliza APIs independentes. A Clinike não possui qualquer controle, gerência ou blindagem sobre as políticas internas ou algoritmos anti-spam da empresa Meta (WhatsApp). Portanto, amparada pelo Artigo 393 do Código Civil (caso fortuito e fato de terceiro), a Clinike está totalmente isenta de responsabilidades por bloqueios, banimentos, suspensões de números, instabilidades de sinal, falhas de chips ou perda definitiva de conectividade da linha telefônica da clínica contratante.

CLÁUSULA 8ª — DA PROPRIEDADE INTELECTUAL E PROTEÇÃO ANTICÓPIA

8.1. Propriedade Intelectual: O software Clinike, suas marcas, logotipos, telas, identidade visual, códigos-fonte, bancos de dados estruturais e algoritmos são de propriedade exclusiva de Vinicius de Matos Frazão. Essa proteção é assegurada pela Lei do Software (Lei nº 9.609/1998) e pela Lei de Direitos Autorais (Lei nº 9.610/1998). O uso indevido, tentativas de engenharia reversa, cópia ou distribuição não autorizada ensejarão a rescisão imediata e a aplicação de medidas cíveis e penais.

8.2. Proibição de Engenharia Reversa: A Contratante concorda que não irá, nem permitirá que terceiros usem robôs, scrapers, crawlers ou ferramentas de extração de dados para monitorar, copiar ou extrair a tecnologia da Clinike.

8.3. Anonimização Estatística: A Contratante autoriza a Clinike a coletar e processar dados gerados na plataforma de forma estritamente agregada, anonimizada e estatística, para fins de inteligência de mercado, correções técnicas e aprimoramento dos algoritmos do produto, em linha com o Artigo 12 da LGPD.

8.4. Confidencialidade Mútua: Ambas as partes comprometem-se a guardar sigilo absoluto sobre segredos de negócio, estratégias comerciais, dados de pacientes e detalhes técnicos trocados em virtude desta parceria comercial.

CLÁUSULA 9ª — DA LIMITAÇÃO TOTAL DE RESPONSABILIDADE DA CLINIKE
(Amparada nos Artigos 393 e 927 do Código Civil Brasileiro)

9.1. Isenção de Prática Médica/Estética: A Clinike é exclusivamente uma fornecedora de tecnologia de gestão. A Clinike e seu proprietário legal não possuem qualquer responsabilidade técnica, civil ou solidária por decisões clínicas, anamneses mal preenchidas, erros em procedimentos estéticos ou danos à integridade física dos pacientes da Contratante.

9.2. Falhas Críticas de Infraestrutura (SLA): Conforme garantido pelo Artigo 14 do Marco Civil da Internet, o sistema opera sob o regime de "melhores esforços" de conectividade. Não haverá dever de indenizar ou abatimento de valores por indisponibilidades decorrentes de:

Manutenções programadas de segurança (avisadas previamente).
Instabilidade na rede mundial de computadores (provedores de internet do cliente).
Quedas nos servidores globais das empresas parceiras (Supabase/Vercel).
Apagões de conectividade generalizados da Meta/WhatsApp.

9.3. Cláusula de Indenização Regressiva (Hold Harmless): Caso a Clinike venha a sofrer qualquer condenação judicial, administrativa (ANPD) ou prejuízo financeiro causado por ato culposo ou doloso da Contratante (como vazamento de dados por má gestão de senhas ou falta de autorização de pacientes), a Contratante obriga-se a ressarcir integralmente a Clinike por todos os custos, incluindo honorários advocatícios, nos termos do Artigo 934 do Código Civil.

9.4. Teto Máximo Indenizatório (Limitation of Liability): Com fulcro no Artigo 404, Parágrafo Único do Código Civil, na remota hipótese de condenação judicial definitiva da Clinike por falhas exclusivas e comprovadas do sistema, o valor limite de qualquer indenização por danos materiais ou lucros cessantes ficará estritamente teto-limitado à soma das mensalidades efetivamente pagas pela Contratante à Clinike nos últimos 3 (três) meses anteriores ao fato gerador.

CLÁUSULA 10ª — DO FORO DE ELEIÇÃO

10.1. Para dirimir quaisquer dúvidas, controvérsias ou litígios decorrentes da interpretação ou execução deste contrato, as partes elegem expressamente o Foro da Comarca de Uberlândia, Estado de Minas Gerais, com renúncia expressa a qualquer outro, por mais privilegiado que seja.

ACEITE ELETRÔNICO

Ao assinar digitalmente este contrato, ${signerName === '[a ser preenchido no ato da assinatura]' ? 'o representante da Contratante' : signerName}, portador(a) do CPF ${signerCpf}, na qualidade de ${signerRole}, declara ter lido a integralidade deste instrumento, concorda com todos os seus termos e manifesta seu aceite eletrônico em nome da Contratante acima qualificada, nos termos do Artigo 107 do Código Civil e da Lei nº 14.063/2020.`
}
