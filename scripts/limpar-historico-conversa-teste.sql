-- ============================================================================
-- LIMPEZA: histórico de conversa (somente teste/automação)
-- Tabela alvo: eva_conversations
-- ============================================================================
-- Sem backup (conforme solicitado).
-- Segurança: apaga apenas conversas identificadas como teste por:
--   1) metadata.evolution_message_id iniciando com STRESSTEST_
--   2) criadas na janela dinâmica dos últimos 30 dias (hoje - 1 mês)
-- ============================================================================

BEGIN;

-- 1) Preview do que será apagado
SELECT
  COUNT(*) AS total_alvo
FROM eva_conversations
WHERE
  (metadata->>'evolution_message_id' LIKE 'STRESSTEST\_%' ESCAPE '\')
  OR (created_at >= (now() - interval '1 month') AND created_at < now());

-- 2) Delete
DELETE FROM eva_conversations
WHERE
  (metadata->>'evolution_message_id' LIKE 'STRESSTEST\_%' ESCAPE '\')
  OR (created_at >= (now() - interval '1 month') AND created_at < now());

-- 3) Verificação final (deve voltar 0)
SELECT
  COUNT(*) AS restante
FROM eva_conversations
WHERE
  (metadata->>'evolution_message_id' LIKE 'STRESSTEST\_%' ESCAPE '\')
  OR (created_at >= (now() - interval '1 month') AND created_at < now());

COMMIT;

