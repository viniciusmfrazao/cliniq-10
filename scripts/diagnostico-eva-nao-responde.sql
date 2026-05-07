-- =====================================================================
-- DIAGNOSTICO: Por que a Eva nao respondeu? — VERSAO CORRIGIDA
-- =====================================================================
-- IMPORTANTE: troca os '%9999%' pelos ULTIMOS 4 DIGITOS do seu numero
-- de teste (sem espacos, sem +, sem parenteses).
-- =====================================================================

-- ── 1) Webhook chegou da Evolution? (ultimas 30 entradas) ─────────────
SELECT
  created_at,
  instance,
  event,
  status_code,
  substring(error, 1, 80) as erro_resumido,
  body->'data'->'key'->>'remoteJid' as remote_jid_msg
FROM evolution_webhook_logs
ORDER BY created_at DESC
LIMIT 30;

-- ── 2) Mensagem foi salva em eva_conversations? ───────────────────────
-- TROCA %9999% pelos seus ultimos 4 digitos
SELECT
  created_at,
  role,
  phone,
  substring(content, 1, 80) as preview,
  metadata->>'evolution_message_id' as msg_id,
  metadata->>'kind' as kind
FROM eva_conversations
WHERE phone LIKE '%9999%'
ORDER BY created_at DESC
LIMIT 20;

-- ── 3) Lead foi criado? ───────────────────────────────────────────────
-- TROCA %9999% pelos seus ultimos 4 digitos
SELECT
  created_at,
  phone,
  name,
  status,
  eva_pause_until,
  needs_human_review,
  human_review_reason,
  eva_followup_count
FROM leads
WHERE phone LIKE '%9999%'
ORDER BY created_at DESC
LIMIT 10;

-- ── 4) Status COMPLETO da instancia WhatsApp da clinica ───────────────
SELECT * FROM clinic_whatsapp ORDER BY clinic_id, created_at;

-- ── 5) Motor da Eva ativo (edge vs n8n) ───────────────────────────────
SELECT key, value FROM app_settings
WHERE key IN (
  'eva_engine',
  'donna_n8n_webhook_url',
  'evolution_url',
  'eva_internal_secret'
)
ORDER BY key;

-- ── 6) Quantos webhooks chegaram nos ultimos 5 minutos? ───────────────
SELECT
  count(*) total_webhooks,
  count(*) FILTER (WHERE status_code >= 400) com_erro,
  min(created_at) primeiro,
  max(created_at) ultimo
FROM evolution_webhook_logs
WHERE created_at > now() - interval '5 minutes';
