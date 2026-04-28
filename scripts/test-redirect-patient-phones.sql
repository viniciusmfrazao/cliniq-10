-- ============================================================
-- REDIRECIONAR TELEFONES DE PACIENTES PARA NÚMEROS DE TESTE
-- ============================================================
-- ⚠️ USE COM CUIDADO. Sobrescreve telefones reais de pacientes
-- pra Vinicius e Sarah poderem validar fluxos automatizados.
--
-- Cria backup automático em patients.phone_original.
-- Idempotente: pode rodar várias vezes sem zoar o backup.
-- Reversível: ver seção "REVERTER" no final.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Cria coluna de backup do telefone original
-- ------------------------------------------------------------
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS phone_original text;

COMMENT ON COLUMN patients.phone_original IS
  'Backup do telefone original antes do redirecionamento de teste. Usar para reverter quando for pra producao real.';


-- ------------------------------------------------------------
-- 2) Copia phone -> phone_original APENAS onde ainda nao foi feito
-- (preserva o backup mesmo em re-runs)
-- ------------------------------------------------------------
UPDATE patients
SET phone_original = phone
WHERE phone_original IS NULL
  AND phone IS NOT NULL
  AND phone <> '';


-- ------------------------------------------------------------
-- 3) Redireciona telefones: distribuicao 50/50 entre os 2 numeros
--   - Vinicius: 5534991805722  (pacientes em posicao PAR)
--   - Sarah:    5534984431891  (pacientes em posicao IMPAR)
--
-- A distribuicao usa ROW_NUMBER() ordenado por id (estavel entre runs).
-- ------------------------------------------------------------
WITH numbered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY id) AS rn
  FROM patients
  WHERE phone_original IS NOT NULL  -- so redireciona quem tinha telefone real
)
UPDATE patients p
SET phone = CASE
  WHEN n.rn % 2 = 0 THEN '5534991805722'  -- Vinicius
  ELSE                  '5534984431891'   -- Sarah
END
FROM numbered n
WHERE p.id = n.id;


-- ------------------------------------------------------------
-- 4) Verificacao
-- ------------------------------------------------------------
SELECT
  phone,
  count(*) AS qtd_pacientes,
  count(DISTINCT clinic_id) AS qtd_clinicas
FROM patients
WHERE phone IS NOT NULL
GROUP BY phone
ORDER BY qtd_pacientes DESC;


-- ============================================================
-- 🔁 COMO REVERTER (rodar quando for pra producao real)
-- ============================================================
-- Restaura todos os telefones originais e zera o backup:
--
--   UPDATE patients
--   SET phone = phone_original
--   WHERE phone_original IS NOT NULL;
--
--   -- (opcional) limpar backup depois de confirmar:
--   UPDATE patients SET phone_original = NULL;
--
-- ============================================================
