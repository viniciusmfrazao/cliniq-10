# Segurança e Limpeza após Stress Test

## ⚠️ Antes de testar contra produção

| Risco | Mitigação |
|---|---|
| **Custo Claude API** (Eva responde cada msg → R$ 0,02-0,05 cada) | Use instância de teste com Eva desligada **OU** modo manual |
| **Polui CRM** com leads "stress test" | Use telefones não-existentes, e marque `is_test=true` (ver SQL abaixo) |
| **Polui contadores** (NPS, métricas) | Não rodar webhook test perto do horário do cron NPS (11h BRT) |
| **Custo Vercel** (cada request consome GB-Hour) | Comece com smoke, escala só se precisar |
| **Notifica WhatsApp real** (se a Eva responder) | Só rode com instância NÃO conectada à conta real |

## 🧹 Limpeza pós-webhook test

Os testes de webhook criam **leads de teste com telefones inexistentes**.
Pra limpar, conecte no Supabase SQL Editor e rode:

```sql
-- 1. Ver quantos leads de teste foram criados nas últimas 2 horas
SELECT COUNT(*) AS leads_de_teste
FROM leads
WHERE created_at > now() - interval '2 hours'
  AND name IN (
    'Maria Silva','Ana Souza','Beatriz Costa','Carla Mendes','Daniela Reis',
    'Eduarda Lima','Fernanda Oliveira','Gabriela Santos','Helena Pereira',
    'Isabela Almeida','Juliana Carvalho','Karen Ferreira','Larissa Rodrigues',
    'Mariana Gomes','Natalia Ribeiro','Patricia Martins','Renata Araújo',
    'Sabrina Barbosa','Tatiana Cardoso','Vanessa Nunes'
  );

-- 2. Apagar conversas geradas pelo teste
DELETE FROM eva_conversations
WHERE message_id LIKE 'STRESSTEST_%';

-- 3. Apagar mensagens whatsapp geradas
DELETE FROM whatsapp_messages
WHERE wa_message_id LIKE 'STRESSTEST_%';

-- 4. Apagar leads de teste (CUIDADO: isso casa por nome — confira antes)
-- Recomendado: rodar a query SELECT acima primeiro pra ver o que vai apagar
DELETE FROM leads
WHERE created_at > now() - interval '2 hours'
  AND notes ILIKE '%STRESSTEST%';
```

## 🚦 Fluxo recomendado de execução

1. **Roda smoke da landing** (`k6 run stress-test/01-landing.js`) — sem risco
2. **Roda smoke do sistema** (`k6 run stress-test/02-system.js`) — sem risco
3. Se aprovado, sobe pra **load** nos dois acima
4. **WEBHOOK SÓ DEPOIS DE PREPARAR INSTÂNCIA DE TESTE**
   - Crie uma 2ª instância Evolution (ou pause a Eva)
   - Defina `WEBHOOK_INSTANCE` e `WEBHOOK_TOKEN`
   - Rode smoke primeiro
   - Limpe os dados gerados
5. **Stress mais agressivo** (load → stress → spike) só depois de tudo OK

## 📊 Como saber se passou ou falhou

O k6 imprime no fim:
- ✅ Verde: tudo dentro dos thresholds
- ❌ Vermelho com `✗`: alguma métrica falhou

Os thresholds são:
- **Landing**: erros < 1%, p95 < 500ms
- **Sistema**: erros < 2%, p95 < 1.5s
- **Webhook**: erros < 5%, p95 < 3s
