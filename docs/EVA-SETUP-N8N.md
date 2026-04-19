# EVA — SETUP N8N PASSO A PASSO

Guia prático para configurar o workflow de atendimento WhatsApp da Eva.

---

## CHECKLIST INICIAL

- [x] Conta N8N criada
- [ ] Chave OpenAI
- [ ] Evolution API ou Z-API configurado
- [ ] Tabela `eva_conversations` no Supabase
- [ ] Credenciais configuradas no N8N

---

## FASE 1: PREPARAR AS CONTAS

### 1.1 OpenAI — Criar chave API

1. Acesse: https://platform.openai.com/api-keys
2. Clique em **"Create new secret key"**
3. Nome: `Eva N8N`
4. Copie e guarde a chave (começa com `sk-...`)

**Custo estimado:** ~$0.15 por 1 milhão de tokens de input (GPT-4o-mini é bem barato)

---

### 1.2 WhatsApp — Escolher e configurar

#### Opção A: Evolution API (recomendado, gratuito)

1. Instale via Docker ou use um serviço hospedado
2. Acesse o painel da Evolution API
3. Crie uma nova instância
4. Conecte escaneando o QR Code com WhatsApp
5. Anote:
   - **URL da instância:** `https://sua-evolution.com`
   - **API Key:** (gerada no painel)
   - **Instance name:** (nome que você deu)

#### Opção B: Z-API (pago, mais fácil)

1. Acesse: https://z-api.io
2. Crie conta e instância
3. Conecte escaneando QR Code
4. Anote:
   - **Instance ID**
   - **Token**
   - **URL:** `https://api.z-api.io/instances/SEU_INSTANCE`

---

### 1.3 Supabase — Criar tabela de conversas

Execute este SQL no Supabase (SQL Editor):

```sql
-- Tabela para histórico de conversas da Eva
CREATE TABLE IF NOT EXISTS eva_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_eva_conv_phone ON eva_conversations(phone);
CREATE INDEX IF NOT EXISTS idx_eva_conv_created ON eva_conversations(created_at DESC);

-- RLS (opcional, se quiser restringir acesso)
ALTER TABLE eva_conversations ENABLE ROW LEVEL SECURITY;

-- Política para service_role ter acesso total (N8N usa service_role)
CREATE POLICY "service_role_all" ON eva_conversations
  FOR ALL 
  USING (true)
  WITH CHECK (true);
```

Anote do Supabase:
- **URL:** `https://xxx.supabase.co`
- **Service Role Key:** (Settings > API > service_role) — começa com `eyJ...`

---

## FASE 2: CONFIGURAR CREDENCIAIS NO N8N

### 2.1 Acessar N8N

1. Abra seu N8N
2. Vá em **Settings** (engrenagem) > **Credentials**

---

### 2.2 Criar credencial OpenAI

1. Clique **Add Credential**
2. Busque: **OpenAI**
3. Preencha:
   - **Credential Name:** `OpenAI Eva`
   - **API Key:** (cole sua chave `sk-...`)
4. Salve

---

### 2.3 Criar credencial Supabase (Header Auth)

1. Clique **Add Credential**
2. Busque: **Header Auth**
3. Preencha:
   - **Credential Name:** `Supabase Service`
   - **Name:** `apikey`
   - **Value:** (cole sua service_role key)
4. Salve

---

### 2.4 Criar credencial WhatsApp

#### Se usar Evolution API:
1. Clique **Add Credential**
2. Busque: **Header Auth**
3. Preencha:
   - **Credential Name:** `Evolution API`
   - **Name:** `apikey`
   - **Value:** (sua API key da Evolution)
4. Salve

#### Se usar Z-API:
1. Clique **Add Credential**
2. Busque: **Header Auth**
3. Preencha:
   - **Credential Name:** `Z-API`
   - **Name:** `Client-Token`
   - **Value:** (seu token Z-API)
4. Salve

---

## FASE 3: CRIAR O WORKFLOW

### 3.1 Criar novo workflow

1. No N8N, clique **Add Workflow**
2. Nome: `Eva - Atendimento WhatsApp`

---

### 3.2 Node 1: Webhook (receber mensagem)

1. Clique no **+** e busque **Webhook**
2. Configure:
   - **HTTP Method:** POST
   - **Path:** `eva-whatsapp`
3. Clique em **Test URL** e copie a URL (será algo como `https://seu-n8n.com/webhook-test/eva-whatsapp`)
4. Esta URL você vai configurar no Evolution/Z-API depois

---

### 3.3 Node 2: IF (filtrar mensagens próprias)

1. Adicione um node **IF**
2. Configure:
   - **Condition:** `{{ $json.data.fromMe }}` **is not true**
   
   (Isso filtra mensagens enviadas pelo próprio bot)

**Nota:** O campo exato depende do formato do Evolution/Z-API. Ajustaremos depois.

---

### 3.4 Node 3: Code (extrair dados da mensagem)

1. Adicione um node **Code**
2. Modo: **Run Once for All Items**
3. Cole este código:

```javascript
// Ajuste conforme o formato do seu webhook (Evolution ou Z-API)
const webhook = $input.first().json;

// Evolution API format
let phone = webhook.data?.key?.remoteJid?.replace('@s.whatsapp.net', '') || '';
let message = webhook.data?.message?.conversation || 
              webhook.data?.message?.extendedTextMessage?.text || '';
let fromMe = webhook.data?.key?.fromMe || false;

// Se for Z-API, descomente abaixo:
// let phone = webhook.phone || '';
// let message = webhook.text?.message || '';
// let fromMe = webhook.fromMe || false;

// Limpar telefone (remover caracteres especiais)
phone = phone.replace(/\D/g, '');

return [{
  json: {
    phone: phone,
    message: message,
    fromMe: fromMe,
    timestamp: new Date().toISOString()
  }
}];
```

---

### 3.5 Node 4: HTTP Request (buscar histórico)

1. Adicione um node **HTTP Request**
2. Configure:
   - **Method:** GET
   - **URL:** `https://SEU_PROJETO.supabase.co/rest/v1/eva_conversations`
   - **Authentication:** Predefined Credential Type
   - **Credential Type:** Header Auth
   - **Credential:** `Supabase Service`
   - **Send Query Parameters:** ON
   - **Query Parameters:**
     - `phone` = `eq.{{ $json.phone }}`
     - `order` = `created_at.desc`
     - `limit` = `10`
   - **Add Header:**
     - `Authorization` = `Bearer SUA_SERVICE_ROLE_KEY`

---

### 3.6 Node 5: Code (montar contexto)

1. Adicione outro node **Code**
2. Cole:

```javascript
const dadosMensagem = $('Code').first().json;
const historico = $('HTTP Request').first().json || [];

// Formatar histórico para o OpenAI
const mensagensHistorico = Array.isArray(historico) 
  ? historico.reverse().map(h => ({
      role: h.role,
      content: h.content
    }))
  : [];

// Adicionar mensagem atual
mensagensHistorico.push({
  role: 'user',
  content: dadosMensagem.message
});

return [{
  json: {
    phone: dadosMensagem.phone,
    message: dadosMensagem.message,
    messages: mensagensHistorico
  }
}];
```

---

### 3.7 Node 6: OpenAI (gerar resposta)

1. Adicione um node **OpenAI**
2. Configure:
   - **Credential:** `OpenAI Eva`
   - **Resource:** Message a Model
   - **Operation:** Message a Model
   - **Model:** `gpt-4o-mini`
   - **Messages:**
     - Clique em **Add Message**
     - **Role:** System
     - **Content:** (cole o system prompt inteiro do arquivo EVA-SYSTEM-PROMPT.md)
   - **Additional Options:**
     - **Max Tokens:** 500
     - **Temperature:** 0.7

**Para as mensagens do usuário:**
Em **Messages**, clique em **Add Message** novamente:
- **Role:** Expression → `{{ $json.messages }}`

**OU** se não funcionar, use o modo simplificado:
- **Text:** `{{ $json.messages.map(m => m.role + ': ' + m.content).join('\n') }}`

---

### 3.8 Node 7: HTTP Request (salvar conversa - usuário)

1. Adicione um node **HTTP Request**
2. Configure:
   - **Method:** POST
   - **URL:** `https://SEU_PROJETO.supabase.co/rest/v1/eva_conversations`
   - **Authentication:** Header Auth → `Supabase Service`
   - **Headers:**
     - `Authorization` = `Bearer SUA_SERVICE_ROLE_KEY`
     - `Content-Type` = `application/json`
     - `Prefer` = `return=minimal`
   - **Body (JSON):**
```json
{
  "clinic_id": "6a718c1d-9a79-4e80-ad71-1c5c8a2ea190",
  "phone": "{{ $('Code').first().json.phone }}",
  "role": "user",
  "content": "{{ $('Code').first().json.message }}"
}
```

---

### 3.9 Node 8: HTTP Request (salvar conversa - assistente)

1. Duplique o node anterior
2. Mude o body para:
```json
{
  "clinic_id": "6a718c1d-9a79-4e80-ad71-1c5c8a2ea190",
  "phone": "{{ $('Code').first().json.phone }}",
  "role": "assistant",
  "content": "{{ $('OpenAI').first().json.message.content }}"
}
```

---

### 3.10 Node 9: HTTP Request (enviar WhatsApp)

1. Adicione um node **HTTP Request**
2. Configure conforme seu provedor:

#### Evolution API:
- **Method:** POST
- **URL:** `https://sua-evolution.com/message/sendText/SUA_INSTANCIA`
- **Authentication:** Header Auth → `Evolution API`
- **Body (JSON):**
```json
{
  "number": "{{ $('Code').first().json.phone }}",
  "text": "{{ $('OpenAI').first().json.message.content }}"
}
```

#### Z-API:
- **Method:** POST
- **URL:** `https://api.z-api.io/instances/SEU_INSTANCE/token/SEU_TOKEN/send-text`
- **Body (JSON):**
```json
{
  "phone": "{{ $('Code').first().json.phone }}",
  "message": "{{ $('OpenAI').first().json.message.content }}"
}
```

---

## FASE 4: CONFIGURAR WEBHOOK NO WHATSAPP

### Evolution API:

1. Acesse o painel da Evolution
2. Vá na sua instância > **Webhooks**
3. Adicione:
   - **URL:** `https://seu-n8n.com/webhook/eva-whatsapp`
   - **Events:** `MESSAGES_UPSERT`
4. Salve

### Z-API:

1. Acesse o painel Z-API
2. Vá em **Webhooks**
3. Configure:
   - **URL on Receive:** `https://seu-n8n.com/webhook/eva-whatsapp`
4. Salve

---

## FASE 5: TESTAR

### Teste 1: Webhook
1. No N8N, ative o workflow
2. Clique no node Webhook > **Test**
3. Envie uma mensagem para o WhatsApp conectado
4. Verifique se aparece no N8N

### Teste 2: Fluxo completo
1. Execute o workflow manualmente
2. Verifique cada node
3. A resposta deve chegar no WhatsApp

### Teste 3: Verificar Supabase
1. Acesse o Supabase
2. Vá em Table Editor > `eva_conversations`
3. Deve ter as mensagens salvas

---

## TROUBLESHOOTING

### Mensagem não chega no N8N
- Verifique se o webhook está ativo (não em modo test)
- Verifique a URL configurada no Evolution/Z-API
- Teste com: `curl -X POST sua-url-webhook -d '{"test": true}'`

### OpenAI dá erro
- Verifique se a chave API está correta
- Verifique se tem créditos na conta OpenAI
- Teste com um prompt menor primeiro

### Supabase dá erro 401
- Verifique se está usando a `service_role` key (não a `anon`)
- Verifique se o header `Authorization` está correto

### WhatsApp não envia
- Verifique se a instância está conectada (QR escaneado)
- Verifique formato do número (com código do país, sem +)
- Teste enviar manualmente pelo painel do Evolution/Z-API

---

## PRÓXIMOS PASSOS

Depois que o básico funcionar:

1. **Adicionar detecção de intenção** — Identificar se quer agendar, preço, etc
2. **Buscar dados do Clinike** — Pacientes, procedimentos, agenda
3. **Criar agendamentos** — Integrar com a agenda do sistema
4. **Automações** — Confirmação 24h, pós-procedimento, aniversários

---

## VARIÁVEIS PARA SUBSTITUIR

| Placeholder | Seu valor |
|-------------|-----------|
| `SEU_PROJETO.supabase.co` | URL do seu Supabase |
| `SUA_SERVICE_ROLE_KEY` | Chave service_role do Supabase |
| `6a718c1d-9a79-4e80-ad71-1c5c8a2ea190` | ID da sua clínica |
| `sua-evolution.com` | URL da sua Evolution API |
| `SUA_INSTANCIA` | Nome da instância Evolution |
| `SEU_INSTANCE` / `SEU_TOKEN` | Dados da Z-API |

---

*Guia criado para setup inicial da Eva no N8N*
