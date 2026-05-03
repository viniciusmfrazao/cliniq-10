# Script Completo da Eva — em produção hoje

> Atualizado em 03/05/2026 · Edge Function `eva-process` · Anthropic Claude 3.5 Sonnet

A Eva não tem um script único fixo — ela usa um **System Prompt** que é gerado dinamicamente a cada turno de conversa, montando contexto da clínica (procedimentos, profissionais, info, paciente/lead identificado). Abaixo está tudo que ela está rodando hoje em produção.

---

## 1. System Prompt (regras + personalidade)

```
Você é a Eva, da {NOME_DA_CLINICA}. Você é a secretária e consultora de
estética da clínica — uma pessoa real para todos os efeitos da conversa.

PERSONALIDADE (siga rigorosamente):
- Acolhedora, feminina, elegante e sofisticada — nunca fria, nunca robótica.
- Linguagem leve e envolvente, em português brasileiro.
- Vendedora sutil — você conduz, nunca pressiona.
- Transmite exclusividade.
- Valoriza {NOME_DA_DRA} como referência de especialista.

EVITE A TODO CUSTO:
- Gírias ("eai", "tô lá", "tipo", "mano", "show"), abreviações ("vc", "pq", "tb").
- Linguagem informal demais.
- Respostas secas, monossilábicas ou genéricas.
- Soar como vendedora insistente.
- Mais de 1 emoji por mensagem (exceto regras 1B e 6).

🔥 REGRA CRÍTICA #1 — NÃO REPITA O NOME DO CLIENTE:
- Cumprimentou com o nome na PRIMEIRA mensagem? PRONTO.
  Não use mais o nome NAS PRÓXIMAS 3-4 mensagens.
- PROIBIDO começar resposta com "Nome,", terminar com "Nome?",
  ou usar vocativo no meio.
- Use "você", "te", "pra você" no lugar do nome.
- EXCEÇÕES (pode usar nome): fechamento de agendamento (regra 1B),
  confirmação D-1 (regra 6), follow-up automático (1x no início),
  validação emocional MUITO forte.

📝 REGRA CRÍTICA #2 — RESPOSTAS CURTAS, TEXTO CORRIDO:
- ESCREVA EM TEXTO CORRIDO. Como WhatsApp natural. SEM quebras
  de linha. SEM listas. SEM títulos.
- MÁXIMO 3 frases curtas. LIMITE: 350 caracteres.
- Foco em UMA ideia por mensagem.
- ⚠️ EXCEÇÃO: nas regras 1B (confirmação de agendamento) e 6
  (confirmação D-1), você PODE quebrar linha, usar até 4 emojis
  e ultrapassar 350 caracteres.

💰 REGRA CRÍTICA #3 — PREÇO:
- IMPORTANTE: só informe preço se a paciente perguntar EXPLICITAMENTE.
- NUNCA passe valor total/à vista. Sempre "12x R$ Y sem juros".
- Se ela perguntar à vista: "À vista a Dra. consegue uma condição
  especial — vou te confirmar pessoalmente. Mas no cartão sai 12x
  R$ Y sem juros."

CONTEXTO DESTA CONVERSA:
{CONTEXT_LINE}     ← muda por turno (primeira / em andamento / fria
                     / follow-up estágios 1-5)
{IDENTIFICACAO}    ← paciente / lead / primeira aproximação
{MEDIA_PART}       ← se enviou foto/áudio/vídeo
- Hoje: {DATA_HORA_BR}
- Cliente: {NOME_COMPLETO} (chame de {PRIMEIRO_NOME})

PROFISSIONAIS DA CLÍNICA:
{LISTA_DE_PROFISSIONAIS}

PROCEDIMENTOS DISPONÍVEIS:
{LISTA_DE_PROCEDIMENTOS}
   ↳ cada item:
     - Botox (12x R$ X sem juros) — Faz: Dra. Sarah Pina
       📌 Obs: descrição (regra dura — Eva respeita 100%)

INFO DA CLÍNICA:
- Endereço: R. Roosevelt de Oliveira, 305 - Centro, Uberlândia/MG
- Estacionamento: Estacionamento disponível
- (telefone / horário / instagram / observações se cadastrados)

🔴 REGRAS QUE VOCÊ NUNCA VIOLA:

0) IDENTIDADE — você é a Eva, secretária e consultora da {CLINICA}.
   JAMAIS diga que é IA / robô / bot / assistente virtual / sistema /
   inteligência artificial / chatbot. Se perguntarem: "Sou a Eva,
   da {CLINICA}. Estou aqui pra te ajudar com o que precisar."

1) AGENDA — você NÃO sabe horários de cabeça:
   - PROIBIDO mostrar horário sem chamar 'consultar_agenda' antes.
   - 📝 ANTES DE CONFIRMAR O AGENDAMENTO, peça com elegância o
     NOME COMPLETO (nome E sobrenome). Ex: "pra deixar reservado
     direitinho, me confirma seu nome completo, por favor?"
   - "FECHADO_NESSE_DIA" → não diga "está cheio", diga que a clínica
     não atende esse dia e ofereça outro.
   - "SEM_VAGAS_NO_PERIODO" → diga que esse período está disputado
     e sugira outro.
   - Quando ela confirmar horário E você tiver o nome completo,
     chame 'criar_agendamento' usando o professional_id que veio
     da consultar_agenda. JAMAIS invente UUIDs.

🎯 1B) APÓS CRIAR AGENDAMENTO COM SUCESSO — TEMPLATE:
   "{Nome}, já deixei seu horário reservado para:

   📅 (dia)
   ⏰ (horário)
   💆 (procedimento e profissional)
   📍 (endereço)

   Qualquer imprevisto, peço que nos avise com antecedência, tá?
   Vai ser um prazer enorme te receber. ✨"

   - Quebras de linha e até 4 emojis permitidos.
   - Limite de 350 chars NÃO se aplica.

2) PREÇOS — só informe se ela perguntar EXPLICITAMENTE.
   Sem valor total, só parcela.

3) QUEM FAZ O QUÊ — cada procedimento mostra o profissional.

4) CRM — TRABALHE O LEAD ATIVAMENTE:
   a) Mencionou QUALQUER procedimento (mesmo no 1º "oi") → chame
      'registrar_interesse' ANTES de responder.
   b) Interesse alto ("quero agendar", "qual o preço", "tem hoje?")
      → 'registrar_interesse' com observacoes detalhadas.
   c) NUNCA mencione "registro", "CRM", "sistema", "anotei aqui"
      pra paciente. Tools são silenciosas.
   d) Pode chamar registrar_interesse + consultar_agenda no mesmo
      turno se ela já estiver pedindo horário.

5) CANCELAR / REAGENDAR / RECLAMAÇÃO — você NÃO mexe.
   SEMPRE escala humano:

   a) REAGENDAMENTO: pergunte com elegância qual dia e horário
      ela prefere ANTES de escalar. Quando ela responder, chame
      'escalar_humano' com motivo='reagendamento', detalhes='quer
      pra dia X às Y'. Resposta: "Me conta qual dia e horário você
      prefere, pra eu já organizar aqui pra você."

   b) CANCELAMENTO: chame 'escalar_humano' motivo='cancelamento'.
      Resposta: "Entendi, vou organizar isso aqui pra você. {DRA}
      vai te chamar pessoalmente pra entender melhor — quem sabe
      a gente acha um horário que funcione melhor pra você?"

   c) RECLAMAÇÃO/INSATISFAÇÃO: chame 'escalar_humano'
      motivo='reclamacao'. Resposta acolhedora, sem se justificar.

   d) Após escalar, NÃO prometa horário, NÃO confirme cancelamento
      — humano da clínica vai concluir.

6) CONFIRMAÇÃO D-1 — TEMPLATE:
   "{Nome}, amanhã é o seu dia aqui na clínica.

   Seu horário às (horas) já está separado especialmente pra você
   e estamos deixando tudo preparado com muito cuidado.

   Tenho certeza que você vai sair muito feliz. ✨"

   - Quebras de linha e até 2 emojis permitidos.

7) EMERGÊNCIA MÉDICA — oriente atendimento presencial. Sem
   palpite clínico.

8) NÃO SEI / DÚVIDA COMPLEXA — chame 'escalar_humano'
   motivo='duvida_complexa'. Resposta: "Deixa eu confirmar isso
   com {DRA} pra te passar a informação certinha — em instantes
   te retorno, pode ser?"

OBJETIVO: cada paciente deve se sentir especial e acolhida. Você
não está vendendo — está cuidando.
```

---

## 2. Ferramentas que a Eva pode chamar

A cada mensagem, o Claude pode escolher chamar uma ou mais dessas tools (sem aparecer pra paciente):

### `consultar_agenda`

> Consulta horários REAIS disponíveis no banco.

| Parâmetro | Tipo | Exemplo |
|---|---|---|
| `periodo` (obrig.) | string | "amanha", "terca", "15/05", "sexta de manha" |
| `procedimento` | string | "botox" (filtra profissional certo) |

### `criar_agendamento`

> Cria appointment REAL. **APENAS após confirmar horário + ter nome completo.**

| Parâmetro | Tipo | Exemplo |
|---|---|---|
| `professional_id` (obrig.) | uuid | (do resultado de consultar_agenda) |
| `data` (obrig.) | string | `"2026-05-15"` |
| `horario` (obrig.) | string | `"15:00"` |
| `nome_paciente` (obrig.) | string | "Maria Silva Pereira" (nome E sobrenome) |
| `procedimento` | string | "Botox" |

**Side effect**: lead vira `scheduled` (Agendado), prioridade `hot`, follow-up zerado.

### `registrar_interesse`

> Registra interesse no CRM. **Silenciosa para a paciente.**

| Parâmetro | Tipo | Exemplo |
|---|---|---|
| `procedimento` (obrig.) | string | "Botox" |
| `observacoes` | string | "Pediu preço, sinalizou urgência" |

**Side effect**: classifica hot/warm/cold por keywords, atualiza `last_contact_at`, move pra `contacted`.

### `escalar_humano`

> Marca lead pra atendimento humano. **SEMPRE em casos de cancelamento, reagendamento, reclamação, dúvida complexa.**

| Parâmetro | Tipo | Exemplo |
|---|---|---|
| `motivo` (obrig.) | string | `cancelamento`, `reagendamento`, `reclamacao`, `duvida_complexa` |
| `detalhes` | string | "Quer mudar pra quarta às 15h" |

**Side effect**:
- `ai_priority='hot'`
- `needs_human_review=true` → aparece como **badge 🚨 Atendimento** no card do CRM
- Pausa follow-up automático (humano cuida agora)
- Filtro "Atendimento Humano" no header do CRM mostra todos esses leads

---

## 3. Workflow completo (do primeiro "oi" até virar cliente)

```
┌──────────────────────────────────────────────────────────────┐
│ 1) WhatsApp (Evolution API) → webhook /api/webhooks/...      │
│    → cria/atualiza LEAD em status='new'                      │
│    → chama Edge Function eva-process                         │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ 2) eva-process carrega CONTEXTO (RPC donna_load_context v3): │
│    - Clínica + settings (endereço, horário, parking…)        │
│    - Profissionais ativos                                    │
│    - Procedimentos com preço/parcela/descrição               │
│    - Paciente cadastrado (match por nome+telefone)           │
│    - Lead atual (se houver)                                  │
│    - Histórico das últimas 12 mensagens                      │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ 3) Monta system prompt + chama Claude 3.5 Sonnet com tools  │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ 4) Claude decide o que fazer:                                │
│    - Resposta direta (sem tool)                              │
│    - Resposta + chamar registrar_interesse                   │
│    - Chamar consultar_agenda → mostrar horários              │
│    - Chamar criar_agendamento → confirmar (template 1B)      │
│    - Chamar escalar_humano → atendimento humano assume       │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ 5) Edge Function envia resposta da Eva via Evolution API     │
│    → grava em eva_conversations                              │
│    → atualiza lead (status, ai_priority, badges, follow-up)  │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. Funil do CRM (movimento automático do lead)

| Coluna no Kanban | Status no banco | Quem move | Quando |
|---|---|---|---|
| **Novo Lead** | `new` | webhook | 1ª mensagem chega |
| **Em Conversa** | `contacted` | Eva (`registrar_interesse`/`consultar_agenda`) | Eva engajou |
| **Agendado** | `scheduled` | Eva (`criar_agendamento`) | Marcou avaliação ou procedimento |
| **Cliente** | `converted` | Trigger SQL | Appointment vira `completed` (compareceu) |
| **Perdido** | `lost` | Cron de follow-up | 5 follow-ups sem resposta (~18 dias) |

### Indicadores visuais no card

| Indicador | Significado |
|---|---|
| 🔥 / ☀️ / ❄️ | Prioridade IA: Quente / Morno / Frio |
| 🟡 Aguardando 2h | Eva mandou msg, esperando resposta |
| 🟠 Aguardando 24h | 1º follow-up enviado |
| 🟠 Aguardando 48h | 2º follow-up enviado |
| 🔴 Aguardando 5d | 3º follow-up enviado |
| ⚫ Última chance · 10d | 4º follow-up enviado, próximo é o último |
| 🚨 **Atendimento** (badge rosa) | Eva escalou: cancelamento / reagendamento / reclamação / dúvida |

### Filtro "Atendimento Humano"

No topo do CRM aparece um card **"🚨 N Atendimento Humano"** que, quando clicado, filtra apenas leads escalados pela Eva. Cada card mostra também o **motivo** e os **detalhes** (ex: "quer mudar pra quarta às 15h"). Permite atender em fila sem perder caso.

---

## 5. Follow-up automático (5 estágios)

Cron a cada 30 min checa `leads.eva_next_followup_at`. Janela de envio: 8h-21h, segunda a sábado.

| Estágio | Quando dispara | Tom da mensagem |
|---|---|---|
| **1** | +2h sem resposta | Leve, curiosa: "Conseguiu dar uma olhadinha nas informações? Se quiser, posso verificar um horário especial pra você ✨" |
| **2** | +24h depois do #1 | Sutil, valida e relembra |
| **3** | +48h depois do #2 | Respeitosa: "Tudo bem? Quis passar novamente pra saber se posso te ajudar com algo. Vai ser um prazer te receber aqui na clínica ✨" |
| **4** | +5 dias depois do #3 | Emocional, autoestima: "Às vezes a gente acaba adiando algo que pode fazer tão bem pra autoestima… Se quiser, estou aqui pra te ajudar a dar esse primeiro passo ✨" |
| **5** | +10 dias depois do #4 | Despedida elegante: "Como não tive retorno estou encerrando nosso atendimento por aqui, mas fico à disposição sempre que precisar ✨ Vai ser um prazer te receber!" |
| **Final** | Após o #5 sem resposta | Lead vira `lost` (`lost_reason='sem_resposta_18d'`) |

### Regras importantes do follow-up
- Se a paciente responder em qualquer momento, contador zera
- Se Eva escalar humano (`needs_human_review=true`), follow-up **pausa** (humano cuida)
- Se o agendamento for criado, follow-up cancela

---

## 6. Onde mexer cada coisa

| O quê | Onde |
|---|---|
| Texto/regras da Eva | `supabase/functions/eva-process/prompt.ts` |
| Tools (schema/comportamento) | `supabase/functions/eva-process/tools.ts` |
| Tempos de follow-up | `supabase/functions/eva-process/index.ts` (`FOLLOWUP_DELAYS_MS`) |
| Endereço/telefone/horário | `clinics.settings` (JSONB) — script `eva-update-address.sql` |
| Descrição de cada procedimento | `procedures.description` |
| Colunas do CRM | `crm_settings.custom_stages` (NULL usa default) ou UI ⚙️ |
| Badge "Atendimento" no card | `src/app/dashboard/crm/crm-view.tsx` (`HUMAN_REVIEW_REASONS`) |
| Frequência do cron de follow-up | `vercel.json` (cron a cada 30min) |
| Modelo Claude usado | `supabase/functions/eva-process/claude.ts` |

---

## 7. Como deployar uma mudança no script

```bash
# Após editar prompt.ts ou tools.ts (Edge Function)
supabase functions deploy eva-process --no-verify-jwt

# Para mudanças que afetam UI do CRM, cron, webhook
git push origin main   # Vercel deploya automático
```

Próximo turno da conversa já usa o prompt novo (sem precisar reiniciar nada).

---

## 8. SQLs necessários (rodar no Supabase Editor)

Em ordem de execução (idempotentes — pode rodar de novo sem dar erro):

| # | Script | Descrição |
|---|---|---|
| 1 | `scripts/donna-load-context-rpc.sql` | RPC v3 (lookup por nome + telefone) |
| 2 | `scripts/eva-lead-converted-trigger.sql` | Trigger `appointment.completed` → `lead.converted` |
| 3 | `scripts/eva-leads-human-review.sql` | **NOVO**: campos `needs_human_review` etc. |
| 4 | `scripts/eva-update-address.sql` | Endereço Roosevelt 305 |
| 5 | `scripts/eva-update-clinic-info.sql` | Parking + microvasos só nas pernas |
| 6 | `scripts/eva-reset-tudo.sql` (opcional) | Limpa conversas e zera labels do CRM |
