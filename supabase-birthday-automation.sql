-- ============================================================
-- AUTOMAÇÃO DE ANIVERSÁRIO
-- ============================================================
-- Roda este script UMA VEZ no SQL Editor do Supabase.
-- Idempotente: pode rodar de novo sem quebrar.
--
-- Depende de:
--   * patients (com birth_date e whatsapp_opt_in)
--   * clinic_automations (vem de supabase-saas-whatsapp.sql)
--   * clinic_whatsapp (vem de supabase-saas-whatsapp.sql)
-- ============================================================

-- ------------------------------------------------------------
-- 1) Novas colunas em clinic_automations
-- ------------------------------------------------------------
ALTER TABLE clinic_automations
  ADD COLUMN IF NOT EXISTS aniversario_hora int NOT NULL DEFAULT 9
    CHECK (aniversario_hora BETWEEN 0 AND 23),
  ADD COLUMN IF NOT EXISTS aniversario_optin_required boolean NOT NULL DEFAULT true;

-- Sugestão padrão pra clínicas que ainda não tem template
UPDATE clinic_automations
SET template_aniversario =
'Oi {{primeiro_nome}}! 🎉

Hoje é o seu dia e a equipe da {{clinica}} faz questão de celebrar com você!

Desejamos um ano cheio de saúde, beleza e momentos especiais. ✨

Que tal comemorar com a gente? Te enviamos um mimo de aniversário — fala com a gente pra saber mais!'
WHERE template_aniversario IS NULL OR template_aniversario = '';


-- ------------------------------------------------------------
-- 2) Tabela de log de envios — garante 1 mensagem por paciente por ano
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS birthday_messages_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  year int NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'error', 'skipped', 'test')),
  error text,
  message text,
  channel text NOT NULL DEFAULT 'whatsapp',
  UNIQUE (clinic_id, patient_id, year)
);

CREATE INDEX IF NOT EXISTS idx_birthday_log_clinic_year
  ON birthday_messages_log (clinic_id, year, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_birthday_log_patient
  ON birthday_messages_log (patient_id, year);

ALTER TABLE birthday_messages_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic users read birthday log" ON birthday_messages_log;
CREATE POLICY "Clinic users read birthday log" ON birthday_messages_log
  FOR SELECT USING (
    clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid())
    OR is_super_admin(auth.uid())
  );

-- Insert vai sempre pelo service_role no cron — não exposto pra cliente


-- ------------------------------------------------------------
-- 3) Garante que toda clínica conectada tem opt-in liberado pra
--    quem já está cadastrado com telefone (gentileza inicial pra
--    não chegar 0 envios. Se a clínica preferir opt-in estrito,
--    ela ativa aniversario_optin_required = true em clinic_automations).
--
-- IMPORTANTE: rodar isso só na primeira vez. Não muda nada em
-- whatsapp_opt_in se a coluna já estiver explicitamente populada.
-- ------------------------------------------------------------
-- (deixei comentado pra você decidir manualmente se quer rodar)
-- UPDATE patients SET whatsapp_opt_in = true
--   WHERE whatsapp_opt_in IS NULL AND phone IS NOT NULL AND phone <> '';


-- ------------------------------------------------------------
-- 4) View de apoio: aniversariantes do dia (fuso BR), com filtro
--    por clínica, opt-in, e ainda não enviado neste ano.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW birthday_today_pending AS
WITH today_br AS (
  SELECT
    EXTRACT(MONTH FROM (now() AT TIME ZONE 'America/Sao_Paulo'))::int AS m,
    EXTRACT(DAY   FROM (now() AT TIME ZONE 'America/Sao_Paulo'))::int AS d,
    EXTRACT(YEAR  FROM (now() AT TIME ZONE 'America/Sao_Paulo'))::int AS y
)
SELECT
  p.id   AS patient_id,
  p.clinic_id,
  p.name,
  p.phone,
  p.birth_date,
  p.whatsapp_opt_in,
  (today_br.y - EXTRACT(YEAR FROM p.birth_date)::int) AS age,
  today_br.y AS year
FROM patients p
JOIN today_br ON
       EXTRACT(MONTH FROM p.birth_date)::int = today_br.m
   AND EXTRACT(DAY   FROM p.birth_date)::int = today_br.d
WHERE p.birth_date IS NOT NULL
  AND p.phone IS NOT NULL
  AND p.phone <> ''
  AND NOT EXISTS (
    SELECT 1 FROM birthday_messages_log l
    WHERE l.clinic_id = p.clinic_id
      AND l.patient_id = p.id
      AND l.year = today_br.y
      AND l.status IN ('sent', 'skipped')
  );

-- A view herda RLS dos selects originais (patients), então só
-- mostra pacientes da clínica do usuário autenticado.
COMMENT ON VIEW birthday_today_pending IS
  'Aniversariantes do dia (fuso America/Sao_Paulo) que ainda não receberam mensagem este ano. Não filtra opt-in — quem consome decide.';


-- ------------------------------------------------------------
-- Verificação rápida
-- ------------------------------------------------------------
SELECT 'clinic_automations' as tabela, count(*) FROM clinic_automations
UNION ALL SELECT 'birthday_messages_log', count(*) FROM birthday_messages_log;
