# 🔄 Fluxos Automáticos do Clinike

> Atualizado em 03/05/2026
>
> Mapa completo de **TODAS** as automações do sistema: o que dispara, quando, onde está configurado, qual template usa, onde fica o histórico.

---

## 📊 Resumo executivo

| # | Fluxo | Quem dispara | Frequência | Quem responde |
|---|---|---|---|---|
| 1 | **Aniversário** | Cron Vercel | Diário 09h BRT | Sistema (template) |
| 2 | **Lembrete D-1 (confirmação 24h)** | Cron Vercel | Diário 20h BRT | Sistema (template) |
| 3 | **Recall de inativos** | Cron Vercel | Diário 10h BRT | Sistema (template) |
| 4 | **NPS pós-atendimento** | Cron Vercel | Diário 11h BRT | Sistema (template) |
| 5 | **Eva — resposta a mensagens** | Webhook Evolution | Tempo real | Eva (Claude IA) |
| 6 | **Eva — follow-up de leads** | Cron Vercel | A cada 30 min, 8h-21h seg-sáb | Eva (Claude IA) |
| 7 | **Lead → Cliente automático** | Trigger SQL | Quando appointment vira completed | Sistema (DB) |
| 8 | **Lead → Perdido automático** | Cron Eva (estágio 5) | Após 18d sem resposta | Sistema (DB) |

> **Templates dos 4 primeiros = sistema**: você cadastra o texto uma vez, sistema preenche os placeholders e envia.
>
> **Eva (5 e 6) = IA**: Claude gera a mensagem em tempo real, baseado no contexto da conversa.

---

## 🟦 1) Aniversário

> "Parabéns, {nome}! A {clinica} te deseja..."

### Como funciona
- **Cron**: `/api/cron/birthdays` em `vercel.json` → `0 12 * * *` (UTC) = **09h BRT**
- **Lê**: view `birthday_today_pending` (pacientes com aniversário hoje, fuso BR, que ainda não receberam neste ano)
- **Filtra opt-in**: se `aniversario_optin_required=true` na clínica, só envia pra quem tem `whatsapp_opt_in=true`
- **Envia via**: Evolution API (WhatsApp da clínica)
- **Loga em**: `birthday_messages_log` (UNIQUE garante 1 envio por paciente por ano)

### Onde configurar
- UI: `/dashboard/config/automacoes` → aba **Aniversário**
- DB: `clinic_automations.aniversario` (toggle), `template_aniversario` (texto)

### Variáveis disponíveis no template
`{{nome}}` · `{{primeiro_nome}}` · `{{clinica}}` · `{{idade}}`

### Histórico
Tabela `birthday_messages_log` (status: `sent` / `error` / `skipped`).
Visualização: `/dashboard/config/automacoes` → aba Aniversário → seção "Histórico"

### Código
- Cron: `src/app/api/cron/birthdays/route.ts`
- Schema: `supabase-birthday-automation.sql`

---

## 🟦 2) Lembrete D-1 (confirmação 24h antes)

> "{nome}, lembrete: amanhã às {hora} você tem {procedimento} com {profissional}..."

### Como funciona
- **Cron**: `/api/cron/appointment-reminders` em `vercel.json` → `0 23 * * *` (UTC) = **20h BRT**
- **Pega**: appointments do **dia seguinte** (00h-23h59 BRT) com `status IN ('scheduled', 'confirmed', 'pending_confirmation')` e `confirmation_sent_at IS NULL`
- **Idempotência**: `appointments.confirmation_sent_at = now()` ANTES de enviar (se cron rodar 2x não duplica)
- **Envia via**: Evolution API
- **Reverte** o `confirmation_sent_at` se a Evolution falhar, pra tentar novamente no dia seguinte

### Onde configurar
- UI: `/dashboard/config/automacoes` → aba **Confirmação 24h**
- DB: `clinic_automations.confirma_24h` (toggle), `template_confirma_24h` (texto)

### Variáveis disponíveis no template
`{{nome}}` · `{{primeiro_nome}}` · `{{clinica}}` · `{{profissional}}` · `{{procedimento}}` · `{{data}}` · `{{hora}}` · `{{dia_semana}}`

### Histórico
Não tem tabela própria — o controle é o campo `appointments.confirmation_sent_at` (preenchido = enviado).

### Código
- Cron: `src/app/api/cron/appointment-reminders/route.ts`

---

## 🟦 3) Recall de inativos

> "{primeiro_nome}, faz {tempo} que você não vem aqui... que tal um {ultimo_procedimento}?"

### Como funciona
- **Cron**: `/api/cron/recall-inactive` em `vercel.json` → `0 13 * * *` (UTC) = **10h BRT**
- **Lê**: view `patient_last_completed` (última consulta concluída de cada paciente)
- **Filtra**: pacientes cuja última visita foi há mais de **`recall_dias` dias** (configurável; default **150**)
- **Cooldown**: ignora quem recebeu recall nos últimos **90 dias** (configurável via `?cooldown=N`)
- **Limite**: máximo **50 envios por clínica por execução** (não floodar; configurável via `?limit=N`)
- **Loga em**: `recall_messages_log`

### Onde configurar
- UI: `/dashboard/config/automacoes` → aba **Recall de inativos**
- DB: `clinic_automations.recall_inativos` (toggle), `recall_dias` (int), `template_recall` (texto)

### Variáveis disponíveis no template
`{{nome}}` · `{{primeiro_nome}}` · `{{clinica}}` · `{{ultimo_procedimento}}` · `{{tempo}}` (humanizado: "5 meses") · `{{ultima_visita}}` (DD/MM/YYYY) · `{{dias_inativo}}` (número)

### Histórico
Tabela `recall_messages_log` (status: `sent` / `error` / `skipped`)

### Código
- Cron: `src/app/api/cron/recall-inactive/route.ts`
- Schema: `supabase-recall-automation.sql`

---

## 🟦 4) NPS pós-atendimento

> "{primeiro_nome}, como foi sua experiência ontem com {profissional}? De 1 a 5..."

### Como funciona
- **Cron**: `/api/cron/nps` em `vercel.json` → `0 14 * * *` (UTC) = **11h BRT**
- **Pega**: appointments do **dia anterior** com `status='completed'` e `nps_sent_at IS NULL`
- **Idempotência**: insere registro em `nps_responses` ANTES de enviar (UNIQUE em `appointment_id`)
- **Limite**: 100 envios por clínica por execução
- **Captura da resposta**: o webhook `/api/webhooks/evolution/[instance]` detecta resposta numérica (1-5) do paciente nas últimas 48h e atualiza `nps_responses.score`

### Onde configurar
- UI: `/dashboard/config/automacoes` → aba **NPS**
- DB: `clinic_automations.nps_pos_atendimento` (toggle), `template_nps` (texto)

### Variáveis disponíveis no template
`{{nome}}` · `{{primeiro_nome}}` · `{{clinica}}` · `{{profissional}}` · `{{procedimento}}` · `{{data}}` · `{{hora}}` · `{{dia_semana}}`

### Histórico
Tabela `nps_responses` (status: `sent` / `error` / `skipped`, score: 1-5)

### Código
- Cron: `src/app/api/cron/nps/route.ts`
- Schema: `supabase-nps-automation.sql`

---

## 🟪 5) Eva — resposta a mensagens (entrada de WhatsApp)

> Eva é a IA conversacional. Diferente dos 4 acima, ela **não usa template fixo** — gera resposta com Claude 3.5 Sonnet.

### Como funciona
- **Webhook**: `/api/webhooks/evolution/[instance]` recebe POST da Evolution sempre que a clínica recebe (ou envia) uma mensagem
- **Persiste** em `eva_conversations` (com mídia se houver: imagem/áudio/vídeo)
- **Chama Edge Function**: `eva-process` no Supabase (Deno) que:
  - Carrega contexto via RPC `donna_load_context` (clínica, profissionais, procedimentos, paciente, lead, últimas 12 msgs)
  - Monta system prompt dinâmico (inclui regras + personalidade configurada em `/dashboard/config/eva`)
  - Chama Claude com tools: `consultar_agenda`, `criar_agendamento`, `registrar_interesse`, `escalar_humano`, `atualizar_nome_lead`
  - Devolve resposta + chama Evolution API pra enviar pro paciente
- **Atualiza lead**: status, prioridade IA, follow-up zerado

### Onde configurar
- UI: `/dashboard/config/eva` (página nova, criada hoje 03/05/2026)
  - Personalidade da Eva
  - Template de confirmação D-1 (regra #6 — usado quando paciente confirma agendamento)
  - 5 textos de follow-up + 5 tempos
- DB: `clinics.settings.eva` (JSONB)

### Tools disponíveis pra Eva (silenciosas pro paciente)
| Tool | Ação |
|---|---|
| `consultar_agenda` | Consulta horários reais disponíveis |
| `criar_agendamento` | Marca consulta no banco (lead vira `scheduled`) |
| `registrar_interesse` | Classifica lead hot/warm/cold no CRM |
| `escalar_humano` | Marca lead pra atendimento humano (cancelamento, reagendamento, reclamação) |
| `atualizar_nome_lead` | Atualiza nome do lead quando paciente se identifica |

### Histórico
Tabela `eva_conversations` — todas as mensagens (entrada + saída).
Visualização: `/dashboard/whatsapp` (chat completo) e `/dashboard/eva` (lista resumida).

### Código
- Webhook: `src/app/api/webhooks/evolution/[instance]/route.ts`
- Edge Function: `supabase/functions/eva-process/{index,prompt,tools,claude,utils}.ts`
- Tipo: `supabase/functions/eva-process/types.ts`
- RPC contexto: `scripts/donna-load-context-rpc.sql`

---

## 🟪 6) Eva — follow-up automático de leads

> Quando o paciente para de responder, Eva manda follow-up sozinha em 5 estágios. Diferente da regra geral da Eva, esses textos saem de templates configuráveis (com a IA fazendo pequenas adaptações).

### Como funciona
- **Cron**: `/api/cron/eva-followup` em `vercel.json` → `*/30 * * * *` = **a cada 30 minutos**
- **Janela**: só envia entre **8h-21h BRT, segunda a sábado** (domingo nada, madrugada nada)
- **Critério**: leads com `eva_next_followup_at <= now()` e que NÃO foram convertidos, perdidos ou escalados pra humano
- **Chama** a Edge Function `eva-process` com flag `isFollowup=true` → Eva monta a mensagem usando o texto de referência configurado pra aquele estágio
- **5 estágios** com tempos configuráveis em `/dashboard/config/eva`:

| Estágio | Tempo padrão | Tom |
|---|---|---|
| 1 | +2h sem resposta | Leve, curiosa |
| 2 | +24h após estágio 1 | Sutil, valida |
| 3 | +48h após estágio 2 | Respeitoso |
| 4 | +5d após estágio 3 | Emocional, autoestima |
| 5 | +10d após estágio 4 | Despedida elegante |
| Final | Sem resposta após estágio 5 (~18 dias) | Lead vira `lost` (`lost_reason='sem_resposta_18d'`) |

### Reset automático
- Se o paciente **respondeu** → contador zera, próximo follow-up agendado pra +2h
- Se Eva **escalou pra humano** (`needs_human_review=true`) → follow-up pausa
- Se o agendamento foi **criado** → follow-up cancela (`eva_next_followup_at = NULL`)

### Onde configurar
- UI: `/dashboard/config/eva` → seção "Follow-up automático (5 estágios)"
- DB: `clinics.settings.eva.followup_texts` + `followup_minutes`

### Código
- Cron: `src/app/api/cron/eva-followup/route.ts`
- Edge Function (mesma da resposta): `supabase/functions/eva-process/index.ts`

---

## 🟩 7) Lead → Cliente (automático via SQL)

> Quando o paciente comparece (consulta vira `completed`), o lead correspondente vira `converted` sozinho.

### Como funciona
- **Trigger SQL**: `appointment_completed_to_lead` em `appointments` (AFTER INSERT OR UPDATE OF status)
- **Lógica**:
  1. Pega telefone do paciente do `appointments.patient_id`
  2. Busca lead com mesmo telefone (variantes BR via função `phone_variants`)
  3. Se lead em `new`/`contacted`/`scheduled` → muda pra `converted`
  4. Preserva `converted_at` (não sobrescreve se já tiver) e adiciona nota: `"Compareceu na clinica (appointment <uuid>)"`
  5. Zera follow-up

### Onde configurar
- Não é configurável por clínica — é trigger global do banco
- DB: trigger `appointment_completed_to_lead` na tabela `appointments`

### Código
- SQL: `scripts/eva-lead-converted-trigger.sql`

---

## 🟩 8) Lead → Perdido (automático via cron Eva)

> Após 5 follow-ups sem resposta (~18 dias), o lead é marcado como `lost` automaticamente.

### Como funciona
- Conversa com o cron Eva (item 6). Quando `eva_followup_count >= 5` e ainda sem resposta, a Edge Function `eva-process` marca:
  ```
  status = 'lost'
  lost_reason = 'sem_resposta_18d'
  eva_next_followup_at = NULL
  ```
- Lead some das colunas ativas do CRM e vai pra "Perdido"

### Onde configurar
- Não é configurável diretamente — é consequência dos 5 estágios em `/dashboard/config/eva`. Se aumentar os tempos, leva mais dias pra dar `lost`.

---

## 🌐 Webhooks (entradas externas)

| Webhook | URL | Quem chama | O que faz |
|---|---|---|---|
| **Evolution** | `/api/webhooks/evolution/[instance]?token=<webhook_token>` | Evolution API | Recebe msg do WhatsApp, persiste, chama Eva |
| **n8n (legado)** | `/api/webhooks/n8n` | n8n (não usado mais) | Antigo workflow Donna v4 — substituído pela Edge Function |

---

## 🔧 Configuração necessária (uma vez por clínica)

### Variáveis de ambiente (Vercel)
- `CRON_SECRET` — protege os 5 endpoints `/api/cron/*` (sem ele os crons retornam 503)
- `SUPABASE_SERVICE_ROLE_KEY` — usada pelos crons pra escrever direto no banco
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` — UI

### Configuração no banco (rodar 1x)
| Script | Descrição |
|---|---|
| `supabase-saas-whatsapp.sql` | Tabela `clinic_whatsapp` (1 número por clínica) + `clinic_automations` (toggles + templates) |
| `supabase-birthday-automation.sql` | View `birthday_today_pending` + tabela `birthday_messages_log` |
| `supabase-recall-automation.sql` | View `patient_last_completed` + tabela `recall_messages_log` |
| `supabase-nps-automation.sql` | Tabela `nps_responses` + função de captura de score |
| `scripts/eva-lead-converted-trigger.sql` | Trigger lead converted ao completar appointment |
| `scripts/eva-leads-human-review.sql` | Campos `needs_human_review` em leads |
| `scripts/donna-load-context-rpc.sql` | RPC que monta contexto da Eva |

### Configuração no painel (`/dashboard/config`)
1. **WhatsApp** — conectar Evolution (QR Code) → status vira `connected`
2. **Automações** (`/dashboard/config/automacoes`) — ligar toggles + escrever templates dos 4 fluxos sistema
3. **Eva** (`/dashboard/config/eva`) — personalidade + templates da Eva + tempos de follow-up

---

## ⚠️ Cuidados e observações

### Idempotência
**Todos** os crons são idempotentes (rodar 2x não duplica envio):
- Aniversário: UNIQUE `(clinic_id, patient_id, year)` em `birthday_messages_log`
- Lembrete D-1: campo `appointments.confirmation_sent_at` preenchido = ignora
- NPS: UNIQUE `(appointment_id)` em `nps_responses`
- Recall: cooldown de 90 dias verificado em `recall_messages_log`
- Follow-up Eva: `eva_next_followup_at` é avançado a cada estágio

### Status do WhatsApp
Todos os crons checam `clinic_whatsapp.status = 'connected'`. Se a clínica desconectou, os crons pulam silenciosamente (não erram, só não enviam).

### Plano Vercel
A frequência `*/30 * * * *` do follow-up exige **plano Pro** do Vercel. No plano Hobby (1 cron/dia), use o script alternativo `scripts/eva-pgcron-followup.sql` (pg_cron do Supabase chama o endpoint).

### LGPD / opt-in
- Aniversário respeita `whatsapp_opt_in` se `aniversario_optin_required=true`
- Lembrete e NPS NÃO checam opt-in (são serviços, não marketing)
- Recall pega quem já é cliente (já consentiu na ficha)
- Eva responde a quem mandou primeiro (consentimento implícito)

### Não duplica nem com a Eva
A Eva (item 5) e os 4 crons sistema (1-4) podem mandar pra mesma pessoa no mesmo dia, mas:
- Eva é **reativa** (só responde se a paciente mandar mensagem)
- Cron sistema é **proativo** (manda mesmo sem msg do paciente)
- Não existe risco de Eva mandar D-1 + cron mandar D-1 (a regra #6 do prompt da Eva pede pra confirmar manualmente, mas o cron `appointment-reminders` é o que efetivamente envia)

---

## 🔮 Fluxos planejados (não implementados ainda)

Ver `MELHORIAS-INOVADORAS.md` seção "🏗️ MELHORIAS OPERACIONAIS":

- **A. Toggle Eva Auto/Manual por número de WhatsApp** — pausar Eva enquanto secretária atende
- **B. Multi-WhatsApp / Multi-CRM por secretária** — separar atendimento (paciente existente) de vendas (lead de tráfego pago)

E em `MELHORIAS-INOVADORAS.md` seção features de IA:
- Lead scoring na Eva (priorização automática)
- Análise de sentimento WhatsApp (alerta de paciente insatisfeito)
- Predição de no-show (lembrete extra pra leads de risco)

---

## 📞 Onde mexer cada coisa (atalho)

| Quero mexer em... | Vou em... |
|---|---|
| Texto do aniversário | `/dashboard/config/automacoes` → Aniversário |
| Texto do lembrete D-1 | `/dashboard/config/automacoes` → Confirmação 24h |
| Quantos dias pra recall | `/dashboard/config/automacoes` → Recall (campo `recall_dias`) |
| Texto do NPS | `/dashboard/config/automacoes` → NPS |
| Personalidade da Eva | `/dashboard/config/eva` |
| Tempo dos 5 follow-ups | `/dashboard/config/eva` |
| Conectar/desconectar WhatsApp | `/dashboard/config/whatsapp` |
| Frequência dos crons | `vercel.json` (depois `git push`) |
| Logs/histórico de envio | `/dashboard/config/automacoes` (cada aba tem histórico) |
| Conversas da Eva | `/dashboard/whatsapp` ou `/dashboard/eva` |
| Funil de leads (CRM) | `/dashboard/crm` |
