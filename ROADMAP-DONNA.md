# 🤖 Roadmap da Donna — Auto-atendimento WhatsApp

> Criado em 28/04/2026.
> Base: Donna v4 do n8n (workflow `Donna v4 - Agenda Dinâmica + Criar Agendamento`).
> Status: conversando bem, mas faltam fluxos críticos.

---

## 1) Visão atual vs alvo

### Hoje (Donna v4)

```
Paciente → WhatsApp → Evolution → n8n
                                    ↓
                                Filtra/buffer 3s
                                    ↓
                           Histórico (eva_conversations)
                                    ↓
                              Claude Sonnet 4.5
                              ├ tool: consultar_agenda  ✅
                              └ tool: criar_agendamento ✅
                                    ↓
                                 Supabase
                                    ↓
                                Evolution → WhatsApp paciente
```

### Alvo

```
Paciente → WhatsApp → Evolution → n8n
                                    ↓
                              Donna (Claude)
                              ├ consultar_procedimentos ➕ NEW
                              ├ consultar_agenda
                              ├ criar_lead             ➕ NEW
                              ├ converter_lead_em_paciente ➕ NEW
                              ├ criar_agendamento (revisada)
                              ├ listar_consultas       ➕ NEW
                              ├ confirmar_consulta     ➕ NEW
                              ├ enviar_anamnese        ➕ NEW
                              └ escalar_para_secretaria ➕ NEW
                                    ↓
                              Cron de follow-up        ➕ NEW
                              (2h → 1d → 2d → desiste)
```

---

## 2) Decisões de produto (validadas)

| # | Decisão | Implicação |
|---|---|---|
| 1 | **Preços com parcelamento** ("12x R$ 90 sem juros"), tom humano | Tabela `procedures` precisa ter `price` e `installments_max`. Donna formata na resposta. |
| 2 | **Lead-first**: paciente novo vira `lead`, só vira `patient` quando agenda | Tabela `leads` ganha protagonismo. Quem não agendou fica em base de remarketing. |
| 3 | **Follow-up: 2h → 1d → 2d → desiste** (configurável por clínica) | Cron novo + tabela de log. |
| 4 | **Cancelar/reagendar = escalonar** | Donna NÃO faz; encaminha pra secretária num outro WhatsApp. Precisa: nº secretária + mensagem padrão. |
| 5 | **Confirmação D-1**: paciente responde "confirmo/sim/tô lá" → `appointments.status = 'confirmed'`. Cancela/remarca → escalona (mesmo fluxo do #4) | Donna detecta intenção pelo texto, atualiza ou escalona. |

---

## 3) Milestones (ordem recomendada de execução)

> Cada milestone é independente — dá pra entregar 1 por vez.

---

### M1 — Procedimentos + preços (com parcelamento)

**Por quê:** sem isso a Donna não conclui venda. Bloqueia receita.

**Mudanças:**

- **Schema (`procedures`):**
  - Garantir colunas: `price numeric`, `duration_minutes int` (provavelmente já existem)
  - Adicionar: `installments_max int default 12`
  - Adicionar: `description text` (explicação curta do procedimento, p.ex. "Toxina botulínica para rugas de expressão na testa e olhos")
  - Adicionar: `professional_id uuid` ou tabela `procedure_professionals` (M:N) — quais profissionais executam o procedimento

- **Nova tool no n8n: `consultar_procedimentos`**
  - Input: `{ profissional_id?: string, nome?: string }` (filtros opcionais)
  - Endpoint: novo `GET /api/donna/procedures` no app (mais seguro que ir direto no Supabase)
  - Output formatado: nome, descrição, profissional(is), preço (com parcelamento), duração

- **Atualizar system prompt:**
  - Trocar "Não prometa preços" por "Quando perguntar de preço, use a tool consultar_procedimentos. Apresente o valor à vista E em parcelas (ex: 'À vista R$ 1.080 ou 12x R$ 90 sem juros')."
  - Adicionar regra: "Se o procedimento tiver mais de um profissional disponível, mencione todos."

**Esforço:** 1 sessão.

**Dependência:** popular `procedures.price` e `installments_max` (pode ser tela em `/dashboard/config/procedimentos` ou direto no SQL).

---

### M2 — CRM Lead-first

**Por quê:** quem só conversa e não agenda fica perdido hoje. Você quer base de remarketing.

**Mudanças:**

- **Schema (`leads`):**
  - Confirmar colunas: `clinic_id`, `phone`, `name`, `status`, `source`, `interested_in`, `created_at`, `updated_at` (provavelmente já existem)
  - Adicionar (se não tiver): `last_message_at timestamptz`, `last_donna_message_at timestamptz` (pra alimentar follow-up do M3)
  - Status: `new` → `engaged` → `qualified` → `converted` (virou patient) | `cold` (parou de responder) | `lost` (desistiu)

- **Nova tool: `criar_lead`** (chamada quando primeira interação)
  - Cria lead com `status = 'new'`, `source = 'donna'`, `interested_in` = o que o Claude inferiu da conversa
  - Idempotente: se já existe lead com esse `phone` e `clinic_id`, só atualiza

- **Modificar tool `criar_agendamento`:**
  - Antes de criar appointment: verifica se existe `lead` com esse phone → se sim, marca `lead.status = 'converted'`, cria patient (linkando `patients.lead_id` se quiser histórico) e o appointment
  - Se não existe lead nem patient, cria patient direto (caso raro)

- **Detector de "qualified":** se Donna pediu agenda OU paciente perguntou preço → `lead.status = 'qualified'`. Se só "oi", fica `engaged`.

**Esforço:** 1 sessão (curto se schema já tem o essencial).

---

### M3 — Follow-up automático "esfriou"

**Por quê:** lead chega quente, esfria, é perdido. Você quer reengajar.

**Mudanças:**

- **Schema novo: `donna_followup_log`**
  ```sql
  create table donna_followup_log (
    id uuid primary key default gen_random_uuid(),
    clinic_id uuid not null references clinics(id),
    lead_id uuid references leads(id),
    patient_id uuid references patients(id),
    step text not null,           -- '2h' | '1d' | '2d' | 'final'
    sent_at timestamptz default now(),
    message text,
    status text default 'sent'    -- sent | failed
  );
  ```

- **Configuração nova em `clinic_automations`:**
  - `donna_followup_enabled bool default true`
  - `donna_followup_steps jsonb` — formato:
    ```json
    [
      {"after": "2h", "template": "Oi {nome}, ainda dá pra te ajudar com {topico}?"},
      {"after": "1d", "template": "{nome}, tudo bem? Posso te mandar mais infos sobre {topico}?"},
      {"after": "2d", "template": "Última passada por aqui, {nome} 😊 Se mudar de ideia me chama!"}
    ]
    ```

- **Cron novo:** `/api/cron/donna-followup`
  - Roda 1×/h (com Vercel Hobby = 24 execuções/dia, mas frequência pode ser ajustada se 1×/h for demais; alternativa: 4×/dia, 0/6/12/18h)
  - Pra cada conversa em `eva_conversations` onde:
    - Última mensagem é do `assistant` (Donna falou e paciente não respondeu)
    - `updated_at` está dentro da janela do próximo step (ex: 2h-3h pro step '2h', 1d-1.5d pro step '1d')
    - Ainda não recebeu o step esse step (consulta `donna_followup_log`)
  - Renderiza template, envia via Evolution, loga em `donna_followup_log`

- **Detector de retomada:** quando paciente responder, Donna continua normalmente. Não precisa lógica extra — o cron só dispara quando paciente está em silêncio.

**Esforço:** 1-2 sessões.

**Pendente de confirmação:**
- ❓ Você confirmou cadência 2h/1d/2d. Mensagens de cada step a Sarah valida (ela pode preferir tom mais ou menos casual).
- ❓ Frequência do cron: 1×/h ou 4×/dia? 1×/h é mais responsivo mas pode estourar Vercel se tiver muita clínica. Vou propor 1×/h em produção e você ajusta se ficar pesado.

---

### M4 — Escalonamento pra secretária

**Por quê:** cancelamento/reagendamento exige humano. Donna passa a bola.

**Mudanças:**

- **Schema (`clinic_automations`):**
  - Adicionar `secretaria_whatsapp text` (telefone da secretária)
  - Adicionar `secretaria_nome text` (pra Donna mencionar: "vou avisar a Dra. Sarah/secretária X")

- **Nova tool: `escalar_para_secretaria`**
  - Input: `{ motivo: 'cancelar' | 'reagendar' | 'outro', detalhes: string }`
  - Ação: dispara mensagem pra `secretaria_whatsapp` via Evolution:
    ```
    🔔 Donna escalou
    Paciente: Maria Silva (+55 79 99999-9999)
    Motivo: cancelar
    Detalhes: Cliente pediu pra cancelar a consulta de 30/04 às 14h.
    Histórico: <últimas 5 mensagens>
    ```
  - Donna responde pra paciente: "Já avisei a Sarah, ela vai te chamar logo logo!"

- **Detector de intenção** (no system prompt do Claude):
  - Palavras-chave: "cancelar", "remarcar", "desmarcar", "transferir", "preciso desmarcar"
  - Claude usa a tool quando detecta

**Esforço:** 1 sessão.

---

### M5 — Confirmação do D-1 via Donna

**Por quê:** hoje o cron manda lembrete D-1 mas resposta do paciente não vira ação no banco.

**Mudanças:**

- **Detector de confirmação no Claude (system prompt):**
  - Reconhecer: "confirmo", "sim", "tô lá", "estarei", "ok confirmado", "vou sim"
  - Confirmar contra appointment próximo do paciente (próximas 36h)

- **Nova tool: `confirmar_consulta`**
  - Input: `{ appointment_id: string }` (Claude pega da tool listar_consultas implícita ou consulta a próxima)
  - Ação: atualiza `appointments.status = 'confirmed'` + `confirmation_received_at = now()`
  - Resposta da Donna: "Perfeito {nome}! Te esperamos {data} às {hora} ✨"

- **Detector de cancelamento/remarcação:** mesmo gatilho do M4, escalona.

**Esforço:** 1 sessão.

---

### M6 — Listar consultas do paciente

**Por quê:** "Quando é minha próxima consulta?" é pergunta comum.

**Mudanças:**

- Nova tool `listar_consultas_paciente`
- Input: nada (usa o phone da conversa pra achar patient)
- Output: próximas consultas (data, hora, profissional, procedimento)

**Esforço:** 30min.

---

### M7 — Disparar anamnese ao agendar

**Por quê:** já temos `/api/anamnese/send`. Só plugar.

**Mudanças:**

- Após `criar_agendamento` retornar sucesso, Donna chama implicitamente `/api/anamnese/send` (com `x-cliniq-secret`)
- Mensagem extra na confirmação: "Vou te mandar o link da ficha de anamnese pra você preencher antes da consulta. Leva 3 minutos!"

**Esforço:** 30min — mas precisa migrar a Donna pra usar `/api/webhooks/n8n` ou pelo menos chamar `/api/anamnese/send` com auth (M9).

---

### M8 — Multi-tenant (parametrizar clinic_id)

**Por quê:** hoje hardcoded `clinic_id = 6a718c1d...` (Sarah Pina). Quando outra clínica entrar, vai precisar.

**Mudanças:**

- Mapear `evolution_instance_name → clinic_id` (já existe via `clinic_whatsapp.instance_name`)
- N8n usa o instance da mensagem entrante pra resolver clinic_id
- System prompt monta dinamicamente com nome da clínica, profissionais (busca em `users where clinic_id = X and role like '%profissional%'`)

**Esforço:** 1 sessão.

**Quando fazer:** só quando 2ª clínica entrar. Não urgente.

---

### M9 — Migrar pra `/api/webhooks/n8n` (segurança)

**Por quê:** hoje a `SUPABASE_SERVICE_KEY` está nos HTTP Request nodes do n8n. Se o JSON do workflow vazar (export, screenshot, repo público), é game over.

**Mudanças:**

- Cada operação que hoje vai direto pro Supabase passa a usar endpoints do app:
  - `consultar_agenda` → `GET /api/donna/agenda?date=...`
  - `criar_agendamento` → `POST /api/donna/appointments`
  - `criar_lead` → `POST /api/donna/leads`
  - etc.
- Auth: header `x-cliniq-secret` (já configurado nesta sessão).
- Vantagem extra: lógica de negócio centralizada no app (audit logs, validação, RLS-friendly).

**Esforço:** 2-3 sessões (criar 6-8 endpoints + atualizar workflow).

**Quando fazer:** depois dos M1-M5 estarem estáveis.

---

## 4) Esforço total estimado

| Milestone | Esforço |
|---|---|
| M1 — Procedimentos + preços | 1 sessão |
| M2 — Lead-first | 1 sessão |
| M3 — Follow-up esfriou | 1-2 sessões |
| M4 — Escalonamento secretária | 1 sessão |
| M5 — Confirmação D-1 | 1 sessão |
| M6 — Listar consultas | 0.5 sessão |
| M7 — Anamnese ao agendar | 0.5 sessão |
| M8 — Multi-tenant | 1 sessão (não urgente) |
| M9 — Migrar pra `/api/webhooks/n8n` | 2-3 sessões (segurança) |

**Total essencial (M1-M5):** ~5-6 sessões.
**Total completo:** ~9-11 sessões.

---

## 5) Ordem recomendada de execução

```
Sprint 1 (esta semana ou próxima)
├ M1 (preços) — destrava receita
└ M2 (lead-first) — destrava CRM

Sprint 2
├ M5 (confirmação D-1) — alta utilidade, baixo esforço
├ M4 (escalonamento) — necessário pra cancelar/reagendar
└ M6 (listar consultas) — bônus rápido

Sprint 3
├ M3 (follow-up esfriou) — retenção
└ M7 (anamnese ao agendar) — quick-win

Sprint 4 (segurança)
└ M9 (migrar pra /api/webhooks/n8n)

Sprint futuro (quando 2ª clínica entrar)
└ M8 (multi-tenant)
```

---

## 6) Decisões pendentes (pra você confirmar antes de cada milestone)

- [ ] **M3:** mensagens dos 3 steps do follow-up — Sarah valida o tom?
- [ ] **M3:** frequência do cron — 1×/h ou 4×/dia? (recomendo 1×/h, mas valida)
- [ ] **M4:** o número da secretária é o mesmo da Sarah? Ou ela tem outro WhatsApp/atendente?
- [ ] **M1:** já tem preços e parcelamento de cada procedimento numa lista? Ou vou puxar do banco e a Sarah te passa pra popular?

---

## 7) Notas técnicas

- Donna hoje **não usa** `/api/webhooks/n8n` — tudo vai direto pro Supabase. A credential que configuramos hoje fica **preventiva** até o M7/M9.
- Templates de mensagens devem morar em `clinic_automations` (já tem várias colunas `template_*`) pra cada clínica customizar.
- Toda nova tool no n8n precisa de teste isolado (n8n permite "Execute Node" em qualquer node) antes de subir o workflow inteiro.
