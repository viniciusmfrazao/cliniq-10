-- ============================================================
-- MIGRATION: toggle Eva auto/manual + anti-eco NPS
-- ============================================================
-- Rode UMA VEZ no Supabase SQL Editor. É idempotente (pode rodar
-- de novo sem quebrar nada).
--
-- O que adiciona:
--   1. clinic_whatsapp.auto_reply_enabled — botão liga/desliga
--      da Eva por instância (ON por padrão pra não quebrar
--      comportamento atual).
--   2. leads.eva_pause_until — quando preenchido com timestamp
--      futuro, a Eva fica calada pra esse paciente até o tempo
--      passar. Usado pro anti-eco do NPS (5min) e pode ser
--      reaproveitado pra futuros casos.
-- ============================================================

-- 1. Toggle Eva auto/manual ─────────────────────────────────
ALTER TABLE clinic_whatsapp
  ADD COLUMN IF NOT EXISTS auto_reply_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN clinic_whatsapp.auto_reply_enabled IS
  'Quando false, a Eva NÃO responde automaticamente nessa instância. Mensagens '
  'continuam sendo salvas em eva_conversations e leads são criados normalmente, '
  'mas a Edge Function eva-process não é chamada e o cron eva-followup pula '
  'essa clínica. Toggle no topo de /dashboard/whatsapp.';

-- 2. Anti-eco por paciente ──────────────────────────────────
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS eva_pause_until timestamptz NULL;

COMMENT ON COLUMN leads.eva_pause_until IS
  'Quando preenchido com timestamp futuro, a Eva fica calada pra esse lead até '
  'o tempo passar. Usado pra: anti-eco NPS (5min após captura de score), '
  'cooldown manual e futuros gatilhos. Cron eva-followup também respeita.';

CREATE INDEX IF NOT EXISTS idx_leads_eva_pause_until
  ON leads(eva_pause_until)
  WHERE eva_pause_until IS NOT NULL;

-- 3. Verificação ─────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM clinic_whatsapp WHERE auto_reply_enabled = true)
    AS instancias_com_eva_ativa,
  (SELECT COUNT(*) FROM clinic_whatsapp WHERE auto_reply_enabled = false)
    AS instancias_com_eva_pausada,
  (SELECT COUNT(*) FROM leads WHERE eva_pause_until IS NOT NULL AND eva_pause_until > NOW())
    AS leads_em_cooldown_ativo;
