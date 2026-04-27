-- ============================================================
-- AUTOMAÇÃO DE RECALL DE INATIVOS
-- ============================================================
-- Roda este script UMA VEZ no SQL Editor do Supabase.
-- Idempotente: pode rodar de novo sem quebrar.
--
-- Depende de:
--   * patients
--   * appointments (com status 'completed')
--   * procedures
--   * clinic_automations (vem de supabase-saas-whatsapp.sql)
--   * clinic_whatsapp (vem de supabase-saas-whatsapp.sql)
-- ============================================================

-- ------------------------------------------------------------
-- 1) Tabela de log de envios — registra cada recall enviado
-- ------------------------------------------------------------
-- Diferente do aniversário (1x/ano), aqui pode ter múltiplos envios
-- pra um mesmo paciente em ciclos diferentes (ex.: paciente sumiu,
-- recebeu recall, voltou, sumiu de novo). A janela mínima entre
-- envios é controlada na lógica do cron (default 90 dias).
CREATE TABLE IF NOT EXISTS recall_messages_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  last_visit_at timestamptz,         -- data da última consulta na hora do envio
  days_inactive int,                  -- dias desde a última visita
  procedure_name text,                -- último procedimento conhecido
  status text NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'error', 'skipped', 'test')),
  error text,
  message text,
  channel text NOT NULL DEFAULT 'whatsapp'
);

CREATE INDEX IF NOT EXISTS idx_recall_log_clinic_sent
  ON recall_messages_log (clinic_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_recall_log_patient_sent
  ON recall_messages_log (patient_id, sent_at DESC);

ALTER TABLE recall_messages_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic users read recall log" ON recall_messages_log;
CREATE POLICY "Clinic users read recall log" ON recall_messages_log
  FOR SELECT USING (
    clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid())
    OR is_super_admin(auth.uid())
  );

-- Insert vai sempre pelo service_role no cron — não exposto pra cliente


-- ------------------------------------------------------------
-- 2) View: última consulta concluída por paciente
-- ------------------------------------------------------------
-- DISTINCT ON pega só a linha mais recente por patient_id.
-- Inclui procedure_name diretamente pra o cron não precisar de mais um join.
CREATE OR REPLACE VIEW patient_last_completed AS
SELECT DISTINCT ON (a.patient_id)
  a.patient_id,
  a.clinic_id,
  a.start_time     AS last_completed_at,
  a.procedure_id,
  pr.name          AS procedure_name,
  EXTRACT(DAY FROM (now() - a.start_time))::int AS days_since_last
FROM appointments a
LEFT JOIN procedures pr ON pr.id = a.procedure_id
WHERE a.status = 'completed'
  AND a.patient_id IS NOT NULL
ORDER BY a.patient_id, a.start_time DESC;

COMMENT ON VIEW patient_last_completed IS
  'Última consulta concluída por paciente, com nome do procedimento e dias desde a última visita.';


-- ------------------------------------------------------------
-- 3) Sugestão padrão pra clínicas que ainda não tem template
-- ------------------------------------------------------------
UPDATE clinic_automations
SET template_recall =
'Oi {{primeiro_nome}}! 💕

Faz {{tempo}} que você esteve aqui na {{clinica}} — sentimos sua falta!

Que tal voltar pra cuidar de você? Lembramos que da última vez foi {{ultimo_procedimento}} — e o resultado fica ainda melhor com manutenção. ✨

Posso te enviar nossos horários disponíveis?'
WHERE template_recall IS NULL OR template_recall = '';


-- ------------------------------------------------------------
-- Verificação rápida
-- ------------------------------------------------------------
SELECT 'recall_messages_log' as tabela, count(*) FROM recall_messages_log
UNION ALL SELECT 'patient_last_completed (view)', count(*) FROM patient_last_completed;
