'use client'

// NOTA: Este é um Client Component porque usa useState para o accordion.
// Os dados são passados via props do Server Component wrapper (page-server.tsx).
// Se preferir manter como Server Component puro, mova o accordion para um
// componente filho. Por ora, optamos pela abordagem client para simplicidade.

import { useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import BirthdayAutomationForm from './birthday-form'
import BirthdayHistory from './birthday-history'
import AppointmentReminderForm from './reminder-form'
import ReminderHistory from './reminder-history'
import RecallForm from './recall-form'
import RecallHistory from './recall-history'
import NpsForm from './nps-form'
import NpsHistory from './nps-history'
import ContatoPosForm from './contato-pos-form'
import PosVendaForm from './pos-venda-form'
import AlertaDespesasForm from './alerta-despesas-form'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type AutomationRow = {
  aniversario?: boolean | null
  aniversario_hora?: number | null
  aniversario_optin_required?: boolean | null
  template_aniversario?: string | null
  confirma_24h?: boolean | null
  confirma_24h_hora?: number | null
  template_confirma_24h?: string | null
  lembrete_2h?: boolean | null
  template_lembrete_2h?: string | null
  msg_agendamento?: boolean | null
  template_msg_agendamento?: string | null
  recall_inativos?: boolean | null
  recall_dias?: number | null
  template_recall?: string | null
  recall_seq?: any[] | null
  nps_pos_atendimento?: boolean | null
  template_nps?: string | null
  nps_imediato?: boolean | null
  nps_delay_minutes?: number | null
  contato_pos_procedimento?: boolean | null
  contato_pos_hora?: number | null
  template_contato_pos?: string | null
  contato_pos_excluir_categorias?: string[] | null
  contato_pos_seq?: any[] | null
  pos_venda_ativo?: boolean | null
  pos_venda_hora?: number | null
  template_pos_venda?: string | null
  pos_venda_seq?: any[] | null
  alerta_despesas?: boolean | null
  alerta_despesas_dias_antes?: number | null
  relatorio_telefones?: any
}

interface Props {
  clinicId: string
  clinicName: string
  auto: AutomationRow | null
  whatsappConnected: boolean
}

// ─── Accordion item ───────────────────────────────────────────────────────────

function AccordionItem({
  id,
  emoji,
  gradient,
  title,
  description,
  isActive,
  isOpen,
  onToggle,
  children,
}: {
  id: string
  emoji: string
  gradient: string
  title: string
  description: string
  isActive: boolean
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className={`card overflow-hidden transition-all ${isOpen ? 'ring-1 ring-slate-200' : ''}`}>
      {/* Header clicável */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-5 hover:bg-slate-50 transition-colors text-left"
      >
        <div
          className={`w-11 h-11 rounded-xl ${gradient} flex items-center justify-center shadow-sm flex-shrink-0`}
        >
          <span className="text-xl">{emoji}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-slate-900">{title}</p>
            {/* Badge de status */}
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                isActive
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}
              />
              {isActive ? 'Ativa' : 'Inativa'}
            </span>
          </div>
          <p className="text-sm text-slate-500 truncate">{description}</p>
        </div>

        <Icon
          name="chevronDown"
          className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Conteúdo expandido */}
      {isOpen && <div className="border-t border-slate-100">{children}</div>}
    </div>
  )
}

// ─── Separador de grupo ────────────────────────────────────────────────────────

function GroupLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
        {label}
      </p>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  )
}

// ─── Mapa da jornada (banner fixo, storytelling) ──────────────────────────────

function JornadaCompleta({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="card overflow-hidden border border-violet-100 bg-gradient-to-br from-violet-50/60 to-fuchsia-50/40">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <span className="flex items-center gap-2 font-semibold text-violet-900">
          🗺️ Ver a jornada completa
        </span>
        <Icon
          name="chevronDown"
          className={`w-4 h-4 text-violet-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="px-5 pb-6 space-y-4 text-sm text-slate-700 leading-relaxed">
          <p>
            <strong>Tudo começa quando alguém marca uma consulta.</strong>
          </p>
          <p>
            Nesse exato momento, a automação <strong>📅 Lembrete de consulta</strong> já entra em ação: uma mensagem
            confirma o agendamento na hora, outra chega um dia antes pra ninguém esquecer, e uma última avisa 2 horas
            antes — o famoso empurrãozinho que reduz falta. Cada uma dessas mensagens é sua, editável do jeitinho que
            sua clínica fala.
          </p>

          <p>
            <strong>O paciente chegou, foi atendido, e agora?</strong>
          </p>
          <p>
            É aqui que entra o <strong>💜 Contato pós-procedimento</strong>. No dia seguinte (ou quando você preferir —
            3 dias, 7 dias, o tempo que fizer sentido pro procedimento) a clínica manda um &quot;oi, tudo bem? Como
            você está se sentindo?&quot;. Isso não é só cuidado — é o que faz o paciente sentir que não foi só mais um
            número na agenda.
          </p>

          <p>
            <strong>Algum tempo depois, ele volta pra um Retorno.</strong>
          </p>
          <p>
            E é exatamente aí que nasce o <strong>🔁 Pós-venda</strong>. Assim que o agendamento marcado como
            &quot;Retorno&quot; é concluído, a clínica pode montar um fluxo inteiro de relacionamento: no dia
            seguinte, 7 dias depois, 30 dias depois... quantas mensagens fizerem sentido pra manter o vínculo vivo e
            lembrar o paciente de que a clínica está aqui pra próxima etapa da transformação dele.
          </p>

          <p>
            <strong>Enquanto isso, a voz da clínica pode ir em duas direções.</strong>
          </p>
          <p>
            O <strong>⭐ NPS pós-atendimento</strong> serve pra duas coisas: pode ser uma pesquisa de satisfação de
            verdade, pra mapear o que pode melhorar — ou pode ser simplesmente uma mensagem de carinho, tipo:
          </p>
          <p className="italic bg-white/70 border border-violet-100 rounded-lg p-3">
            &quot;Que alegria foi te receber hoje na clínica. Nosso maior objetivo é fazer você se sentir ainda mais
            linda, realizada e transformada, e poder participar desse momento me deixa muito feliz. Foi um prazer te
            atender! ✨&quot;
          </p>
          <p>Sem pesquisa nenhuma — só reforçando que ali é um lugar que se importa.</p>

          <p>
            <strong>E os pacientes que sumiram?</strong>
          </p>
          <p>
            O <strong>💌 Recall de inativos</strong> existe pra isso: lembrar quem já é cliente da casa e faz um tempo
            que não aparece. Vale ouro — porque esses pacientes já confiam na clínica, já conhecem o trabalho. É o
            paciente de maior valor que existe: você não precisa gastar um centavo em captação pra trazer ele de
            volta, só precisa lembrar ele que a clínica está aqui.
          </p>

          <p>
            <strong>No meio do caminho, tem os momentos especiais.</strong>
          </p>
          <p>
            A <strong>🎂 Mensagem de aniversário</strong> sai sozinha, no dia certo, sem ninguém precisar lembrar.
          </p>

          <p>
            <strong>E por trás de tudo isso, a clínica se cuida também.</strong>
          </p>
          <p>
            O <strong>💸 Alerta de despesas</strong> avisa sobre o financeiro da casa. E se você quiser receber o
            resumo da semana inteira — agendamentos, cancelamentos, faturamento, estoque — é só cadastrar o número
            que vai receber o <strong>Relatório semanal</strong> logo na primeira tela de Configurações.
          </p>

          <div className="pt-2 mt-2 border-t border-violet-100">
            <p className="text-violet-800">
              💜 <em>No fim, cada automação aqui não é só uma mensagem programada — é um pedacinho do relacionamento
              entre a clínica e o paciente, funcionando sozinho, no momento certo.</em>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Componente principal (Client) ────────────────────────────────────────────

export default function AutomacoesClient({
  clinicId,
  clinicName,
  auto,
  whatsappConnected,
}: Props) {
  // Controla qual accordion está aberto (null = todos fechados)
  const [openId, setOpenId] = useState<string | null>(null)
  const [jornadaAberta, setJornadaAberta] = useState(false)

  function toggle(id: string) {
    setOpenId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="max-w-3xl mx-auto space-y-3">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <Link
            href="/dashboard/config"
            className="text-sm text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
          >
            <Icon name="chevronLeft" className="w-4 h-4" />
            Voltar
          </Link>
          <h1 className="text-xl font-bold text-slate-900 mt-2">Automações</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure as mensagens automáticas enviadas para seus pacientes pelo WhatsApp
          </p>
        </div>
      </div>

      {/* Alerta WhatsApp desconectado */}
      {!whatsappConnected && (
        <div className="card p-4 bg-amber-50 border border-amber-200">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Icon name="alertCircle" className="w-4 h-4 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-amber-900 text-sm">WhatsApp não conectado</p>
              <p className="text-xs text-amber-700 mt-0.5">
                As automações precisam que o WhatsApp da clínica esteja conectado para enviar
                mensagens.
              </p>
              <Link
                href="/dashboard/config/whatsapp"
                className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-xs font-medium"
              >
                Configurar WhatsApp
                <Icon name="chevronRight" className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Mapa da jornada (fixo, expansível) ────────────────────────────── */}
      <JornadaCompleta isOpen={jornadaAberta} onToggle={() => setJornadaAberta(p => !p)} />

      {/* ── Grupo: Antes do atendimento ───────────────────────────────────── */}
      <GroupLabel label="Antes do atendimento" />

      <AccordionItem
        id="lembrete"
        emoji="📅"
        gradient="bg-gradient-to-br from-emerald-500 to-teal-500"
        title="Lembrete de consulta"
        description="Confirmação ao agendar, no dia anterior e/ou 2h antes da consulta"
        isActive={!!(auto?.confirma_24h || auto?.lembrete_2h || auto?.msg_agendamento)}
        isOpen={openId === 'lembrete'}
        onToggle={() => toggle('lembrete')}
      >
        <AppointmentReminderForm
          clinicId={clinicId}
          clinicName={clinicName}
          initial={{
            enabled: auto?.confirma_24h ?? true,
            hora: auto?.confirma_24h_hora ?? 20,
            template24h: auto?.template_confirma_24h || '',
            lembrete2hEnabled: auto?.lembrete_2h ?? false,
            template2h: auto?.template_lembrete_2h || '',
            msgAgendamentoEnabled: auto?.msg_agendamento ?? false,
            templateAgendamento: auto?.template_msg_agendamento || '',
          }}
        />
        <ReminderHistory clinicId={clinicId} />
      </AccordionItem>

      {/* ── Grupo: Pós-atendimento ────────────────────────────────────────── */}
      <GroupLabel label="Após o atendimento" />

      <AccordionItem
        id="contato-pos"
        emoji="💜"
        gradient="bg-gradient-to-br from-violet-500 to-purple-500"
        title="Contato pós-procedimento"
        description="Sequência de acompanhamento após cada procedimento realizado"
        isActive={!!auto?.contato_pos_procedimento}
        isOpen={openId === 'contato-pos'}
        onToggle={() => toggle('contato-pos')}
      >
        <ContatoPosForm
          clinicId={clinicId}
          clinicName={clinicName}
          initial={{
            enabled: auto?.contato_pos_procedimento ?? false,
            hora: auto?.contato_pos_hora ?? 10,
            template: auto?.template_contato_pos || '',
            excluirCategorias: auto?.contato_pos_excluir_categorias ?? [
              'Atendimento',
              'Atendimento ',
            ],
            seq: auto?.contato_pos_seq ?? [],
          }}
        />
      </AccordionItem>

      <AccordionItem
        id="pos-venda"
        emoji="🔁"
        gradient="bg-gradient-to-br from-fuchsia-500 to-pink-500"
        title="Pós-venda"
        description="Mensagens automáticas quando um Retorno é concluído"
        isActive={!!auto?.pos_venda_ativo}
        isOpen={openId === 'pos-venda'}
        onToggle={() => toggle('pos-venda')}
      >
        <PosVendaForm
          clinicId={clinicId}
          clinicName={clinicName}
          initial={{
            enabled: auto?.pos_venda_ativo ?? false,
            hora: auto?.pos_venda_hora ?? 10,
            template: auto?.template_pos_venda || '',
            seq: auto?.pos_venda_seq ?? [],
          }}
        />
      </AccordionItem>

      <AccordionItem
        id="nps"
        emoji="⭐"
        gradient="bg-gradient-to-br from-blue-500 to-indigo-500"
        title="NPS pós-atendimento"
        description="Pesquisa de satisfação automática após cada atendimento"
        isActive={!!auto?.nps_pos_atendimento}
        isOpen={openId === 'nps'}
        onToggle={() => toggle('nps')}
      >
        <NpsForm
          clinicId={clinicId}
          clinicName={clinicName}
          initial={{
            enabled: auto?.nps_pos_atendimento ?? false,
            template: auto?.template_nps || '',
            imediato: auto?.nps_imediato ?? false,
            delayMinutes: auto?.nps_delay_minutes ?? 30,
          }}
        />
        <NpsHistory clinicId={clinicId} />
      </AccordionItem>

      {/* ── Grupo: Retenção ───────────────────────────────────────────────── */}
      <GroupLabel label="Retenção de pacientes" />

      <AccordionItem
        id="recall"
        emoji="💌"
        gradient="bg-gradient-to-br from-amber-500 to-orange-500"
        title="Recall de inativos"
        description="Sequência automática para pacientes que não voltam há um tempo"
        isActive={!!auto?.recall_inativos}
        isOpen={openId === 'recall'}
        onToggle={() => toggle('recall')}
      >
        <RecallForm
          clinicId={clinicId}
          clinicName={clinicName}
          initial={{
            enabled: auto?.recall_inativos ?? false,
            diasInativo: auto?.recall_dias ?? 150,
            template: auto?.template_recall || '',
            seq: auto?.recall_seq ?? [],
          }}
        />
        <RecallHistory clinicId={clinicId} />
      </AccordionItem>

      {/* ── Grupo: Relacionamento ─────────────────────────────────────────── */}
      <GroupLabel label="Relacionamento" />

      <AccordionItem
        id="aniversario"
        emoji="🎂"
        gradient="bg-gradient-to-br from-pink-500 to-rose-500"
        title="Mensagem de aniversário"
        description="Enviada automaticamente no dia do aniversário do paciente"
        isActive={!!auto?.aniversario}
        isOpen={openId === 'aniversario'}
        onToggle={() => toggle('aniversario')}
      >
        <BirthdayAutomationForm
          clinicId={clinicId}
          clinicName={clinicName}
          initial={{
            enabled: auto?.aniversario ?? true,
            hour: auto?.aniversario_hora ?? 9,
            optinRequired: auto?.aniversario_optin_required ?? true,
            template: auto?.template_aniversario || '',
          }}
        />
        <BirthdayHistory clinicId={clinicId} />
      </AccordionItem>

      {/* ── Grupo: Financeiro ─────────────────────────────────────────────── */}
      <GroupLabel label="Financeiro" />

      <AccordionItem
        id="despesas"
        emoji="💸"
        gradient="bg-gradient-to-br from-orange-500 to-red-500"
        title="Alerta de despesas"
        description="Avisa via WhatsApp quando há boletos ou despesas vencendo em breve"
        isActive={!!auto?.alerta_despesas}
        isOpen={openId === 'despesas'}
        onToggle={() => toggle('despesas')}
      >
        <AlertaDespesasForm
          clinicId={clinicId}
          initial={{
            enabled: auto?.alerta_despesas ?? false,
            diasAntes: auto?.alerta_despesas_dias_antes ?? 1,
            temTelefones: Array.isArray(auto?.relatorio_telefones)
              ? auto.relatorio_telefones.length > 0
              : !!auto?.relatorio_telefones,
          }}
        />
      </AccordionItem>

      {/* Padding final */}
      <div className="h-4" />
    </div>
  )
}
