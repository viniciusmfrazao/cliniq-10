-- ============================================================================
-- 🚨 EMERGÊNCIA: parar Eva de mandar follow-up pra leads do stress test
-- ============================================================================
-- Causa: o cron eva-followup roda a cada 30min e processa 50 leads por vez.
-- O stress test gerou 627 leads com phones aleatórios (alguns reais!), e
-- esses leads estão recebendo follow-up automático há ~20h.
-- Resultado: a Evolution provavelmente bloqueou a instância por spam.
--
-- COMO USAR:
--   1. Rode o BLOCO 1 imediatamente — para o stress sem deletar nada
--   2. Confira o resultado do BLOCO 2 — quantos leads/conversas existem
--   3. Pra limpar definitivo, rode depois `scripts/LIMPAR-STRESS-TEST.sql`
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 🛑 BLOCO 1 — PARAR FOLLOW-UP IMEDIATO (executar primeiro!)
-- ─────────────────────────────────────────────────────────────────────────────
-- Zera o eva_next_followup_at de todos os leads do stress test.
-- O cron na próxima rodada (30min) vai pular todos eles.
-- Esse bloco NÃO deleta nada, só desativa o follow-up.
WITH stress_phones AS (
  SELECT DISTINCT clinic_id, phone
  FROM eva_conversations
  WHERE metadata->>'evolution_message_id' LIKE 'STRESSTEST\_%' ESCAPE '\'
)
UPDATE leads l
SET
  eva_next_followup_at = NULL,
  status = CASE WHEN l.status = 'new' THEN 'lost' ELSE l.status END,
  lost_reason = COALESCE(l.lost_reason, 'stress_test_cleanup'),
  notes = COALESCE(l.notes, '') || E'\n[BLOQUEIO] Lead criado pelo stress test em 04/05/2026 — follow-up desativado.'
FROM stress_phones s
WHERE l.clinic_id = s.clinic_id AND l.phone = s.phone;

-- Confere quantos leads foram pausados
SELECT COUNT(*) AS leads_pausados
FROM leads
WHERE notes LIKE '%[BLOQUEIO]%stress_test%'
   OR lost_reason = 'stress_test_cleanup';

-- ─────────────────────────────────────────────────────────────────────────────
-- 📊 BLOCO 2 — PREVIEW (quanto vai ser deletado?)
-- ─────────────────────────────────────────────────────────────────────────────
WITH stress_phones AS (
  SELECT DISTINCT clinic_id, phone
  FROM eva_conversations
  WHERE metadata->>'evolution_message_id' LIKE 'STRESSTEST\_%' ESCAPE '\'
)
SELECT
  (SELECT COUNT(*) FROM stress_phones) AS total_telefones_afetados,
  (SELECT COUNT(*) FROM eva_conversations c
    WHERE EXISTS (SELECT 1 FROM stress_phones s
      WHERE s.clinic_id = c.clinic_id AND s.phone = c.phone))
    AS total_mensagens_a_remover,
  (SELECT COUNT(*) FROM leads l
    WHERE EXISTS (SELECT 1 FROM stress_phones s
      WHERE s.clinic_id = l.clinic_id AND s.phone = l.phone))
    AS total_leads_a_remover;

-- ─────────────────────────────────────────────────────────────────────────────
-- 🧹 LIMPEZA COMPLETA → veja `scripts/LIMPAR-STRESS-TEST.sql`
-- ─────────────────────────────────────────────────────────────────────────────
-- Esse arquivo PARA o spam. Pra DELETAR tudo do stress test, rode depois
-- o script `scripts/LIMPAR-STRESS-TEST.sql` (já vem pronto pra executar,
-- não precisa descomentar nada).
