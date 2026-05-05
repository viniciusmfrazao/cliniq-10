-- ============================================================================
-- 🧹 LIMPEZA: deletar TUDO do stress test
-- ============================================================================
-- ATENÇÃO: este script DELETA dados.
-- Rode SOMENTE depois de:
--   1. Ter executado o BLOCO 1 do PARAR-EVA-AGORA.sql (parar follow-up)
--   2. Ter conferido o BLOCO 2 do PARAR-EVA-AGORA.sql (preview da quantidade)
--
-- Tudo é executado dentro de uma transação. Se algo der errado, faça ROLLBACK
-- em vez de COMMIT no final.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Deleta as conversas (eva_conversations) dos phones do stress test
-- ─────────────────────────────────────────────────────────────────────────────
WITH stress_phones AS (
  SELECT DISTINCT clinic_id, phone
  FROM eva_conversations
  WHERE metadata->>'evolution_message_id' LIKE 'STRESSTEST\_%' ESCAPE '\'
)
DELETE FROM eva_conversations c
USING stress_phones s
WHERE c.clinic_id = s.clinic_id AND c.phone = s.phone;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Deleta os leads do stress test
-- ─────────────────────────────────────────────────────────────────────────────
-- Pega tanto os marcados pelo PARAR-EVA-AGORA.sql quanto qualquer lead
-- whatsapp criado na janela do stress test (defesa em profundidade).
DELETE FROM leads
WHERE lost_reason = 'stress_test_cleanup'
   OR notes LIKE '%[BLOQUEIO]%stress_test%'
   OR (
        source = 'whatsapp'
        AND created_at >= '2026-05-04 00:00:00-03'
        AND created_at <  '2026-05-04 00:30:00-03'
      );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Deleta NPS responses gerados na janela do stress test
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM nps_responses
WHERE created_at >= '2026-05-04 00:00:00-03'
  AND created_at <  '2026-05-04 00:30:00-03';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Deleta webhook logs do stress test
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM evolution_webhook_logs
WHERE created_at >= '2026-05-04 00:00:00-03'
  AND created_at <  '2026-05-04 00:30:00-03';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) Verificação final — deve voltar 0 em todos
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM eva_conversations
    WHERE metadata->>'evolution_message_id' LIKE 'STRESSTEST\_%' ESCAPE '\'
  ) AS conversas_stress_restantes,
  (SELECT COUNT(*) FROM leads
    WHERE lost_reason = 'stress_test_cleanup'
       OR notes LIKE '%[BLOQUEIO]%stress_test%'
  ) AS leads_stress_restantes,
  (SELECT COUNT(*) FROM evolution_webhook_logs
    WHERE created_at >= '2026-05-04 00:00:00-03'
      AND created_at <  '2026-05-04 00:30:00-03'
  ) AS logs_stress_restantes;

-- Se os 3 voltarem 0, faz COMMIT.
-- Se alguma coisa parecer errada, rola ROLLBACK e me avisa.
COMMIT;
