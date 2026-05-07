-- Vincula clínica ao plano SaaS (admin_plans) para limite WhatsApp e billing.
-- Idempotente: seguro rodar várias vezes.

ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES admin_plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clinics_plan_id ON clinics(plan_id) WHERE plan_id IS NOT NULL;

COMMENT ON COLUMN clinics.plan_id IS 'Plano contratado (admin_plans). Complementa a coluna legada plan (text).';
