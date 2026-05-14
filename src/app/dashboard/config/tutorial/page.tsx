'use client'

import { useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'

type Section = 'inicio' | 'agenda' | 'pacientes' | 'financeiro' | 'crm' | 'whatsapp' | 'eva' | 'estoque' | 'documentos' | 'equipe' | 'importar' | 'dicas'

const sections: { id: Section; title: string; icon: string }[] = [
  { id: 'inicio',     title: 'Primeiros Passos',   icon: 'sparkles' },
  { id: 'agenda',     title: 'Agenda',              icon: 'calendar' },
  { id: 'pacientes',  title: 'Pacientes',           icon: 'users' },
  { id: 'financeiro', title: 'Financeiro',          icon: 'dollarSign' },
  { id: 'crm',        title: 'CRM e Leads',         icon: 'target' },
  { id: 'whatsapp',   title: 'WhatsApp',            icon: 'messageCircle' },
  { id: 'eva',        title: 'Eva IA',              icon: 'sparkles' },
  { id: 'estoque',    title: 'Estoque',             icon: 'box' },
  { id: 'documentos', title: 'Documentos',          icon: 'file' },
  { id: 'equipe',     title: 'Equipe',              icon: 'userPlus' },
  { id: 'importar',   title: 'Importar Dados',      icon: 'upload' },
  { id: 'dicas',      title: 'Dicas e Atalhos',     icon: 'zap' },
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
            {activeSection === 'inicio'     && <PrimeirosPassos />}
            {activeSection === 'agenda'     && <TutorialAgenda />}
            {activeSection === 'pacientes'  && <TutorialPacientes />}
            {activeSection === 'financeiro' && <TutorialFinanceiro />}
            {activeSection === 'crm'        && <TutorialCRM />}
            {activeSection === 'whatsapp'   && <TutorialWhatsApp />}
            {activeSection === 'eva'        && <TutorialEva />}
            {activeSection === 'estoque'    && <TutorialEstoque />}
            {activeSection === 'documentos' && <TutorialDocumentos />}
            {activeSection === 'equipe'     && <TutorialEquipe />}
            {activeSection === 'importar'   && <TutorialImportar />}
            {activeSection === 'dicas'      && <DicasAtalhos />}
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
        <h2 className="text-lg font-bold text-slate-900">🚀 Bem-vindo ao Clinike!</h2>
        <p className="text-slate-600 mt-2">Siga estes passos para configurar sua clínica e começar a usar o sistema.</p>
      </div>
      <div className="space-y-4">
        <Step number={1} title="Configure os dados da clínica" description="Preencha nome, endereço, telefone, Instagram e horário de funcionamento em Configurações → Dados da Clínica." link="/dashboard/config" />
        <Step number={2} title="Cadastre sua equipe" description="Adicione os profissionais com nome, email e papel. Defina os horários de atendimento de cada um clicando no ícone de relógio." link="/dashboard/equipe" />
        <Step number={3} title="Cadastre os procedimentos" description="Liste todos os serviços com preço, duração e quem realiza. Sem profissional vinculado = qualquer membro pode realizar." link="/dashboard/procedimentos" />
        <Step number={4} title="Conecte o WhatsApp" description="Vá em Configurações → WhatsApp e escaneie o QR code para conectar o número da clínica." link="/dashboard/config/whatsapp" />
        <Step number={5} title="Configure a Eva IA" description="Personalize a personalidade, mensagens de follow-up e política de desconto da sua assistente virtual." link="/dashboard/config/eva" />
        <Step number={6} title="Importe o histórico (opcional)" description="Importe agendamentos e pacientes do sistema anterior via planilha Excel." link="/dashboard/config/importar" />
        <Step number={7} title="Comece a agendar!" description="Sua clínica está pronta. Crie o primeiro agendamento." link="/dashboard/agenda" />
      </div>
      <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
        <p className="text-sm text-violet-800"><strong>💡 Dica:</strong> Configure os horários de cada profissional em Equipe → ícone de relógio antes de ativar a Eva. Isso é essencial para ela responder sobre disponibilidade corretamente.</p>
      </div>
    </div>
  )
}

function TutorialAgenda() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">📅 Como usar a Agenda</h2>
        <p className="text-slate-600 mt-2">A agenda é o coração do sistema. Aqui você gerencia todos os agendamentos.</p>
      </div>
      <div className="space-y-4">
        <Tutorial title="Criar um agendamento" steps={['Clique no botão "Agendar" no topo da tela','Selecione o paciente (ou cadastre um novo)','Escolha o procedimento desejado','Selecione o profissional responsável','Defina data e horário','Clique em "Confirmar Agendamento"']} />
        <Tutorial title="Visualizar a agenda" steps={['Use os botões "Dia", "Semana" ou "Mês" para trocar a visualização','Filtre por profissional clicando no nome dele no topo','Clique em um agendamento para ver detalhes e alterar status']} />
        <Tutorial title="Status dos agendamentos" steps={['Agendado: Consulta marcada, aguardando confirmação','Confirmado: Paciente confirmou presença','Check-in: Paciente chegou na clínica','Em atendimento: Consulta em andamento','Concluído: Atendimento finalizado','Cancelado / Não compareceu: Consulta não realizada']} />
        <Tutorial title="Confirmação automática D-1" steps={['O sistema envia mensagem de confirmação 24h antes automaticamente','Quando o paciente responder "sim/confirmo", o status muda para Confirmado','Configure o texto da mensagem em Configurações → Eva IA']} />
      </div>
    </div>
  )
}

function TutorialPacientes() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">👥 Gestão de Pacientes</h2>
        <p className="text-slate-600 mt-2">Cadastre e gerencie todos os pacientes da sua clínica.</p>
      </div>
      <div className="space-y-4">
        <Tutorial title="Cadastrar novo paciente" steps={['Vá em Pacientes → Novo Paciente','Preencha nome e telefone (obrigatórios)','Adicione CPF, data de nascimento e endereço','Use o campo "Observações" para informações importantes','Clique em "Salvar"']} />
        <Tutorial title="Ficha completa do paciente" steps={['Dados pessoais e histórico de contato','Todos os agendamentos passados e futuros','Prontuário e evoluções clínicas','Anamnese respondida','Documentos assinados','Aplicações de injetáveis com mapa facial']} />
        <Tutorial title="Filtros de pacientes" steps={['Busque por nome, telefone, email ou CPF','Filtre "Pendentes" para ver pacientes sem CPF ou data de nascimento','Use essa lista para completar o cadastro gradualmente']} />
        <Tutorial title="Lista de Espera" steps={['Vá em Lista de Espera para ver pacientes aguardando vaga','Quando um horário abrir, notifique o próximo da fila','O paciente pode ser adicionado manualmente ou solicitar pela Eva']} />
      </div>
    </div>
  )
}

function TutorialFinanceiro() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">💰 Módulo Financeiro</h2>
        <p className="text-slate-600 mt-2">Controle entradas, saídas e tenha visão completa do faturamento.</p>
      </div>
      <div className="space-y-4">
        <Tutorial title="Registrar entrada (receita)" steps={['Vá em Financeiro → Entradas → Nova Entrada','Selecione o paciente e procedimento','Informe valor bruto e forma de pagamento','Se cartão, informe bandeira e número de parcelas','O sistema calcula automaticamente taxa e valor líquido','Salve o registro']} />
        <Tutorial title="Registrar saída (despesa)" steps={['Vá em Financeiro → Saídas → Nova Saída','Informe descrição, categoria e valor','Categorias: aluguel, material, equipamento, salário, etc','Adicione observações e salve']} />
        <Tutorial title="Configurar taxas de pagamento" steps={['Vá em Configurações → Taxas de Pagamento','Cadastre a taxa de cada bandeira de cartão','O sistema desconta automaticamente ao registrar entradas','O DRE mostra o valor líquido real que entra no caixa']} />
        <Tutorial title="Metas financeiras" steps={['Configure metas mensais de faturamento no dashboard','Acompanhe o progresso em tempo real','Veja comparativo mês a mês']} />
      </div>
    </div>
  )
}

function TutorialCRM() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">🎯 CRM e Leads</h2>
        <p className="text-slate-600 mt-2">Gerencie interessados e converta mais pacientes. Leads do WhatsApp entram automaticamente.</p>
      </div>
      <div className="space-y-4">
        <Tutorial title="Entendendo o funil" steps={['Novo Lead: Pessoa que entrou em contato pelo WhatsApp','Em Conversa: Eva já está atendendo','Agendado: Marcou uma consulta ou avaliação','Cliente: Virou paciente após o agendamento','Perdido: Não teve interesse após todos os follow-ups']} />
        <Tutorial title="Leads automáticos da Eva" steps={['Toda mensagem no WhatsApp vira lead automaticamente','A Eva registra interesse, prioridade e histórico','Badge "Atendimento" aparece quando escalado para humano','Clique em "Devolver pra Eva" para ela retomar o atendimento']} />
        <Tutorial title="Adicionar lead manualmente" steps={['Clique em "Novo Lead"','Preencha nome, telefone e origem (Instagram, indicação, etc)','Selecione o procedimento de interesse','Adicione observações sobre o contato']} />
        <Tutorial title="Follow-up automático" steps={['A Eva envia 5 mensagens automáticas para leads sem resposta','Estágios: 2h, 1 dia, 2 dias, 5 dias e 10 dias','Configure os textos em Configurações → Eva IA','Após o 5° follow-up sem resposta, lead é marcado como Perdido']} />
      </div>
    </div>
  )
}

function TutorialWhatsApp() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">💬 WhatsApp da Clínica</h2>
        <p className="text-slate-600 mt-2">Conecte o número da clínica e gerencie conversas diretamente no sistema.</p>
      </div>
      <div className="space-y-4">
        <Tutorial title="Conectar o WhatsApp" steps={['Vá em Configurações → WhatsApp da Clínica','Clique em "Conectar novo número"','Abra o WhatsApp no celular → três pontinhos → Aparelhos conectados','Escaneie o QR code exibido na tela','Aguarde a conexão — ícone verde "Conectado" confirma']} />
        <Tutorial title="Visualizar conversas" steps={['Vá em WhatsApp no menu lateral','Veja todas as conversas em tempo real','Conversas com a Eva ativa mostram respostas automáticas','Conversas escaladas mostram banner amarelo "Atendimento humano"']} />
        <Tutorial title="Atendimento humano" steps={['Quando a Eva escala, aparece banner amarelo na conversa','A Eva fica em silêncio enquanto você responde','Ao terminar, clique em "Devolver pra Eva" para ela retomar','A Eva não perde o contexto da conversa']} />
        <Tutorial title="Múltiplos números" steps={['A clínica pode ter mais de um número conectado','Cada número pode ter papel específico: entrada de leads, automações, manual','Gerencie os números em Configurações → WhatsApp']} />
      </div>
    </div>
  )
}

function TutorialEva() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">✨ Eva IA — Sua Assistente Virtual</h2>
        <p className="text-slate-600 mt-2">A Eva atende no WhatsApp 24/7, agenda consultas, registra leads e faz follow-up automaticamente.</p>
      </div>
      <div className="space-y-4">
        <Tutorial title="O que a Eva faz automaticamente" steps={['Recebe e responde mensagens no WhatsApp 24/7','Apresenta procedimentos e preços quando perguntado','Consulta horários disponíveis em tempo real','Cria agendamentos confirmados diretamente na agenda','Registra o lead no CRM com interesse e prioridade','Envia follow-ups automáticos para quem não respondeu','Escala para atendimento humano quando não sabe responder']} />
        <Tutorial title="Configurar personalidade" steps={['Vá em Configurações → Eva IA','Edite o campo "Personalidade" com o tom que sua clínica prefere','Exemplo: "Seja calorosa, elegante, use emojis com moderação"','Se deixar em branco, a Eva usa o padrão Clinike']} />
        <Tutorial title="Configurar horários (ESSENCIAL)" steps={['Vá em Equipe e clique no ícone de relógio de cada profissional','Defina quais dias e horários cada um atende','A Eva usa esses dados para responder sobre disponibilidade','Sem horários cadastrados, a Eva inventa ou escala desnecessariamente']} />
        <Tutorial title="Mensagens de follow-up" steps={['Configure até 5 textos em Configurações → Eva IA','Cada texto tem tom diferente: curioso, sutil, emocional...','Configure o intervalo entre cada follow-up (em minutos)','Se não configurar, a Eva usa os textos padrão do Clinike']} />
        <Tutorial title="Política de desconto" steps={['Em Configurações → Eva IA, adicione a política de desconto','Exemplo: "À vista no Pix: 5% de desconto"','A Eva só menciona quando o paciente perguntar explicitamente','Nunca oferece proativamente — segue boas práticas de venda']} />
        <Tutorial title="Quando a Eva escala para humano" steps={['Cancelamentos e reagendamentos','Reclamações','Dúvidas que ela não sabe responder','Você recebe badge no CRM e banner amarelo no WhatsApp','Ao terminar, clique em "Devolver pra Eva"']} />
      </div>
      <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
        <p className="text-sm text-violet-800"><strong>💡 Dica:</strong> Cadastre os horários de todos os profissionais antes de ativar a Eva. Isso evita respostas erradas sobre disponibilidade.</p>
      </div>
    </div>
  )
}

function TutorialEstoque() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">📦 Controle de Estoque</h2>
        <p className="text-slate-600 mt-2">Gerencie produtos, injetáveis e alertas de validade.</p>
      </div>
      <div className="space-y-4">
        <Tutorial title="Cadastrar produto" steps={['Vá em Estoque → Novo Produto','Preencha nome, marca e categoria','Defina unidade de medida (ml, unidade, etc)','Informe estoque mínimo para alertas automáticos','Adicione preço de custo','Salve o produto']} />
        <Tutorial title="Dar entrada no estoque" steps={['Abra o produto desejado','Clique em "Nova Entrada"','Informe quantidade, lote e validade','Adicione nota fiscal se tiver','Confirme a entrada']} />
        <Tutorial title="Injetáveis e mapa facial" steps={['Vá em Injetáveis para registrar aplicações','Selecione o paciente e o produto aplicado','Marque os pontos no mapa facial interativo','Registre quantidade em unidades ou ml','O histórico fica salvo na ficha do paciente']} />
        <Tutorial title="Alertas automáticos" steps={['Produtos abaixo do estoque mínimo aparecem em vermelho','Produtos próximos da validade são destacados em amarelo','Verifique o painel de estoque regularmente para reposição']} />
      </div>
    </div>
  )
}

function TutorialDocumentos() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">📄 Documentos e Assinaturas</h2>
        <p className="text-slate-600 mt-2">Crie termos de consentimento e colete assinaturas digitais.</p>
      </div>
      <div className="space-y-4">
        <Tutorial title="Criar template de documento" steps={['Vá em Configurações → Templates de Documentos','Clique em "Novo Template"','Dê um nome (ex: Termo de Consentimento Botox)','Escreva o conteúdo do documento','Use variáveis: {nome_paciente}, {data}, {procedimento}','Salve o template']} />
        <Tutorial title="Enviar para assinatura" steps={['Na ficha do paciente, clique em "Documentos"','Selecione o template desejado','O sistema preenche as variáveis automaticamente','Envie por WhatsApp ou email','O paciente assina pelo celular','Documento assinado fica salvo no prontuário']} />
        <Tutorial title="Anamnese digital" steps={['Configure o formulário em Configurações → Anamnese','Adicione seções e perguntas personalizadas','Envie o link para o paciente antes da consulta','As respostas ficam salvas na ficha do paciente']} />
      </div>
    </div>
  )
}

function TutorialEquipe() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">👩‍⚕️ Gestão de Equipe</h2>
        <p className="text-slate-600 mt-2">Adicione membros, defina permissões e configure horários de atendimento.</p>
      </div>
      <div className="space-y-4">
        <Tutorial title="Adicionar membro" steps={['Vá em Equipe → Adicionar Membro','Preencha nome e email','Selecione a função (Admin, Esteticista, Recepcionista, etc)','O membro receberá email para definir a senha no primeiro acesso']} />
        <Tutorial title="Configurar horários de atendimento" steps={['Na lista de equipe, clique no ícone de relógio do profissional','Ative os dias que ele atende','Defina os horários de início e fim de cada turno','Pode adicionar múltiplos turnos por dia (manhã + tarde)','Use "Copiar segunda → ter/qua/qui/sex" para agilizar','Salve — a Eva e a agenda usam esses horários automaticamente']} />
        <Tutorial title="Configurar férias e folgas" steps={['Clique no ícone de calendário do profissional','Adicione períodos de indisponibilidade','A agenda bloqueia automaticamente esses dias','A Eva não oferecerá horários nesses períodos']} />
        <Tutorial title="Funções e permissões" steps={['Admin: Acesso total ao sistema','Esteticista/Médico/Biomédica: Agenda, pacientes, prontuário','Recepcionista: Agenda e check-in (sem financeiro)','Personalize em Configurações → Permissões por Papel']} />
      </div>
    </div>
  )
}

function TutorialImportar() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">📥 Importar Dados do Sistema Anterior</h2>
        <p className="text-slate-600 mt-2">Importe histórico de agendamentos e pacientes via planilha Excel.</p>
      </div>
      <div className="space-y-4">
        <Tutorial title="Como importar agendamentos" steps={['Vá em Configurações → Importar Agendamentos','Selecione o arquivo Excel exportado do sistema anterior','Configure os profissionais para ignorar (ex: quem saiu da clínica)','Defina o nome do profissional fictício para quem não está mais cadastrado','Escolha o status para agendamentos do passado (recomendado: Realizado)','Agendamentos com data futura viram "Agendado" automaticamente','Clique em "Iniciar Importação" e aguarde até 1 minuto']} />
        <Tutorial title="Regras aplicadas automaticamente" steps={['Agendamentos deletados e cancelados são ignorados','Pacientes já cadastrados com o mesmo telefone NÃO são duplicados','Pacientes novos são criados com os dados da planilha','Profissionais são mapeados pelo nome (busca parcial)']} />
      </div>
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
        <p className="text-sm text-amber-800"><strong>⚠️ Atenção:</strong> Faça a importação uma única vez. Rodar duas vezes pode duplicar agendamentos. Se precisar reimportar, entre em contato com o suporte antes.</p>
      </div>
    </div>
  )
}

function DicasAtalhos() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">⚡ Dicas e Atalhos</h2>
        <p className="text-slate-600 mt-2">Seja mais produtivo com estas dicas.</p>
      </div>
      <div className="grid gap-4">
        <Dica icon="🔍" title="Busca rápida global" description="Use Ctrl+K (ou Cmd+K no Mac) para buscar pacientes, agendamentos e mais em qualquer tela." />
        <Dica icon="📱" title="Funciona no celular" description="O sistema é 100% responsivo. Use pelo celular para check-ins rápidos e consultar a agenda." />
        <Dica icon="⏰" title="Cadastre os horários dos profissionais" description="Fundamental para a Eva funcionar corretamente. Sem horários, ela não sabe quais dias cada profissional atende." />
        <Dica icon="🤖" title="Eva responde 24/7" description="A Eva fica ativa mesmo fora do horário da clínica. Configure a personalidade para soar como sua clínica." />
        <Dica icon="🎯" title="CRM atualizado automaticamente" description="Todo lead do WhatsApp entra no CRM automaticamente com interesse, prioridade e histórico registrados pela Eva." />
        <Dica icon="🎨" title="Personalize o tema" description="Em Configurações, escolha a cor do sistema que combina com a identidade visual da sua clínica." />
        <Dica icon="📊" title="Dashboard diário" description="A página inicial mostra consultas do dia, pacientes cadastrados e receita do mês. Comece sempre por lá." />
        <Dica icon="🔔" title="Confirmação automática" description="O sistema envia mensagem de confirmação 24h antes de cada consulta. Configure o texto em Configurações → Eva IA." />
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
