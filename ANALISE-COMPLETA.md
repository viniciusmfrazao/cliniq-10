# Clinike — Análise Completa, Roadmap e Pendências

> Documento gerado em 2026-04-28. Atualize aqui conforme cada item for entregue.
>
> Status:
> - [x] Concluído
> - [~] Em andamento
> - [ ] Pendente

> 🤖 **Roadmap da Donna (auto-atendimento WhatsApp):** ver [`ROADMAP-DONNA.md`](./ROADMAP-DONNA.md)
>   — 9 milestones decididos com a clínica em 28/04/2026 (preços, lead-first, follow-up, escalonamento, confirmação D-1). Não esquecer.
>
> 🚀 **Melhorias com IA (diferencial competitivo):** ver [`MELHORIAS-INOVADORAS.md`](./MELHORIAS-INOVADORAS.md)
>   — 13 features priorizadas (simulador estético, análise de pele, voice-to-text, predição de no-show, etc).

---

## 1) Erros e pontos de atenção (achados na varredura)

### 1.1 Pastas-fantasma do `mkdir` quebrado no PowerShell
Diretórios vazios deixados por uma expansão de chaves que o PowerShell não interpreta. Não rodam em build, mas atrapalham busca/IDE e pollution do repositório.

- [x] Apagado `src/{app/` e toda a árvore abaixo.
- [x] Apagado `src/components/{layout,ui}/`.

### 1.2 `docs/` está no `.gitignore` mas o git já rastreia o histórico
- [ ] Decidir: parar de versionar (`git rm -r --cached docs && git commit`) ou tirar `docs/` do `.gitignore`. Prompts da Eva/Donna e workflows do n8n estão lá.

### 1.3 Vulnerabilidades de autenticação em APIs

| Rota | Risco | Status |
|---|---|---|
| `POST /api/webhooks/n8n` | Crítico — sem auth, qualquer um confirma/cancela agendamento e cria leads | [x] **Fechado** (Fix #1) |
| `POST /api/evolution/test` | Alto — SSRF: aceita URL e key arbitrários no body sem auth | [x] **Fechado** (Fix #2) |
| `GET /api/cron/*` (5 rotas) | Médio — `if (expected && auth !== expected)` libera tudo se `CRON_SECRET` não estiver setado | [x] **Fechado** (Fix #3) |
| `POST /api/anamnese/[token]` | Médio (LGPD) — IP da assinatura vem do body, pode ser falsificada | [x] **Fechado** (Fix #5) |
| `POST /api/documents/sign/[token]` | Médio (LGPD) — mesmo problema da anamnese | [x] **Fechado** (Fix #5) |
| `POST /api/invite` | Alto — se e-mail já existe no Auth, troca a senha do usuário (takeover entre clínicas) | [x] **Fechado** (Fix #4) |
| `GET /api/admin/logs` | Baixo (precisa super admin) — `or()` com search direto sem `sanitizeSearchTerm` | [ ] Pendente |

### 1.4 Injeção em PostgREST `.or()`
- [x] `src/app/dashboard/injetaveis/page.tsx` agora passa por `sanitizeSearchTerm` (Fix #6).
- [ ] `src/app/api/admin/logs/route.ts` — passar `search` por `sanitizeSearchTerm`.

### 1.5 Vercel `vercel.json` x plano Hobby
- [ ] 4 crons rodando 1x/dia. `aniversario_hora` por clínica não é respeitado (cron único). Documentar para o cliente ou migrar pro Pro.

### 1.6 Bugs lógicos
- [ ] `cron/recall-inactive`: em `dryRun` incrementa `summary.sent` mas não respeita o `limitPerClinic`.
- [ ] `cron/appointment-reminders`: marca `confirmation_sent_at` antes de enviar; se servidor cair entre o lock e a Evolution, paciente fica sem lembrete. Mover pra log separado (estilo `recall_messages_log`).
- [ ] `audit_logs`: faltam índices em `(clinic_id, created_at DESC)`.
- [ ] `evolution-timeline`: signed URLs de fotos com 1h. Usuário >1h na página vê foto quebrada. Re-gerar via cliente quando o `<img>` falhar.
- [ ] Dashboard compara hoje × ontem — segunda sempre cai. Comparar com mesmo dia da semana anterior.
- [ ] Dashboard `birthdaysThisWeek` usa `new Date()` (UTC do server) em vez de `BR_TZ`.
- [ ] Dashboard SSR roda 9+ queries em série; paralelizar com `Promise.all`.
- [ ] `patient-form`: CPF sem validação de DV (gera duplicatas por digitação).

### 1.7 Lint / Build
- [ ] `next.config.js` está com `eslint.ignoreDuringBuilds: true`. Limpar warnings e ligar.
- [ ] ~150 `console.log/warn/error` espalhados — usar `src/lib/logger.ts` e desligar em prod.

### 1.8 Cobertura de teste
- [ ] Existe Jest e Playwright configurados, mas só 1 teste (`ErrorBoundary.test.tsx`). Cobertura ~0%.

---

## 2) Performance (curto/médio prazo)

- [ ] Paralelizar dashboard SSR (`Promise.all`).
- [ ] Adicionar índices Postgres faltantes (`audit_logs`, `evolutions`, `appointments`, `eva_conversations`).
- [ ] Trocar `select('*')` por colunas explícitas em queries quentes.
- [ ] Paginação real em `pacientes`, `auditoria`, `whatsapp` (não trazer 1000 linhas).
- [ ] `next/image` com loader Supabase nas galerias do prontuário.
- [ ] Avaliar substituir `xlsx` (~600KB gzip) por CSV server-side.
- [ ] Realtime só onde faz sentido (agenda/recepção/notificações). Tirar de relatórios.

---

## 3) UX / qualidade de código

- [ ] Dark mode efetivo nos componentes do dashboard (variantes `dark:` faltam).
- [ ] Skeleton loaders nas listas pesadas (agenda, financeiro, pacientes).
- [ ] Empty states com CTA em todas as listas.
- [ ] Acessibilidade: `alt`, `aria-label` em ícones-botão, foco visível.
- [ ] Validação de formulário centralizada (zod ou similar).
- [ ] Tipos centralizados em `src/types/database.ts` aplicados em todos os componentes (hoje vários redefinem locais).
- [ ] Atalhos de teclado: `N` novo agendamento, `G+A` agenda, `Esc` fecha modal.

---

## 4) Roadmap de produto (do `ROADMAP.md`, mantido aqui pra centralizar)

### Curto prazo (alta prioridade)
- [ ] Confirmação ativa via Eva/Donna 24h antes (cron + n8n + WhatsApp).
- [ ] Recall automático de inativos (já tem cron, falta UI por clínica).
- [ ] Aniversariantes do dia com botão "Mandar parabéns" no dashboard.
- [ ] Ditado por voz na evolução (Web Speech API + estruturação automática).
- [ ] Fotos antes/depois com slider lado-a-lado nativo.
- [ ] Modo "TV" recepção em tempo real.

### Médio prazo
- [ ] Comissão automática por profissional (fechamento mensal).
- [ ] Relatório semanal automático no WhatsApp da dona (sexta 18h).
- [ ] Permissões finas por módulo/role (recepção sem DRE etc).
- [ ] LGPD — exportação de dados do paciente (PDF + JSON).
- [ ] Backup completo (CSV/Excel server-side).

### Backlog
- [ ] Pesquisa NPS pós-atendimento (já tem cron, falta UI).
- [ ] Compartilhar agendamento via WhatsApp.
- [ ] Heatmap de ocupação por profissional.
- [ ] Reagendamento sugerido automático.
- [ ] Multi-clínica (uma conta + várias unidades).
- [ ] PWA push notifications.
- [ ] Timeline cronológica única do paciente (agenda + evolução + financeiro + fotos).

---

## 5) Diferencial: IA

### 5.1 ⭐ Simulador "antes/depois" com IA na foto real
- [ ] Endpoint `POST /api/ai/simulate-injection` (autenticado, com clinic_id).
- [ ] UI no `/dashboard/injetaveis/[patientId]` com aba "Simular resultado".
- [ ] Prompt por zona/procedimento (toxina vs preenchedor, unidades, técnica).
- [ ] Watermark "SIMULAÇÃO — NÃO É RESULTADO GARANTIDO".
- [ ] Termo de consentimento eletrônico antes de gerar.
- [ ] Auditoria do prompt + modelo + versão.
- [ ] Provider sugerido: Replicate (`tencentarc/photomaker` ou FAL `flux-pulid` para preservar identidade).

### 5.2 Eva / Donna — próximo nível
- [ ] Function calling real (criar agendamento, consultar agenda, registrar recall).
- [ ] Score de lead automático (`leads.ai_score`, `ai_priority` já existem).
- [ ] Sumário automático da consulta (Whisper + estruturação Queixa/HPMA/Conduta).
- [ ] Detecção de no-show provável.

### 5.3 Visão computacional
- [ ] Análise facial automática com landmarks (MediaPipe).
- [ ] Auto-tagueamento de fotos (antes/depois, zona).
- [ ] Comparador antes/depois com alinhamento facial.
- [ ] OCR de exames externos.

### 5.4 IA financeira / operacional
- [ ] Previsão de receita do mês.
- [ ] Detecção de inconsistência entre caixa e agenda concluída.
- [ ] Otimização de agenda (sugerir paciente da lista de espera para buracos).
- [ ] Score de churn por paciente.

### 5.5 RAG no prontuário
- [ ] Embeddings de `evolutions` + `anamneses` no `pgvector`.
- [ ] Pergunta natural na ficha ("alergias?", "última toxina?").

### 5.6 Diferencial comercial
- [ ] Simulador no site institucional como canal de aquisição.
- [ ] NPS preditivo (classifica risco de churn pelo comentário).
- [ ] Relatório semanal narrativo pra dona da clínica.

---

## 6) Workflows do n8n — o que falta

> Os JSONs estão em `docs/n8n-donna-workflow*.json`, `docs/donna-v4-workflow.json` e `docs/eva-followup-workflow.json`.

### 6.1 Donna (WhatsApp inbound)
- [ ] Function calling real conectado nas rotas internas (`/api/whatsapp/send`, queries de agenda).
- [ ] Header `x-cliniq-secret` em todas as chamadas para `/api/whatsapp/send` (já é exigido pelo backend).
- [ ] Nó de tratamento de mídia (foto/áudio) — hoje o webhook recebe, mas o workflow não interpreta áudio (Whisper) nem imagem.
- [ ] Branch para "paciente novo" (lead) vs "paciente existente" (com histórico).
- [ ] Resposta automática só dentro do horário comercial da clínica (campo já existe em `clinic_horarios`).

### 6.2 Eva (follow-up / recall / NPS)
- [ ] Reaproveitar `/api/cron/*` em vez de duplicar lógica no n8n. Eva fica só com a parte conversacional.
- [ ] Captura da resposta NPS (1-5 ou estrelas) já está no webhook da Evolution — workflow do n8n não precisa duplicar.
- [ ] Workflow de "recall com sugestão de horário": cron manda mensagem → paciente responde "quero" → Eva consulta `procedures` + `users` disponíveis → manda 3 horários sugeridos.
- [ ] Confirmação de consulta 24h antes: hoje é cron único na Vercel. Migrar pro n8n por clínica/horário (Pro plan ou n8n self-hosted) caso queira respeitar `confirma_24h_hora`.

### 6.3 Webhook receiver no Clinike
- [x] `/api/webhooks/evolution/[instance]` está bem (token por clínica, NPS captura, dedupe, mídia → bucket).
- [ ] `/api/webhooks/n8n` está sem auth — Fix #1 nesta rodada.
- [ ] Logs de webhook (já existe `evolution_webhook_logs`) — adicionar UI de inspeção rápida em `/admin/webhooks/logs` (parcial em logs-viewer).

### 6.4 Setup que falta documentar
- [ ] Variáveis **obrigatórias** por ambiente: `CRON_SECRET`, `N8N_WEBHOOK_SECRET` (env Vercel) **ou** `app_settings.n8n_donna_secret` (Supabase), `evolution_*` em `app_settings`, `n8n_donna_url` em `app_settings`.
- [ ] `OPENAI_API_KEY` **não** é usada no código do app hoje — fica configurada no próprio n8n (Credentials). Só será necessária no Vercel quando implementarmos IA direto no Clinike (ex: simulador de botox).
- [ ] Procedimento de "rotação de secret" (se vazar `n8n_donna_secret`, como atualizar sem quebrar webhook).

---

## 7) Resumo priorizado

### Status da configuração de ambiente (28/04/2026 11h)
- [x] `CRON_SECRET` adicionado no Vercel (Production + Preview, Sensitive)
- [x] `N8N_WEBHOOK_SECRET` adicionado no Vercel (Production + Preview, Sensitive)
- [ ] **`SUPABASE_SERVICE_ROLE_KEY` está com "Needs Attention"** — investigar e corrigir (provavelmente marcar como Sensitive)
- [ ] Forçar **Redeploy** do último commit (sem cache) pra propagar as envs novas
- [ ] **n8n**: criar Credential "Header Auth" (`x-cliniq-secret` = valor do `N8N_WEBHOOK_SECRET`)
- [ ] **n8n**: aplicar essa Credential em todos os HTTP Request nodes que batem em `/api/webhooks/n8n`
- [ ] Rodar os 5 testes via curl (cron 401/200, webhook 401/404, healthcheck 200)
- [ ] Testar 1 fluxo real do n8n (ex: confirmação WhatsApp)

### 🔥 Esta semana — segurança e bugs sensíveis
1. [x] Fix #1: Auth em `/api/webhooks/n8n` (header `x-cliniq-secret` validado contra `app_settings.n8n_donna_secret` ou env `N8N_WEBHOOK_SECRET`).
2. [x] Fix #2: Auth em `/api/evolution/test` (super admin only + validação de protocolo da URL).
3. [x] Fix #3: `CRON_SECRET` ausente devolve 503 (cron_not_configured) em vez de liberar — em 5 rotas: nps, birthdays, appointment-reminders, recall-inactive, reminders.
4. [x] Fix #4: `/api/invite` recusa convite (409) se e-mail já existe no Auth, em vez de trocar a senha. Sem mais takeover entre clínicas.
5. [x] Fix #5: IP da assinatura (anamnese + documentos) lido de `x-forwarded-for` via novo helper `src/lib/client-ip.ts`. Front limpou `body.ip`. **Validado em produção em 28/04/2026 12h05** via `scripts/auditoria-assinaturas.sql`: 2 anamneses pós-fix gravaram IPv4 brasileiros válidos (`189.39.25.96`, `200.251.129.101`); registros anteriores ao deploy (1 anamnese null + 1 documento `'captured'`) são histórico imutável.
6. [x] Fix #6: `searchParams.q` em `/dashboard/injetaveis` passa por `sanitizeSearchTerm`.
7. [x] Fix #7: Pastas-fantasma `src/{app/...` e `src/components/{layout,ui}` removidas.

### ✨ Quick-wins entregues após os fixes
- [x] **Botão "Anamnese" no popover da agenda** (28/04/2026)
  - `POST /api/anamnese/send` cria/reaproveita ficha pendente e dispara via Evolution.
  - Reusa anamnese ativa (`pending`/`viewed`) com `expires_at` no futuro — sem duplicar.
  - Sem WhatsApp conectado ou paciente sem telefone: copia o link no clipboard e avisa.
  - Componente `src/app/dashboard/agenda/send-anamnese-button.tsx` plugado no popover do `AppointmentCard`.
- [x] **Anamnese visível no atendimento e no histórico do paciente** (28/04/2026)
  - Componente `src/components/anamnese/AnamneseSummaryCard.tsx` (compact|full) com chips de alerta clínico.
  - Atendimento: card "Anamnese mais recente" abaixo do prontuário com gestante/lactante/alergias/herpes/auto-imune/fumante/medicamentos.
  - Tab "evoluções" da Central do Paciente virou "Histórico do paciente" e mistura evoluções + anamneses por data, com filtro próprio.

#### Validação jurídica do `signature_ip` (Fix #5)
Script versionado em `scripts/auditoria-assinaturas.sql` (auditoria reprodutível).

**Resultado da validação em produção (28/04/2026 12h05):**

| Origem | OK (IP real) | Sem IP (null) | Bug antigo (`'captured'`) | Total |
|---|---|---|---|---|
| `anamneses` | 2 | 1 | 0 | 3 |
| `documents_sent` | 0 | 0 | 1 | 1 |

- Pós-fix: 2 anamneses gravaram IPv4 brasileiros válidos (`189.39.25.96`, `200.251.129.101`).
- Pré-fix (24/04): 1 anamnese sem IP + 1 documento com `'captured'` — histórico imutável, mas novos registros vêm corretos.

**Conjunto probatório por assinatura (LGPD + Lei 14.063/2020 — assinatura simples):**
- `patient_id` → vínculo ao paciente (nome, CPF).
- `completed_at` → timestamp do ato (com timezone).
- `signature_ip` → origem da requisição (capturada via `x-forwarded-for`).
- `signature_data` → imagem do canvas em PNG base64.
- `token` → 32 chars gerados por `crypto.getRandomValues`, vincula a assinatura ao link enviado pra aquele paciente específico.
- `sent_by` → user da clínica que disparou.

### 🟡 Próximas 2-3 semanas
8. [ ] Paralelizar dashboard + índices faltantes.
9. [ ] Comparador antes/depois nativo (slider).
10. [ ] Skeleton loaders + empty states com CTA.
11. [ ] LGPD export do paciente.
12. [ ] Logger central (substituir `console.log`).
13. [ ] Sanitizar search em `/api/admin/logs` e qualquer outro `.or()` com input direto.

### 🚀 Roadmap maior
14. [ ] Simulador IA de botox/preenchedor.
15. [ ] Ditado por voz com estruturação automática.
16. [ ] RAG sobre prontuário.
17. [ ] Multi-clínica + permissões finas.
18. [ ] Push notifications PWA.
