-- ============================================================================
-- Diagnóstico: por que a Eva não está respondendo?
-- ============================================================================
-- Rode TODOS os blocos no SQL Editor de PRODUÇÃO. Cada bloco é independente.
-- Os comentários no topo de cada bloco explicam o que esperar.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Status do toggle Eva auto/manual + estado da instância
-- ─────────────────────────────────────────────────────────────────────────────
-- O QUE OBSERVAR:
--   - status deve ser 'connected'
--   - auto_reply_enabled deve ser true
--   - last_event_at recente (= webhook tá chegando)
SELECT
  c.name AS clinica,
  cw.instance_name,
  cw.status,
  cw.auto_reply_enabled,
  cw.last_event_at,
  EXTRACT(EPOCH FROM (now() - cw.last_event_at))/60 AS minutos_desde_ultimo_evento,
  cw.connected_at
FROM clinic_whatsapp cw
JOIN clinics c ON c.id = cw.clinic_id
ORDER BY cw.last_event_at DESC NULLS LAST;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Engine atual da Eva (n8n vs edge function) + URLs configuradas
-- ─────────────────────────────────────────────────────────────────────────────
-- O QUE OBSERVAR:
--   - eva_engine: 'n8n' (legado) ou 'edge' (novo)
--   - se n8n: n8n_donna_url precisa estar preenchido
--   - se edge: eva_edge_url + ANTHROPIC_API_KEY no env do Vercel
SELECT key, value
FROM app_settings
WHERE key IN ('eva_engine', 'n8n_donna_url', 'eva_edge_url', 'eva_internal_secret')
ORDER BY key;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Últimos webhooks recebidos da Evolution (tá chegando mensagem?)
-- ─────────────────────────────────────────────────────────────────────────────
-- O QUE OBSERVAR:
--   - se está vazio nas últimas 24h → webhook não tá chegando (problema na Evolution)
--   - se tem 'eva skip: ...' no error → Eva foi BLOQUEADA (entender o motivo)
--   - se tem 'forward Donna: ...' com erro → engine da Eva tá quebrada
SELECT
  created_at,
  event,
  status_code,
  LEFT(COALESCE(error, ''), 300) AS erro_ou_trace
FROM evolution_webhook_logs
WHERE created_at > now() - interval '24 hours'
ORDER BY created_at DESC
LIMIT 30;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Leads em cooldown da Eva (eva_pause_until ativo)
-- ─────────────────────────────────────────────────────────────────────────────
-- O QUE OBSERVAR:
--   - se TODOS os seus leads/pacientes têm pause_until no futuro,
--     a Eva fica calada com todo mundo (efeito do stress-test ou bug)
SELECT
  COUNT(*) FILTER (WHERE eva_pause_until > now()) AS leads_em_cooldown,
  COUNT(*) FILTER (WHERE eva_pause_until IS NULL) AS leads_sem_cooldown,
  COUNT(*) AS total_leads,
  MAX(eva_pause_until) AS pause_mais_tarde
FROM leads;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Mensagens recebidas vs respostas da Eva nas últimas 24h
-- ─────────────────────────────────────────────────────────────────────────────
-- O QUE OBSERVAR:
--   - 'user' = mensagens recebidas
--   - 'assistant' = respostas (Eva ou secretária via /send)
--   - se user >> assistant nas últimas horas → Eva parou de responder
SELECT
  date_trunc('hour', created_at) AS hora,
  role,
  COUNT(*) AS total
FROM eva_conversations
WHERE created_at > now() - interval '24 hours'
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Mensagens não-respondidas (user sem assistant subsequente)
-- ─────────────────────────────────────────────────────────────────────────────
-- O QUE OBSERVAR:
--   - lista as mensagens recebidas nas últimas 6h que ainda não foram respondidas
SELECT
  e.created_at,
  e.phone,
  LEFT(e.content, 100) AS pergunta,
  EXTRACT(EPOCH FROM (now() - e.created_at))/60 AS minutos_atras
FROM eva_conversations e
WHERE e.role = 'user'
  AND e.created_at > now() - interval '6 hours'
  AND NOT EXISTS (
    SELECT 1 FROM eva_conversations e2
    WHERE e2.clinic_id = e.clinic_id
      AND e2.phone = e.phone
      AND e2.role = 'assistant'
      AND e2.created_at > e.created_at
      AND e2.created_at < e.created_at + interval '5 minutes'
  )
ORDER BY e.created_at DESC
LIMIT 20;
