-- ============================================================
-- FIXTURES DE TESTE PARA AUTOMACOES (Recall + Lembrete D-1 + NPS)
-- ============================================================
-- ⚠️ Pre-requisito: rodar test-redirect-patient-phones.sql antes
-- (para os pacientes terem phone redirecionado para os 2 numeros).
--
-- Cria 12 appointments fake na Clinica Sarah Pina:
--   - 4 RECALL  (status=completed, start_time = hoje - 180 dias)
--   - 4 D-1     (status=scheduled, start_time = amanha)
--   - 4 NPS     (status=completed, start_time = ontem)
--
-- Cada bloco insere 2 pacientes do Vinicius + 2 da Sarah.
-- Todos marcados com notes='[FIXTURE-XYZ]' pra fácil reversao.
-- Idempotente: pode rodar várias vezes (deleta fixtures previos antes).
-- ============================================================


-- ------------------------------------------------------------
-- BLOCO 0: pre-checagem (rodar antes pra confirmar dados base)
-- ------------------------------------------------------------
SELECT
  (SELECT id FROM clinics WHERE name ILIKE '%Sarah Pina%' LIMIT 1) AS clinic_id,
  (SELECT name FROM clinics WHERE name ILIKE '%Sarah Pina%' LIMIT 1) AS clinic_name,
  (SELECT count(*) FROM users WHERE clinic_id = (SELECT id FROM clinics WHERE name ILIKE '%Sarah Pina%' LIMIT 1)) AS profissionais_disponiveis,
  (SELECT count(*) FROM procedures WHERE clinic_id = (SELECT id FROM clinics WHERE name ILIKE '%Sarah Pina%' LIMIT 1) AND active = true) AS procedimentos_ativos,
  (SELECT count(*) FROM patients WHERE phone = '5534991805722') AS pacientes_vinicius,
  (SELECT count(*) FROM patients WHERE phone = '5534984431891') AS pacientes_sarah;


-- ------------------------------------------------------------
-- BLOCO 1: limpar fixtures antigos (idempotente)
-- ------------------------------------------------------------
-- Deleta NPS responses ligadas a fixtures (FK ON DELETE SET NULL ja cobre,
-- mas vamos limpar antes do delete pra evitar log orfão).
DELETE FROM nps_responses
WHERE appointment_id IN (
  SELECT id FROM appointments WHERE notes LIKE '[FIXTURE-%'
);

DELETE FROM appointments WHERE notes LIKE '[FIXTURE-%';


-- ------------------------------------------------------------
-- BLOCO 2: inserir fixtures dos 3 cenarios
-- ------------------------------------------------------------
WITH
clinic AS (
  SELECT id FROM clinics WHERE name ILIKE '%Sarah Pina%' LIMIT 1
),
prof AS (
  SELECT u.id FROM users u
  WHERE u.clinic_id = (SELECT id FROM clinic) LIMIT 1
),
proc AS (
  SELECT p.id FROM procedures p
  WHERE p.clinic_id = (SELECT id FROM clinic) AND p.active = true LIMIT 1
),
pacientes_vinicius AS (
  SELECT id, name, ROW_NUMBER() OVER (ORDER BY id) AS rn
  FROM patients
  WHERE phone = '5534991805722'
    AND clinic_id = (SELECT id FROM clinic)
  ORDER BY id LIMIT 6
),
pacientes_sarah AS (
  SELECT id, name, ROW_NUMBER() OVER (ORDER BY id) AS rn
  FROM patients
  WHERE phone = '5534984431891'
    AND clinic_id = (SELECT id FROM clinic)
  ORDER BY id LIMIT 6
),
todos_pacientes AS (
  -- Cada paciente recebe 1 cenario:
  -- rn=1,2 -> RECALL (180 dias atras)
  -- rn=3,4 -> D-1 (amanha)
  -- rn=5,6 -> NPS (ontem, completed)
  SELECT id, rn, '5534991805722' AS phone FROM pacientes_vinicius
  UNION ALL
  SELECT id, rn, '5534984431891' AS phone FROM pacientes_sarah
)
INSERT INTO appointments (
  clinic_id, patient_id, professional_id, procedure_id,
  start_time, end_time, status, notes, price
)
SELECT
  (SELECT id FROM clinic),
  tp.id,
  (SELECT id FROM prof),
  (SELECT id FROM proc),
  CASE
    WHEN tp.rn IN (1,2) THEN (now() - interval '180 days')                    -- RECALL
    WHEN tp.rn IN (3,4) THEN (date_trunc('day', (now() AT TIME ZONE 'America/Sao_Paulo'))::date + 1 + time '14:00') AT TIME ZONE 'America/Sao_Paulo'  -- D-1 (amanha 14h BRT)
    WHEN tp.rn IN (5,6) THEN (date_trunc('day', (now() AT TIME ZONE 'America/Sao_Paulo'))::date - 1 + time '15:00') AT TIME ZONE 'America/Sao_Paulo'  -- NPS (ontem 15h BRT)
  END AS start_time,
  CASE
    WHEN tp.rn IN (1,2) THEN (now() - interval '180 days' + interval '1 hour')
    WHEN tp.rn IN (3,4) THEN (date_trunc('day', (now() AT TIME ZONE 'America/Sao_Paulo'))::date + 1 + time '15:00') AT TIME ZONE 'America/Sao_Paulo'
    WHEN tp.rn IN (5,6) THEN (date_trunc('day', (now() AT TIME ZONE 'America/Sao_Paulo'))::date - 1 + time '16:00') AT TIME ZONE 'America/Sao_Paulo'
  END AS end_time,
  CASE
    WHEN tp.rn IN (1,2,5,6) THEN 'completed'::appointment_status
    WHEN tp.rn IN (3,4)     THEN 'scheduled'::appointment_status
  END AS status,
  CASE
    WHEN tp.rn IN (1,2) THEN '[FIXTURE-RECALL]'
    WHEN tp.rn IN (3,4) THEN '[FIXTURE-D1]'
    WHEN tp.rn IN (5,6) THEN '[FIXTURE-NPS]'
  END AS notes,
  100.00 AS price
FROM todos_pacientes tp;


-- ------------------------------------------------------------
-- BLOCO 3: limpar logs antigos pra esses pacientes
-- ------------------------------------------------------------
-- Garante que o Recall consegue mandar (sem cooldown bloqueando)
DELETE FROM recall_messages_log
WHERE patient_id IN (
  SELECT patient_id FROM appointments
  WHERE notes LIKE '[FIXTURE-%'
);


-- ------------------------------------------------------------
-- BLOCO 4: verificacao
-- ------------------------------------------------------------
SELECT
  notes AS cenario,
  to_char(start_time AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') AS data_hora_br,
  status,
  pa.name AS paciente,
  pa.phone AS phone_destino
FROM appointments a
JOIN patients pa ON pa.id = a.patient_id
WHERE a.notes LIKE '[FIXTURE-%'
ORDER BY a.notes, a.start_time, pa.phone;


-- ============================================================
-- 🔁 COMO REVERTER (rodar quando terminar os testes)
-- ============================================================
-- Apaga todos os appointments fake + logs relacionados:
--
--   DELETE FROM nps_responses
--   WHERE appointment_id IN (
--     SELECT id FROM appointments WHERE notes LIKE '[FIXTURE-%'
--   );
--
--   DELETE FROM recall_messages_log
--   WHERE patient_id IN (
--     SELECT patient_id FROM appointments WHERE notes LIKE '[FIXTURE-%'
--   );
--
--   DELETE FROM appointments WHERE notes LIKE '[FIXTURE-%';
--
-- ============================================================
