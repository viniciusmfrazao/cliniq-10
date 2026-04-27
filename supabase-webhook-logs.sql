-- ===========================================================================
-- Tabela de log de webhooks recebidos da Evolution (debug e auditoria)
-- ===========================================================================
-- Idempotente. Pode rodar várias vezes.

CREATE TABLE IF NOT EXISTS evolution_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance text NOT NULL,
  event text,
  status_code int NOT NULL DEFAULT 200,
  error text,
  body jsonb,
  headers jsonb,
  query jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evolution_webhook_logs_instance
  ON evolution_webhook_logs (instance, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evolution_webhook_logs_event
  ON evolution_webhook_logs (event, created_at DESC);

-- Limpa logs > 7 dias automaticamente (rodar via pg_cron ou manualmente)
-- Uso simples sem cron: rodar essa query periodicamente
-- DELETE FROM evolution_webhook_logs WHERE created_at < now() - interval '7 days';

ALTER TABLE evolution_webhook_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin reads webhook logs" ON evolution_webhook_logs;
CREATE POLICY "Super admin reads webhook logs" ON evolution_webhook_logs
  FOR SELECT USING (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Clinic admins read own webhook logs" ON evolution_webhook_logs;
CREATE POLICY "Clinic admins read own webhook logs" ON evolution_webhook_logs
  FOR SELECT USING (
    instance IN (
      SELECT instance_name FROM clinic_whatsapp
      WHERE clinic_id IN (
        SELECT clinic_id FROM users
        WHERE id = auth.uid() AND role IN ('admin','manager')
      )
    )
  );

SELECT 'webhook logs ok' as status;
