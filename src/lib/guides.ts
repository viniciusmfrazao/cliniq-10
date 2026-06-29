/**
 * Guias de uso do dia-a-dia, organizados por papel.
 *
 * Cada papel tem um fluxo completo de passos. Cada passo tem:
 * - title:        titulo curto
 * - description:  o que fazer
 * - tip:          dica opcional (boa-pratica)
 * - icon:         nome do icone (ver Icon.tsx)
 * - href:         link pra abrir o lugar do app
 * - color:        gradiente do icone (`from-X to-Y` no Tailwind)
 */

export type GuideStep = {
  title: string
  description: string
  tip?: string
  icon: string
  href?: string
  color: string
}

export type GuideRole = {
  id: 'secretaria' | 'profissional' | 'admin' | 'financeiro'
  label: string
  emoji: string
  shortLabel: string
  tagline: string
  /** Cor base usada no hero / gradientes do papel */
  gradient: string
  /** Quem (provavelmente) tem esse papel no app, baseado no role */
  matchesRole: (role: string) => boolean
  steps: GuideStep[]
}

export const GUIDES: GuideRole[] = [
  {
    id: 'secretaria',
    label: 'Secretária / Recepção',
    shortLabel: 'Secretária',
    emoji: '☎️',
    tagline: 'Quem faz a clínica girar todo dia.',
    gradient: 'from-blue-500 via-cyan-500 to-teal-500',
    matchesRole: (r) => r === 'receptionist',
    steps: [
      {
        title: 'Comece o dia no Início',
        description:
          'Veja o resumo do dia: quantas consultas, quantas confirmadas, quem chega primeiro. Esse é o seu painel de controle.',
        tip: 'Mantenha essa aba aberta durante o expediente — ela atualiza sozinho.',
        icon: 'home',
        href: '/dashboard',
        color: 'from-blue-500 to-cyan-500',
      },
      {
        title: 'Confirme a agenda do dia',
        description:
          'Abra a Agenda em "Dia", olhe quem ainda está como "Agendado" e mande WhatsApp confirmando. Use o botão direito do agendamento pra mudar pra "Confirmado".',
        tip: 'Confirme até 12h do dia anterior pra reduzir faltas.',
        icon: 'calendar',
        href: '/dashboard/agenda',
        color: 'from-cyan-500 to-teal-500',
      },
      {
        title: 'Faça o check-in quando chegar',
        description:
          'Vá em Recepção e mude o status pra "Aguardando" assim que o paciente entra. O profissional vê na hora pelo realtime e sabe que pode chamar.',
        tip: 'Avise o profissional pelo chat interno (Eva) se ele estiver demorando.',
        icon: 'userCheck',
        href: '/dashboard/recepcao',
        color: 'from-teal-500 to-emerald-500',
      },
      {
        title: 'Atenda novos contatos pelo CRM',
        description:
          'Os leads do Instagram/WhatsApp aparecem na coluna "Novo". Responda, qualifique e arraste pro próximo estágio. Quando virar paciente, agenda direto dali.',
        tip: 'Não deixe lead esfriar: responder em até 5min triplica a conversão.',
        icon: 'target',
        href: '/dashboard/crm',
        color: 'from-violet-500 to-purple-500',
      },
      {
        title: 'Cadastre novos pacientes',
        description:
          'Quando alguém vira paciente, abra Pacientes → Novo. Só nome, telefone e procedimento de interesse já bastam pra começar.',
        tip: 'O resto (endereço, CPF) você completa depois, na ficha.',
        icon: 'userPlus',
        href: '/dashboard/pacientes/novo',
        color: 'from-purple-500 to-pink-500',
      },
      {
        title: 'Receba o pagamento ao final',
        description:
          'Depois do atendimento, lance a entrada em Financeiro → Nova Entrada. Selecione paciente, procedimento, forma de pagamento. O sistema calcula taxa e líquido sozinho.',
        tip: 'Cartão? Informe bandeira e parcelas — a taxa vem automática.',
        icon: 'dollarSign',
        href: '/dashboard/financeiro/entradas/nova',
        color: 'from-emerald-500 to-green-500',
      },
      {
        title: 'Encerre o dia',
        description:
          'Antes de sair, dê uma olhada em Agenda → Amanhã pra ver se tudo está confirmado e sem furos. Confira a Lista de Espera por encaixes.',
        tip: 'Pacientes em lista de espera adoram receber "abriu uma vaga amanhã às 15h".',
        icon: 'clock',
        href: '/dashboard/lista-espera',
        color: 'from-amber-500 to-orange-500',
      },
    ],
  },

  {
    id: 'profissional',
    label: 'Profissional (Médica/Esteta/Enf.)',
    shortLabel: 'Profissional',
    emoji: '🩺',
    tagline: 'Foque no atendimento — o sistema cuida do resto.',
    gradient: 'from-violet-500 via-purple-500 to-pink-500',
    matchesRole: (r) =>
      ['doctor', 'esthetician', 'biomedic', 'nurse', 'physiotherapist', 'nutritionist', 'psychologist'].includes(r),
    steps: [
      {
        title: 'Veja sua agenda do dia',
        description:
          'Comece em Agenda filtrando por você. Cada bloco mostra paciente, procedimento e status. Ícones coloridos indicam quem já chegou.',
        tip: 'No mobile, deslize lateralmente entre os dias.',
        icon: 'calendar',
        href: '/dashboard/agenda',
        color: 'from-violet-500 to-purple-500',
      },
      {
        title: 'Pré-leia o histórico do paciente',
        description:
          'Antes do atendimento, abra a Central do Paciente e use a aba "Evoluções". Veja procedimentos anteriores, fotos antes/depois e anamneses — assim você chega preparada.',
        tip: 'Procedimento contínuo (botox/preenchimento)? Compare com a foto de 6 meses atrás.',
        icon: 'file',
        href: '/dashboard/pacientes',
        color: 'from-purple-500 to-pink-500',
      },
      {
        title: 'Inicie o atendimento',
        description:
          'Quando a recepção marcar como "Aguardando", abra o agendamento e clique em "Iniciar Atendimento". O cronômetro começa e a tela vira o seu cockpit.',
        tip: 'O timer no topo te ajuda a respeitar o tempo planejado.',
        icon: 'play',
        href: '/dashboard/agenda',
        color: 'from-pink-500 to-rose-500',
      },
      {
        title: 'Preencha o prontuário enquanto atende',
        description:
          'Coluna esquerda: Queixa, Conduta, Observações. Os campos crescem sozinhos conforme você digita — sem dança no celular. Anexe fotos antes/depois.',
        tip: 'Use voz pra ditado: aperte a tecla microfone do teclado.',
        icon: 'edit',
        color: 'from-rose-500 to-orange-500',
      },
      {
        title: 'Registre injetáveis no mapa',
        description:
          'Coluna direita: clique nos pontos do rosto onde aplicou. Selecione o produto e a dose. Pode também usar "Entrada Manual" quando for só uma quantidade total.',
        tip: 'Modo manual é mais rápido pra bioestimuladores diluídos.',
        icon: 'syringe',
        color: 'from-orange-500 to-amber-500',
      },
      {
        title: 'Anote outros produtos usados',
        description:
          'Seringas, fios, anestésico, etc. Vá em "Produtos utilizados" e adicione. Tudo isso é descontado do estoque ao finalizar.',
        tip: 'Use a busca em vez de rolar a lista — é mais rápido.',
        icon: 'box',
        color: 'from-amber-500 to-yellow-500',
      },
      {
        title: 'Agende o retorno',
        description:
          'Procedimento exige retorno em 30 dias? Use o "Agendar Retorno" no rodapé do atendimento — já fica vinculado e a recepção vê na agenda.',
        tip: 'Quem agenda retorno na hora retorna 3x mais.',
        icon: 'refresh',
        color: 'from-yellow-500 to-emerald-500',
      },
      {
        title: 'Finalize com tudo registrado',
        description:
          'Clique em "Finalizar". O estoque desconta sozinho, a evolução vai pro prontuário, o financeiro recebe o aviso e o paciente cai como "Concluído".',
        tip: 'Se esquecer de algo, o sistema avisa antes de finalizar.',
        icon: 'check',
        color: 'from-emerald-500 to-green-500',
      },
    ],
  },

  {
    id: 'admin',
    label: 'Admin / Dona da Clínica',
    shortLabel: 'Admin',
    emoji: '👑',
    tagline: 'Configure uma vez. Acompanhe sempre.',
    gradient: 'from-amber-500 via-orange-500 to-rose-500',
    matchesRole: (r) => r === 'admin' || r === 'super_admin',
    steps: [
      {
        title: 'Configure os dados da clínica',
        description:
          'Em Configurações, preencha nome, CNPJ, logo e cor do tema. Tudo isso aparece nos documentos, recibos e na tela do paciente.',
        tip: 'O logo aparece nos documentos enviados por WhatsApp.',
        icon: 'settings',
        href: '/dashboard/config',
        color: 'from-amber-500 to-orange-500',
      },
      {
        title: 'Ative só os módulos que vai usar',
        description:
          'Não use Injetáveis? Esconde. Não tem CRM? Some do menu. Em Configurações → Módulos você liga e desliga o que aparece pra equipe.',
        tip: 'Menos botões = equipe mais focada.',
        icon: 'layers',
        href: '/dashboard/config',
        color: 'from-orange-500 to-rose-500',
      },
      {
        title: 'Cadastre sua equipe',
        description:
          'Em Equipe, adicione cada profissional/secretária. Defina o papel (admin/médico/recepção/financeiro) — as permissões saem prontas.',
        tip: 'O profissional recebe e-mail pra criar a senha dele.',
        icon: 'users',
        href: '/dashboard/equipe',
        color: 'from-rose-500 to-pink-500',
      },
      {
        title: 'Defina horários de cada profissional',
        description:
          'Ainda em Equipe, abra "Horários" do profissional e marque os dias e turnos que ele atende. A agenda usa isso pra mostrar slots disponíveis.',
        tip: 'Bloqueios pontuais (folga, congresso) ficam em "Indisponibilidades".',
        icon: 'clock',
        href: '/dashboard/equipe',
        color: 'from-pink-500 to-violet-500',
      },
      {
        title: 'Cadastre procedimentos',
        description:
          'Em Procedimentos: nome, duração, preço e quais profissionais executam. Quando a recepção for agendar, só aparece quem pode fazer aquele procedimento.',
        tip: 'Já preenche descrição padrão? Vira template pro prontuário.',
        icon: 'clipboard',
        href: '/dashboard/procedimentos',
        color: 'from-violet-500 to-purple-500',
      },
      {
        title: 'Personalize templates de documentos',
        description:
          'Em Documentos → Templates, crie modelos de termo de consentimento, anamnese e recibo. Use variáveis como {nome_paciente} pra preencher sozinho.',
        tip: 'Um template bem feito é assinado em segundos pelo WhatsApp.',
        icon: 'file',
        href: '/dashboard/documentos/templates',
        color: 'from-purple-500 to-blue-500',
      },
      {
        title: 'Configure a Donna IA',
        description:
          'Em Eva IA, conecte WhatsApp e treine a Donna com o tom da sua clínica. Ela atende, qualifica e agenda enquanto você está com paciente.',
        tip: 'Comece com horários comerciais — depois libere 24/7.',
        icon: 'sparkles',
        href: '/dashboard/eva',
        color: 'from-blue-500 to-cyan-500',
      },
      {
        title: 'Acompanhe e audite',
        description:
          'Auditoria mostra tudo que foi criado/editado/apagado e por quem. É a sua segurança pra qualquer dúvida sobre quem mexeu em quê.',
        tip: 'Veja a auditoria 1x por semana — vira um hábito saudável.',
        icon: 'shield',
        href: '/dashboard/auditoria',
        color: 'from-cyan-500 to-teal-500',
      },
    ],
  },

  {
    id: 'financeiro',
    label: 'Financeiro',
    shortLabel: 'Financeiro',
    emoji: '💰',
    tagline: 'O dinheiro entra, sai e você sempre sabe onde está.',
    gradient: 'from-emerald-500 via-teal-500 to-cyan-500',
    matchesRole: () => false,
    steps: [
      {
        title: 'Comece pela visão geral',
        description:
          'O painel do Financeiro mostra Receita do dia/mês, Líquido, Ticket médio, Saídas e o Resultado. É seu termômetro de saúde da clínica.',
        tip: 'Bata o olho 1x por dia, sempre no mesmo horário.',
        icon: 'pieChart',
        href: '/dashboard/financeiro',
        color: 'from-emerald-500 to-teal-500',
      },
      {
        title: 'Registre entradas pelo pagamento na agenda',
        description:
          'A forma correta é pelo botão "Registrar Pagamento" no popup do agendamento. O sistema vincula automaticamente ao paciente e atendimento. Informe apenas a forma de pagamento e o valor. Para corrigir, vá em Financeiro → Entradas, clique no lápis e edite.',
        tip: 'Entradas lançadas pela agenda vinculam ao atendimento automaticamente — isso alimenta a rentabilidade do paciente.',
        icon: 'dollar',
        href: '/dashboard/agenda',
        color: 'from-teal-500 to-cyan-500',
      },
      {
        title: 'Registre as saídas com categoria certa',
        description:
          'Toda despesa vai em Saídas → Nova. Categorias: Administrativas (aluguel, luz), Pessoal (salários), Marketing, Impostos. Para aluguel de sala por procedimento use a subcategoria "Aluguel de sala" — o custo é rateado por atendimento do dia. Nunca use CMV / Insumos para compra de produtos: esses entram pelo estoque e geram dupla contagem.',
        tip: 'CMV / Insumos é excluído do rateio de fixos por paciente — o custo de produto já é calculado automaticamente pelo estoque.',
        icon: 'minus',
        href: '/dashboard/financeiro/saidas/nova',
        color: 'from-cyan-500 to-blue-500',
      },
      {
        title: 'Cuide dos devedores',
        description:
          'Em Devedores você vê quem ainda não pagou. Mande lembrete por WhatsApp em 1 clique e marque como recebido quando cair.',
        tip: 'Cobrar amigável até o 7º dia evita 80% dos calotes.',
        icon: 'bell',
        href: '/dashboard/financeiro/devedores',
        color: 'from-blue-500 to-violet-500',
      },
      {
        title: 'Veja o DRE e o fluxo',
        description:
          'DRE mensal: receita − despesas = resultado. Fluxo de Caixa anual: como cada mês se comporta. Exporte em PDF pro contador.',
        tip: 'Compare 3 meses pra entender sazonalidade.',
        icon: 'barChart',
        href: '/dashboard/financeiro/dre',
        color: 'from-violet-500 to-purple-500',
      },
      {
        title: 'Defina e acompanhe metas',
        description:
          'Coloque sua meta de faturamento mensal. O sistema mostra o quanto falta e quanto sobra. Comissione profissionais por meta atingida.',
        tip: 'Meta realista cresce 10–15% sobre o melhor mês recente.',
        icon: 'target',
        href: '/dashboard/financeiro/metas',
        color: 'from-purple-500 to-pink-500',
      },
      {
        title: 'Conheça seu paciente VIP',
        description:
          'Histórico por Paciente lista quem mais gasta e em quê. Use isso pra criar campanhas de fidelidade pros 20% que pagam 80%.',
        tip: 'Aniversário do top 10? Mande mensagem personalizada.',
        icon: 'award',
        href: '/dashboard/financeiro/historico-paciente',
        color: 'from-pink-500 to-rose-500',
      },
      {
        title: 'Entenda a rentabilidade de cada paciente',
        description:
          'Na ficha de cada paciente há o card Rentabilidade. Ele mostra: Receita total (pagamentos registrados via agenda), Custo estoque (produtos usados × custo de compra), Lucro bruto (receita − estoque) e Margem %. Por atendimento aparece também os Fixos (ref.) — custos fixos da clínica rateados pelo número de atendimentos do mês. CMV / Insumos não entra no rateio pois já está no custo de estoque.',
        tip: 'Margem negativa pode indicar pagamento não registrado — verifique em Financeiro → Entradas se o pagamento foi lançado corretamente.',
        icon: 'trendingUp',
        href: '/dashboard/pacientes',
        color: 'from-violet-500 to-purple-500',
      },
    ],
  },
]

export function defaultGuideForRole(role?: string | null): GuideRole {
  if (!role) return GUIDES[0]
  const match = GUIDES.find((g) => g.matchesRole(role))
  return match || GUIDES[0]
}
