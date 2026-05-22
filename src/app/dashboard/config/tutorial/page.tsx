'use client'

import { useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'

type Section = 'inicio' | 'agenda' | 'atendimento' | 'pacientes' | 'financeiro' | 'crm' | 'whatsapp' | 'eva' | 'estoque' | 'documentos' | 'equipe' | 'importar' | 'dicas'

const sections: { id: Section; title: string; icon: string }[] = [
  { id: 'inicio',      title: 'Primeiros Passos',    icon: 'sparkles'     },
  { id: 'agenda',      title: 'Agenda',               icon: 'calendar'     },
  { id: 'atendimento', title: 'Atendimento',          icon: 'clipboard'    },
  { id: 'pacientes',   title: 'Pacientes',            icon: 'users'        },
  { id: 'financeiro',  title: 'Financeiro',           icon: 'dollarSign'   },
  { id: 'crm',         title: 'CRM e Leads',          icon: 'target'       },
  { id: 'whatsapp',    title: 'WhatsApp',             icon: 'messageCircle'},
  { id: 'eva',         title: 'Eva IA',               icon: 'sparkles'     },
  { id: 'estoque',     title: 'Estoque',              icon: 'box'          },
  { id: 'documentos',  title: 'Documentos',           icon: 'file'         },
  { id: 'equipe',      title: 'Equipe',               icon: 'userPlus'     },
  { id: 'importar',    title: 'Importar Dados',       icon: 'upload'       },
  { id: 'dicas',       title: 'Dicas e Atalhos',      icon: 'zap'          },
]

export default function TutorialPage() {
  const [activeSection, setActiveSection] = useState<Section>('inicio')

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <Link href="/dashboard/config" className="text-sm text-violet-600 hover:text-violet-700 flex items-center gap-1 mb-2">
          <Icon name="arrowLeft" className="w-4 h-4" />
          Voltar para Configurações
        </Link>
        <h1 className="text-xl font-bold text-slate-900">Central de Ajuda</h1>
        <p className="text-sm text-slate-500 mt-0.5">Aprenda a usar todas as funcionalidades do Clinike</p>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <nav className="card p-2 sticky top-4">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  activeSection === section.id ? 'bg-violet-100 text-violet-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon name={section.icon} className="w-4 h-4" />
                <span className="text-sm font-medium">{section.title}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="lg:col-span-3">
          <div className="card p-6">
            {activeSection === 'inicio'      && <PrimeirosPassos />}
            {activeSection === 'agenda'      && <TutorialAgenda />}
            {activeSection === 'atendimento' && <TutorialAtendimento />}
            {activeSection === 'pacientes'   && <TutorialPacientes />}
            {activeSection === 'financeiro'  && <TutorialFinanceiro />}
            {activeSection === 'crm'         && <TutorialCRM />}
            {activeSection === 'whatsapp'    && <TutorialWhatsApp />}
            {activeSection === 'eva'         && <TutorialEva />}
            {activeSection === 'estoque'     && <TutorialEstoque />}
            {activeSection === 'documentos'  && <TutorialDocumentos />}
            {activeSection === 'equipe'      && <TutorialEquipe />}
            {activeSection === 'importar'    && <TutorialImportar />}
            {activeSection === 'dicas'       && <DicasAtalhos />}
          </div>
        </div>
      </div>
    </div>
  )
}

function PrimeirosPassos() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{'🚀'} Bem-vindo ao Clinike!</h2>
        <p className="text-slate-600 mt-2">Siga estes passos para configurar sua clínica e começar a usar o sistema.</p>
      </div>
      <div className="space-y-4">
        <Step number={1} title="Configure os dados da clínica" description="Preencha nome, endereço, telefone, Instagram e horário de funcionamento em Configurações → Dados da Clínica." link="/dashboard/config" />
        <Step number={2} title="Cadastre sua equipe" description="Adicione os profissionais com nome, email e papel. Configure os horários de atendimento de cada um." link="/dashboard/equipe" />
        <Step number={3} title="Cadastre os procedimentos" description="Liste todos os serviços com preço, duração e profissional responsável. Adicione uma descrição clara para a Eva usar nas respostas." link="/dashboard/procedimentos" />
        <Step number={4} title="Conecte o WhatsApp" description="Vá em Configurações → WhatsApp e escaneie o QR code para conectar o número da clínica." link="/dashboard/config/whatsapp" />
        <Step number={5} title="Configure a Eva IA" description="Personalize a personalidade, mensagens de follow-up e política de desconto da sua assistente virtual." link="/dashboard/config/eva" />
        <Step number={6} title="Configure as taxas de pagamento" description="Cadastre as taxas de cada bandeira de cartão para o sistema calcular o valor líquido automaticamente." link="/dashboard/config/taxas" />
        <Step number={7} title="Importe o histórico (opcional)" description="Importe agendamentos e pacientes do sistema anterior via planilha Excel." link="/dashboard/config/importar" />
        <Step number={8} title="Comece a agendar!" description="Sua clínica está pronta. Crie o primeiro agendamento." link="/dashboard/agenda" />
      </div>
      <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
        <p className="text-sm text-violet-800"><strong>Dica:</strong> Configure os horários de cada profissional em Equipe antes de ativar a Eva. Isso é essencial para ela responder sobre disponibilidade corretamente.</p>
      </div>
    </div>
  )
}

function TutorialAgenda() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{'📅'} Como usar a Agenda</h2>
        <p className="text-slate-600 mt-2">A agenda é o coração do sistema. Aqui você gerencia todos os atendimentos.</p>
      </div>
      <div className="space-y-4">
        <Tutorial title="Criar um agendamento" steps={['Clique no botão \"+ Novo Agendamento\" no topo da tela','Selecione o paciente (ou cadastre um novo)', 'Escolha o procedimento desejado','Selecione o profissional responsável','Defina data e horário disponível','Opcionalmente registre um sinal (pagamento antecipado)','Clique em \"Confirmar Agendamento\"']} />
        <Tutorial title="Registrar sinal (pagamento antecipado)" steps={['Ao passar o mouse sobre um agendamento, clique nele para abrir o popup','Na seção \"Sinal\", clique em \"+ Registrar\"','Informe o valor e a forma de pagamento (Pix, dinheiro, crédito, débito)','O sinal fica registrado e visível no popup e no card']} />
        <Tutorial title="Adicionar observações" steps={['Abra o popup do agendamento passando o mouse','Clique em \"+ Adicionar\" na seção Observações','Digite e salve diretamente no popup sem sair da agenda']} />
        <Tutorial title="Visualizar a agenda" steps={['Use os botões \"Dia\", \"Semana\" ou \"Mês\" para trocar a visualização','Filtre por profissional usando o seletor no topo','Clique em um agendamento para ver detalhes, alterar status, editar ou abrir atendimento']} />
        <Tutorial title="Status dos agendamentos" steps={['Agendado: Consulta marcada, aguardando confirmação','Confirmado: Paciente confirmou presença','Check-in: Paciente chegou na clínica','Em atendimento: Consulta em andamento','Realizado: Atendimento finalizado (automático ao clicar em Finalizar)','Cancelado / Não compareceu: Consulta não realizada']} />
        <Tutorial title="Confirmação automática" steps={['O sistema envia mensagem de confirmação 24h antes automaticamente','Também envia lembrete 2h antes do atendimento','Configure os textos em Configurações → Eva IA']} />
      </div>
    </div>
  )
}

function TutorialAtendimento() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{'🩺'} Tela de Atendimento</h2>
        <p className="text-slate-600 mt-2">Tudo que o profissional precisa durante a consulta em uma única tela.</p>
      </div>
      <div className="space-y-4">
        <Tutorial title="Acessar o atendimento" steps={['Na agenda, clique no agendamento','Clique em \"Abrir Atendimento\"','Ou diretamente pelo popup da agenda no botão \"Atendimento\"']} />
        <Tutorial title="Coluna esquerda — Prontuário" steps={['Queixa principal: o que trouxe o paciente hoje','Conduta / Procedimento realizado: descreva o que foi feito','Observações: recomendações pós-procedimento','Fotos antes/depois: adicione até 20MB por foto (JPG, PNG, WEBP)','Pacotes ativos: se o paciente tiver pacote, aparece o botão \"Usar Sessão\"','Orçamentos: visualize e crie orçamentos sem sair da tela','Anamnese: veja as respostas do paciente ou reenvie o formulário','Agendar retorno: sugira a próxima data para a recepção confirmar']} />
        <Tutorial title="Coluna direita — Mapa / Odontograma" steps={['Alterne entre Mapa de Injetáveis e Odontograma (se habilitado)','Mapa facial: marque os pontos de aplicação com produto e quantidade','Odontograma: marque condições por dente (cárie, coroa, canal, etc.)','Selecione a condição na legenda e clique nos dentes para marcar','Salve o odontograma — fica registrado na ficha do paciente']} />
        <Tutorial title="Finalizar atendimento" steps={['Clique em \"Finalizar\" no topo da tela','O status do agendamento muda para \"Realizado\" automaticamente na agenda','O sistema envia NPS automático ao paciente após o atendimento','Você é redirecionado de volta para a agenda']} />
      </div>
      <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
        <p className="text-sm text-violet-800"><strong>Dica:</strong> Use a tela de atendimento no tablet durante a consulta. O mapa facial fica visualmente claro e o prontuário salva em tempo real.</p>
      </div>
    </div>
  )
}

function TutorialPacientes() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{'👥'} Gestão de Pacientes</h2>
        <p className="text-slate-600 mt-2">Cadastre e gerencie todos os pacientes da sua clínica.</p>
      </div>
      <div className="space-y-4">
        <Tutorial title="Cadastrar novo paciente" steps={['Vá em Pacientes → Novo Paciente','Preencha nome e telefone (obrigatórios)','Adicione CPF, data de nascimento e endereço','Use o campo \"Observações\" para informações importantes','Clique em \"Salvar\"']} />
        <Tutorial title="Ficha completa do paciente" steps={['Visão geral: dados, próximo agendamento e resumo','Evoluções: histórico de prontuários e fotos','Atendimentos: todos os agendamentos passados e futuros','Anamneses: formulários respondidos pelo paciente','Injetáveis: histórico de aplicações com mapa facial','Pacotes: sessões de pacote compradas e consumidas','Odontograma: mapa dental (se módulo habilitado)']} />
        <Tutorial title="Pacotes de sessões" steps={['Na tab Pacotes da ficha do paciente, clique em \"Novo Pacote\"','Informe nome do pacote (ex: Clube do Botox), total de sessões e valor','A cada atendimento, clique em \"+ Sessão\" para descontar','O progresso aparece em barra visual e pontos coloridos','Ao agendar, você pode criar um pacote diretamente no formulário de agendamento']} />
        <Tutorial title="Lista de Espera" steps={['Vá em Lista de Espera para ver pacientes aguardando vaga','Quando um horário abrir, notifique o próximo da fila','O paciente pode ser adicionado manualmente ou solicitar pela Eva']} />
      </div>
    </div>
  )
}

function TutorialFinanceiro() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{'💰'} Módulo Financeiro</h2>
        <p className="text-slate-600 mt-2">Controle entradas, saídas, devedores e tenha visão completa do faturamento.</p>
      </div>
      <div className="space-y-4">
        <Tutorial title="Registrar entrada (receita)" steps={['Vá em Financeiro → Entradas → Nova Entrada','Selecione o paciente e procedimento','Informe valor bruto e forma de pagamento','Se cartão, informe número de parcelas','O sistema calcula automaticamente taxa e valor líquido','Salve o registro — aparece no dashboard imediatamente']} />
        <Tutorial title="Sinal na agenda" steps={['Na agenda, abra o popup de qualquer agendamento','Clique em \"+ Registrar\" na seção Sinal','Informe valor e forma (Pix, dinheiro, crédito, débito)','O sinal fica visível no popup para a secretária conferir na chegada do paciente']} />
        <Tutorial title="Registrar saída (despesa)" steps={['Vá em Financeiro → Saídas → Nova Saída','Informe descrição, categoria e valor','Categorias: aluguel, material, equipamento, salário, marketing, etc','Adicione observações e salve']} />
        <Tutorial title="Controle de devedores" steps={['Vá em Financeiro → Devedores','Veja todos os pacientes com parcelas em aberto','Registre um pagamento clicando no débito','O sistema atualiza o saldo automaticamente','Parcelas vencidas ficam destacadas em vermelho']} />
        <Tutorial title="DRE e relatórios" steps={['Vá em Financeiro → DRE para ver o resultado mensal','Receita bruta, deduções de taxas e lucro líquido','Rankings de procedimentos mais rentáveis e profissionais','Fluxo de caixa com projeção anual','Metas mensais com progresso em tempo real']} />
        <Tutorial title="Configurar taxas de pagamento" steps={['Vá em Configurações → Taxas de Pagamento','Cadastre a taxa de cada bandeira de cartão','O sistema desconta automaticamente ao registrar entradas','O DRE mostra o valor líquido real']} />
      </div>
    </div>
  )
}

function TutorialCRM() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{'🎯'} CRM e Leads</h2>
        <p className="text-slate-600 mt-2">Gerencie interessados e converta mais pacientes. Leads do WhatsApp entram automaticamente.</p>
      </div>
      <div className="space-y-4">
        <Tutorial title="Entendendo o funil" steps={['Novo Lead: Pessoa que entrou em contato pelo WhatsApp','Em Conversa: Eva está atendendo ou aguardando resposta','Agendado: Marcou uma consulta ou avaliação','Cliente: Virou paciente após o agendamento','Perdido: Não teve interesse após todos os follow-ups']} />
        <Tutorial title="Leads automáticos" steps={['Toda mensagem no WhatsApp vira lead automaticamente','O lead sai de \"Novo Lead\" para \"Em Conversa\" assim que manda a primeira mensagem','A Eva registra interesse, histórico e prioridade','Badge \"Atendimento Humano\" aparece quando escalado','Clique em \"Devolver pra Eva\" para ela retomar']} />
        <Tutorial title="Relatório do CRM" steps={['Clique em \"Relatório\" no topo do CRM','Veja total de leads, agendados, conversão e perdidos','Filtre por período, origem e status','Exporte para Excel com um clique','As colunas mostram nome real do stage mesmo quando personalizado']} />
        <Tutorial title="Follow-up automático" steps={['A Eva envia follow-ups apenas quando o cliente respondeu e depois sumiu','Não envia em cascata — respeita o ritmo do lead','Configure os textos em Configurações → Eva IA','Após o 5° follow-up sem interação, lead é marcado como Perdido']} />
        <Tutorial title="Stages personalizados" steps={['Clique em ⚙️ no CRM para configurar','Crie stages com nome e cor da sua escolha','Arraste leads entre stages no kanban','O relatório usa os nomes corretos dos seus stages']} />
      </div>
    </div>
  )
}

function TutorialWhatsApp() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{'💬'} WhatsApp da Clínica</h2>
        <p className="text-slate-600 mt-2">Conecte o número da clínica e gerencie conversas diretamente no sistema.</p>
      </div>
      <div className="space-y-4">
        <Tutorial title="Conectar o WhatsApp" steps={['Vá em Configurações → WhatsApp da Clínica','Clique em \"Conectar novo número\"','Abra o WhatsApp no celular → três pontinhos → Aparelhos conectados','Escaneie o QR code exibido na tela','Aguarde a conexão — ícone verde \"Conectado\" confirma']} />
        <Tutorial title="Papéis do número" steps={['Eva atende mensagens recebidas: a Eva responde automaticamente neste número','Automação sai por aqui: lembretes, NPS, aniversário e recall saem por este número','Secretária pode usar manualmente: aparece no painel WhatsApp para responder','Você pode ter múltiplos números com papéis diferentes']} />
        <Tutorial title="Painel de conversas" steps={['Vá em WhatsApp no menu lateral','Busque por nome ou número no campo de pesquisa','Filtre por \"Aguardando\" para ver só quem está esperando resposta','Badge verde mostra mensagens não lidas','Clique em \"Agendar\" no header para abrir o modal de agendamento sem sair da conversa']} />
        <Tutorial title="Agendar pelo chat" steps={['Abra qualquer conversa no painel WhatsApp','Clique no botão verde \"Agendar\" no topo direito','Selecione profissional, procedimento e data','Os horários disponíveis aparecem em tempo real — sem slots ocupados','Confirme para criar o agendamento diretamente']} />
        <Tutorial title="Atendimento humano" steps={['Quando a Eva escala, aparece badge \"Atendimento Humano\" no CRM','Responda normalmente pelo painel WhatsApp','A Eva fica em silêncio enquanto você responde','Ao terminar, clique em \"Devolver pra Eva\" para ela retomar']} />
      </div>
    </div>
  )
}

function TutorialEva() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{'✨'} Eva IA — Sua Assistente Virtual</h2>
        <p className="text-slate-600 mt-2">A Eva atende no WhatsApp 24/7, agenda consultas, registra leads e faz follow-up automaticamente.</p>
      </div>
      <div className="space-y-4">
        <Tutorial title="O que a Eva faz" steps={['Recebe e responde mensagens no WhatsApp 24/7','Apresenta procedimentos e preços com base no cadastro','Consulta horários disponíveis em tempo real','Cria agendamentos confirmados diretamente na agenda','Registra o lead no CRM com interesse e histórico','Envia follow-ups inteligentes — só quando o cliente sumiu após interagir','Escala para atendimento humano quando necessário']} />
        <Tutorial title="Comportamento dos follow-ups" steps={['Follow-up 1: explica o procedimento de interesse + valor e pergunta se ficou dúvida','Follow-up 2+: só dispara se o cliente respondeu alguma vez e sumiu depois','Nunca envia em cascata sem o cliente ter interagido','Configure os textos em Configurações → Eva IA — se deixar em branco usa o padrão']} />
        <Tutorial title="Configurar procedimentos para a Eva" steps={['Vá em Procedimentos e abra cada um','Use o campo Descrição/Observações para dar contexto à Eva','Exemplo: \"Disponível apenas em datas especiais. Não é aplicado pela Dra. X\"','A Eva respeita essas instruções como fonte de verdade','Vincule o profissional responsável — a Eva nunca mente sobre quem aplica']} />
        <Tutorial title="Quando a Eva escala" steps={['Cancelamentos e reagendamentos','Reclamações','Dúvidas que ela não consegue responder','Pedido explícito de atendimento humano','Você recebe badge no CRM e pode responder pelo painel WhatsApp']} />
        <Tutorial title="Configurações importantes" steps={['Personalidade: tom da Eva (ex: \"calorosa, elegante, use emojis com moderação\")','Follow-up: textos e intervalos de cada estágio','Política de desconto: a Eva só menciona quando perguntada diretamente','Horários dos profissionais: configure em Equipe — essencial para disponibilidade correta']} />
      </div>
      <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
        <p className="text-sm text-violet-800"><strong>Dica:</strong> A Eva lê a descrição de cada procedimento para responder corretamente. Quanto mais detalhada a descrição, melhor a Eva explica para o paciente.</p>
      </div>
    </div>
  )
}

function TutorialEstoque() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{'📦'} Controle de Estoque</h2>
        <p className="text-slate-600 mt-2">Gerencie produtos, injetáveis e alertas de validade e estoque mínimo.</p>
      </div>
      <div className="space-y-4">
        <Tutorial title="Cadastrar produto" steps={['Vá em Estoque → Novo Produto','Preencha nome, marca e categoria','Defina unidade de medida (ml, unidade, caixa, etc)','Informe estoque mínimo — alerta automático quando abaixo','Adicione preço de custo e preço de venda','Salve o produto']} />
        <Tutorial title="Dar entrada no estoque" steps={['Abra o produto desejado','Clique em \"Nova Entrada\"','Informe quantidade, lote e validade','Adicione nota fiscal se tiver','Confirme a entrada — estoque atualiza automaticamente']} />
        <Tutorial title="Injetáveis e mapa facial" steps={['Vá em Injetáveis para registrar aplicações','Selecione o paciente e o produto aplicado','Marque os pontos no mapa facial interativo','Registre quantidade em unidades ou ml','O histórico fica salvo na ficha do paciente com data e profissional']} />
        <Tutorial title="Alertas de estoque" steps={['Produtos abaixo do mínimo aparecem destacados no painel','Produtos próximos da validade são sinalizados','Verifique o painel de estoque regularmente','Configure o estoque mínimo de cada produto para alertas precisos']} />
      </div>
    </div>
  )
}

function TutorialDocumentos() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{'📄'} Documentos e Assinaturas</h2>
        <p className="text-slate-600 mt-2">Crie termos de consentimento e colete assinaturas digitais.</p>
      </div>
      <div className="space-y-4">
        <Tutorial title="Criar template de documento" steps={['Vá em Configurações → Templates de Documentos','Clique em \"Novo Template\"','Dê um nome (ex: Termo de Consentimento Botox)','Escreva o conteúdo do documento','Use variáveis: {nome_paciente}, {data}, {procedimento}','Salve o template']} />
        <Tutorial title="Enviar para assinatura" steps={['Na ficha do paciente, clique em \"Documentos\"','Selecione o template desejado','O sistema preenche as variáveis automaticamente','Envie por WhatsApp — o paciente assina pelo celular','Documento assinado fica salvo no prontuário']} />
        <Tutorial title="Anamnese digital" steps={['Configure o formulário em Configurações → Anamnese','Adicione seções e perguntas personalizadas','Envie o link para o paciente antes da consulta','As respostas ficam salvas na ficha do paciente','Na tela de atendimento, o profissional vê as respostas em destaque']} />
      </div>
    </div>
  )
}

function TutorialEquipe() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Gestão de Equipe</h2>
        <p className="text-slate-600 mt-2">Adicione membros, defina permissões e configure horários de atendimento.</p>
      </div>
      <div className="space-y-4">
        <Tutorial title="Adicionar membro" steps={['Vá em Equipe → Adicionar Membro','Preencha nome e email','Selecione a função (Admin, Esteticista, Biomédica, Recepcionista, etc)','O membro recebe email para definir a senha no primeiro acesso']} />
        <Tutorial title="Configurar horários de atendimento" steps={['Na lista de equipe, clique no ícone de relógio do profissional','Ative os dias que ele atende','Defina horários de início e fim por turno','Pode ter múltiplos turnos por dia (manhã + tarde)','Use \"Copiar\" para replicar para outros dias','Salve — a Eva e a agenda usam esses horários automaticamente']} />
        <Tutorial title="Funções e permissões" steps={['Admin: Acesso total ao sistema incluindo financeiro','Esteticista/Médico/Biomédica: Agenda, pacientes e prontuário','Recepcionista: Agenda, check-in e CRM','Personalize em Configurações → Permissões por Papel']} />
      </div>
    </div>
  )
}

function TutorialImportar() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Importar Dados do Sistema Anterior</h2>
        <p className="text-slate-600 mt-2">Importe historico de agendamentos e pacientes via planilha Excel.</p>
      </div>
      <div className="space-y-4">
        <Tutorial title="Como importar agendamentos" steps={['Va em Configuracoes - Importar Agendamentos','Selecione o arquivo Excel exportado do sistema anterior','Configure os profissionais para ignorar','Defina o status para agendamentos do passado (recomendado: Realizado)','Agendamentos futuros viram Agendado automaticamente','Clique em Iniciar Importacao e aguarde']} />
        <Tutorial title="Regras aplicadas automaticamente" steps={['Agendamentos cancelados sao ignorados','Pacientes ja cadastrados com o mesmo telefone NAO sao duplicados','Pacientes novos sao criados com os dados da planilha','Profissionais sao mapeados pelo nome']} />
      </div>
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
        <p className="text-sm text-amber-800"><strong>Atencao:</strong> Faca a importacao uma unica vez. Rodar duas vezes pode duplicar agendamentos. Se precisar reimportar, entre em contato com o suporte antes.</p>
      </div>
    </div>
  )
}

function DicasAtalhos() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Dicas e Atalhos</h2>
        <p className="text-slate-600 mt-2">Seja mais produtivo com estas dicas.</p>
      </div>
      <div className="grid gap-4">
        <Dica icon="🔍" title="Busca rapida global" description="Use Ctrl+K (ou Cmd+K no Mac) para buscar pacientes, agendamentos e mais em qualquer tela." />
        <Dica icon="📱" title="Funciona no celular e tablet" description="O sistema e 100% responsivo. Use pelo celular para check-ins rapidos e pelo tablet durante o atendimento." />
        <Dica icon="💬" title="Agende pelo WhatsApp" description="No painel WhatsApp, clique em Agendar no header da conversa para criar agendamentos sem sair do chat." />
        <Dica icon="🦷" title="Odontograma ativavel" description="O modulo Odontograma pode ser ativado por clinica pelo painel admin. Ideal para clinicas odontologicas ou mistas." />
        <Dica icon="📦" title="Pacotes de sessoes" description="Crie pacotes na ficha do paciente ou direto ao agendar. O sistema controla sessoes restantes automaticamente." />
        <Dica icon="💰" title="Sinal no agendamento" description="Registre o sinal cobrado no ato do agendamento diretamente no popup da agenda. A recepcao ve o valor na chegada do paciente." />
        <Dica icon="🤖" title="Eva respeita o cadastro" description="A Eva le a descricao de cada procedimento. Coloque instrucoes claras la para ela responder corretamente." />
        <Dica icon="📊" title="CRM atualizado automaticamente" description="Todo lead do WhatsApp entra no CRM automaticamente e avanca para Em Conversa na primeira mensagem." />
        <Dica icon="🔔" title="Realtime na ficha" description="Quando o paciente preenche a anamnese, ela aparece na ficha automaticamente sem precisar recarregar a pagina." />
        <Dica icon="✅" title="Finalizar igual Realizado" description="Ao clicar em Finalizar no atendimento, o status da agenda muda para Realizado automaticamente." />
      </div>
      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mt-6">
        <p className="text-sm text-emerald-800"><strong>Precisa de ajuda?</strong> Entre em contato pelo WhatsApp: (34) 99180-5722</p>
      </div>
    </div>
  )
}

function Step({ number, title, description, link }: { number: number; title: string; description: string; link: string }) {
  return (
    <Link href={link} className="flex gap-4 p-4 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors group">
      <div className="w-8 h-8 rounded-full bg-violet-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">{number}</div>
      <div className="flex-1">
        <h3 className="font-semibold text-slate-900 group-hover:text-violet-600 transition-colors">{title}</h3>
        <p className="text-sm text-slate-600 mt-0.5">{description}</p>
      </div>
      <Icon name="chevronRight" className="w-5 h-5 text-slate-400 self-center" />
    </Link>
  )
}

function Tutorial({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div className="border border-slate-200 rounded-xl p-4">
      <h3 className="font-semibold text-slate-900 mb-3">{title}</h3>
      <ol className="space-y-2">
        {steps.map((step, idx) => (
          <li key={idx} className="flex gap-3 text-sm">
            <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-xs font-semibold flex-shrink-0">{idx + 1}</span>
            <span className="text-slate-600">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function Dica({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="flex gap-4 p-4 bg-amber-50 border border-amber-100 rounded-xl">
      <span className="text-2xl">{icon}</span>
      <div>
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-600 mt-0.5">{description}</p>
      </div>
    </div>
  )
}
