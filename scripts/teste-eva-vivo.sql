-- ============================================================================
-- 🩺 Teste rápido: Eva tá viva?
-- ============================================================================
-- Use depois de mandar UMA mensagem real pelo seu celular pro WhatsApp da
-- clínica. Os 3 blocos respondem 3 perguntas:
--   A) A mensagem chegou no webhook?
--   B) A edge function respondeu (sem mais "ok" falso positivo)?
--   C) Eva gerou resposta no banco?
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- A) Webhook recebeu mensagem nos últimos 5 minutos?
-- ─────────────────────────────────────────────────────────────────────────────
-- O QUE OBSERVAR:
--   - Linha com "messages_upsert" + seu telefone real → chegou ✅
--   - Nada → Evolution não está repassando webhook (instância penalizada)
--   - Procure por "forward Donna FAIL" ou "forward Donna ok (engine=edge,
--     status=200, ...)" — o NOVO formato pós-deploy
SELECT
  created_at,
  event,
  status_code,
  LEFT(COALESCE(error, ''), 600) AS trace_completo
FROM evolution_webhook_logs
WHERE created_at > now() - interval '5 minutes'
ORDER BY created_at DESC
LIMIT 10;

-- ─────────────────────────────────────────────────────────────────────────────
-- B) Status atual do WhatsApp + último evento
-- ─────────────────────────────────────────────────────────────────────────────
-- O QUE OBSERVAR:
--   - status='connected' e last_event_at recente (< 1 min) → tudo ok
--   - last_event_at antigo → Evolution parou de mandar webhook
SELECT
  c.name AS clinica,
  cw.instance_name,
  cw.status,
  cw.auto_reply_enabled,
  cw.last_event_at,
  EXTRACT(EPOCH FROM (now() - cw.last_event_at)) AS segundos_atras
FROM clinic_whatsapp cw
JOIN clinics c ON c.id = cw.clinic_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- C) Mensagens REAIS dos últimos 10 minutos (user + Eva)
-- ─────────────────────────────────────────────────────────────────────────────
-- O QUE OBSERVAR:
--   - role='user' = sua mensagem chegou ✅
--   - role='assistant' depois disso = Eva respondeu ✅
--   - Só user, sem assistant = Eva quebrou na edge function
SELECT
  created_at,
  phone,
  role,
  LEFT(content, 200) AS conteudo,
  metadata->>'engine' AS engine,
  last_agent
FROM eva_conversations
WHERE created_at > now() - interval '10 minutes'
ORDER BY created_at DESC
LIMIT 20;
