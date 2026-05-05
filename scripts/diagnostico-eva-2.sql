-- ============================================================================
-- Diagnóstico Eva — Parte 2 (após análise dos blocos 1, 2, 3)
-- ============================================================================
-- ACHADOS DA PARTE 1:
--   ✓ WhatsApp connected, auto_reply_enabled=true
--   ✓ Engine = 'edge' (Edge Function eva-process)
--   ✓ Webhooks chegando até 16:47 hoje
--   ⚠ Os 30 logs visíveis eram do STRESS TEST (00:22-00:23) — falso positivo
--   ⚠ "forward Donna ok" no log NÃO garante que Eva respondeu —
--     era só "fetch foi disparado", sem checar status da Edge Function
--
-- AGORA VAMOS DESCOBRIR:
--   1. Qual o estado dos webhooks REAIS (depois do stress test)
--   2. Tem leads marcados pra revisão humana (silentFail da Eva)?
--   3. A Edge Function tá respondendo ou erro de Anthropic?
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- A. Webhooks REAIS recentes (excluindo stress test do dia 04 entre 00:00-00:30)
-- ─────────────────────────────────────────────────────────────────────────────
-- O QUE OBSERVAR:
--   - Procure por trace tipo "forward Donna FAIL (engine=edge, status=...)"
--     (só vai aparecer depois do deploy desse fix novo)
--   - Procure por números reais (não os de stress test 5519900..., 5582953...)
SELECT
  created_at,
  event,
  status_code,
  LEFT(COALESCE(error, ''), 500) AS erro_ou_trace
FROM evolution_webhook_logs
WHERE created_at > now() - interval '24 hours'
  AND NOT (created_at BETWEEN '2026-05-04 00:20:00-03' AND '2026-05-04 00:30:00-03')
ORDER BY created_at DESC
LIMIT 30;

-- ─────────────────────────────────────────────────────────────────────────────
-- B. Leads que Eva marcou pra revisão humana (silentFail)
-- ─────────────────────────────────────────────────────────────────────────────
-- O QUE OBSERVAR:
--   - Se aparecerem MUITOS leads aqui = Edge Function tá quebrando
--     (Claude erro / loop / sem resposta) e Eva tá pedindo SOS
--   - human_review_reason = 'claude_error' significa instabilidade técnica
--     (geralmente: ANTHROPIC_API_KEY ausente OU rate limit OU sem créditos)
SELECT
  id,
  name,
  phone,
  needs_human_review,
  human_review_reason,
  LEFT(human_review_details, 300) AS detalhes,
  human_review_at,
  EXTRACT(EPOCH FROM (now() - human_review_at))/3600 AS horas_atras
FROM leads
WHERE needs_human_review = true
ORDER BY human_review_at DESC NULLS LAST
LIMIT 20;

-- ─────────────────────────────────────────────────────────────────────────────
-- C. Volume real de mensagens hoje (excluindo stress test)
-- ─────────────────────────────────────────────────────────────────────────────
-- O QUE OBSERVAR:
--   - 'user' = mensagens recebidas
--   - 'assistant' = respostas (Eva ou secretária)
--   - Se hoje user >> assistant, Eva tá engasgada
SELECT
  date_trunc('hour', created_at) AS hora,
  role,
  COUNT(*) AS total
FROM eva_conversations
WHERE created_at > now() - interval '24 hours'
  AND NOT (created_at BETWEEN '2026-05-04 00:20:00-03' AND '2026-05-04 00:30:00-03')
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

-- ─────────────────────────────────────────────────────────────────────────────
-- D. Conversas pelo `last_agent` — separa Eva de secretária
-- ─────────────────────────────────────────────────────────────────────────────
-- Se 'eva' tá zerado nas últimas horas, a Edge Function não tá respondendo.
-- Se tem várias 'eva', mas o WhatsApp não recebeu, é Evolution errando o envio.
SELECT
  metadata->>'engine' AS engine,
  last_agent,
  COUNT(*) AS total,
  MIN(created_at) AS primeira,
  MAX(created_at) AS ultima
FROM eva_conversations
WHERE role = 'assistant'
  AND created_at > now() - interval '24 hours'
GROUP BY 1, 2
ORDER BY ultima DESC NULLS LAST;

-- ─────────────────────────────────────────────────────────────────────────────
-- E. Mensagens recebidas SEM resposta nas últimas 6h (REAIS)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  e.created_at,
  e.phone,
  LEFT(e.content, 100) AS pergunta,
  EXTRACT(EPOCH FROM (now() - e.created_at))/60 AS minutos_atras
FROM eva_conversations e
WHERE e.role = 'user'
  AND e.created_at > now() - interval '6 hours'
  AND NOT (e.created_at BETWEEN '2026-05-04 00:20:00-03' AND '2026-05-04 00:30:00-03')
  AND NOT EXISTS (
    SELECT 1 FROM eva_conversations e2
    WHERE e2.clinic_id = e.clinic_id
      AND e2.phone = e.phone
      AND e2.role = 'assistant'
      AND e2.created_at > e.created_at
      AND e2.created_at < e.created_at + interval '5 minutes'
  )
ORDER BY e.created_at DESC
LIMIT 30;
