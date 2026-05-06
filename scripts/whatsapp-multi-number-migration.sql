-- =====================================================================
-- WhatsApp Multi-Number per Clinic
-- =====================================================================
-- Permite que cada clinica tenha N numeros WhatsApp em vez de 1 so.
-- Cada numero pode ter combinacoes diferentes de papeis:
--   role_inbound              -> Eva atende mensagens recebidas aqui
--   role_outbound_automation  -> Crons (NPS, aniversario, lembrete, recall) saem por aqui
--   role_outbound_manual      -> Secretaria usa pra responder pelo painel
--
-- Cenarios suportados:
--   A) Clinica com 2 numeros (comercial / operacional)
--   B) Clinica com 1 numero so (faz tudo)
--   C) Multi-secretaria (cada uma com seu numero, via assigned_to)
--
-- Mudanca estrutural: clinic_id deixa de ser PK. Adicionamos `id` uuid
-- como PK nova e mantemos clinic_id como FK indexado. Garantimos via
-- unique index parcial que so existe 1 default por clinica.
-- =====================================================================

-- 1) Garante que a coluna id existe e tem valor
ALTER TABLE clinic_whatsapp
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

UPDATE clinic_whatsapp SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE clinic_whatsapp ALTER COLUMN id SET NOT NULL;

-- 2) Detecta e dropa PK antiga (em clinic_id), substitui por (id).
--    Idempotente: se ja estiver em id, nao faz nada.
DO $$
DECLARE
  pk_name text;
  pk_cols text;
BEGIN
  SELECT con.conname, pg_get_constraintdef(con.oid)
  INTO pk_name, pk_cols
  FROM pg_constraint con
  WHERE con.contype = 'p'
    AND con.conrelid = 'public.clinic_whatsapp'::regclass;

  IF pk_name IS NOT NULL AND pk_cols !~* '\(\s*id\s*\)' THEN
    EXECUTE format('ALTER TABLE clinic_whatsapp DROP CONSTRAINT %I', pk_name);
  END IF;

  -- Cria nova PK em id se ainda nao existir
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE contype = 'p' AND conrelid = 'public.clinic_whatsapp'::regclass
  ) THEN
    ALTER TABLE clinic_whatsapp ADD PRIMARY KEY (id);
  END IF;
END $$;

-- 3) Colunas novas
ALTER TABLE clinic_whatsapp
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS role_inbound boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS role_outbound_automation boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS role_outbound_manual boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES users(id) ON DELETE SET NULL;

-- 4) Backfill: marca todas as linhas existentes como default (1 por clinica)
--    Pra clinicas que ja tem 1 numero, ele vira o default automaticamente.
UPDATE clinic_whatsapp
SET is_default = true
WHERE is_default = false
  AND id IN (
    SELECT DISTINCT ON (clinic_id) id
    FROM clinic_whatsapp
    ORDER BY clinic_id, created_at ASC
  );

-- 5) Garante que so existe 1 default por clinica
CREATE UNIQUE INDEX IF NOT EXISTS uq_clinic_whatsapp_default
  ON clinic_whatsapp(clinic_id) WHERE is_default = true;

-- 6) Indices uteis pra queries de roteamento
CREATE INDEX IF NOT EXISTS idx_clinic_whatsapp_clinic_id
  ON clinic_whatsapp(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_whatsapp_assigned_to
  ON clinic_whatsapp(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clinic_whatsapp_outbound_auto
  ON clinic_whatsapp(clinic_id) WHERE role_outbound_automation = true;
CREATE INDEX IF NOT EXISTS idx_clinic_whatsapp_inbound
  ON clinic_whatsapp(clinic_id) WHERE role_inbound = true;

-- 7) Comentarios pra quem ler o schema depois
COMMENT ON COLUMN clinic_whatsapp.is_default IS
  'Numero padrao da clinica. Fallback quando nenhum match de papel. So 1 por clinica.';
COMMENT ON COLUMN clinic_whatsapp.role_inbound IS
  'Eva atende mensagens recebidas neste numero (true por padrao).';
COMMENT ON COLUMN clinic_whatsapp.role_outbound_automation IS
  'Crons (NPS, aniversario, lembrete, recall, confirmacao) saem por aqui.';
COMMENT ON COLUMN clinic_whatsapp.role_outbound_manual IS
  'Secretaria pode usar pra responder/iniciar conversas pelo painel.';
COMMENT ON COLUMN clinic_whatsapp.label IS
  'Apelido visivel pra identificar (ex: Comercial, Operacional, Recepcao Maria).';
COMMENT ON COLUMN clinic_whatsapp.assigned_to IS
  'User dono deste numero (Fase 2: multi-secretaria). NULL = compartilhado.';

-- 8) admin_plans (planos do SaaS) ganha limite de numeros por plano
ALTER TABLE admin_plans
  ADD COLUMN IF NOT EXISTS max_whatsapp_numbers integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN admin_plans.max_whatsapp_numbers IS
  'Quantos numeros WhatsApp uma clinica deste plano pode conectar.';

-- Defaults sugeridos por plano (so atualiza se ainda for 1, nao sobrescreve customizacao)
UPDATE admin_plans SET max_whatsapp_numbers = 1
  WHERE LOWER(slug) = 'starter' AND max_whatsapp_numbers <= 1;
UPDATE admin_plans SET max_whatsapp_numbers = 2
  WHERE LOWER(slug) = 'professional' AND max_whatsapp_numbers <= 1;
UPDATE admin_plans SET max_whatsapp_numbers = 10
  WHERE LOWER(slug) = 'enterprise' AND max_whatsapp_numbers <= 1;
