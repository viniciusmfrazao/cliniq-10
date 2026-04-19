# 🤖 EVA — WORKFLOWS N8N

Documentação técnica dos fluxos de automação da Eva.

---

## 📋 ÍNDICE

1. [Arquitetura Geral](#arquitetura-geral)
2. [Credenciais Necessárias](#credenciais-necessárias)
3. [Workflow 1: Atendimento WhatsApp](#workflow-1-atendimento-whatsapp)
4. [Workflow 2: Confirmação de Agendamento](#workflow-2-confirmação-de-agendamento)
5. [Workflow 3: Pós-Procedimento](#workflow-3-pós-procedimento)
6. [Workflow 4: Aniversariantes](#workflow-4-aniversariantes)
7. [Workflow 5: Follow-up Leads Frios](#workflow-5-follow-up-leads-frios)
8. [Workflow 6: Lembrete 2h Antes](#workflow-6-lembrete-2h-antes)
9. [Prompts da Eva](#prompts-da-eva)
10. [Funções Auxiliares](#funções-auxiliares)

---

## 🏗️ ARQUITETURA GERAL

```
┌─────────────────────────────────────────────────────────────────┐
│                         ENTRADA                                  │
├─────────────────────────────────────────────────────────────────┤
│  WhatsApp (Z-API)  │  Cron (horário)  │  Webhook (Clinike)       │
└─────────┬──────────┴────────┬─────────┴───────────┬─────────────┘
          │                   │                     │
          ▼                   ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                          N8N                                     │
├─────────────────────────────────────────────────────────────────┤
│  • Recebe evento                                                 │
│  • Busca contexto (Supabase)                                    │
│  • Processa com IA (OpenAI)                                     │
│  • Executa ações (Supabase)                                     │
│  • Responde (WhatsApp)                                          │
└─────────┬──────────┬────────┬─────────┬───────────┬─────────────┘
          │          │        │         │           │
          ▼          ▼        ▼         ▼           ▼
┌─────────────────────────────────────────────────────────────────┐
│                         SAÍDA                                    │
├─────────────────────────────────────────────────────────────────┤
│  WhatsApp  │  Supabase (criar/atualizar)  │  Logs/Alertas       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔐 CREDENCIAIS NECESSÁRIAS

### No N8N, criar as seguintes credenciais:

#### 1. Supabase (HTTP Header Auth)
```
Nome: Supabase Clinike
Tipo: Header Auth
Header Name: apikey
Header Value: [SUA_SUPABASE_SERVICE_KEY]
```

#### 2. OpenAI
```
Nome: OpenAI Eva
Tipo: OpenAI API
API Key: [SUA_OPENAI_API_KEY]
```

#### 3. Z-API (HTTP Header Auth)
```
Nome: Z-API WhatsApp
Tipo: Header Auth
Header Name: Client-Token
Header Value: [SEU_ZAPI_TOKEN]
```

### Variáveis de Ambiente (N8N)
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
CLINIC_ID=6a718c1d-9a79-4e80-ad71-1c5c8a2ea190
DEFAULT_PROFESSIONAL_ID=beefd6c9-fd93-44cf-9efc-4d08076bfb93
ZAPI_INSTANCE_ID=seu_instance_id
ZAPI_TOKEN=seu_token
ZAPI_URL=https://api.z-api.io/instances/SEU_INSTANCE
CLINIC_PHONE=5534999999999
```

---

## 📱 WORKFLOW 1: ATENDIMENTO WHATSAPP

**Nome:** `Eva - Atendimento WhatsApp`
**Trigger:** Webhook (Z-API envia mensagens recebidas)
**Objetivo:** Responder mensagens com IA e gerenciar leads

### Fluxo Visual:
```
[Webhook] → [Filtrar Bot] → [Buscar Paciente] → [Buscar Histórico] 
    → [Detectar Intenção] → [Switch]
                              ├→ [Agendar] → [Buscar Horários] → [Criar Agendamento]
                              ├→ [Dúvida] → [Buscar Procedimentos] → [Responder IA]
                              ├→ [Preço] → [Buscar Preços] → [Responder IA]
                              └→ [Geral] → [Responder IA]
    → [Salvar Histórico] → [Atualizar Lead] → [Enviar WhatsApp]
```

### Node 1: Webhook
```json
{
  "type": "webhook",
  "name": "Receber WhatsApp",
  "settings": {
    "httpMethod": "POST",
    "path": "eva-whatsapp",
    "responseMode": "onReceived"
  }
}
```

**Payload esperado (Z-API):**
```json
{
  "phone": "5534999999999",
  "message": {
    "text": "Olá, quero saber sobre botox"
  },
  "fromMe": false,
  "momment": 1712847600000
}
```

### Node 2: Filtrar (IF)
```
Condição: {{ $json.fromMe }} == false
(Ignorar mensagens enviadas pelo próprio bot)
```

### Node 3: Buscar Paciente (HTTP Request)
```json
{
  "type": "httpRequest",
  "name": "Buscar Paciente",
  "settings": {
    "method": "GET",
    "url": "={{ $env.SUPABASE_URL }}/rest/v1/patients",
    "qs": {
      "phone": "eq.{{ $json.phone }}",
      "clinic_id": "eq.{{ $env.CLINIC_ID }}",
      "select": "id,name,birth_date,created_at"
    },
    "headers": {
      "apikey": "={{ $env.SUPABASE_SERVICE_KEY }}",
      "Authorization": "Bearer {{ $env.SUPABASE_SERVICE_KEY }}"
    }
  }
}
```

### Node 4: Buscar/Criar Lead (HTTP Request)
```json
{
  "type": "httpRequest",
  "name": "Buscar Lead",
  "settings": {
    "method": "GET",
    "url": "={{ $env.SUPABASE_URL }}/rest/v1/leads",
    "qs": {
      "phone": "eq.{{ $('Webhook').item.json.phone }}",
      "clinic_id": "eq.{{ $env.CLINIC_ID }}",
      "select": "*"
    }
  }
}
```

### Node 5: Buscar Histórico de Conversa (HTTP Request)
```json
{
  "type": "httpRequest",
  "name": "Buscar Histórico",
  "settings": {
    "method": "GET",
    "url": "={{ $env.SUPABASE_URL }}/rest/v1/eva_conversations",
    "qs": {
      "phone": "eq.{{ $('Webhook').item.json.phone }}",
      "clinic_id": "eq.{{ $env.CLINIC_ID }}",
      "order": "created_at.desc",
      "limit": "10"
    }
  }
}
```

### Node 6: Montar Contexto (Code)
```javascript
const webhook = $('Webhook').item.json;
const paciente = $('Buscar Paciente').item.json[0] || null;
const lead = $('Buscar Lead').item.json[0] || null;
const historico = $('Buscar Histórico').all().map(h => h.json);

// Formatar histórico para contexto
const historicoTexto = historico
  .reverse()
  .map(h => `${h.role}: ${h.content}`)
  .join('\n');

return {
  phone: webhook.phone,
  message: webhook.message.text,
  paciente: paciente,
  lead: lead,
  historico: historicoTexto,
  isNewLead: !lead,
  patientName: paciente?.name || lead?.name || 'paciente'
};
```

### Node 7: OpenAI - Resposta Eva
```json
{
  "type": "openAi",
  "name": "Eva Responde",
  "settings": {
    "model": "gpt-4o",
    "messages": [
      {
        "role": "system",
        "content": "{{ $('Prompt Eva').item.json.systemPrompt }}"
      },
      {
        "role": "user", 
        "content": "HISTÓRICO:\n{{ $json.historico }}\n\nNOVA MENSAGEM DO PACIENTE:\n{{ $json.message }}"
      }
    ],
    "temperature": 0.7,
    "maxTokens": 500
  }
}
```

### Node 8: Detectar Intenção (OpenAI)
```json
{
  "type": "openAi",
  "name": "Detectar Intenção",
  "settings": {
    "model": "gpt-4o-mini",
    "messages": [
      {
        "role": "system",
        "content": "Analise a mensagem e retorne APENAS um JSON com a intenção detectada.\n\nIntenções possíveis:\n- AGENDAR: quer marcar horário\n- HORARIOS: pergunta sobre disponibilidade\n- PRECO: pergunta valor/quanto custa\n- DUVIDA: pergunta sobre procedimento\n- LOCALIZACAO: pergunta endereço\n- CONFIRMACAO: confirma agendamento\n- CANCELAR: quer cancelar\n- RECLAMACAO: está reclamando\n- GERAL: conversa geral\n\nRetorne: {\"intencao\": \"TIPO\", \"procedimento\": \"nome ou null\", \"data_mencionada\": \"data ou null\"}"
      },
      {
        "role": "user",
        "content": "{{ $json.message }}"
      }
    ],
    "temperature": 0
  }
}
```

### Node 9: Switch (por intenção)
```
Regras:
- AGENDAR ou HORARIOS → Fluxo de Agendamento
- PRECO → Fluxo de Preços
- RECLAMACAO → Fluxo de Escalação
- Outros → Fluxo Geral
```

### Node 10: Buscar Horários Disponíveis (Code + HTTP)
```javascript
// Calcular próximos 7 dias úteis
const hoje = new Date();
const dias = [];
for (let i = 1; i <= 7; i++) {
  const d = new Date(hoje);
  d.setDate(d.getDate() + i);
  const dow = d.getDay();
  if (dow >= 1 && dow <= 5) { // Seg-Sex
    dias.push(d.toISOString().split('T')[0]);
  }
}

return { diasDisponiveis: dias };
```

**HTTP Request - Buscar agendamentos existentes:**
```json
{
  "url": "={{ $env.SUPABASE_URL }}/rest/v1/appointments",
  "qs": {
    "clinic_id": "eq.{{ $env.CLINIC_ID }}",
    "start_time": "gte.{{ $json.diasDisponiveis[0] }}",
    "status": "neq.cancelled",
    "select": "start_time,professional_id"
  }
}
```

**Code - Calcular slots livres:**
```javascript
const agendamentos = $('Buscar Agendamentos').all().map(a => a.json);
const dias = $('Dias Disponíveis').item.json.diasDisponiveis;

// Horários da clínica: 9h às 19h, intervalos de 1h
const slots = [];
const horariosBase = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

dias.forEach(dia => {
  horariosBase.forEach(hora => {
    const dt = `${dia}T${hora}:00`;
    const ocupado = agendamentos.some(a => a.start_time.startsWith(dt));
    if (!ocupado) {
      slots.push({ data: dia, hora: hora, datetime: dt });
    }
  });
});

// Retornar apenas os 6 primeiros slots disponíveis
return { slotsDisponiveis: slots.slice(0, 6) };
```

### Node 11: Criar Agendamento (HTTP Request)
```json
{
  "type": "httpRequest",
  "name": "Criar Agendamento",
  "settings": {
    "method": "POST",
    "url": "={{ $env.SUPABASE_URL }}/rest/v1/appointments",
    "headers": {
      "apikey": "={{ $env.SUPABASE_SERVICE_KEY }}",
      "Authorization": "Bearer {{ $env.SUPABASE_SERVICE_KEY }}",
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    },
    "body": {
      "clinic_id": "={{ $env.CLINIC_ID }}",
      "patient_id": "={{ $json.paciente?.id || null }}",
      "professional_id": "={{ $env.DEFAULT_PROFESSIONAL_ID }}",
      "start_time": "={{ $json.slotEscolhido.datetime }}",
      "end_time": "={{ $json.slotEscolhido.datetime_fim }}",
      "status": "scheduled",
      "notes": "Agendado via WhatsApp - Eva"
    }
  }
}
```

### Node 12: Salvar Conversa (HTTP Request)
```json
{
  "type": "httpRequest",
  "name": "Salvar Conversa",
  "settings": {
    "method": "POST",
    "url": "={{ $env.SUPABASE_URL }}/rest/v1/eva_conversations",
    "body": [
      {
        "clinic_id": "={{ $env.CLINIC_ID }}",
        "phone": "={{ $('Webhook').item.json.phone }}",
        "role": "user",
        "content": "={{ $('Webhook').item.json.message.text }}"
      },
      {
        "clinic_id": "={{ $env.CLINIC_ID }}",
        "phone": "={{ $('Webhook').item.json.phone }}",
        "role": "assistant",
        "content": "={{ $('Eva Responde').item.json.message.content }}"
      }
    ]
  }
}
```

### Node 13: Atualizar Lead (HTTP Request)
```json
{
  "type": "httpRequest",
  "name": "Atualizar Lead",
  "settings": {
    "method": "PATCH",
    "url": "={{ $env.SUPABASE_URL }}/rest/v1/leads",
    "qs": {
      "phone": "eq.{{ $('Webhook').item.json.phone }}",
      "clinic_id": "eq.{{ $env.CLINIC_ID }}"
    },
    "body": {
      "stage": "={{ $json.novaEtapa }}",
      "last_contact": "={{ new Date().toISOString() }}",
      "updated_at": "={{ new Date().toISOString() }}"
    }
  }
}
```

### Node 14: Enviar WhatsApp (HTTP Request - Z-API)
```json
{
  "type": "httpRequest",
  "name": "Enviar WhatsApp",
  "settings": {
    "method": "POST",
    "url": "={{ $env.ZAPI_URL }}/send-text",
    "headers": {
      "Client-Token": "={{ $env.ZAPI_TOKEN }}",
      "Content-Type": "application/json"
    },
    "body": {
      "phone": "={{ $('Webhook').item.json.phone }}",
      "message": "={{ $('Eva Responde').item.json.message.content }}"
    }
  }
}
```

---

## 📅 WORKFLOW 2: CONFIRMAÇÃO DE AGENDAMENTO (24H ANTES)

**Nome:** `Eva - Confirmação 24h`
**Trigger:** Cron - Todo dia às 10:00
**Objetivo:** Enviar confirmação para agendamentos do dia seguinte

### Fluxo Visual:
```
[Cron 10h] → [Buscar Agendamentos Amanhã] → [Loop] → [Montar Mensagem] → [Enviar WhatsApp]
```

### Node 1: Cron Trigger
```json
{
  "type": "cron",
  "name": "Todo dia 10h",
  "settings": {
    "cronExpression": "0 10 * * *"
  }
}
```

### Node 2: Buscar Agendamentos de Amanhã (HTTP Request)
```javascript
// Code node antes para calcular data de amanhã
const amanha = new Date();
amanha.setDate(amanha.getDate() + 1);
const dataAmanha = amanha.toISOString().split('T')[0];

return { 
  dataInicio: `${dataAmanha}T00:00:00`,
  dataFim: `${dataAmanha}T23:59:59`
};
```

```json
{
  "url": "={{ $env.SUPABASE_URL }}/rest/v1/appointments",
  "qs": {
    "clinic_id": "eq.{{ $env.CLINIC_ID }}",
    "start_time": "gte.{{ $json.dataInicio }}",
    "start_time": "lte.{{ $json.dataFim }}",
    "status": "in.(scheduled,confirmed)",
    "select": "id,start_time,patients(name,phone),procedures(name)"
  }
}
```

### Node 3: Loop (Split In Batches)
```
Processar cada agendamento individualmente
```

### Node 4: Montar Mensagem (Code)
```javascript
const apt = $json;
const hora = new Date(apt.start_time).toLocaleTimeString('pt-BR', { 
  hour: '2-digit', 
  minute: '2-digit' 
});
const data = new Date(apt.start_time).toLocaleDateString('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long'
});

const mensagem = `Oi, ${apt.patients.name}! 🤍

Passando pra confirmar sua consulta amanhã, ${data}, às ${hora}.

📍 Roosevelt de Oliveira, 305 – Centro, Uberlândia

Posso confirmar sua presença?`;

return {
  phone: apt.patients.phone,
  message: mensagem,
  appointmentId: apt.id
};
```

### Node 5: Enviar WhatsApp (HTTP Request)
```json
{
  "url": "={{ $env.ZAPI_URL }}/send-text",
  "body": {
    "phone": "={{ $json.phone }}",
    "message": "={{ $json.message }}"
  }
}
```

---

## 💆 WORKFLOW 3: PÓS-PROCEDIMENTO

**Nome:** `Eva - Pós Procedimento`
**Trigger:** Cron - Todo dia às 11:00
**Objetivo:** Enviar mensagem para quem fez procedimento ontem

### Node 1: Cron Trigger
```json
{
  "cronExpression": "0 11 * * *"
}
```

### Node 2: Buscar Atendimentos de Ontem (HTTP)
```javascript
// Code - calcular ontem
const ontem = new Date();
ontem.setDate(ontem.getDate() - 1);
const dataOntem = ontem.toISOString().split('T')[0];

return { 
  dataInicio: `${dataOntem}T00:00:00`,
  dataFim: `${dataOntem}T23:59:59`
};
```

```json
{
  "url": "={{ $env.SUPABASE_URL }}/rest/v1/appointments",
  "qs": {
    "clinic_id": "eq.{{ $env.CLINIC_ID }}",
    "start_time": "gte.{{ $json.dataInicio }}",
    "start_time": "lte.{{ $json.dataFim }}",
    "status": "eq.completed",
    "select": "id,patients(name,phone),procedures(name)"
  }
}
```

### Node 3: Montar Mensagem (Code)
```javascript
const apt = $json;
const procedimento = apt.procedures?.name || 'procedimento';

const mensagem = `Oi, ${apt.patients.name}! 🤍

Como você está se sentindo após o ${procedimento}?

Qualquer dúvida sobre os cuidados, estou por aqui!`;

return {
  phone: apt.patients.phone,
  message: mensagem
};
```

---

## 🎂 WORKFLOW 4: ANIVERSARIANTES

**Nome:** `Eva - Aniversariantes`
**Trigger:** Cron - Todo dia às 08:00
**Objetivo:** Enviar felicitação de aniversário

### Node 1: Cron Trigger
```json
{
  "cronExpression": "0 8 * * *"
}
```

### Node 2: Buscar Aniversariantes (HTTP + RPC)
```json
{
  "url": "={{ $env.SUPABASE_URL }}/rest/v1/patients",
  "qs": {
    "clinic_id": "eq.{{ $env.CLINIC_ID }}",
    "select": "name,phone,birth_date"
  }
}
```

### Node 3: Filtrar Aniversariantes (Code)
```javascript
const hoje = new Date();
const diaHoje = hoje.getDate();
const mesHoje = hoje.getMonth() + 1;

const aniversariantes = $input.all()
  .map(i => i.json)
  .filter(p => {
    if (!p.birth_date) return false;
    const bd = new Date(p.birth_date);
    return bd.getDate() === diaHoje && (bd.getMonth() + 1) === mesHoje;
  });

return aniversariantes.map(p => ({ json: p }));
```

### Node 4: Montar Mensagem (Code)
```javascript
const mensagem = `Feliz aniversário, ${$json.name}! 🎂🤍

Que seu dia seja repleto de alegria e realizações!

Com carinho,
Equipe Clínica Sarah Pina`;

return {
  phone: $json.phone,
  message: mensagem
};
```

---

## ❄️ WORKFLOW 5: FOLLOW-UP LEADS FRIOS

**Nome:** `Eva - Follow-up Leads`
**Trigger:** Cron - Todo dia às 14:00
**Objetivo:** Reativar leads sem resposta há 3+ dias

### Node 1: Cron Trigger
```json
{
  "cronExpression": "0 14 * * *"
}
```

### Node 2: Buscar Leads Frios (HTTP)
```javascript
// Code - calcular 3 dias atrás
const tresDias = new Date();
tresDias.setDate(tresDias.getDate() - 3);

return { dataLimite: tresDias.toISOString() };
```

```json
{
  "url": "={{ $env.SUPABASE_URL }}/rest/v1/leads",
  "qs": {
    "clinic_id": "eq.{{ $env.CLINIC_ID }}",
    "stage": "in.(new,contacted)",
    "last_contact": "lte.{{ $json.dataLimite }}",
    "select": "id,name,phone,notes,stage"
  }
}
```

### Node 3: Gerar Mensagem com IA (OpenAI)
```json
{
  "model": "gpt-4o",
  "messages": [
    {
      "role": "system",
      "content": "Você é Eva. Gere uma mensagem curta e acolhedora para reativar um lead que não respondeu há alguns dias. Seja gentil, não pressione. Use 🤍 no final."
    },
    {
      "role": "user",
      "content": "Nome: {{ $json.name }}\nInteresse inicial: {{ $json.notes }}"
    }
  ]
}
```

---

## ⏰ WORKFLOW 6: LEMBRETE 2H ANTES

**Nome:** `Eva - Lembrete 2h`
**Trigger:** Cron - A cada 30 minutos
**Objetivo:** Enviar lembrete 2h antes da consulta

### Node 1: Cron Trigger
```json
{
  "cronExpression": "*/30 * * * *"
}
```

### Node 2: Calcular Janela de Tempo (Code)
```javascript
const agora = new Date();
const em2h = new Date(agora.getTime() + 2 * 60 * 60 * 1000);
const em2h30 = new Date(agora.getTime() + 2.5 * 60 * 60 * 1000);

return {
  inicio: em2h.toISOString(),
  fim: em2h30.toISOString()
};
```

### Node 3: Buscar Agendamentos (HTTP)
```json
{
  "url": "={{ $env.SUPABASE_URL }}/rest/v1/appointments",
  "qs": {
    "clinic_id": "eq.{{ $env.CLINIC_ID }}",
    "start_time": "gte.{{ $json.inicio }}",
    "start_time": "lte.{{ $json.fim }}",
    "status": "in.(scheduled,confirmed)",
    "select": "id,start_time,patients(name,phone)"
  }
}
```

### Node 4: Montar Mensagem (Code)
```javascript
const hora = new Date($json.start_time).toLocaleTimeString('pt-BR', { 
  hour: '2-digit', 
  minute: '2-digit' 
});

const mensagem = `Oi, ${$json.patients.name}! 🤍

Só passando pra lembrar que te espero daqui a 2 horinhas, às ${hora}!

📍 Roosevelt de Oliveira, 305 – Centro

Até já!`;

return {
  phone: $json.patients.phone,
  message: mensagem
};
```

---

## 🧠 PROMPTS DA EVA

### System Prompt Principal

```
Você é Eva, a assistente virtual da Clínica Sarah Pina, especializada em estética.

PERSONALIDADE:
- Elegante, acolhedora e sofisticada
- Linguagem refinada e clara, nunca usa gírias
- Vendedora sutil - conduz para agendamento sem pressionar
- Sempre faz perguntas para manter a conversa
- Usa 🤍 com moderação (1x por mensagem no máximo)

INFORMAÇÕES DA CLÍNICA:
- Endereço: Roosevelt de Oliveira, 305 – Centro, Uberlândia
- Horário: Segunda a sexta, 9h às 19h
- Atendimento apenas com hora marcada

PROFISSIONAIS:
- Dra. Sarah: Especialista em harmonização facial, botox, preenchimentos, fios de PDO
- Dra. Amanda: Microvasos, limpeza de pele, enzimas, carboxiterapia, lavieen

PROCEDIMENTOS E VALORES (aproximados):
- Botox: a partir de R$ 1.200
- Preenchimento labial: a partir de R$ 1.500
- Harmonização facial: a partir de R$ 3.000
- Bioestimuladores: a partir de R$ 2.500

REGRAS:
1. Nunca seja seca ou robótica
2. Sempre termine com uma pergunta ou direcionamento
3. Valorize as Dras como especialistas
4. Conduza para agendamento de avaliação
5. Em reclamações: "Vou passar seu contato para a Dra. Sarah pessoalmente"

ESTRUTURA DE RESPOSTA:
1. Acolhe (reconhece o que a pessoa disse)
2. Explica brevemente
3. Valoriza
4. Conduz para próximo passo
5. Faz uma pergunta
```

### Prompt para Detecção de Intenção

```
Analise a mensagem do paciente e retorne APENAS um JSON com:

{
  "intencao": "TIPO",
  "procedimento": "nome ou null",
  "data_mencionada": "data ou null",
  "urgencia": "alta/media/baixa",
  "sentimento": "positivo/neutro/negativo"
}

Intenções possíveis:
- AGENDAR: quer marcar horário/consulta
- HORARIOS: pergunta disponibilidade
- PRECO: pergunta valor/quanto custa
- DUVIDA: pergunta sobre procedimento
- LOCALIZACAO: pergunta endereço/como chegar
- CONFIRMACAO: confirma que vai comparecer
- REAGENDAR: quer mudar horário
- CANCELAR: quer cancelar
- RECLAMACAO: está insatisfeito/reclamando
- GERAL: conversa geral/saudação
```

---

## 🗄️ TABELA AUXILIAR (CRIAR NO SUPABASE)

```sql
-- Histórico de conversas da Eva
CREATE TABLE eva_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  intent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_eva_conv_phone ON eva_conversations(phone);
CREATE INDEX idx_eva_conv_clinic ON eva_conversations(clinic_id);
CREATE INDEX idx_eva_conv_created ON eva_conversations(created_at DESC);

-- RLS
ALTER TABLE eva_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eva_conv_select" ON eva_conversations FOR SELECT USING (clinic_id = get_my_clinic_id());
CREATE POLICY "eva_conv_insert" ON eva_conversations FOR INSERT WITH CHECK (clinic_id = get_my_clinic_id());
```

---

## 📝 CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1: Configuração
- [ ] Criar conta Z-API e conectar WhatsApp
- [ ] Criar chave API OpenAI
- [ ] Configurar credenciais no N8N
- [ ] Criar tabela `eva_conversations` no Supabase

### Fase 2: Workflow Principal
- [ ] Implementar Workflow 1 (Atendimento WhatsApp)
- [ ] Testar fluxo básico de conversa
- [ ] Testar agendamento automático

### Fase 3: Automações
- [ ] Implementar Workflow 2 (Confirmação 24h)
- [ ] Implementar Workflow 3 (Pós-procedimento)
- [ ] Implementar Workflow 4 (Aniversariantes)
- [ ] Implementar Workflow 5 (Follow-up)
- [ ] Implementar Workflow 6 (Lembrete 2h)

### Fase 4: Refinamento
- [ ] Ajustar prompts baseado em testes reais
- [ ] Adicionar tratamento de erros
- [ ] Configurar alertas para escalação
- [ ] Monitorar e otimizar

---

## 🆘 TROUBLESHOOTING

### Mensagem não enviada
- Verificar token Z-API
- Verificar formato do telefone (55 + DDD + número)
- Verificar se WhatsApp está conectado

### IA respondendo estranho
- Revisar system prompt
- Verificar se histórico está sendo passado
- Ajustar temperature (mais baixo = mais consistente)

### Agendamento não criado
- Verificar IDs (clinic_id, professional_id)
- Verificar formato de data/hora
- Verificar RLS no Supabase

---

*Documento criado para implementação da Eva no N8N*
*Versão 1.0 - Abril 2026*
