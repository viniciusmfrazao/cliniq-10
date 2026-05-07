-- ============================================================================
-- Schema do follow-up automatico da Eva
--
-- Adiciona 2 colunas em `leads`:
--   - eva_followup_count    : quantos follow-ups ja foram enviados (0..3)
--   - eva_next_followup_at  : quando o proximo follow-up deve disparar
--
-- Fluxo (tempos fixos):
--   t0  = paciente ficou em silencio (Eva enviou ultima resposta)
--   +2h  → cron envia follow-up #1 → eva_followup_count=1
--   +1d  → cron envia follow-up #2 → eva_followup_count=2
--   +2d  → cron envia follow-up #3 → eva_followup_count=3
--   apos #3 sem resposta → status='lost', lost_reason='sem_resposta_72h'
--
-- Quando o paciente responde, a Edge Function reseta eva_followup_count=0
-- e eva_next_followup_at=NULL (cancela follow-ups pendentes).
--
-- Quando a Eva CRIA um agendamento, tambem zera (lead foi convertido).
-- ============================================================================

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS eva_followup_count   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eva_next_followup_at timestamptz NULL;

-- Indice pro cron varrer rapido
CREATE INDEX IF NOT EXISTS idx_leads_eva_next_followup
  ON leads(eva_next_followup_at)
  WHERE eva_next_followup_at IS NOT NULL;

-- View opcional pra voce monitorar quem esta em follow-up
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
  AND l.whatsapp_opt_in IS DISTINCT FROM false
ORDER BY l.eva_next_followup_at NULLS LAST;
