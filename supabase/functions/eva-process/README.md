# Eva — Edge Function (Supabase)

Substituta do workflow n8n para processar mensagens do WhatsApp da Eva.

## Arquitetura

```
WhatsApp → Evolution API
            ↓
       /api/webhooks/evolution/[instance]/route.ts (Next.js)
            ↓
   forwardToDonna() lê app_settings.eva_engine
            ↓
       ┌────────────┴─────────────┐
       │                          │
   "n8n" (legado)            "edge" (novo)
       │                          │
   webhook do n8n      Edge Function eva-process
                                   │
                       ┌───────────┼───────────┐
                       │           │           │
                  donna_load_  Claude API   Evolution
                  context        (tools)    sendText
                  (RPC)
                       │           │           │
                       └───────────┼───────────┘
                                   ↓
                        eva_conversations (insert)
```

## Pré-requisitos

- Node.js / npm já instalados (você já tem)
- Supabase CLI: `npm install -g supabase` (se não tiver)
- Conta logada: `supabase login`

## 1) Linkar o projeto local ao Supabase

```bash
supabase link --project-ref yqrjbyaucimvmzpfipgs
```

(Vai pedir o database password do projeto — só precisa uma vez.)

## 2) Configurar os secrets na Edge Function

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxx
```

Os secrets `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já são injetados automaticamente pelo Supabase em toda Edge Function — não precisa setar.

(Opcional) secret extra de proteção:
```bash
supabase secrets set EVA_INTERNAL_SECRET=$(openssl rand -hex 24)
```
E grave o mesmo valor em `app_settings.eva_internal_secret`.

## 3) Deploy

```bash
supabase functions deploy eva-process
```

Saída esperada:
```
Deployed Function eva-process to project yqrjbyaucimvmzpfipgs
URL: https://yqrjbyaucimvmzpfipgs.supabase.co/functions/v1/eva-process
```

## 4) Rodar o SQL de setup

No Supabase SQL Editor, rodar `scripts/eva-edge-setup.sql`. Isso adiciona:
- `eva_engine` em `app_settings` (default: `'n8n'`)
- `eva_edge_url` apontando pra Edge Function
- `eva_internal_secret` (vazio por default, opcional)

## 5) Testar (sem cair em produção)

Faz um POST de teste no terminal:

```bash
curl -X POST "https://yqrjbyaucimvmzpfipgs.supabase.co/functions/v1/eva-process" \
  -H "Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "clinicId":"6a718c1d-9a79-4e80-ad71-1c5c8a2ea190",
    "instance":"clinica-sarah-pina",
    "phone":"553491805722",
    "userText":"Bom dia, tem horário pra botox quarta de tarde?",
    "customerName":"Vinicius Frazão"
  }'
```

Resposta esperada:
```json
{
  "ok": true,
  "finalText": "Bom dia! Posso verificar a agenda...",
  "sent": true,
  "elapsedMs": 2400,
  "steps": [...],
  "usage": { "input_tokens": 2800, "output_tokens": 80, "cache_read_input_tokens": 0, "cache_creation_input_tokens": 2500 },
  "errors": []
}
```

Reparem em `usage.cache_creation_input_tokens` na 1ª chamada e `usage.cache_read_input_tokens` nas próximas — é o prompt caching funcionando.

## 6) Ativar em produção

No SQL Editor:
```sql
UPDATE app_settings SET value = 'edge' WHERE key = 'eva_engine';
```

Pronto. A próxima mensagem do WhatsApp vai pela Edge Function.

## 7) Reverter (se algo der errado)

```sql
UPDATE app_settings SET value = 'n8n' WHERE key = 'eva_engine';
```

Volta pro n8n imediatamente — sem deploy, sem nada.

## Logs

```bash
supabase functions logs eva-process --tail
```

Ou no dashboard: Project → Edge Functions → eva-process → Logs.

## Estrutura de arquivos

| Arquivo | O que faz |
|---|---|
| `index.ts` | Entry point — handler HTTP, validação, orquestração |
| `prompt.ts` | System prompt da Eva + definição das tools |
| `claude.ts` | Wrapper Anthropic API + loop conversacional |
| `tools.ts` | Implementação das tools (consultar_agenda, criar_agendamento, etc) |
| `utils.ts` | Helpers: sanitização, parser de datas, normalização |
| `types.ts` | TypeScript types compartilhados |

## Diferenças vs n8n

| | n8n | Edge Function |
|---|---|---|
| Custo plataforma | ~$20-50/mês | Grátis (incluído no Supabase) |
| Custo Claude | $50/mês | ~$15-20/mês (com prompt caching) |
| Deploy | copy/paste no UI | `supabase functions deploy` |
| Versionamento | manual | Git |
| Logs | UI do n8n | `supabase functions logs` |
| Debug | Executions UI | console.log + `supabase functions serve` (local) |
| Bugs de copy/paste | sim | não |
