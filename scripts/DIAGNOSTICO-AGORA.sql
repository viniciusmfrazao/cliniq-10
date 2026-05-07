-- =====================================================================
-- DIAGNOSTICO COMPLETO: Eva + WhatsApp + Webhook
-- =====================================================================
-- Cole BLOCO POR BLOCO no SQL Editor.
-- Cada bloco retorna uma "foto" do estado atual.
-- =====================================================================

-- =====================================================================
-- BLOCO 1 — Estado atual do WhatsApp da Clinica Sarah Pina
-- =====================================================================
SELECT
  c.name AS clinica,
  cw.instance_name,
  cw.status,
  cw.auto_reply_enabled,
  cw.phone_number,
  cw.connected_at,
  cw.last_event_at,
  EXTRACT(EPOCH FROM (now() - cw.last_event_at))/60 AS minutos_desde_ultimo_evento,
  cw.health_warning,
  cw.health_reason,
  cw.health_checked_at,
  cw.webhook_token IS NOT NULL AS tem_token,
  length(cw.webhook_token) AS token_length
FROM clinic_whatsapp cw
JOIN clinics c ON c.id = cw.clinic_id
WHERE cw.clinic_id = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190';


-- =====================================================================
-- BLOCO 2 — Ultimos 20 webhooks recebidos da Evolution
-- =====================================================================
SELECT
  l.created_at AT TIME ZONE 'America/Sao_Paulo' AS quando,
  ROUND(EXTRACT(EPOCH FROM (now() - l.created_at))/60) AS minutos_atras,
  l.instance,
  l.event,
  l.status_code,
  COALESCE(left(l.error, 200), '') AS erro_ou_trace,
  l.body->'data'->'key'->>'fromMe' AS from_me,
  l.body->'data'->'key'->>'remoteJid' AS de_quem,
  left(
    COALESCE(
      l.body->'data'->'message'->>'conversation',
      l.body->'data'->'message'->'extendedTextMessage'->>'text',
      l.body->'data'->>'pushName'
    ),
    80
  ) AS texto
FROM evolution_webhook_logs l
WHERE l.created_at > now() - interval '2 hours'
ORDER BY l.created_at DESC
LIMIT 20;


-- =====================================================================
-- BLOCO 3 — Configuracoes da Eva (engine, url, secret)
-- =====================================================================
SELECT key, left(value, 100) AS value
FROM app_settings
WHERE key IN ('eva_engine', 'eva_edge_url', 'eva_internal_secret', 'n8n_donna_url')
ORDER BY key;


-- =====================================================================
-- BLOCO 4 — Ultimas 15 mensagens em eva_conversations da clinica
-- =====================================================================
SELECT
  ec.created_at AT TIME ZONE 'America/Sao_Paulo' AS quando,
  ROUND(EXTRACT(EPOCH FROM (now() - ec.created_at))/60) AS minutos_atras,
  ec.role,
  ec.phone,
  left(COALESCE(ec.content, ec.user_message, ec.assistant_message), 120) AS texto
FROM eva_conversations ec
WHERE ec.clinic_id = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190'
  AND ec.created_at > now() - interval '6 hours'
ORDER BY ec.created_at DESC
LIMIT 15;


-- =====================================================================
-- BLOCO 5 — Leads ativos da clinica + status de pause/review
-- =====================================================================
SELECT
  l.id,
  l.phone,
  l.name,
  l.status AS stage,
  l.needs_human_review,
  l.human_review_reason,
  l.eva_pause_until,
  (l.eva_pause_until IS NOT NULL AND l.eva_pause_until > now()) AS pausa_ativa,
  ROUND(EXTRACT(EPOCH FROM (l.eva_pause_until - now()))/60) AS pausa_minutos_restantes,
  l.eva_next_followup_at,
  l.last_whatsapp_at,
  l.last_contact_at,
  l.created_at AT TIME ZONE 'America/Sao_Paulo' AS criado_em
FROM leads l
WHERE l.clinic_id = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190'
  AND l.created_at > now() - interval '7 days'
ORDER BY COALESCE(l.last_whatsapp_at, l.last_contact_at, l.created_at) DESC
LIMIT 10;
