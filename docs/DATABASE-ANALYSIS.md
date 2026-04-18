# Análise do Banco de Dados

**Data:** Abril 2026  
**Projeto:** CliniQ

## Resumo

O banco possui **37 tabelas**, das quais **31 estão em uso** e **6 não estão implementadas** no frontend.

---

## Tabelas em Uso ✅

| Tabela | Módulo | Descrição |
|--------|--------|-----------|
| `admin_plans` | Super Admin | Planos de assinatura gerenciados pelo admin |
| `anamneses` | Documentos | Anamneses enviadas para pacientes |
| `appointment_products` | Atendimento | Produtos usados em atendimentos |
| `appointments` | Agenda | Agendamentos |
| `audit_logs` | Sistema | Logs de auditoria |
| `clinic_integrations` | Config | Integrações (Evolution API, etc) |
| `clinics` | Core | Dados das clínicas |
| `crm_message_templates` | CRM | Templates de mensagens |
| `crm_settings` | CRM | Configurações do CRM |
| `debitos` | Financeiro | Débitos de pacientes |
| `document_templates` | Documentos | Templates de documentos |
| `documents_sent` | Documentos | Documentos enviados |
| `entradas` | Financeiro | Receitas/Entradas |
| `eva_conversations` | Eva IA | Conversas do WhatsApp |
| `evolutions` | Prontuário | Evoluções/Atendimentos |
| `injectable_applications` | Injetáveis | Aplicações de injetáveis |
| `injectable_points` | Injetáveis | Pontos de aplicação |
| `leads` | CRM | Leads do funil |
| `medical_records` | Prontuário | Dados médicos do paciente |
| `metas_financeiras` | Financeiro | Metas mensais |
| `notifications` | Sistema | Notificações |
| `patients` | Core | Pacientes |
| `procedures` | Core | Procedimentos |
| `products` | Estoque | Produtos |
| `roles_permissions` | Config | Permissões por role |
| `rooms` | Agenda | Salas de atendimento |
| `saidas` | Financeiro | Despesas/Saídas |
| `stock_movements` | Estoque | Movimentações de estoque |
| `super_admins` | Super Admin | Administradores do sistema |
| `users` | Core | Usuários |
| `waiting_list` | Lista Espera | Lista de espera |

---

## Tabelas NÃO Utilizadas ⚠️

> **IMPORTANTE:** Não deletar estas tabelas! Elas podem ser implementadas no futuro.

### 1. `anamnesis_templates`
**Propósito:** Templates personalizados de anamnese por clínica  
**Status:** Estrutura existe, UI não implementada  
**Prioridade:** Média - Útil para clínicas que querem perguntas personalizadas

```sql
CREATE TABLE anamnesis_templates (
  id uuid PRIMARY KEY,
  clinic_id uuid REFERENCES clinics(id),
  name text NOT NULL,
  description text,
  questions jsonb NOT NULL DEFAULT '[]',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```

### 2. `anamnesis_responses`
**Propósito:** Respostas de anamnese usando templates  
**Status:** Depende de `anamnesis_templates`  
**Prioridade:** Média

```sql
CREATE TABLE anamnesis_responses (
  id uuid PRIMARY KEY,
  clinic_id uuid REFERENCES clinics(id),
  patient_id uuid REFERENCES patients(id),
  template_id uuid REFERENCES anamnesis_templates(id),
  responses jsonb NOT NULL DEFAULT '{}',
  filled_at timestamptz DEFAULT now()
);
```

### 3. `chat_messages`
**Propósito:** Chat interno entre usuários da clínica  
**Status:** Não implementado  
**Prioridade:** Baixa - Pode usar WhatsApp/outros

```sql
CREATE TABLE chat_messages (
  id uuid PRIMARY KEY,
  clinic_id uuid,
  sender_id uuid REFERENCES users(id),
  receiver_id uuid REFERENCES users(id),
  message text NOT NULL,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

### 4. `lead_interactions`
**Propósito:** Histórico detalhado de interações com leads  
**Status:** Não implementado (usando campo `notes` em leads)  
**Prioridade:** Média - Melhoria do CRM

```sql
CREATE TABLE lead_interactions (
  id uuid PRIMARY KEY,
  lead_id uuid REFERENCES leads(id),
  clinic_id uuid REFERENCES clinics(id),
  user_id uuid REFERENCES users(id),
  type text NOT NULL, -- 'call', 'whatsapp', 'email', 'note', 'status_change'
  direction text, -- 'inbound', 'outbound'
  content text,
  whatsapp_message_id text,
  whatsapp_status text,
  old_status text,
  new_status text,
  ai_generated boolean DEFAULT false,
  ai_suggested boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

### 5. `plans` (enum-based)
**Propósito:** Planos com preços para Stripe  
**Status:** Substituído por `admin_plans`  
**Prioridade:** Baixa - Avaliar se precisa manter

```sql
CREATE TABLE plans (
  id uuid PRIMARY KEY,
  name plan_name NOT NULL UNIQUE, -- enum
  price_monthly numeric NOT NULL,
  price_yearly numeric,
  modules module_name[] NOT NULL DEFAULT '{}',
  max_professionals integer,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```

### 6. `subscriptions`
**Propósito:** Assinaturas das clínicas (integração Stripe)  
**Status:** Não implementado  
**Prioridade:** Alta para monetização

```sql
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY,
  clinic_id uuid REFERENCES clinics(id),
  plan_id uuid REFERENCES plans(id),
  status subscription_status DEFAULT 'trial',
  current_period_start timestamptz DEFAULT now(),
  current_period_end timestamptz DEFAULT now() + interval '14 days',
  stripe_subscription_id text,
  cancelled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

---

## Recomendações

### Curto Prazo
1. **Manter todas as tabelas** - Não deletar nenhuma
2. **Usar `admin_plans`** para gestão manual de planos
3. **Implementar `lead_interactions`** quando melhorar o CRM

### Médio Prazo
1. **Implementar `anamnesis_templates`** - Valor para clínicas
2. **Avaliar `subscriptions`** quando integrar Stripe

### Longo Prazo
1. **Decidir sobre `plans` vs `admin_plans`** - Unificar
2. **Chat interno** - Avaliar necessidade real

---

## Inconsistências Conhecidas

### Nomenclatura Mista PT/EN
- `entradas` / `saidas` (PT) vs `appointments` (EN)
- `paciente_id` vs `patient_id`
- `profissional_id` vs `professional_id`

**Decisão:** Manter como está para não quebrar código existente.

### Campos Redundantes em `entradas`
```sql
paciente_id uuid + paciente_nome text  -- redundante
procedimento_id uuid + procedimento_nome text  -- redundante
profissional_id uuid + profissional_nome text  -- redundante
```

**Motivo:** Snapshot para relatórios (mantém nome mesmo se editado depois)  
**Decisão:** Manter para integridade de relatórios financeiros.
