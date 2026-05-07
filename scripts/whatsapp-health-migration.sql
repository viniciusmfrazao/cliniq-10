-- =====================================================================
-- WhatsApp health monitoring
-- =====================================================================
-- Detecta sessoes "fantasma" da Evolution: quando o socket Baileys cai
-- silenciosamente (celular reseta o pareamento) mas o status no banco
-- ainda esta 'connected'. O cron /api/cron/whatsapp-health (1x/h)
-- preenche essas colunas e o banner do dashboard alerta o admin.
-- =====================================================================

ALTER TABLE clinic_whatsapp
  ADD COLUMN IF NOT EXISTS health_warning   boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS health_reason    text         NULL,
  ADD COLUMN IF NOT EXISTS health_checked_at timestamptz NULL;

COMMENT ON COLUMN clinic_whatsapp.health_warning IS
  'true quando o cron de health detecta sessao fantasma (Evolution diz close OU last_event_at muito antigo).';

COMMENT ON COLUMN clinic_whatsapp.health_reason IS
  'Razao tecnica do ultimo health_warning (ex: evolution_state=close, no_events_24h).';

COMMENT ON COLUMN clinic_whatsapp.health_checked_at IS
  'Timestamp da ultima verificacao do cron de health.';
