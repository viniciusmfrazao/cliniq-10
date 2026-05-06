-- ============================================================================
-- STAGING BOOTSTRAP — clinike-staging (folcgzoxfpelogspivot)
-- ============================================================================
-- Cole este arquivo INTEIRO no SQL Editor do staging:
--   https://supabase.com/dashboard/project/folcgzoxfpelogspivot/sql/new
--
-- Premissa: o staging já tem o `schema-completo.sql` aplicado (27 tabelas
-- básicas). Este script PATCHA pra ficar igual à prod:
--   - cria enums novos (module_name, plan_name, subscription_status)
--   - cria 22 tabelas que faltam (clinic_whatsapp, app_settings, nps_responses,
--     crm_settings, crm_message_templates, evolution_webhook_logs,
--     clinic_automations, professional_schedules, professional_unavailability,
--     plans, subscriptions, anamnesis_templates, anamnesis_responses,
--     lead_interactions, metas_financeiras, recall_messages_log,
--     birthday_messages_log, chat_messages, appointment_products)
--   - adiciona colunas faltantes em leads, eva_conversations, patients,
--     appointments, anamneses, documents_sent, injectable_applications,
--     procedures, products
--   - cria funções: normalize_br_phone, phone_variants, donna_load_context,
--     tg_appointment_completed_to_lead, set_updated_at, etc.
--   - cria triggers de auditoria e updated_at
--   - cria 5 views (admin_metrics, eva_followup_queue, etc.)
--   - cria storage bucket whatsapp-media
--   - aplica RLS policies em todas as tabelas
--   - insere dados base (planos, app_settings)
--
-- Idempotente: pode rodar várias vezes sem quebrar.
-- ============================================================================


-- ============================================================================
-- 0) EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================================
-- 1) ENUMS NOVOS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE module_name AS ENUM (
    'agenda', 'patients', 'medical_records', 'injectable_maps',
    'stock', 'documents', 'eva_ai', 'whatsapp', 'crm', 'dashboard'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE plan_name AS ENUM ('starter', 'pro', 'clinic_plus');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'past_due', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================================
-- 2) PATCH NOS ENUMS EXISTENTES (caso precise valores adicionais)
-- ============================================================================

-- appointment_status: garantir todos os valores
DO $$ BEGIN
  ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'pending_confirmation';
EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ============================================================================
-- 3) AJUSTES EM TABELAS EXISTENTES (colunas + tipos)
-- ============================================================================

-- 3.1 clinics: ajustar tipos pra match com prod
DO $$ BEGIN
  ALTER TABLE clinics ALTER COLUMN trial_ends_at SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE clinics ALTER COLUMN created_at SET NOT NULL;
  ALTER TABLE clinics ALTER COLUMN updated_at SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Converter clinics.plan: text -> plan_name (idempotente)
DO $$
DECLARE
  v_type text;
BEGIN
  SELECT data_type INTO v_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'clinics' AND column_name = 'plan';

  IF v_type = 'text' THEN
    -- Normaliza valores antes de converter
    UPDATE clinics SET plan = 'starter' WHERE plan IS NULL OR plan NOT IN ('starter','pro','clinic_plus');
    ALTER TABLE clinics ALTER COLUMN plan DROP DEFAULT;
    ALTER TABLE clinics ALTER COLUMN plan TYPE plan_name USING plan::plan_name;
    ALTER TABLE clinics ALTER COLUMN plan SET DEFAULT 'starter';
    ALTER TABLE clinics ALTER COLUMN plan SET NOT NULL;
  END IF;
END $$;

-- Converter clinics.active_modules: text[] -> module_name[]
DO $$
DECLARE
  v_udt text;
BEGIN
  SELECT udt_name INTO v_udt
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'clinics' AND column_name = 'active_modules';

  IF v_udt = '_text' THEN
    -- Limpa valores não compatíveis (mapeia legados)
    UPDATE clinics SET active_modules = NULL WHERE active_modules IS NOT NULL;
    ALTER TABLE clinics ALTER COLUMN active_modules DROP DEFAULT;
    ALTER TABLE clinics ALTER COLUMN active_modules TYPE module_name[] USING NULL::module_name[];
  END IF;
END $$;


-- 3.2 patients: adicionar whatsapp_opt_in (pode faltar em schemas antigos) + phone_original
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS phone_original  text;


-- 3.3 appointments: campos de automação
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_2h_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS nps_sent_at timestamptz;

-- Converter appointments.status pra text (mais flexível, igual à prod)
DO $$
DECLARE v_udt text;
BEGIN
  SELECT udt_name INTO v_udt
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='appointments' AND column_name='status';
  IF v_udt = 'appointment_status' THEN
    ALTER TABLE appointments ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE appointments ALTER COLUMN status TYPE text USING status::text;
    ALTER TABLE appointments ALTER COLUMN status SET DEFAULT 'scheduled';
  END IF;
END $$;


-- 3.4 leads: TODAS as colunas novas (followup, human_review, eva_pause)
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS eva_followup_count   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eva_next_followup_at timestamptz,
  ADD COLUMN IF NOT EXISTS needs_human_review   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS human_review_reason  text,
  ADD COLUMN IF NOT EXISTS human_review_details text,
  ADD COLUMN IF NOT EXISTS human_review_at      timestamptz,
  ADD COLUMN IF NOT EXISTS eva_pause_until      timestamptz;

-- Converter leads.status e leads.source pra text (match prod)
DO $$
DECLARE v_udt text;
BEGIN
  SELECT udt_name INTO v_udt FROM information_schema.columns
  WHERE table_schema='public' AND table_name='leads' AND column_name='status';
  IF v_udt = 'lead_status' THEN
    ALTER TABLE leads ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE leads ALTER COLUMN status TYPE text USING status::text;
    ALTER TABLE leads ALTER COLUMN status SET DEFAULT 'new';
  END IF;

  SELECT udt_name INTO v_udt FROM information_schema.columns
  WHERE table_schema='public' AND table_name='leads' AND column_name='source';
  IF v_udt = 'lead_source' THEN
    ALTER TABLE leads ALTER COLUMN source DROP DEFAULT;
    ALTER TABLE leads ALTER COLUMN source TYPE text USING source::text;
    ALTER TABLE leads ALTER COLUMN source SET DEFAULT 'other';
  END IF;
END $$;


-- 3.5 eva_conversations: messages, customer_name, lead_id, patient_id, etc.
ALTER TABLE eva_conversations
  ADD COLUMN IF NOT EXISTS messages       jsonb,
  ADD COLUMN IF NOT EXISTS customer_name  text,
  ADD COLUMN IF NOT EXISTS lead_id        uuid,
  ADD COLUMN IF NOT EXISTS patient_id     uuid,
  ADD COLUMN IF NOT EXISTS last_agent     text,
  ADD COLUMN IF NOT EXISTS updated_at     timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS metadata       jsonb NOT NULL DEFAULT '{}'::jsonb;


-- 3.6 anamneses + documents_sent: signature evidence
ALTER TABLE anamneses
  ADD COLUMN IF NOT EXISTS signature_user_agent text,
  ADD COLUMN IF NOT EXISTS signature_country text;

ALTER TABLE documents_sent
  ADD COLUMN IF NOT EXISTS signature_user_agent text,
  ADD COLUMN IF NOT EXISTS signature_country text;


-- 3.7 injectable_applications: stock_deducted, product_id
ALTER TABLE injectable_applications
  ADD COLUMN IF NOT EXISTS product_id uuid,
  ADD COLUMN IF NOT EXISTS appointment_id uuid,
  ADD COLUMN IF NOT EXISTS stock_deducted boolean DEFAULT false;


-- 3.8 stock_movements: ajustes de colunas
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS appointment_id uuid,
  ADD COLUMN IF NOT EXISTS patient_id uuid,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS cost_price numeric;


-- 3.9 procedures: defaults atualizados
ALTER TABLE procedures
  ADD COLUMN IF NOT EXISTS variation text,
  ADD COLUMN IF NOT EXISTS installment_price numeric,
  ADD COLUMN IF NOT EXISTS installments integer,
  ADD COLUMN IF NOT EXISTS professional_ids uuid[],
  ADD COLUMN IF NOT EXISTS includes_return boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS return_days integer,
  ADD COLUMN IF NOT EXISTS is_promotion boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS original_price numeric,
  ADD COLUMN IF NOT EXISTS promotion_dates date[],
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();


-- 3.10 document_templates: theme_color
ALTER TABLE document_templates
  ADD COLUMN IF NOT EXISTS theme_color text DEFAULT '#6366f1';


-- 3.11 audit_logs: garantir entity_id como uuid (na prod é uuid)
DO $$
DECLARE v_type text;
BEGIN
  SELECT data_type INTO v_type FROM information_schema.columns
  WHERE table_schema='public' AND table_name='audit_logs' AND column_name='entity_id';
  IF v_type = 'text' THEN
    ALTER TABLE audit_logs ALTER COLUMN entity_id TYPE uuid USING NULLIF(entity_id,'')::uuid;
  END IF;
END $$;


-- 3.12 roles_permissions: estrutura prod (role enum + module enum)
-- Se schema antigo existe (com role_name text), precisa recriar
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='roles_permissions' AND column_name='role_name'
  ) THEN
    DROP TABLE roles_permissions CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS roles_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES clinics(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  module module_name NOT NULL,
  can_view   boolean NOT NULL DEFAULT false,
  can_create boolean NOT NULL DEFAULT false,
  can_edit   boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  UNIQUE(clinic_id, role, module)
);


-- 3.13 clinic_integrations: ajustar pra match prod (provider+config jsonb)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clinic_integrations' AND column_name='provider'
  ) THEN
    ALTER TABLE clinic_integrations
      ADD COLUMN IF NOT EXISTS provider text,
      ADD COLUMN IF NOT EXISTS config jsonb DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
  END IF;
END $$;


-- ============================================================================
-- 4) TABELAS NOVAS
-- ============================================================================

-- 4.1 plans (novo modelo de billing)
CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name plan_name NOT NULL UNIQUE,
  price_monthly numeric NOT NULL,
  price_yearly numeric,
  modules module_name[] NOT NULL DEFAULT '{}',
  max_professionals integer,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4.2 subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  plan_id   uuid NOT NULL REFERENCES plans(id),
  status    subscription_status NOT NULL DEFAULT 'trial',
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end   timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  stripe_subscription_id text,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_clinic ON subscriptions(clinic_id);


-- 4.3 app_settings (config global da plataforma — keys/values)
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text,
  is_secret boolean NOT NULL DEFAULT false,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);


-- 4.4 clinic_whatsapp (N instancias Evolution por clinica — multi-numero)
CREATE TABLE IF NOT EXISTS clinic_whatsapp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  instance_name text NOT NULL UNIQUE,
  phone_number text,
  status text NOT NULL DEFAULT 'disconnected',
  qr_code text,
  qr_expires_at timestamptz,
  connected_at timestamptz,
  last_event_at timestamptz,
  webhook_token text NOT NULL DEFAULT gen_random_uuid()::text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  auto_reply_enabled boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  role_inbound boolean NOT NULL DEFAULT true,
  role_outbound_automation boolean NOT NULL DEFAULT true,
  role_outbound_manual boolean NOT NULL DEFAULT true,
  label text,
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_clinic_whatsapp_default
  ON clinic_whatsapp(clinic_id) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_clinic_whatsapp_clinic_id
  ON clinic_whatsapp(clinic_id);

COMMENT ON COLUMN clinic_whatsapp.auto_reply_enabled IS
  'Quando false, a Eva NÃO responde automaticamente nessa instância.';
COMMENT ON COLUMN clinic_whatsapp.is_default IS
  'Numero padrao da clinica. So 1 por clinica.';
COMMENT ON COLUMN clinic_whatsapp.role_inbound IS
  'Eva atende mensagens recebidas neste numero.';
COMMENT ON COLUMN clinic_whatsapp.role_outbound_automation IS
  'Crons (NPS, aniversario, lembrete, recall) saem por aqui.';
COMMENT ON COLUMN clinic_whatsapp.role_outbound_manual IS
  'Secretaria pode usar pra responder/iniciar conversas pelo painel.';


-- 4.5 clinic_automations (toggle de cada automação)
CREATE TABLE IF NOT EXISTS clinic_automations (
  clinic_id uuid PRIMARY KEY REFERENCES clinics(id) ON DELETE CASCADE,
  confirma_24h boolean NOT NULL DEFAULT true,
  lembrete_2h  boolean NOT NULL DEFAULT true,
  aniversario  boolean NOT NULL DEFAULT true,
  nps_pos_atendimento boolean NOT NULL DEFAULT true,
  recall_inativos boolean NOT NULL DEFAULT true,
  followup_lead boolean NOT NULL DEFAULT true,
  reativacao_lead_perdido boolean NOT NULL DEFAULT true,
  relatorio_semanal boolean NOT NULL DEFAULT true,
  recall_dias integer NOT NULL DEFAULT 90,
  relatorio_telefones text[] NOT NULL DEFAULT '{}',
  template_confirma_24h text,
  template_lembrete_2h  text,
  template_aniversario  text,
  template_nps          text,
  template_recall       text,
  template_followup_2h  text,
  template_followup_1d  text,
  template_followup_2d  text,
  aniversario_hora integer NOT NULL DEFAULT 9,
  aniversario_optin_required boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);


-- 4.6 crm_settings
CREATE TABLE IF NOT EXISTS crm_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid UNIQUE REFERENCES clinics(id) ON DELETE CASCADE,
  custom_stages jsonb,
  custom_sources jsonb,
  auto_assign boolean DEFAULT false,
  default_assigned_to uuid,
  whatsapp_auto_reply boolean DEFAULT true,
  whatsapp_welcome_message text,
  whatsapp_followup_days integer DEFAULT 3,
  eva_auto_analyze boolean DEFAULT true,
  eva_auto_suggest boolean DEFAULT true,
  eva_auto_followup boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);


-- 4.7 crm_message_templates
CREATE TABLE IF NOT EXISTS crm_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  channel text DEFAULT 'whatsapp',
  content text NOT NULL,
  trigger_stage text,
  trigger_days integer,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);


-- 4.8 nps_responses
CREATE TABLE IF NOT EXISTS nps_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  professional_id uuid REFERENCES users(id),
  procedure_name text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  replied_at timestamptz,
  score smallint CHECK (score IS NULL OR (score >= 0 AND score <= 10)),
  comment text,
  status text NOT NULL DEFAULT 'sent',
  error text,
  message text,
  channel text NOT NULL DEFAULT 'whatsapp'
);
CREATE INDEX IF NOT EXISTS idx_nps_clinic ON nps_responses(clinic_id);
CREATE INDEX IF NOT EXISTS idx_nps_appointment ON nps_responses(appointment_id);


-- 4.9 evolution_webhook_logs
CREATE TABLE IF NOT EXISTS evolution_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance text NOT NULL,
  event text,
  status_code integer NOT NULL,
  error text,
  body jsonb,
  headers jsonb,
  query jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_instance ON evolution_webhook_logs(instance);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created ON evolution_webhook_logs(created_at DESC);


-- 4.10 birthday_messages_log
CREATE TABLE IF NOT EXISTS birthday_messages_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  year integer NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'sent',
  error text,
  message text,
  channel text NOT NULL DEFAULT 'whatsapp',
  UNIQUE(clinic_id, patient_id, year)
);


-- 4.11 recall_messages_log
CREATE TABLE IF NOT EXISTS recall_messages_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  last_visit_at timestamptz,
  days_inactive integer,
  procedure_name text,
  status text NOT NULL DEFAULT 'sent',
  error text,
  message text,
  channel text NOT NULL DEFAULT 'whatsapp'
);


-- 4.12 lead_interactions
CREATE TABLE IF NOT EXISTS lead_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES clinics(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),
  type text NOT NULL,
  direction text,
  content text,
  whatsapp_message_id text,
  whatsapp_status text,
  old_status text,
  new_status text,
  ai_generated boolean DEFAULT false,
  ai_suggested boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_interactions_lead ON lead_interactions(lead_id);


-- 4.13 anamnesis_templates
CREATE TABLE IF NOT EXISTS anamnesis_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);


-- 4.14 anamnesis_responses
CREATE TABLE IF NOT EXISTS anamnesis_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  template_id uuid REFERENCES anamnesis_templates(id),
  responses jsonb NOT NULL DEFAULT '{}'::jsonb,
  filled_at timestamptz DEFAULT now()
);


-- 4.15 metas_financeiras
CREATE TABLE IF NOT EXISTS metas_financeiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES clinics(id) ON DELETE CASCADE,
  mes date NOT NULL,
  meta_receita numeric NOT NULL,
  meta_atendimentos integer,
  created_at timestamptz DEFAULT now(),
  UNIQUE(clinic_id, mes)
);


-- 4.16 chat_messages (chat interno entre usuários)
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES clinics(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES users(id),
  receiver_id uuid REFERENCES users(id),
  message text NOT NULL,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);


-- 4.17 appointment_products (produtos consumidos no atendimento)
CREATE TABLE IF NOT EXISTS appointment_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric,
  notes text,
  created_at timestamptz DEFAULT now()
);


-- 4.18 professional_schedules
CREATE TABLE IF NOT EXISTS professional_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time   time NOT NULL,
  is_active  boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);


-- 4.19 professional_unavailability
CREATE TABLE IF NOT EXISTS professional_unavailability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  professional_id uuid REFERENCES users(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date   date NOT NULL,
  start_time time,
  end_time   time,
  reason text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);


-- ============================================================================
-- 5) ÍNDICES ADICIONAIS
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_leads_eva_next_followup ON leads(eva_next_followup_at) WHERE eva_next_followup_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_eva_pause_until   ON leads(eva_pause_until)      WHERE eva_pause_until      IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_needs_human_review ON leads(clinic_id, needs_human_review) WHERE needs_human_review = true;
CREATE INDEX IF NOT EXISTS idx_eva_conversations_clinic_phone ON eva_conversations(clinic_id, phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_status_start ON appointments(status, start_time);


-- ============================================================================
-- 6) FUNÇÕES
-- ============================================================================

-- 6.1 set_updated_at: trigger genérico
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- 6.2 normalize_br_phone
CREATE OR REPLACE FUNCTION public.normalize_br_phone(p text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  digits text := regexp_replace(coalesce(p,''), '[^0-9]', '', 'g');
BEGIN
  IF digits = '' THEN RETURN NULL; END IF;
  IF length(digits) = 11 THEN
    digits := '55' || digits;
  ELSIF length(digits) = 10 THEN
    digits := '55' || substr(digits,1,2) || '9' || substr(digits,3);
  ELSIF length(digits) = 12 THEN
    digits := substr(digits,1,4) || '9' || substr(digits,5);
  END IF;
  RETURN digits;
END;
$$;
GRANT EXECUTE ON FUNCTION public.normalize_br_phone(text) TO PUBLIC, anon, authenticated, service_role;


-- 6.3 phone_variants
CREATE OR REPLACE FUNCTION public.phone_variants(p_phone text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY(
    SELECT DISTINCT v
    FROM unnest(ARRAY[
      p_phone,
      public.normalize_br_phone(p_phone),
      regexp_replace(p_phone, '^(\d{4})9', '\1'),
      regexp_replace(p_phone, '^(\d{4})(\d{8})$', '\19\2')
    ]) AS v
    WHERE v IS NOT NULL AND v <> ''
  );
$$;
GRANT EXECUTE ON FUNCTION public.phone_variants(text) TO PUBLIC, anon, authenticated, service_role;


-- 6.4 donna_load_context (RPC principal da Eva)
DROP FUNCTION IF EXISTS donna_load_context(uuid, text);
DROP FUNCTION IF EXISTS donna_load_context(uuid, text, text);

CREATE OR REPLACE FUNCTION donna_load_context(
  p_clinic_id     uuid,
  p_phone         text,
  p_customer_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'history', COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object('role', role, 'content', content) ORDER BY created_at ASC)
        FROM (
          SELECT role, content, created_at
          FROM eva_conversations
          WHERE clinic_id = p_clinic_id
            AND phone = ANY(public.phone_variants(p_phone))
            AND content IS NOT NULL
            AND length(trim(content)) > 0
          ORDER BY created_at DESC
          LIMIT 40
        ) AS recent
      ),
      '[]'::jsonb
    ),
    'professionals', COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'role', role))
        FROM users
        WHERE clinic_id = p_clinic_id
          AND active = true
          AND id IN (
            SELECT DISTINCT unnest(professional_ids)
            FROM procedures
            WHERE clinic_id = p_clinic_id AND active = true
              AND professional_ids IS NOT NULL
          )
      ),
      '[]'::jsonb
    ),
    'procedures', COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object(
          'id', id,
          'name', name,
          'description', description,
          'price', price,
          'installments', installments,
          'installment_price', installment_price,
          'professional_ids', professional_ids,
          'duration_minutes', duration_minutes,
          'category', category
        ) ORDER BY name ASC)
        FROM procedures
        WHERE clinic_id = p_clinic_id AND active = true
      ),
      '[]'::jsonb
    ),
    'clinic', (
      SELECT jsonb_build_object(
        'name', name,
        'slug', slug,
        'settings', COALESCE(settings, '{}'::jsonb)
      )
      FROM clinics
      WHERE id = p_clinic_id
    ),
    'patient', (
      SELECT jsonb_build_object('id', id, 'name', name, 'birth_date', birth_date)
      FROM patients
      WHERE clinic_id = p_clinic_id
        AND phone = ANY(public.phone_variants(p_phone))
      ORDER BY
        CASE
          WHEN p_customer_name IS NOT NULL
               AND lower(unaccent(name)) = lower(unaccent(p_customer_name))
            THEN 0
          WHEN p_customer_name IS NOT NULL
               AND (lower(unaccent(name)) LIKE lower(unaccent(p_customer_name)) || '%'
                 OR lower(unaccent(name)) LIKE '%' || lower(unaccent(p_customer_name)))
            THEN 1
          ELSE 2
        END,
        updated_at DESC NULLS LAST,
        created_at DESC
      LIMIT 1
    ),
    'lead', (
      SELECT jsonb_build_object(
        'id', id,
        'name', name,
        'status', status,
        'interest', interest,
        'procedure_id', procedure_id,
        'eva_followup_count', eva_followup_count
      )
      FROM leads
      WHERE clinic_id = p_clinic_id
        AND phone = ANY(public.phone_variants(p_phone))
      ORDER BY
        CASE
          WHEN p_customer_name IS NOT NULL
               AND lower(unaccent(name)) = lower(unaccent(p_customer_name))
            THEN 0
          ELSE 1
        END,
        created_at DESC
      LIMIT 1
    ),
    'last_assistant_at', (
      SELECT MAX(created_at)
      FROM eva_conversations
      WHERE clinic_id = p_clinic_id
        AND phone = ANY(public.phone_variants(p_phone))
        AND role = 'assistant'
    ),
    'evolution', jsonb_build_object(
      'url',         (SELECT value FROM app_settings WHERE key = 'evolution_url'),
      'master_key',  (SELECT value FROM app_settings WHERE key = 'evolution_master_key'),
      'instance',    (SELECT instance_name FROM clinic_whatsapp WHERE clinic_id = p_clinic_id ORDER BY is_default DESC, created_at ASC LIMIT 1),
      'phone',       (SELECT phone_number  FROM clinic_whatsapp WHERE clinic_id = p_clinic_id ORDER BY is_default DESC, created_at ASC LIMIT 1),
      'status',      (SELECT status        FROM clinic_whatsapp WHERE clinic_id = p_clinic_id ORDER BY is_default DESC, created_at ASC LIMIT 1)
    )
  );
$$;
REVOKE EXECUTE ON FUNCTION donna_load_context(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION donna_load_context(uuid, text, text) TO service_role;


-- 6.5 tg_appointment_completed_to_lead (trigger)
CREATE OR REPLACE FUNCTION public.tg_appointment_completed_to_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_phone text;
  v_lead_id uuid;
BEGIN
  IF NEW.status <> 'completed' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' THEN RETURN NEW; END IF;

  SELECT phone INTO v_patient_phone FROM patients WHERE id = NEW.patient_id;
  IF v_patient_phone IS NULL OR v_patient_phone = '' THEN RETURN NEW; END IF;

  SELECT id INTO v_lead_id
  FROM leads
  WHERE clinic_id = NEW.clinic_id
    AND phone = ANY(public.phone_variants(v_patient_phone))
    AND status IN ('new', 'contacted', 'scheduled')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_lead_id IS NOT NULL THEN
    UPDATE leads
    SET status = 'converted',
        converted_at = COALESCE(converted_at, now()),
        conversion_notes = COALESCE(conversion_notes, 'Compareceu na clinica (appointment ' || NEW.id::text || ')'),
        last_contact_at = now(),
        eva_followup_count = 0,
        eva_next_followup_at = NULL
    WHERE id = v_lead_id;
  END IF;

  RETURN NEW;
END;
$$;
GRANT EXECUTE ON FUNCTION public.tg_appointment_completed_to_lead() TO service_role;


-- 6.6 ensure_clinic_automations: auto-cria row em clinic_automations
CREATE OR REPLACE FUNCTION public.ensure_clinic_automations()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO clinic_automations (clinic_id) VALUES (NEW.id)
  ON CONFLICT (clinic_id) DO NOTHING;
  RETURN NEW;
END;
$$;


-- ============================================================================
-- 7) TRIGGERS
-- ============================================================================

-- 7.1 updated_at em todas as tabelas que têm essa coluna
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'clinics','users','patients','procedures','appointments','leads',
    'medical_records','document_templates','products','eva_conversations',
    'clinic_integrations','crm_settings','app_settings','clinic_whatsapp',
    'clinic_automations','professional_schedules','subscriptions'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=t AND column_name='updated_at'
    ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I', t, t);
      EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
    END IF;
  END LOOP;
END $$;

-- 7.2 trigger lead converted
DROP TRIGGER IF EXISTS appointment_completed_to_lead ON appointments;
CREATE TRIGGER appointment_completed_to_lead
  AFTER INSERT OR UPDATE OF status ON appointments
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION public.tg_appointment_completed_to_lead();

-- 7.3 trigger ensure clinic_automations
DROP TRIGGER IF EXISTS trg_clinics_ensure_automations ON clinics;
CREATE TRIGGER trg_clinics_ensure_automations
  AFTER INSERT ON clinics
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_clinic_automations();


-- ============================================================================
-- 8) VIEWS
-- ============================================================================

-- 8.1 eva_followup_queue
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


-- 8.2 admin_metrics
CREATE OR REPLACE VIEW admin_metrics AS
SELECT
  (SELECT COUNT(*) FROM clinics WHERE deleted_at IS NULL) AS total_clinics,
  (SELECT COUNT(*) FROM clinics WHERE deleted_at IS NULL AND trial_ends_at > now()) AS clinics_on_trial,
  (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL) AS total_users,
  (SELECT COUNT(*) FROM patients) AS total_patients,
  (SELECT COUNT(*) FROM appointments WHERE start_time::date = current_date) AS appointments_today,
  (SELECT COUNT(*) FROM leads WHERE created_at >= date_trunc('month', now())) AS leads_this_month;


-- 8.3 appointments_nps_pending: completed sem NPS enviado
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


-- 8.4 birthday_today_pending: aniversariantes do dia que ainda não receberam
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


-- 8.5 patient_last_completed: último atendimento de cada paciente
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
-- 9) STORAGE BUCKETS
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
-- 10) RLS — habilitar nas tabelas novas
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


-- 10.1 Policies padrão (clinic-scoped) — só pra tabelas com clinic_id direto
DO $$
DECLARE
  t text;
  policy_tables text[] := ARRAY[
    'clinic_whatsapp','clinic_automations','crm_settings','crm_message_templates',
    'nps_responses','birthday_messages_log','recall_messages_log',
    'lead_interactions','anamnesis_templates','anamnesis_responses',
    'metas_financeiras','chat_messages',
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

-- 10.1b appointment_products: scope via appointment.clinic_id (não tem clinic_id direto)
DROP POLICY IF EXISTS "Clinic users manage appointment_products" ON appointment_products;
CREATE POLICY "Clinic users manage appointment_products" ON appointment_products
  FOR ALL USING (
    appointment_id IN (
      SELECT id FROM appointments
      WHERE clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    appointment_id IN (
      SELECT id FROM appointments
      WHERE clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid())
    )
  );

-- 10.2 evolution_webhook_logs: super-admin only (sem clinic_id direto)
DROP POLICY IF EXISTS "Super admins view webhook logs" ON evolution_webhook_logs;
CREATE POLICY "Super admins view webhook logs" ON evolution_webhook_logs
  FOR SELECT USING (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Service role inserts webhook logs" ON evolution_webhook_logs;
CREATE POLICY "Service role inserts webhook logs" ON evolution_webhook_logs
  FOR INSERT WITH CHECK (true);

-- 10.3 app_settings: super-admin only
DROP POLICY IF EXISTS "Super admins manage app_settings" ON app_settings;
CREATE POLICY "Super admins manage app_settings" ON app_settings
  FOR ALL USING (is_super_admin(auth.uid()));

-- 10.4 plans: público pode ver ativos
DROP POLICY IF EXISTS "Anyone view active plans" ON plans;
CREATE POLICY "Anyone view active plans" ON plans
  FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "Super admins manage plans" ON plans;
CREATE POLICY "Super admins manage plans" ON plans
  FOR ALL USING (is_super_admin(auth.uid()));


-- ============================================================================
-- 11) DADOS INICIAIS (seed básico)
-- ============================================================================

-- 11.1 Plans
INSERT INTO plans (name, price_monthly, price_yearly, modules, max_professionals, active)
VALUES
  ('starter',     199,  1990, ARRAY['agenda','patients','dashboard']::module_name[], 2, true),
  ('pro',         399,  3990, ARRAY['agenda','patients','medical_records','documents','crm','dashboard']::module_name[], 5, true),
  ('clinic_plus', 699,  6990, ARRAY['agenda','patients','medical_records','injectable_maps','stock','documents','eva_ai','whatsapp','crm','dashboard']::module_name[], NULL, true)
ON CONFLICT (name) DO NOTHING;

-- 11.2 admin_plans (legado, mantém pra compatibilidade)
INSERT INTO admin_plans (name, description, price_monthly, price_yearly, modules, max_professionals)
VALUES
  ('Starter', 'Ideal para clínicas iniciantes', 199, 1990,
   ARRAY['agenda','pacientes','recepcao','procedimentos','financeiro','equipe'], 2),
  ('Professional', 'Para clínicas em crescimento', 399, 3990,
   ARRAY['agenda','pacientes','recepcao','procedimentos','prontuario','injetaveis','documentos','estoque','crm','financeiro','equipe'], 5),
  ('Enterprise', 'Recursos completos para grandes clínicas', 699, 6990,
   ARRAY['agenda','pacientes','recepcao','procedimentos','prontuario','injetaveis','documentos','lista_espera','estoque','crm','whatsapp','eva_ia','financeiro','equipe','auditoria'], NULL)
ON CONFLICT (name) DO NOTHING;

-- 11.3 app_settings: chaves base (sem secrets — você preenche depois)
INSERT INTO app_settings (key, value, is_secret, description) VALUES
  ('eva_engine',        'edge', false, 'Motor de IA da Eva: edge | n8n'),
  ('eva_edge_url',      '',     false, 'URL da Edge Function (preencher após deploy)'),
  ('eva_internal_secret','',    true,  'Secret interno app -> edge (opcional)'),
  ('evolution_url',     '',     false, 'URL base da Evolution API (staging)'),
  ('evolution_master_key', '',  true,  'Master key da Evolution API (staging)'),
  ('environment',       'staging', false, 'Identificador do ambiente: production | staging')
ON CONFLICT (key) DO NOTHING;


-- ============================================================================
-- 12) VERIFICAÇÃO FINAL
-- ============================================================================
SELECT
  'tabelas' AS tipo, COUNT(*) AS qtd
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
UNION ALL
SELECT 'views', COUNT(*) FROM information_schema.views WHERE table_schema = 'public'
UNION ALL
SELECT 'enums', COUNT(*) FROM pg_type WHERE typtype = 'e' AND typnamespace = 'public'::regnamespace
UNION ALL
SELECT 'funcoes', COUNT(*) FROM information_schema.routines WHERE routine_schema='public' AND routine_type='FUNCTION';

-- Esperado (deve bater com a prod):
--   tabelas: ~46
--   views:    5
--   enums:   11
--   funcoes: 15+
