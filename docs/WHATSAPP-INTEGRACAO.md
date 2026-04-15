# Integração WhatsApp + Eva (Evolution API)

## Visão Geral

```
[WhatsApp] → [Evolution API] → [N8N Webhook] → [Eva AI] → [Resposta] → [Evolution API] → [WhatsApp]
```

---

## PARTE 1: Requisitos

### O que você precisa:
- [ ] VPS (servidor) com no mínimo 2GB RAM
- [ ] Docker e Docker Compose instalados
- [ ] Domínio ou IP público
- [ ] Número de WhatsApp dedicado (chip novo)
- [ ] N8N já funcionando (você já tem!)

### Servidores recomendados (baratos):
| Provedor | Plano | Preço |
|----------|-------|-------|
| **Hostinger VPS** | KVM 1 | ~R$25/mês |
| **Contabo** | VPS S | ~$6/mês |
| **Hetzner** | CX11 | ~€4/mês |
| **Oracle Cloud** | Free Tier | Grátis |

---

## PARTE 2: Instalar Evolution API

### Passo 1: Conectar no servidor via SSH

```bash
ssh root@SEU_IP_DO_SERVIDOR
```

### Passo 2: Instalar Docker (se não tiver)

```bash
# Atualizar sistema
apt update && apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Instalar Docker Compose
apt install docker-compose -y

# Verificar instalação
docker --version
docker-compose --version
```

### Passo 3: Criar pasta do projeto

```bash
mkdir -p /opt/evolution-api
cd /opt/evolution-api
```

### Passo 4: Criar arquivo docker-compose.yml

```bash
nano docker-compose.yml
```

Cole este conteúdo:

```yaml
version: '3.8'

services:
  evolution-api:
    image: atendai/evolution-api:latest
    container_name: evolution-api
    restart: always
    ports:
      - "8080:8080"
    environment:
      # Configurações básicas
      - SERVER_URL=http://SEU_IP_OU_DOMINIO:8080
      - AUTHENTICATION_TYPE=apikey
      - AUTHENTICATION_API_KEY=SUA_CHAVE_SECRETA_AQUI
      - AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=true
      
      # Configurações de instância
      - CONFIG_SESSION_PHONE_CLIENT=Evolution API
      - CONFIG_SESSION_PHONE_NAME=Chrome
      
      # Webhook global (opcional)
      - WEBHOOK_GLOBAL_URL=
      - WEBHOOK_GLOBAL_ENABLED=false
      
      # QR Code
      - QRCODE_LIMIT=30
      - QRCODE_COLOR=#000000
      
      # Database (usando SQLite - mais simples)
      - DATABASE_ENABLED=true
      - DATABASE_PROVIDER=sqlite
      - DATABASE_CONNECTION_URI=file:./evolution.db
      
      # Logs
      - LOG_LEVEL=ERROR
      - LOG_COLOR=true
      
    volumes:
      - evolution_instances:/evolution/instances
      - evolution_store:/evolution/store

volumes:
  evolution_instances:
  evolution_store:
```

**IMPORTANTE:** Substitua:
- `SEU_IP_OU_DOMINIO` pelo IP do seu servidor (ex: `45.123.45.67`)
- `SUA_CHAVE_SECRETA_AQUI` por uma chave segura (ex: `Eva2026SecretKey!@#`)

### Passo 5: Iniciar Evolution API

```bash
docker-compose up -d
```

### Passo 6: Verificar se está rodando

```bash
docker logs evolution-api
```

Acesse no navegador: `http://SEU_IP:8080`

Deve aparecer: `{"status":200,"message":"Welcome to Evolution API..."}`

---

## PARTE 3: Criar Instância do WhatsApp

### Passo 1: Criar instância via API

Abra o terminal (ou Postman/Insomnia) e execute:

```bash
curl -X POST "http://SEU_IP:8080/instance/create" \
  -H "Content-Type: application/json" \
  -H "apikey: SUA_CHAVE_SECRETA_AQUI" \
  -d '{
    "instanceName": "clinica-sarah-pina",
    "qrcode": true,
    "integration": "WHATSAPP-BAILEYS"
  }'
```

### Passo 2: Conectar WhatsApp (QR Code)

Acesse no navegador:
```
http://SEU_IP:8080/instance/connect/clinica-sarah-pina
```

Ou via API:
```bash
curl -X GET "http://SEU_IP:8080/instance/connect/clinica-sarah-pina" \
  -H "apikey: SUA_CHAVE_SECRETA_AQUI"
```

**Escaneie o QR Code** com o WhatsApp do número dedicado:
1. Abra WhatsApp no celular
2. Vá em Configurações → Dispositivos conectados
3. Clique em "Conectar dispositivo"
4. Escaneie o QR Code

### Passo 3: Verificar conexão

```bash
curl -X GET "http://SEU_IP:8080/instance/connectionState/clinica-sarah-pina" \
  -H "apikey: SUA_CHAVE_SECRETA_AQUI"
```

Deve retornar: `{"state": "open"}`

---

## PARTE 4: Configurar Webhook no N8N

### Passo 1: Criar webhook no N8N

1. Abra seu workflow "Eva - Atendimento" no N8N
2. O primeiro node deve ser um **Webhook**
3. Copie a URL do webhook, ex: `https://vfrazao.app.n8n.cloud/webhook/eva-whatsapp`

### Passo 2: Configurar webhook na Evolution API

```bash
curl -X POST "http://SEU_IP:8080/webhook/set/clinica-sarah-pina" \
  -H "Content-Type: application/json" \
  -H "apikey: SUA_CHAVE_SECRETA_AQUI" \
  -d '{
    "webhook": {
      "enabled": true,
      "url": "https://vfrazao.app.n8n.cloud/webhook/eva-whatsapp",
      "webhookByEvents": false,
      "webhookBase64": false,
      "events": [
        "MESSAGES_UPSERT"
      ]
    }
  }'
```

**Substitua a URL** pela URL real do seu webhook no N8N.

---

## PARTE 5: Ajustar Workflow no N8N

### Estrutura do Workflow Atualizado

```
[Webhook] → [Filtrar Mensagem] → [Code JavaScript1] → [OpenAI] → [Tools] → [Enviar Resposta]
```

### Node 1: Webhook

- **Método**: POST
- **Path**: /eva-whatsapp
- **Response Mode**: Immediately

### Node 2: Filtrar Mensagem (IF)

Adicione um node "IF" para filtrar apenas mensagens de texto recebidas:

**Condição:**
```
{{ $json.data.messageType }} = "conversation"
```

E:
```
{{ $json.data.key.fromMe }} = false
```

### Node 3: Extrair Dados (Code)

Substitua o código do "Code in JavaScript1" para extrair dados do Evolution API:

```javascript
// Extrair dados da mensagem do Evolution API
const data = $input.item.json.data;

// Número do remetente (sem @s.whatsapp.net)
const phone = data.key.remoteJid.replace('@s.whatsapp.net', '');

// Mensagem recebida
const message = data.message?.conversation || 
                data.message?.extendedTextMessage?.text || 
                '';

// ID da mensagem (para marcar como lida)
const messageId = data.key.id;

// Nome do contato (se disponível)
const pushName = data.pushName || '';

// Preparar para buscar histórico no Supabase
const SUPABASE_URL = 'https://yqrjbyaucimvmzpfipgs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxcmpieWF1Y2ltdm16cGZpcGdzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTc3MTQ4NywiZXhwIjoyMDkxMzQ3NDg3fQ.q4VwAwLbPQTXGCdW1ZfLvmyW8TAQuJ67LgI3gCO6mzg';
const CLINIC_ID = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190';

// Buscar histórico de conversa
let messagesText = '';
try {
  const history = await this.helpers.httpRequest({
    method: 'GET',
    url: `${SUPABASE_URL}/rest/v1/eva_conversations?phone=eq.${phone}&clinic_id=eq.${CLINIC_ID}&order=created_at.desc&limit=20`,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  
  if (history && history.length > 0) {
    const msgs = history.reverse();
    messagesText = msgs.map(m => `${m.role}: ${m.content}`).join('\n');
  }
} catch (e) {}

// Adicionar mensagem atual ao histórico
messagesText += `\nuser: ${message}`;

// Salvar mensagem do usuário no Supabase
try {
  await this.helpers.httpRequest({
    method: 'POST',
    url: `${SUPABASE_URL}/rest/v1/eva_conversations`,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: {
      clinic_id: CLINIC_ID,
      phone: phone,
      role: 'user',
      content: message
    }
  });
} catch (e) {}

// Criar ou atualizar lead
try {
  const existingLead = await this.helpers.httpRequest({
    method: 'GET',
    url: `${SUPABASE_URL}/rest/v1/leads?phone=eq.${phone}&clinic_id=eq.${CLINIC_ID}`,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  
  if (!existingLead || existingLead.length === 0) {
    // Criar novo lead
    await this.helpers.httpRequest({
      method: 'POST',
      url: `${SUPABASE_URL}/rest/v1/leads`,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: {
        clinic_id: CLINIC_ID,
        phone: phone,
        name: pushName || `Lead WhatsApp`,
        source: 'whatsapp',
        status: 'new',
        first_contact_at: new Date().toISOString(),
        last_contact_at: new Date().toISOString()
      }
    });
  } else {
    // Atualizar lead existente
    await this.helpers.httpRequest({
      method: 'PATCH',
      url: `${SUPABASE_URL}/rest/v1/leads?id=eq.${existingLead[0].id}`,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: {
        status: 'contacted',
        last_contact_at: new Date().toISOString()
      }
    });
  }
} catch (e) {}

// Data atual formatada
const agora = new Date();
const diasSemana = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dataAtual = `${diasSemana[agora.getDay()]}, ${agora.getDate()} de ${meses[agora.getMonth()]} de ${agora.getFullYear()}`;

return {
  json: {
    phone,
    message,
    messagesText,
    pushName,
    messageId,
    dataAtual
  }
};
```

### Node Final: Enviar Resposta (HTTP Request)

Após o OpenAI gerar a resposta, adicione um node **HTTP Request** para enviar de volta:

**Configuração:**
- **Method**: POST
- **URL**: `http://SEU_IP:8080/message/sendText/clinica-sarah-pina`
- **Headers**:
  - `apikey`: `SUA_CHAVE_SECRETA_AQUI`
  - `Content-Type`: `application/json`
- **Body (JSON)**:

```json
{
  "number": "{{ $('Code in JavaScript1').item.json.phone }}",
  "text": "{{ $json.output[0].content[0].text }}"
}
```

---

## PARTE 6: Testar a Integração

### Checklist de Teste

1. [ ] Evolution API rodando (`http://SEU_IP:8080`)
2. [ ] WhatsApp conectado (escaneou QR Code)
3. [ ] Webhook configurado na Evolution API
4. [ ] Workflow do N8N ativo
5. [ ] Enviar mensagem teste para o número do WhatsApp

### Teste Manual

1. Pegue outro celular
2. Envie "Oi" para o número conectado
3. Verifique se o N8N recebeu (aba Executions)
4. Verifique se a resposta chegou no WhatsApp

---

## PARTE 7: Configurações Extras

### 7.1 Marcar mensagem como lida

Adicione após processar (opcional):

```bash
curl -X PUT "http://SEU_IP:8080/chat/markMessageAsRead/clinica-sarah-pina" \
  -H "Content-Type: application/json" \
  -H "apikey: SUA_CHAVE_SECRETA_AQUI" \
  -d '{
    "readMessages": [
      {
        "remoteJid": "5534999999999@s.whatsapp.net",
        "id": "MESSAGE_ID_AQUI"
      }
    ]
  }'
```

### 7.2 Enviar mensagem com delay (parecer mais humano)

No N8N, adicione um node "Wait" de 2-5 segundos antes de responder.

### 7.3 Horário de atendimento

Adicione um node "IF" para verificar horário:

```javascript
const hora = new Date().getHours();
const diaAtual = new Date().getDay(); // 0 = domingo

// Segunda a Sexta, 8h às 20h
const dentroHorario = diaAtual >= 1 && diaAtual <= 5 && hora >= 8 && hora < 20;

return dentroHorario;
```

Se fora do horário, envie mensagem automática:
> "Olá! No momento estamos fora do horário de atendimento (8h às 20h, segunda a sexta). Mas pode deixar sua mensagem que responderemos assim que possível! 🤍"

### 7.4 SSL/HTTPS (Produção)

Para produção, configure HTTPS com Nginx + Let's Encrypt:

```bash
apt install nginx certbot python3-certbot-nginx -y

# Configurar Nginx como proxy reverso
nano /etc/nginx/sites-available/evolution
```

```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/evolution /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
certbot --nginx -d seu-dominio.com
```

---

## Resumo dos Endpoints Úteis

| Ação | Método | Endpoint |
|------|--------|----------|
| Criar instância | POST | `/instance/create` |
| Conectar (QR) | GET | `/instance/connect/{instance}` |
| Status conexão | GET | `/instance/connectionState/{instance}` |
| Configurar webhook | POST | `/webhook/set/{instance}` |
| Enviar texto | POST | `/message/sendText/{instance}` |
| Enviar imagem | POST | `/message/sendMedia/{instance}` |
| Marcar como lida | PUT | `/chat/markMessageAsRead/{instance}` |

---

## Problemas Comuns

### QR Code expira rápido
- Aumente `QRCODE_LIMIT` no docker-compose

### WhatsApp desconecta
- Mantenha o celular com internet estável
- Não use WhatsApp Web em outro lugar ao mesmo tempo

### Mensagens não chegam no N8N
- Verifique se o webhook está correto
- Teste a URL do webhook manualmente
- Verifique logs: `docker logs evolution-api`

### Erro 401 Unauthorized
- Verifique se a apikey está correta em todas as requisições

---

## Próximos Passos

Após tudo funcionando:
1. [ ] Configurar backup automático
2. [ ] Monitoramento de uptime
3. [ ] Mensagens de follow-up automático
4. [ ] Relatórios de atendimento

---

*Documentação criada para Clínica Sarah Pina - Abril 2026*
