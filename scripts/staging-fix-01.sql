-- ============================================================================
-- PATCH 01 — corrige falta de whatsapp_opt_in em patients
-- ============================================================================
-- Roda ISTO no SQL Editor do staging:
--   https://supabase.com/dashboard/project/folcgzoxfpelogspivot/sql/new
--
-- O que faz:
--   1. Adiciona a coluna que faltava em patients
--   2. Recria as views que dependiam dela
--   3. Confirma que está tudo OK
-- ============================================================================

-- 1) Adiciona coluna que faltava
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS phone_original  text;


-- 2) Recria views (não tinham sido criadas porque o script parou no erro)

-- 2.1 eva_followup_queue
CREATE OR REPLACE VIEW eva_followup_queue AS
SELECT
  l.clinic_id,
  c.name AS clinica,
  l.id AS lead_id,
  l.name AS lead_nome,
  l.phone,
  l.status,
  l.interest,
  l.eva_followup_count,
  l.eva_next_followup_at,
  l.last_whatsapp_at,
  l.last_contact_at,
  CASE
    WHEN l.eva_next_followup_at IS NULL THEN 'parado'
    WHEN l.eva_next_followup_at <= now() THEN 'pronto'
    ELSE 'agendado'
  END AS estado_followup,
  CASE l.eva_followup_count
    WHEN 0 THEN 'aguardando_2h'
    WHEN 1 THEN 'aguardando_1d_apos_2h'
    WHEN 2 THEN 'aguardando_2d_apos_1d'
    ELSE 'esgotou'
  END AS proximo_estagio
FROM leads l
LEFT JOIN clinics c ON c.id = l.clinic_id
WHERE l.status NOT IN ('lost','converted')
  AND l.whatsapp_opt_in IS DISTINCT FROM false;


-- 2.2 admin_metrics
CREATE OR REPLACE VIEW admin_metrics AS
SELECT
  (SELECT COUNT(*) FROM clinics WHERE deleted_at IS NULL) AS total_clinics,
  (SELECT COUNT(*) FROM clinics WHERE deleted_at IS NULL AND trial_ends_at > now()) AS clinics_on_trial,
  (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL) AS total_users,
  (SELECT COUNT(*) FROM patients) AS total_patients,
  (SELECT COUNT(*) FROM appointments WHERE start_time::date = current_date) AS appointments_today,
  (SELECT COUNT(*) FROM leads WHERE created_at >= date_trunc('month', now())) AS leads_this_month;


-- 2.3 appointments_nps_pending
CREATE OR REPLACE VIEW appointments_nps_pending AS
SELECT
  a.id AS appointment_id,
  a.clinic_id,
  a.patient_id,
  a.professional_id,
  a.procedure_id,
  a.start_time,
  a.end_time,
  pr.name AS procedure_name
FROM appointments a
LEFT JOIN procedures pr ON pr.id = a.procedure_id
WHERE a.status = 'completed'
  AND a.nps_sent_at IS NULL
  AND a.start_time < now()
  AND a.start_time >= now() - interval '7 days';


-- 2.4 birthday_today_pending (ESTA é a que falhou — agora tem a coluna)
CREATE OR REPLACE VIEW birthday_today_pending AS
SELECT
  p.id AS patient_id,
  p.clinic_id,
  p.name,
  p.phone,
  p.birth_date,
  p.whatsapp_opt_in,
  EXTRACT(YEAR FROM age(p.birth_date))::integer AS age,
  EXTRACT(YEAR FROM now())::integer AS year
FROM patients p
WHERE p.birth_date IS NOT NULL
  AND EXTRACT(MONTH FROM p.birth_date) = EXTRACT(MONTH FROM now())
  AND EXTRACT(DAY FROM p.birth_date) = EXTRACT(DAY FROM now())
  AND p.whatsapp_opt_in = true
  AND NOT EXISTS (
    SELECT 1 FROM birthday_messages_log bl
    WHERE bl.patient_id = p.id
      AND bl.year = EXTRACT(YEAR FROM now())::integer
      AND bl.status = 'sent'
  );


-- 2.5 patient_last_completed
CREATE OR REPLACE VIEW patient_last_completed AS
SELECT DISTINCT ON (a.patient_id)
  a.patient_id,
  a.clinic_id,
  a.start_time AS last_completed_at,
  a.procedure_id,
  pr.name AS procedure_name,
  EXTRACT(DAY FROM now() - a.start_time)::integer AS days_since_last
FROM appointments a
LEFT JOIN procedures pr ON pr.id = a.procedure_id
WHERE a.status = 'completed'
ORDER BY a.patient_id, a.start_time DESC;


-- ============================================================================
-- 3) STORAGE BUCKETS (caso o script tenha parado antes deles)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('patient-photos', 'patient-photos', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('clinic-logos', 'clinic-logos', true)
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 4) RLS nas tabelas novas (caso o script tenha parado antes)
-- ============================================================================
ALTER TABLE app_settings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_whatsapp           ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_automations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_settings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_message_templates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE nps_responses             ENABLE ROW LEVEL SECURITY;
ALTER TABLE evolution_webhook_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE birthday_messages_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE recall_messages_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_interactions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE anamnesis_templates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE anamnesis_responses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE metas_financeiras         ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_products      ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_schedules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_unavailability ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles_permissions         ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
  policy_tables text[] := ARRAY[
    'clinic_whatsapp','clinic_automations','crm_settings','crm_message_templates',
    'nps_responses','birthday_messages_log','recall_messages_log',
    'lead_interactions','anamnesis_templates','anamnesis_responses',
    'metas_financeiras','chat_messages','appointment_products',
    'professional_schedules','professional_unavailability','subscriptions',
    'roles_permissions'
  ];
BEGIN
  FOREACH t IN ARRAY policy_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Clinic users manage %I" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "Clinic users manage %I" ON public.%I FOR ALL USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid())) WITH CHECK (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()))',
      t, t
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Super admins view webhook logs" ON evolution_webhook_logs;
CREATE POLICY "Super admins view webhook logs" ON evolution_webhook_logs
  FOR SELECT USING (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Service role inserts webhook logs" ON evolution_webhook_logs;
CREATE POLICY "Service role inserts webhook logs" ON evolution_webhook_logs
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Super admins manage app_settings" ON app_settings;
CREATE POLICY "Super admins manage app_settings" ON app_settings
  FOR ALL USING (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Anyone view active plans" ON plans;
CREATE POLICY "Anyone view active plans" ON plans
  FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "Super admins manage plans" ON plans;
CREATE POLICY "Super admins manage plans" ON plans
  FOR ALL USING (is_super_admin(auth.uid()));


-- ============================================================================
-- 5) DADOS INICIAIS (caso o script tenha parado antes)
-- ============================================================================
INSERT INTO plans (name, price_monthly, price_yearly, modules, max_professionals, active)
VALUES
  ('starter',     199,  1990, ARRAY['agenda','patients','dashboard']::module_name[], 2, true),
  ('pro',         399,  3990, ARRAY['agenda','patients','medical_records','documents','crm','dashboard']::module_name[], 5, true),
  ('clinic_plus', 699,  6990, ARRAY['agenda','patients','medical_records','injectable_maps','stock','documents','eva_ai','whatsapp','crm','dashboard']::module_name[], NULL, true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO app_settings (key, value, is_secret, description) VALUES
  ('eva_engine',        'edge', false, 'Motor de IA da Eva: edge | n8n'),
  ('eva_edge_url',      '',     false, 'URL da Edge Function (preencher após deploy)'),
  ('eva_internal_secret','',    true,  'Secret interno app -> edge (opcional)'),
  ('evolution_url',     '',     false, 'URL base da Evolution API (staging)'),
  ('evolution_master_key', '',  true,  'Master key da Evolution API (staging)'),
  ('environment',       'staging', false, 'Identificador do ambiente: production | staging')
ON CONFLICT (key) DO NOTHING;


-- ============================================================================
-- 6) VERIFICAÇÃO FINAL
-- ============================================================================
SELECT
  'tabelas' AS tipo, COUNT(*)::int AS qtd
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
UNION ALL
SELECT 'views', COUNT(*)::int FROM information_schema.views WHERE table_schema = 'public'
UNION ALL
SELECT 'enums', COUNT(*)::int FROM pg_type WHERE typtype = 'e' AND typnamespace = 'public'::regnamespace
UNION ALL
SELECT 'funcoes', COUNT(*)::int FROM information_schema.routines WHERE routine_schema='public' AND routine_type='FUNCTION';

-- Esperado:
--   tabelas: ~46
--   views:    5
--   enums:   11
--   funcoes: 15+
