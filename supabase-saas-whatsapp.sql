-- ============================================================
-- FASE 1 — Fundação Multi-Tenant para WhatsApp SaaS
-- ============================================================
-- Roda este script UMA VEZ no SQL Editor do Supabase.
-- É idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================

-- ------------------------------------------------------------
-- 1) app_settings (config global do SaaS, só super_admin acessa)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text,
  is_secret boolean NOT NULL DEFAULT false,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins read app_settings" ON app_settings;
CREATE POLICY "Super admins read app_settings" ON app_settings
  FOR SELECT USING (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admins write app_settings" ON app_settings;
CREATE POLICY "Super admins write app_settings" ON app_settings
  FOR ALL USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Sementes (preencher depois pela tela /admin/evolution)
INSERT INTO app_settings (key, value, is_secret, description) VALUES
  ('evolution_url',            '', false, 'URL base da Evolution API (ex: https://evo.cliniq.app)'),
  ('evolution_master_key',     '', true,  'API Key master da Evolution (única, vale pra todas as instances)'),
  ('evolution_webhook_secret', '', true,  'Secret usado pra validar webhooks que chegam da Evolution'),
  ('n8n_donna_url',            '', false, 'URL do webhook do workflow Donna v4 no N8N'),
  ('n8n_donna_secret',         '', true,  'Secret enviado em header pra autenticar chamadas pra Donna')
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------
-- 2) clinic_whatsapp (1 número por clínica)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clinic_whatsapp (
  clinic_id uuid PRIMARY KEY REFERENCES clinics(id) ON DELETE CASCADE,
  instance_name text NOT NULL UNIQUE,
  phone_number text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','qr_pending','connected','disconnected','error')),
  qr_code text,
  qr_expires_at timestamptz,
  connected_at timestamptz,
  last_event_at timestamptz,
  webhook_token text NOT NULL DEFAULT gen_random_uuid()::text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinic_whatsapp_instance ON clinic_whatsapp(instance_name);
CREATE INDEX IF NOT EXISTS idx_clinic_whatsapp_status   ON clinic_whatsapp(status);

ALTER TABLE clinic_whatsapp ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic users see own whatsapp" ON clinic_whatsapp;
CREATE POLICY "Clinic users see own whatsapp" ON clinic_whatsapp
  FOR SELECT USING (
    clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid())
    OR is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Clinic admins manage own whatsapp" ON clinic_whatsapp;
CREATE POLICY "Clinic admins manage own whatsapp" ON clinic_whatsapp
  FOR ALL USING (
    clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid() AND role IN ('admin','manager'))
    OR is_super_admin(auth.uid())
  )
  WITH CHECK (
    clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid() AND role IN ('admin','manager'))
    OR is_super_admin(auth.uid())
  );

-- ------------------------------------------------------------
-- 3) clinic_automations (toggles + templates por clínica)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clinic_automations (
  clinic_id uuid PRIMARY KEY REFERENCES clinics(id) ON DELETE CASCADE,
  -- Toggles
  confirma_24h boolean NOT NULL DEFAULT true,
  lembrete_2h boolean NOT NULL DEFAULT false,
  aniversario boolean NOT NULL DEFAULT true,
  nps_pos_atendimento boolean NOT NULL DEFAULT false,
  recall_inativos boolean NOT NULL DEFAULT false,
  followup_lead boolean NOT NULL DEFAULT false,
  reativacao_lead_perdido boolean NOT NULL DEFAULT false,
  relatorio_semanal boolean NOT NULL DEFAULT false,
  -- Parâmetros
  recall_dias int NOT NULL DEFAULT 150,
  relatorio_telefones text[] NOT NULL DEFAULT ARRAY[]::text[],
  -- Templates (placeholders: {{nome}}, {{hora}}, {{procedimento}}, {{clinica}}, {{profissional}}, {{data}})
  template_confirma_24h text,
  template_lembrete_2h  text,
  template_aniversario  text,
  template_nps          text,
  template_recall       text,
  template_followup_2h  text,
  template_followup_1d  text,
  template_followup_2d  text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE clinic_automations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic users read automations" ON clinic_automations;
CREATE POLICY "Clinic users read automations" ON clinic_automations
  FOR SELECT USING (
    clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid())
    OR is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Clinic admins manage automations" ON clinic_automations;
CREATE POLICY "Clinic admins manage automations" ON clinic_automations
  FOR ALL USING (
    clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid() AND role IN ('admin','manager'))
    OR is_super_admin(auth.uid())
  )
  WITH CHECK (
    clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid() AND role IN ('admin','manager'))
    OR is_super_admin(auth.uid())
  );

-- Cria registro automaticamente quando uma clínica é criada
CREATE OR REPLACE FUNCTION ensure_clinic_automations()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO clinic_automations (clinic_id) VALUES (NEW.id)
  ON CONFLICT (clinic_id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ensure_clinic_automations ON clinics;
CREATE TRIGGER trg_ensure_clinic_automations
  AFTER INSERT ON clinics
  FOR EACH ROW EXECUTE FUNCTION ensure_clinic_automations();

-- Backfill pras clínicas existentes
INSERT INTO clinic_automations (clinic_id)
SELECT id FROM clinics
ON CONFLICT (clinic_id) DO NOTHING;

-- ------------------------------------------------------------
-- 4) Colunas em appointments pra rastrear envios
-- ------------------------------------------------------------
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_2h_sent_at  timestamptz,
  ADD COLUMN IF NOT EXISTS nps_sent_at          timestamptz;

CREATE INDEX IF NOT EXISTS idx_appointments_confirmation_pending
  ON appointments (start_time)
  WHERE status = 'scheduled' AND confirmation_sent_at IS NULL;

-- ------------------------------------------------------------
-- 5) Helper: pegar config de WhatsApp da clínica + globais
--    (usado por Edge Functions / API routes via service role)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_whatsapp_config(p_clinic_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'evolution_url',         (SELECT value FROM app_settings WHERE key = 'evolution_url'),
    'evolution_master_key',  (SELECT value FROM app_settings WHERE key = 'evolution_master_key'),
    'instance_name',         cw.instance_name,
    'status',                cw.status,
    'phone_number',          cw.phone_number
  )
  FROM clinic_whatsapp cw
  WHERE cw.clinic_id = p_clinic_id;
$$;

REVOKE EXECUTE ON FUNCTION get_whatsapp_config(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION get_whatsapp_config(uuid) TO service_role;

-- ------------------------------------------------------------
-- Verificação rápida
-- ------------------------------------------------------------
SELECT 'app_settings'        as tabela, count(*) FROM app_settings
UNION ALL SELECT 'clinic_whatsapp',     count(*) FROM clinic_whatsapp
UNION ALL SELECT 'clinic_automations',  count(*) FROM clinic_automations;
