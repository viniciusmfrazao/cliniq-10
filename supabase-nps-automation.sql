-- ============================================================
-- AUTOMAÇÃO DE NPS PÓS-ATENDIMENTO
-- ============================================================
-- Roda este script UMA VEZ no SQL Editor do Supabase.
-- Idempotente: pode rodar de novo sem quebrar.
--
-- Depende de:
--   * patients
--   * appointments (com status 'completed' e nps_sent_at do supabase-saas-whatsapp.sql)
--   * procedures
--   * users (profissionais)
--   * clinic_automations (vem de supabase-saas-whatsapp.sql)
--   * clinic_whatsapp (vem de supabase-saas-whatsapp.sql)
-- ============================================================

-- ------------------------------------------------------------
-- 1) Tabela de respostas — registra envio + resposta NPS
-- ------------------------------------------------------------
-- Cada appointment gera no máximo 1 nps_responses. A coluna
-- replied_at + score fica NULL até o paciente responder; a captura
-- da resposta é feita no webhook receiver (Evolution) procurando
-- mensagem "1".."5" enviada por quem recebeu o NPS nas últimas 48h.
CREATE TABLE IF NOT EXISTS nps_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  professional_id uuid REFERENCES users(id) ON DELETE SET NULL,
  procedure_name text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  replied_at timestamptz,
  score smallint CHECK (score IS NULL OR (score >= 1 AND score <= 5)),
  comment text,
  status text NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'error', 'skipped', 'test', 'replied')),
  error text,
  message text,
  channel text NOT NULL DEFAULT 'whatsapp',
  -- 1 NPS por appointment
  CONSTRAINT nps_responses_appointment_unique UNIQUE (appointment_id)
);

CREATE INDEX IF NOT EXISTS idx_nps_clinic_sent
  ON nps_responses (clinic_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_nps_patient_sent
  ON nps_responses (patient_id, sent_at DESC);

-- Pra captura automática da resposta no webhook: encontrar NPS sem resposta
-- enviado nas últimas 48h pra um determinado patient_id da clínica.
CREATE INDEX IF NOT EXISTS idx_nps_pending_reply
  ON nps_responses (clinic_id, patient_id, sent_at DESC)
  WHERE replied_at IS NULL;

ALTER TABLE nps_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic users read nps" ON nps_responses;
CREATE POLICY "Clinic users read nps" ON nps_responses
  FOR SELECT USING (
    clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid())
    OR is_super_admin(auth.uid())
  );

-- Insert/update vai pelo service_role no cron e webhook — não exposto pra cliente.


-- ------------------------------------------------------------
-- 2) View: appointments completed de ontem, sem NPS enviado
-- ------------------------------------------------------------
-- O cron filtra essa view por clinic_id. "Ontem" no fuso BRT.
CREATE OR REPLACE VIEW appointments_nps_pending AS
SELECT
  a.id              AS appointment_id,
  a.clinic_id,
  a.patient_id,
  a.professional_id,
  a.procedure_id,
  a.start_time,
  a.end_time,
  pr.name           AS procedure_name
FROM appointments a
LEFT JOIN procedures pr ON pr.id = a.procedure_id
WHERE a.status = 'completed'
  AND a.patient_id IS NOT NULL
  AND a.nps_sent_at IS NULL
  -- janela: ontem (00h-23h59 BRT) — o cron tb confere antes de mandar
  AND a.start_time >= (date_trunc('day', (now() AT TIME ZONE 'America/Sao_Paulo')) - interval '1 day') AT TIME ZONE 'America/Sao_Paulo'
  AND a.start_time <  (date_trunc('day', (now() AT TIME ZONE 'America/Sao_Paulo'))) AT TIME ZONE 'America/Sao_Paulo';

COMMENT ON VIEW appointments_nps_pending IS
  'Atendimentos concluídos ontem (BRT) que ainda não receberam NPS.';


-- ------------------------------------------------------------
-- 3) Sugestão padrão de template pra clínicas sem template_nps
-- ------------------------------------------------------------
UPDATE clinic_automations
SET template_nps =
'Oi {{primeiro_nome}}! 💕

Aqui é da {{clinica}}. Como foi seu atendimento ontem com {{profissional}}?

Responde de 1 a 5:
1️⃣ Péssimo
2️⃣ Ruim
3️⃣ Regular
4️⃣ Bom
5️⃣ Excelente

Sua opinião é super importante pra gente! 🙏'
WHERE template_nps IS NULL OR template_nps = '';


-- ------------------------------------------------------------
-- Verificação rápida
-- ------------------------------------------------------------
SELECT 'nps_responses' as tabela, count(*) FROM nps_responses
UNION ALL SELECT 'appointments_nps_pending (view)', count(*) FROM appointments_nps_pending;
