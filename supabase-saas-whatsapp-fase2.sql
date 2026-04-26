-- ===========================================================================
-- Fase 2 - Self-service de WhatsApp (extensões)
-- ===========================================================================
-- Idempotente: pode rodar múltiplas vezes sem problemas.
-- Pré-requisito: supabase-saas-whatsapp.sql (Fase 1) já executado.

-- 1) Coluna metadata em eva_conversations (rastreio de message_id Evolution, push_name etc)
ALTER TABLE eva_conversations
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2) Índice para acelerar consulta por (clinic_id, phone) ordenado por created_at
CREATE INDEX IF NOT EXISTS idx_eva_conversations_clinic_phone_created
  ON eva_conversations (clinic_id, phone, created_at DESC);

-- 3) Índice para acelerar lookup de instance_name no webhook receiver
-- (já existe idx_clinic_whatsapp_instance da Fase 1, mas garantimos)
CREATE INDEX IF NOT EXISTS idx_clinic_whatsapp_instance_lookup
  ON clinic_whatsapp (instance_name);

-- 4) Confere
SELECT 'fase 2 ok' as status;
