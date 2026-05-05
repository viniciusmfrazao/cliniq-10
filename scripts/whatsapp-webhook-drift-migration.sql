-- =====================================================================
-- WhatsApp webhook URL drift detection
-- =====================================================================
-- Quando o dominio publico do app muda (ex: clinike.vercel.app -> app.clinike.com.br)
-- o webhook salvo na Evolution continua apontando pro dominio antigo e ai entra
-- num "modo zumbi" — Evolution chama URL morta, todas as mensagens dos pacientes
-- somem e ninguem percebe ate alguem reclamar.
--
-- Pra evitar isso:
--  - O cron whatsapp-health agora le o webhook configurado na Evolution
--    (via /webhook/find/{instance}) e compara com a URL ATUAL esperada
--    (NEXT_PUBLIC_APP_URL).
--  - Se forem diferentes, AUTO-CORRIGE chamando setInstanceWebhook e marca
--    health_warning=true por 1 ciclo (com health_reason='webhook_url_drift_fixed')
--    pra dar visibilidade do que aconteceu.
--  - Tambem persistimos a URL atual e a esperada pra debug.
-- =====================================================================

ALTER TABLE clinic_whatsapp
  ADD COLUMN IF NOT EXISTS webhook_actual_url   text NULL,
  ADD COLUMN IF NOT EXISTS webhook_expected_url text NULL,
  ADD COLUMN IF NOT EXISTS webhook_last_fixed_at timestamptz NULL;

COMMENT ON COLUMN clinic_whatsapp.webhook_actual_url IS
  'URL que a Evolution diz ter armazenada para o webhook desta instance (lido em /webhook/find).';

COMMENT ON COLUMN clinic_whatsapp.webhook_expected_url IS
  'URL que o app espera que a Evolution chame (calculada a partir de NEXT_PUBLIC_APP_URL).';

COMMENT ON COLUMN clinic_whatsapp.webhook_last_fixed_at IS
  'Quando o cron auto-corrigiu a URL do webhook pela ultima vez.';
