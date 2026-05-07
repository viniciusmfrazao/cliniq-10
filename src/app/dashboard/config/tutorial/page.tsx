'use client'

import { useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'

type Section = 'inicio' | 'agenda' | 'pacientes' | 'financeiro' | 'crm' | 'estoque' | 'documentos' | 'equipe' | 'dicas'

const sections: { id: Section; title: string; icon: string }[] = [
  { id: 'inicio', title: 'Primeiros Passos', icon: 'sparkles' },
  { id: 'agenda', title: 'Agenda', icon: 'calendar' },
  { id: 'pacientes', title: 'Pacientes', icon: 'users' },
  { id: 'financeiro', title: 'Financeiro', icon: 'dollarSign' },
  { id: 'crm', title: 'CRM e Leads', icon: 'target' },
  { id: 'estoque', title: 'Estoque', icon: 'box' },
  { id: 'documentos', title: 'Documentos', icon: 'file' },
  { id: 'equipe', title: 'Equipe', icon: 'userPlus' },
  { id: 'dicas', title: 'Dicas e Atalhos', icon: 'zap' },
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
        <p className="text-sm text-slate-500 mt-0.5">
          Aprenda a usar todas as funcionalidades do Clinike
        </p>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <nav className="card p-2 sticky top-4">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  activeSection === section.id
                    ? 'bg-violet-100 text-violet-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon name={section.icon} className="w-4 h-4" />
                <span className="text-sm font-medium">{section.title}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <div className="card p-6">
            {activeSection === 'inicio' && <PrimeirosPassos />}
            {activeSection === 'agenda' && <TutorialAgenda />}
            {activeSection === 'pacientes' && <TutorialPacientes />}
            {activeSection === 'financeiro' && <TutorialFinanceiro />}
            {activeSection === 'crm' && <TutorialCRM />}
            {activeSection === 'estoque' && <TutorialEstoque />}
            {activeSection === 'documentos' && <TutorialDocumentos />}
            {activeSection === 'equipe' && <TutorialEquipe />}
            {activeSection === 'dicas' && <DicasAtalhos />}
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
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          🚀 Bem-vindo ao Clinike!
        </h2>
        <p className="text-slate-600 mt-2">
          Siga estes passos para configurar sua clínica e começar a usar o sistema.
        </p>
      </div>

      <div className="space-y-4">
        <Step 
          number={1} 
          title="Configure os dados da clínica" 
          description="Vá em Configurações e preencha nome, CNPJ e logotipo da sua clínica."
          link="/dashboard/config"
        />
        <Step 
          number={2} 
          title="Cadastre sua equipe" 
          description="Adicione os profissionais que trabalham na clínica (médicos, esteticistas, recepcionistas)."
          link="/dashboard/equipe"
        />
        <Step 
          number={3} 
          title="Cadastre os procedimentos" 
          description="Liste todos os serviços oferecidos com preços e duração média."
          link="/dashboard/procedimentos"
        />
        <Step 
          number={4} 
          title="Importe ou cadastre pacientes" 
          description="Adicione seus pacientes manualmente ou importe de uma planilha."
          link="/dashboard/pacientes"
        />
        <Step 
          number={5} 
          title="Comece a agendar!" 
          description="Sua clínica está pronta. Crie o primeiro agendamento."
          link="/dashboard/agenda"
        />
      </div>

      <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 mt-6">
        <p className="text-sm text-violet-800">
          <strong>💡 Dica:</strong> Use o menu lateral para navegar entre as funcionalidades. 
          No celular, use o menu inferior.
        </p>
      </div>
    </div>
  )
}

function TutorialAgenda() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          📅 Como usar a Agenda
        </h2>
        <p className="text-slate-600 mt-2">
          A agenda é o coração do sistema. Aqui você gerencia todos os agendamentos.
        </p>
      </div>

      <div className="space-y-4">
        <Tutorial 
          title="Criar um agendamento"
          steps={[
            'Clique no botão "Agendar" no topo da tela',
            'Selecione o paciente (ou cadastre um novo)',
            'Escolha o procedimento desejado',
            'Selecione o profissional responsável',
            'Defina data e horário',
            'Clique em "Confirmar Agendamento"'
          ]}
        />

        <Tutorial 
          title="Visualizar a agenda"
          steps={[
            'Use os botões "Dia", "Semana" ou "Mês" para trocar a visualização',
            'Filtre por profissional clicando no nome dele',
            'Clique em um agendamento para ver detalhes',
            'Arraste agendamentos para reagendar (na visualização semanal)'
          ]}
        />

        <Tutorial 
          title="Gerenciar status"
          steps={[
            'Agendado: Consulta marcada, aguardando confirmação',
            'Confirmado: Paciente confirmou presença',
            'Check-in: Paciente chegou na clínica',
            'Em atendimento: Consulta em andamento',
            'Concluído: Atendimento finalizado',
            'Cancelado / Não compareceu: Consulta não realizada'
          ]}
        />
      </div>
    </div>
  )
}

function TutorialPacientes() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          👥 Gestão de Pacientes
        </h2>
        <p className="text-slate-600 mt-2">
          Cadastre e gerencie todos os pacientes da sua clínica.
        </p>
      </div>

      <div className="space-y-4">
        <Tutorial 
          title="Cadastrar novo paciente"
          steps={[
            'Vá em Pacientes > Novo Paciente',
            'Preencha nome, telefone e email (obrigatórios)',
            'Adicione CPF, data de nascimento e endereço',
            'Use o campo "Observações" para informações importantes',
            'Clique em "Salvar"'
          ]}
        />

        <Tutorial 
          title="Buscar pacientes"
          steps={[
            'Use a barra de pesquisa no topo da lista',
            'Busque por nome, telefone, email ou CPF',
            'Clique no paciente para ver a ficha completa'
          ]}
        />

        <Tutorial 
          title="Ficha do paciente"
          steps={[
            'Dados pessoais e contato',
            'Histórico de agendamentos',
            'Evoluções e prontuário',
            'Documentos assinados',
            'Fotos antes/depois'
          ]}
        />
      </div>
    </div>
  )
}

function TutorialFinanceiro() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          💰 Módulo Financeiro
        </h2>
        <p className="text-slate-600 mt-2">
          Controle entradas, saídas e tenha visão completa do faturamento.
        </p>
      </div>

      <div className="space-y-4">
        <Tutorial 
          title="Registrar entrada (receita)"
          steps={[
            'Vá em Financeiro > Entradas > Nova Entrada',
            'Selecione o paciente e procedimento',
            'Informe valor bruto e forma de pagamento',
            'Se cartão, informe bandeira e número de parcelas',
            'O sistema calcula automaticamente taxa e valor líquido',
            'Salve o registro'
          ]}
        />

        <Tutorial 
          title="Registrar saída (despesa)"
          steps={[
            'Vá em Financeiro > Saídas > Nova Saída',
            'Informe descrição e categoria (aluguel, material, etc)',
            'Preencha valor e fornecedor',
            'Adicione observações se necessário',
            'Salve o registro'
          ]}
        />

        <Tutorial 
          title="Ver relatórios"
          steps={[
            'DRE: Demonstrativo de Resultado (receitas - despesas)',
            'Filtre por período (mês, trimestre, ano)',
            'Veja faturamento por profissional',
            'Exporte relatórios em PDF'
          ]}
        />
      </div>
    </div>
  )
}

function TutorialCRM() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          🎯 CRM e Leads
        </h2>
        <p className="text-slate-600 mt-2">
          Gerencie interessados e converta mais pacientes.
        </p>
      </div>

      <div className="space-y-4">
        <Tutorial 
          title="Entendendo o funil"
          steps={[
            'Novo Lead: Pessoa que entrou em contato',
            'Contatado: Você já respondeu',
            'Agendou: Marcou uma consulta/avaliação',
            'Convertido: Virou paciente',
            'Perdido: Não teve interesse'
          ]}
        />

        <Tutorial 
          title="Adicionar novo lead"
          steps={[
            'Clique em "Novo Lead"',
            'Preencha nome, telefone e origem (Instagram, WhatsApp, etc)',
            'Selecione o procedimento de interesse',
            'Adicione observações sobre o contato',
            'O lead entra automaticamente como "Novo"'
          ]}
        />

        <Tutorial 
          title="Mover leads no funil"
          steps={[
            'Arraste o card do lead para outra coluna',
            'Ou clique no lead e mude o status manualmente',
            'Adicione notas sobre cada interação',
            'Agende follow-up para não esquecer'
          ]}
        />
      </div>
    </div>
  )
}

function TutorialEstoque() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          📦 Controle de Estoque
        </h2>
        <p className="text-slate-600 mt-2">
          Gerencie produtos, injetáveis e alertas de validade.
        </p>
      </div>

      <div className="space-y-4">
        <Tutorial 
          title="Cadastrar produto"
          steps={[
            'Vá em Estoque > Novo Produto',
            'Preencha nome, marca e categoria',
            'Defina unidade de medida (ml, unidade, etc)',
            'Informe estoque mínimo para alertas',
            'Adicione preço de custo e venda',
            'Salve o produto'
          ]}
        />

        <Tutorial 
          title="Dar entrada no estoque"
          steps={[
            'Abra o produto desejado',
            'Clique em "Nova Entrada"',
            'Informe quantidade, lote e validade',
            'Adicione nota fiscal se tiver',
            'Confirme a entrada'
          ]}
        />

        <Tutorial 
          title="Alertas automáticos"
          steps={[
            'Produtos abaixo do estoque mínimo aparecem em vermelho',
            'Produtos próximos da validade são destacados',
            'Receba notificações de reposição'
          ]}
        />
      </div>
    </div>
  )
}

function TutorialDocumentos() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          📄 Documentos e Assinaturas
        </h2>
        <p className="text-slate-600 mt-2">
          Crie termos de consentimento e colete assinaturas digitais.
        </p>
      </div>

      <div className="space-y-4">
        <Tutorial 
          title="Criar template de documento"
          steps={[
            'Vá em Configurações > Templates de Documentos',
            'Clique em "Novo Template"',
            'Dê um nome (ex: Termo de Botox)',
            'Escreva o conteúdo do documento',
            'Use variáveis: {nome_paciente}, {data}, {procedimento}',
            'Salve o template'
          ]}
        />

        <Tutorial 
          title="Enviar para assinatura"
          steps={[
            'Na ficha do paciente, clique em "Documentos"',
            'Selecione o template desejado',
            'O sistema preenche as variáveis automaticamente',
            'Envie por WhatsApp ou email',
            'O paciente assina pelo celular',
            'Documento assinado fica salvo no prontuário'
          ]}
        />
      </div>
    </div>
  )
}

function TutorialEquipe() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          👩‍⚕️ Gestão de Equipe
        </h2>
        <p className="text-slate-600 mt-2">
          Adicione membros da equipe e defina permissões.
        </p>
      </div>

      <div className="space-y-4">
        <Tutorial 
          title="Adicionar membro"
          steps={[
            'Vá em Equipe',
            'Clique em "Adicionar Membro"',
            'Preencha nome, email e senha temporária',
            'Selecione a função (Admin, Médico, Recepcionista, etc)',
            'O membro receberá email para primeiro acesso'
          ]}
        />

        <Tutorial 
          title="Funções disponíveis"
          steps={[
            'Admin: Acesso total ao sistema',
            'Médico/Esteticista: Agenda, pacientes, prontuário',
            'Recepcionista: Agenda, check-in, pacientes básico',
            'Financeiro: Apenas módulo financeiro',
            'Visualizador: Apenas consulta, sem edição'
          ]}
        />

        <Tutorial 
          title="Desativar membro"
          steps={[
            'Encontre o membro na lista',
            'Clique em "Desativar"',
            'O histórico é mantido, mas acesso bloqueado',
            'Pode reativar depois se necessário'
          ]}
        />
      </div>
    </div>
  )
}

function DicasAtalhos() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          ⚡ Dicas e Atalhos
        </h2>
        <p className="text-slate-600 mt-2">
          Seja mais produtivo com estas dicas.
        </p>
      </div>

      <div className="grid gap-4">
        <Dica 
          icon="🔍"
          title="Busca rápida de pacientes"
          description="Na agenda, comece a digitar o nome do paciente para filtrar rapidamente."
        />
        <Dica 
          icon="📱"
          title="Funciona no celular"
          description="O sistema é 100% responsivo. Use pelo celular para check-ins e consultas rápidas."
        />
        <Dica 
          icon="🔔"
          title="Notificações"
          description="Ative as notificações do navegador para receber alertas de check-in e novos leads."
        />
        <Dica 
          icon="📊"
          title="Dashboard atualizado"
          description="A página inicial mostra resumo do dia. Comece sempre por lá."
        />
        <Dica 
          icon="🎨"
          title="Personalize o tema"
          description="Em Configurações, escolha a cor do sistema que combina com sua clínica."
        />
        <Dica 
          icon="💬"
          title="Donna IA"
          description="Configure a Donna para responder WhatsApp automaticamente e agendar consultas."
        />
      </div>

      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mt-6">
        <p className="text-sm text-emerald-800">
          <strong>Precisa de ajuda?</strong> Entre em contato pelo WhatsApp: (34) 99180-5722
        </p>
      </div>
    </div>
  )
}

// Componentes auxiliares
function Step({ number, title, description, link }: { number: number; title: string; description: string; link: string }) {
  return (
    <Link href={link} className="flex gap-4 p-4 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors group">
      <div className="w-8 h-8 rounded-full bg-violet-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
        {number}
      </div>
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
            <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-xs font-semibold flex-shrink-0">
              {idx + 1}
            </span>
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
