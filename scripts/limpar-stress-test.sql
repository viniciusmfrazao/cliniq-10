-- ============================================================
-- LIMPEZA DOS LEADS/CONVERSAS GERADOS PELO STRESS TEST
-- ============================================================
-- O script de stress test (stress-test/03-webhook.js) gera mensagens
-- com `evolution_message_id` no formato `STRESSTEST_<timestamp>_<rand>`.
-- Essa marca fica gravada em `eva_conversations.metadata->>'evolution_message_id'`,
-- então a gente identifica todo telefone que entrou pelo teste e remove
-- TUDO em cascata (conversas + leads).
--
-- COMO USAR:
--   1. Rode primeiro a CTE de SELECT (linha "PREVIEW") pra ver o impacto
--   2. Confirme os números (deve bater com o que o k6 mostrou)
--   3. Descomente os DELETE e rode tudo de novo
-- ============================================================

-- ─── PREVIEW (sem deletar nada) ─────────────────────────────
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
      WHERE s.clinic_id = l.clinic_id AND s.phone = l.phone)
    AND l.source = 'whatsapp'
    AND l.created_at > NOW() - INTERVAL '6 hours')
    AS total_leads_a_remover;

-- ─── DELETE (descomente quando confirmar os números) ────────
-- BEGIN;
--
-- WITH stress_phones AS (
--   SELECT DISTINCT clinic_id, phone
--   FROM eva_conversations
--   WHERE metadata->>'evolution_message_id' LIKE 'STRESSTEST\_%' ESCAPE '\'
-- )
-- DELETE FROM eva_conversations c
-- USING stress_phones s
-- WHERE c.clinic_id = s.clinic_id AND c.phone = s.phone;
--
-- -- Deleta os leads correspondentes (só os criados pelo webhook nas últimas
-- -- 6h, com source='whatsapp', pra nunca tocar em lead manual real).
-- WITH stress_phones AS (
--   SELECT DISTINCT clinic_id, phone
--   FROM (
--     SELECT clinic_id, phone FROM eva_conversations
--     WHERE metadata->>'evolution_message_id' LIKE 'STRESSTEST\_%' ESCAPE '\'
--     UNION
--     -- Fallback: caso o eva_conversations já tenha sido deletado acima,
--     -- pega leads criados em janela do teste com source whatsapp e padrão
--     -- de telefone gerado (DDD 11–99 + 9XXXXXXXX = formato exato do k6).
--     SELECT clinic_id, phone FROM leads
--     WHERE source = 'whatsapp'
--       AND created_at > NOW() - INTERVAL '6 hours'
--       AND phone ~ '^55[1-9][0-9]9[0-9]{8}$'
--       AND name IN (
--         'Maria Silva','Ana Souza','Beatriz Costa','Carla Mendes','Daniela Reis',
--         'Eduarda Lima','Fernanda Oliveira','Gabriela Santos','Helena Pereira',
--         'Isabela Almeida','Juliana Carvalho','Karen Ferreira','Larissa Rodrigues',
--         'Mariana Gomes','Natalia Ribeiro','Patricia Martins','Renata Araújo',
--         'Sabrina Barbosa','Tatiana Cardoso','Vanessa Nunes',
--         'Lead WhatsApp'
--       )
--   ) x
-- )
-- DELETE FROM leads l
-- USING stress_phones s
-- WHERE l.clinic_id = s.clinic_id
--   AND l.phone = s.phone
--   AND l.source = 'whatsapp'
--   AND l.created_at > NOW() - INTERVAL '6 hours';
--
-- COMMIT;
