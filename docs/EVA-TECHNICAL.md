# EVA — DOCUMENTAÇÃO TÉCNICA

Lógica de integração da Eva com o sistema Clinike (Supabase) e automações N8N.

---

## FUNÇÕES DA EVA

### Atendimento WhatsApp
1. **Primeiro contato** — Acolher, entender necessidade, conduzir para agendamento
2. **Tirar dúvidas** — Procedimentos, valores, formas de pagamento
3. **Quebrar objeções** — Preço, medo, "vou pensar"
4. **Agendar consultas** — Verificar disponibilidade e confirmar horário

### Gestão de CRM
5. **Criar lead** — Quando novo contato chega no WhatsApp
6. **Mover etapas** — Novo → Em conversa → Agendado → Compareceu → Fechou
7. **Classificar perfil** — Decidida, Insegura, Preço, Fria
8. **Registrar interações** — Salvar histórico de conversas

### Confirmações
9. **Confirmar agendamento** — 24h antes
10. **Lembrete no dia** — 2h antes
11. **Reagendar** — Se não puder comparecer, oferecer nova data

### Relacionamento
12. **Aniversário** — Mensagem personalizada no dia
13. **Datas especiais** — Dia das Mães, Natal, etc
14. **Reativação** — Pacientes que não voltam há X dias

### Pós-Procedimento
15. **Dia seguinte** — Verificar como está se sentindo
16. **Cuidados** — Enviar orientações específicas
17. **Acompanhamento** — 7 dias depois: verificar satisfação
18. **Indicação de retorno** — Sugerir manutenção

### Follow-ups
19. **Lead frio** — Retomar contato após 3 dias sem resposta
20. **Orçamento enviado** — Verificar se tem dúvidas após 2 dias
21. **Não compareceu** — Entender motivo e reagendar
22. **Pós-avaliação** — Quem fez avaliação mas não fechou

### Escalação
23. **Reclamações** — Encaminhar para Sarah imediatamente
24. **Casos complexos** — Dúvidas médicas → Dra responde
25. **Negociação especial** — Descontos acima do padrão → Sarah aprova

---

## AUTOMAÇÕES N8N

| Gatilho | Ação da Eva |
|---------|-------------|
| Nova mensagem WhatsApp | Responder com IA + criar/atualizar lead |
| Lead criado | Enviar mensagem de boas-vindas |
| Agendamento criado | Confirmar horário + enviar localização |
| 24h antes da consulta | Enviar confirmação |
| 2h antes da consulta | Enviar lembrete |
| Consulta concluída | Enviar mensagem pós-procedimento |
| Aniversário do paciente | Enviar felicitação |
| Lead sem resposta 3 dias | Enviar follow-up |
| Lead sem resposta 7 dias | Segundo follow-up |
| Lead sem resposta 14 dias | Último follow-up |

---

## CREDENCIAIS NECESSÁRIAS (N8N)

| Variável | Descrição |
|----------|-----------|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_KEY` | Chave service_role (acesso total) |
| `CLINIC_ID` | ID da clínica no sistema |
| `DEFAULT_PROFESSIONAL_ID` | ID do profissional padrão para agendamentos |
| `ZAPI_URL` | URL da instância Z-API |
| `ZAPI_TOKEN` | Token de autenticação Z-API |

---

## INTEGRAÇÃO COM SUPABASE

### Consultar Disponibilidade de Agenda

**Contexto:** Paciente pergunta "Tem horário quinta-feira?"

**Query:**
```sql
SELECT start_time, end_time, u.name as profissional
FROM appointments a
JOIN users u ON a.professional_id = u.id
WHERE DATE(start_time) = '2026-04-16'
  AND status NOT IN ('cancelled')
  AND clinic_id = 'CLINIC_ID'
```

**Lógica:** Calcular slots livres considerando:
- Horário da clínica: 9h às 19h
- Intervalo padrão: 1h
- Subtrair horários já ocupados

**Resposta esperada:**
```
Quinta temos disponível às 10h, 14h e 16h.
Qual fica melhor pra você?
```

---

### Criar Agendamento

**Contexto:** Paciente escolhe "14h"

**Query:**
```sql
INSERT INTO appointments (
  clinic_id, 
  patient_id, 
  professional_id, 
  start_time, 
  end_time, 
  status, 
  notes
) VALUES (
  'CLINIC_ID', 
  'PATIENT_ID', 
  'PROFESSIONAL_ID',
  '2026-04-16 14:00:00', 
  '2026-04-16 15:00:00', 
  'scheduled', 
  'Agendado via WhatsApp - Eva'
)
```

**Resposta esperada:**
```
Perfeito! Agendei sua avaliação para quinta, dia 16, às 14h com a Dra. Sarah.

📍 Roosevelt de Oliveira, 305 – Centro, Uberlândia

Te espero lá!
```

---

### Buscar Paciente por Telefone

**Contexto:** Verificar se contato já é paciente cadastrado

**Query:**
```sql
SELECT id, name, phone, birth_date, created_at
FROM patients 
WHERE phone = '5534999999999'
  AND clinic_id = 'CLINIC_ID'
```

---

### Criar Paciente

**Contexto:** Novo contato que ainda não está no sistema

**Query:**
```sql
INSERT INTO patients (clinic_id, name, phone, source)
VALUES ('CLINIC_ID', 'Maria', '5534999999999', 'whatsapp')
RETURNING id
```

---

### Criar Lead

**Contexto:** Registrar novo lead no CRM

**Query:**
```sql
INSERT INTO leads (clinic_id, name, phone, stage, source, notes)
VALUES (
  'CLINIC_ID', 
  'Maria', 
  '5534999999999', 
  'new', 
  'whatsapp', 
  'Interesse em botox'
)
```

---

### Atualizar Etapa do Lead

**Contexto:** Lead agendou consulta

**Query:**
```sql
UPDATE leads 
SET stage = 'scheduled', 
    updated_at = now()
WHERE phone = '5534999999999'
  AND clinic_id = 'CLINIC_ID'
```

**Etapas possíveis:**
- `new` — Novo contato
- `contacted` — Em conversa
- `scheduled` — Agendado
- `attended` — Compareceu
- `closed` — Fechou
- `lost` — Perdido

---

### Buscar Aniversariantes do Dia

**Contexto:** Cron diário às 8h para enviar felicitações

**Query:**
```sql
SELECT name, phone 
FROM patients
WHERE EXTRACT(MONTH FROM birth_date) = EXTRACT(MONTH FROM CURRENT_DATE)
  AND EXTRACT(DAY FROM birth_date) = EXTRACT(DAY FROM CURRENT_DATE)
  AND clinic_id = 'CLINIC_ID'
```

---

### Consultar Procedimentos e Preços

**Contexto:** Paciente pergunta "Quanto custa o botox?"

**Query:**
```sql
SELECT name, price, duration_minutes, description
FROM procedures
WHERE name ILIKE '%botox%' 
  AND active = true
  AND clinic_id = 'CLINIC_ID'
```

---

### Buscar Agendamentos para Confirmação (24h antes)

**Contexto:** Cron diário às 10h

**Query:**
```sql
SELECT 
  a.id,
  a.start_time,
  p.name as patient_name,
  p.phone as patient_phone,
  pr.name as procedure_name
FROM appointments a
JOIN patients p ON a.patient_id = p.id
LEFT JOIN procedures pr ON a.procedure_id = pr.id
WHERE DATE(a.start_time) = CURRENT_DATE + INTERVAL '1 day'
  AND a.status IN ('scheduled', 'confirmed')
  AND a.clinic_id = 'CLINIC_ID'
```

---

### Buscar Atendimentos Concluídos Ontem (Pós-procedimento)

**Contexto:** Cron diário às 11h

**Query:**
```sql
SELECT 
  a.id,
  p.name as patient_name,
  p.phone as patient_phone,
  pr.name as procedure_name
FROM appointments a
JOIN patients p ON a.patient_id = p.id
LEFT JOIN procedures pr ON a.procedure_id = pr.id
WHERE DATE(a.start_time) = CURRENT_DATE - INTERVAL '1 day'
  AND a.status = 'completed'
  AND a.clinic_id = 'CLINIC_ID'
```

---

### Buscar Leads Frios (sem resposta 3+ dias)

**Contexto:** Cron diário às 14h para follow-up

**Query:**
```sql
SELECT id, name, phone, notes, stage
FROM leads
WHERE stage IN ('new', 'contacted')
  AND last_contact < CURRENT_TIMESTAMP - INTERVAL '3 days'
  AND clinic_id = 'CLINIC_ID'
```

---

## TABELA: HISTÓRICO DE CONVERSAS

Para manter contexto das conversas da Eva, criar esta tabela:

```sql
CREATE TABLE eva_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  intent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_eva_conv_phone ON eva_conversations(phone);
CREATE INDEX idx_eva_conv_clinic ON eva_conversations(clinic_id);
CREATE INDEX idx_eva_conv_created ON eva_conversations(created_at DESC);

ALTER TABLE eva_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eva_conv_select" ON eva_conversations 
  FOR SELECT USING (clinic_id = get_my_clinic_id());

CREATE POLICY "eva_conv_insert" ON eva_conversations 
  FOR INSERT WITH CHECK (clinic_id = get_my_clinic_id());
```

### Salvar Mensagem na Conversa

```sql
INSERT INTO eva_conversations (clinic_id, phone, role, content, intent)
VALUES (
  'CLINIC_ID',
  '5534999999999',
  'user',
  'Quero saber sobre botox',
  'DUVIDA'
)
```

### Buscar Histórico de Conversa

```sql
SELECT role, content, created_at
FROM eva_conversations
WHERE phone = '5534999999999'
  AND clinic_id = 'CLINIC_ID'
ORDER BY created_at DESC
LIMIT 10
```

---

## FLUXO COMPLETO: AGENDAMENTO VIA WHATSAPP

```
1. Recebe mensagem
   ↓
2. Busca paciente por telefone
   ├─ Existe → Usa ID existente
   └─ Não existe → Cria paciente + lead
   ↓
3. Busca histórico de conversa (últimas 10 mensagens)
   ↓
4. Detecta intenção (OpenAI)
   ├─ AGENDAR → Busca slots disponíveis
   ├─ PRECO → Busca procedimento
   ├─ RECLAMACAO → Escala para humano
   └─ GERAL → Responde com IA
   ↓
5. Gera resposta (OpenAI com system prompt)
   ↓
6. Salva conversa (user + assistant)
   ↓
7. Atualiza lead (stage, last_contact)
   ↓
8. Envia resposta (WhatsApp API)
```

---

## FLUXO: CONFIRMAÇÃO 24H

```
1. Cron 10:00
   ↓
2. Busca agendamentos de amanhã
   ↓
3. Para cada agendamento:
   ├─ Monta mensagem personalizada
   └─ Envia WhatsApp
```

---

## FLUXO: PÓS-PROCEDIMENTO

```
1. Cron 11:00
   ↓
2. Busca atendimentos de ontem (status = completed)
   ↓
3. Para cada atendimento:
   ├─ Monta mensagem com nome do procedimento
   └─ Envia WhatsApp
```

---

## FLUXO: ANIVERSARIANTES

```
1. Cron 08:00
   ↓
2. Busca pacientes com aniversário hoje
   ↓
3. Para cada paciente:
   ├─ Monta mensagem de felicitação
   └─ Envia WhatsApp
```

---

## FLUXO: FOLLOW-UP LEADS FRIOS

```
1. Cron 14:00
   ↓
2. Busca leads sem resposta há 3+ dias
   ↓
3. Para cada lead:
   ├─ Gera mensagem com IA (personalizada)
   └─ Envia WhatsApp
```
