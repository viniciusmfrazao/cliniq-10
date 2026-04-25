# Clinike — Roadmap de Usabilidade

Lista de melhorias priorizadas, atualizada continuamente conforme cada item é entregue.

> **Status**
> - [x] Concluído
> - [ ] Pendente
> - [~] Em andamento

---

## ✅ Concluído

- [x] **Fuso horário (Timezone BR)** — `now()` e queries do dashboard sempre em America/Sao_Paulo, fim do bug "vira o dia às 21h". (`src/lib/datetime.ts` + `supabase-timezone.sql`)
- [x] **Busca global ⌘K / Ctrl+K** — paleta de comandos com pacientes, páginas e ações rápidas (`src/components/ui/CommandPalette.tsx`).
- [x] **Toasts + Undo** — sistema de notificações com botão "Desfazer" 5s. Aplicado em deletar entrada/saída e mudar status de agendamento (`src/components/ui/Toast.tsx`).

---

## 🔥 Próximos (alta prioridade)

### Inteligência / Automação
- [ ] **Confirmação ativa via Eva (24h antes)** — cron + N8N + WhatsApp ativo: "Confirma sua consulta amanhã 14h?". Reduz no-show drasticamente.
- [ ] **Recall automático** — paciente que fez procedimento e não volta há X meses → Eva manda mensagem de retorno.
- [ ] **Aniversariantes do dia** — card no dashboard com botão "Mandar parabéns via WhatsApp" em 1 clique.

### Mobile / Atendimento
- [ ] **Ditado por voz na evolução** — Web Speech API. Profissional fala, vira texto na evolução (mãos ocupadas com paciente).
- [ ] **Fotos antes/depois** — upload na evolução + comparador slider lado-a-lado. Crítico pra estética.
- [ ] **Modo "TV" recepção** — tela pra TV/tablet na sala de espera mostrando fila em tempo real (Realtime já está ligado).

---

## 📈 Médio prazo (impacto MÉDIO–ALTO)

### Operação
- [ ] **Comissão automática por profissional** — fechamento mensal: "Dra. Ana fez R$ X em abril → comissão Y%".
- [ ] **Relatório semanal no WhatsApp da dona** — sexta 18h: resumo automático (atendimentos, receita, no-shows, leads).
- [ ] **Permissões finas** — auditoria das roles: recepção sem DRE, profissional só vê seus pacientes, etc.

### UX que parece detalhe mas conta
- [ ] **Skeleton loaders** — agenda, financeiro e listas pesadas com shimmer em vez de tela em branco.
- [ ] **Empty states com CTA** — listas vazias com ilustração + "Criar primeiro X" em vez de tela em branco.
- [ ] **Atalhos de teclado** — `N` novo agendamento, `G+A` ir pra agenda, `Esc` fechar modal.
- [ ] **Modo escuro** — confortável em sala com luz baixa (já tem variáveis CSS prontas).

### Compliance / Diferencial
- [ ] **LGPD — exportação de dados do paciente** — botão "Exportar (PDF + JSON)" na ficha. Lei obriga e quase ninguém faz.
- [ ] **Backup completo da clínica** — botão de exportar Excel/CSV de pacientes, financeiro, agenda.

---

## 🧪 Backlog (ideias pra avaliar)

- [ ] **Pesquisa NPS pós-atendimento** — Eva manda 24h depois "Como foi sua experiência? 1-10".
- [ ] **Compartilhar agendamento via WhatsApp** — botão "enviar para o paciente" na agenda em 1 clique.
- [ ] **Indicador de carga horária por profissional** — heatmap semanal de ocupação.
- [ ] **Reagendamento sugerido** — quando cliente cancela, Eva sugere os próximos 3 horários disponíveis automaticamente.
- [ ] **Multi-clínica** — uma conta única com várias unidades (já tem `clinic_id` em tudo).
- [ ] **PWA push notifications** — aproveitar que já é PWA pra receber alertas mesmo com app fechado.
- [ ] **Histórico timeline do paciente** — uma tela só com agendamentos + evoluções + financeiro + fotos em ordem cronológica.

---

## Convenções

- **Mobile-first**: toda nova feature deve funcionar bem no celular antes do desktop.
- **Sem libs novas sem motivo**: se der pra fazer com o que já tem (Tailwind + Supabase + componentes internos), preferir.
- **Realtime quando faz sentido**: agenda, recepção, fila de pacientes, notificações. Não em listas de relatório.
- **LGPD por padrão**: nenhuma melhoria pode quebrar logs de auditoria nem expor dados de outra clínica.
