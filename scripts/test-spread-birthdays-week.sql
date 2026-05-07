-- ============================================================
-- DISTRIBUIR ANIVERSÁRIOS DE TESTE NA SEMANA (28/04 → 04/05/2026)
-- ============================================================
-- ⚠️ Pre-requisito: rodar primeiro test-redirect-patient-phones.sql
-- (esse script depende de pacientes com phone = numero de teste).
--
-- Cria 14 aniversariantes simulados:
--   - 7 dias da semana (28/04, 29/04, 30/04, 01/05, 02/05, 03/05, 04/05)
--   - 1 paciente por dia em cada um dos 2 numeros = 2/dia
--   - Total: 14 pacientes com data alterada
--
-- Cria backup automatico em patients.birth_date_original.
-- Idempotente: pode rodar varias vezes.
-- Reversivel: ver secao "REVERTER" no final.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Cria coluna de backup do birth_date original
-- ------------------------------------------------------------
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS birth_date_original date;

COMMENT ON COLUMN patients.birth_date_original IS
  'Backup da data de nascimento original antes de alteracao para teste de aniversario.';


-- ------------------------------------------------------------
-- 2) Copia birth_date -> birth_date_original onde ainda nao foi
-- (preserva backup mesmo em re-runs)
-- ------------------------------------------------------------
UPDATE patients
SET birth_date_original = birth_date
WHERE birth_date_original IS NULL
  AND birth_date IS NOT NULL;


-- ------------------------------------------------------------
-- 3) Distribui aniversarios na semana 28/04 a 04/05
--    Pega os 7 primeiros pacientes (ORDER BY id) de cada numero
--    e atribui um dia diferente da semana pra cada.
--
--    Preserva o ANO original (pra a idade calculada nao virar 0).
-- ------------------------------------------------------------
WITH targets AS (
  SELECT
    id,
    phone,
    birth_date_original,
    ROW_NUMBER() OVER (PARTITION BY phone ORDER BY id) AS rn
  FROM patients
  WHERE phone IN ('5534991805722', '5534984431891')
    AND birth_date_original IS NOT NULL
)
UPDATE patients p
SET birth_date = make_date(
  EXTRACT(YEAR FROM t.birth_date_original)::int,
  CASE WHEN t.rn IN (1,2,3) THEN 4 ELSE 5 END,
  CASE
    WHEN t.rn = 1 THEN 28  -- ter 28/04
    WHEN t.rn = 2 THEN 29  -- qua 29/04
    WHEN t.rn = 3 THEN 30  -- qui 30/04
    WHEN t.rn = 4 THEN 1   -- sex 01/05
    WHEN t.rn = 5 THEN 2   -- sab 02/05
    WHEN t.rn = 6 THEN 3   -- dom 03/05
    WHEN t.rn = 7 THEN 4   -- seg 04/05
  END
)
FROM targets t
WHERE p.id = t.id AND t.rn <= 7;


-- ------------------------------------------------------------
-- 4) (opcional, mas recomendado) Limpar birthday_messages_log
-- pra os pacientes alterados, garantindo que o cron consiga
-- mandar de novo no dia certo durante o teste.
--
-- Sem isso, se o paciente ja tinha recebido aniversario neste
-- ano, a UNIQUE bloqueia o re-envio e voce nao testa.
-- ------------------------------------------------------------
DELETE FROM birthday_messages_log
WHERE patient_id IN (
  SELECT p.id
  FROM patients p
  WHERE p.phone IN ('5534991805722', '5534984431891')
    AND p.birth_date_original IS NOT NULL
)
AND year = 2026;


-- ------------------------------------------------------------
-- 5) Verificacao: lista os aniversariantes da semana
-- ------------------------------------------------------------
SELECT
  to_char(birth_date, 'DD/MM') AS dia,
  to_char(birth_date, 'TMDay') AS dia_semana,
  phone,
  name,
  EXTRACT(YEAR FROM AGE(birth_date)) AS idade_aproximada
FROM patients
WHERE phone IN ('5534991805722', '5534984431891')
  AND (
    (EXTRACT(MONTH FROM birth_date) = 4 AND EXTRACT(DAY FROM birth_date) IN (28, 29, 30))
    OR (EXTRACT(MONTH FROM birth_date) = 5 AND EXTRACT(DAY FROM birth_date) BETWEEN 1 AND 4)
  )
ORDER BY
  EXTRACT(MONTH FROM birth_date),
  EXTRACT(DAY FROM birth_date),
  phone;


-- ============================================================
-- 🔁 COMO REVERTER (rodar quando for pra producao real)
-- ============================================================
-- Restaura todas as datas originais:
--
--   UPDATE patients
--   SET birth_date = birth_date_original
--   WHERE birth_date_original IS NOT NULL;
--
--   -- (opcional) limpar backup depois de confirmar:
--   UPDATE patients SET birth_date_original = NULL;
--
-- ============================================================
