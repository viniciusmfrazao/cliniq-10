-- ============================================================================
-- LIMPEZA: pacientes-fantasma do stress test (2332 duplicados)
-- ============================================================================
-- Contexto:
--   Os pacientes com phone = '5534991805722' e '5534984431891' na clinic
--   '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190' foram TODOS criados por testes de
--   automacao. Vamos detonar a cascata inteira (pacientes + 94 vinculos:
--   71 appointments, 7 evolutions, 4 medical_records, 5 anamneses,
--   4 injectable_applications, 1 documents_sent, 2 entradas).
--
-- Tudo dentro de uma transacao. Se algo parecer estranho, troca o COMMIT
-- final por ROLLBACK.
-- ============================================================================

BEGIN;

-- mapping dos pacientes que serao apagados
SELECT count(*) AS total_pacientes_alvo
FROM patients
WHERE clinic_id = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190'
  AND phone IN ('5534991805722', '5534984431891');

-- ----------------------------------------------------------------------------
-- 1) Filhos diretos com FK NOT NULL (precisam ir antes do paciente)
-- ----------------------------------------------------------------------------

-- injectable_points apaga junto via CASCADE quando injectable_applications cair
DELETE FROM injectable_applications
WHERE patient_id IN (
  SELECT id
  FROM patients
  WHERE clinic_id = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190'
    AND phone IN ('5534991805722', '5534984431891')
);

DELETE FROM documents_sent
WHERE patient_id IN (
  SELECT id
  FROM patients
  WHERE clinic_id = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190'
    AND phone IN ('5534991805722', '5534984431891')
);

DELETE FROM anamneses
WHERE patient_id IN (
  SELECT id
  FROM patients
  WHERE clinic_id = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190'
    AND phone IN ('5534991805722', '5534984431891')
);

DELETE FROM evolutions
WHERE patient_id IN (
  SELECT id
  FROM patients
  WHERE clinic_id = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190'
    AND phone IN ('5534991805722', '5534984431891')
);

DELETE FROM medical_records
WHERE patient_id IN (
  SELECT id
  FROM patients
  WHERE clinic_id = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190'
    AND phone IN ('5534991805722', '5534984431891')
);

DELETE FROM waiting_list
WHERE patient_id IN (
  SELECT id
  FROM patients
  WHERE clinic_id = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190'
    AND phone IN ('5534991805722', '5534984431891')
);

DELETE FROM debitos
WHERE paciente_id IN (
  SELECT id
  FROM patients
  WHERE clinic_id = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190'
    AND phone IN ('5534991805722', '5534984431891')
);

-- ----------------------------------------------------------------------------
-- 2) Filhos com FK opcional - poderiamos só zerar a referencia,
--    mas como tudo veio do stress test, deletamos os registros tambem
-- ----------------------------------------------------------------------------

-- stock_movements referencia appointments, entao precisa vir antes
DELETE FROM stock_movements
WHERE appointment_id IN (
  SELECT id
  FROM appointments
  WHERE patient_id IN (
    SELECT id
    FROM patients
    WHERE clinic_id = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190'
      AND phone IN ('5534991805722', '5534984431891')
  )
);

DELETE FROM appointments
WHERE patient_id IN (
  SELECT id
  FROM patients
  WHERE clinic_id = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190'
    AND phone IN ('5534991805722', '5534984431891')
);

DELETE FROM entradas
WHERE paciente_id IN (
  SELECT id
  FROM patients
  WHERE clinic_id = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190'
    AND phone IN ('5534991805722', '5534984431891')
);

-- eva_conversations tambem referencia patient_id
DELETE FROM eva_conversations
WHERE patient_id IN (
  SELECT id
  FROM patients
  WHERE clinic_id = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190'
    AND phone IN ('5534991805722', '5534984431891')
);

-- ----------------------------------------------------------------------------
-- 3) Finalmente, os pacientes
-- nps_responses cai automaticamente via CASCADE (se a tabela existir)
-- ----------------------------------------------------------------------------

DELETE FROM patients
WHERE clinic_id = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190'
  AND phone IN ('5534991805722', '5534984431891');

-- ----------------------------------------------------------------------------
-- 4) Verificacao final - todos devem voltar 0
-- ----------------------------------------------------------------------------

SELECT
  (SELECT count(*) FROM patients
    WHERE clinic_id = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190'
      AND phone IN ('5534991805722', '5534984431891')
  ) AS pacientes_restantes,
  (SELECT count(*) FROM stock_movements
    WHERE appointment_id IN (
      SELECT id
      FROM appointments
      WHERE patient_id IN (
        SELECT id
        FROM patients
        WHERE clinic_id = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190'
          AND phone IN ('5534991805722', '5534984431891')
      )
    )
  ) AS stock_movements_restantes,
  (SELECT count(*) FROM eva_conversations
    WHERE patient_id IN (
      SELECT id
      FROM patients
      WHERE clinic_id = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190'
        AND phone IN ('5534991805722', '5534984431891')
    )
  ) AS eva_conversations_restantes,
  (SELECT count(*) FROM appointments
    WHERE patient_id IN (
      SELECT id
      FROM patients
      WHERE clinic_id = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190'
        AND phone IN ('5534991805722', '5534984431891')
    )
  ) AS appointments_restantes,
  (SELECT count(*) FROM evolutions
    WHERE patient_id IN (
      SELECT id
      FROM patients
      WHERE clinic_id = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190'
        AND phone IN ('5534991805722', '5534984431891')
    )
  ) AS evolutions_restantes,
  (SELECT count(*) FROM medical_records
    WHERE patient_id IN (
      SELECT id
      FROM patients
      WHERE clinic_id = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190'
        AND phone IN ('5534991805722', '5534984431891')
    )
  ) AS medical_records_restantes;

-- Se os 4 voltarem 0 -> COMMIT
-- Se algo estranho                                       -> ROLLBACK
COMMIT;

-- ============================================================================
-- DEPOIS DA LIMPEZA: previnir duplicacao no futuro
-- ============================================================================
-- Recomendado rodar (FORA dessa transacao, depois do COMMIT acima):
--
--   CREATE UNIQUE INDEX IF NOT EXISTS patients_clinic_phone_unique
--     ON patients (clinic_id, phone)
--     WHERE phone IS NOT NULL AND phone <> '';
--
-- Isso garante que nunca mais vai ter 2 pacientes com mesmo phone na mesma
-- clinica. Se algum import tentar inserir duplicado, vai falhar (e a gente
-- vai querer saber).
-- ============================================================================
