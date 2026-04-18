# Donna - Setup do Workflow N8N

## 📥 Importar o Workflow

1. Abra o N8N
2. Vá em **Workflows** → **Import from File**
3. Selecione o arquivo `n8n-donna-workflow.json`

---

## 🔧 Configurações Necessárias

### 1. Substituir Variáveis

Em **TODOS** os nós de código, substitua:

| Placeholder | Seu Valor |
|-------------|-----------|
| `SUA_SUPABASE_URL` | `https://yqrjbyaucimvmzpfipgs.supabase.co` |
| `SUA_SUPABASE_KEY` | Sua Service Role Key do Supabase |
| `SEU_CLINIC_ID` | ID da sua clínica (UUID) |
| `ID_DRA_SARAH` | ID da Dra. Sarah na tabela users |
| `ID_DRA_AMANDA` | ID da Dra. Amanda na tabela users |

### Como encontrar os IDs:

```sql
-- No Supabase SQL Editor:
SELECT id, name FROM clinics;
SELECT id, name, role FROM users WHERE role IN ('doctor', 'esthetician');
```

---

### 2. Configurar Credenciais

#### OpenAI
1. Vá em **Credentials** → **Add Credential**
2. Selecione **OpenAI API**
3. Cole sua API Key
4. Salve e vincule ao nó "Message a model"

#### Evolution API
1. Vá em **Credentials** → **Add Credential**
2. Selecione **Header Auth**
3. Nome do Header: `apikey`
4. Valor: Sua API Key da Evolution
5. Salve

#### Variáveis de Ambiente (opcional)
Em **Settings** → **Variables**, adicione:
- `EVOLUTION_API_URL`: URL da sua Evolution API
- `EVOLUTION_INSTANCE`: Nome da instância

---

### 3. Configurar Webhook na Evolution API

1. Acesse sua Evolution API
2. Vá em **Webhooks** da instância
3. Configure:
   - **URL**: `https://seu-n8n.com/webhook/donna-webhook`
   - **Events**: `MESSAGES_UPSERT`

---

## 📋 Estrutura do Workflow

```
Webhook → Extrair Mensagem → Carregar Histórico → Preparar Prompt
                                                         ↓
                                               Message a model ← [Tools]
                                                         ↓
                                               Limpar Resposta
                                                         ↓
                                               Salvar Conversa
                                                         ↓
                                               Enviar WhatsApp
                                                         ↓
                                               Responder Webhook
```

---

## 🛠️ Ferramentas Disponíveis

| Ferramenta | Função |
|------------|--------|
| `consultar_agenda` | Consulta horários disponíveis |
| `criar_agendamento` | Cria agendamento no sistema |
| `criar_lead` | Cria/atualiza lead no CRM |
| `cadastrar_paciente` | Cadastra paciente |

---

## 🧪 Testando

1. Ative o workflow
2. Envie uma mensagem para o WhatsApp conectado
3. Verifique a execução no N8N
4. Confira se a resposta foi enviada

---

## 🐛 Troubleshooting

### Erro "SUPABASE_URL not defined"
- Verifique se substituiu todas as variáveis nos nós de código

### Mensagem não chega
- Verifique o webhook na Evolution API
- Confira se o workflow está ativo

### Ferramentas não funcionam
- Verifique se os IDs dos profissionais estão corretos
- Confira a Service Role Key do Supabase

### Histórico não carrega
- Verifique se a tabela `eva_conversations` existe
- Execute a query de criação se necessário

---

## 📊 Tabela eva_conversations (se não existir)

```sql
CREATE TABLE IF NOT EXISTS eva_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID REFERENCES clinics(id),
  phone VARCHAR(20) NOT NULL,
  customer_name VARCHAR(255),
  lead_id UUID REFERENCES leads(id),
  patient_id UUID REFERENCES patients(id),
  messages JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_eva_conv_phone ON eva_conversations(phone);
CREATE INDEX idx_eva_conv_clinic ON eva_conversations(clinic_id);

ALTER TABLE eva_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic can manage own conversations" ON eva_conversations
  FOR ALL USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));
```

---

## 🚀 Follow-up (Futuro)

Para implementar follow-up automático, crie um workflow separado com:
1. **Schedule Trigger** (ex: todo dia às 9h)
2. Buscar leads sem interação há X dias
3. Enviar mensagem personalizada
4. Atualizar status do lead

---

## ✅ Checklist

- [ ] Importei o workflow
- [ ] Substituí SUPABASE_URL em todos os nós
- [ ] Substituí SUPABASE_KEY em todos os nós
- [ ] Substituí CLINIC_ID em todos os nós
- [ ] Substituí IDs dos profissionais
- [ ] Configurei credencial OpenAI
- [ ] Configurei credencial Evolution API
- [ ] Configurei webhook na Evolution
- [ ] Testei enviando mensagem
- [ ] Verifiquei resposta no WhatsApp
