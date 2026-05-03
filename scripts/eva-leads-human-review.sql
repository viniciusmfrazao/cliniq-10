-- ============================================================================
-- Adiciona campos de "atendimento humano" em leads — usado pelo escalar_humano
-- e exibido como badge no CRM.
--
-- Idempotente: pode rodar varias vezes.
-- ============================================================================

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS needs_human_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS human_review_reason text,
  ADD COLUMN IF NOT EXISTS human_review_details text,
  ADD COLUMN IF NOT EXISTS human_review_at timestamptz;

-- Indice pra acelerar o filtro "Apenas atendimento humano" no CRM
CREATE INDEX IF NOT EXISTS idx_leads_needs_human_review
  ON leads(clinic_id, needs_human_review)
  WHERE needs_human_review = true;

-- Comentarios pra futura referencia
COMMENT ON COLUMN leads.needs_human_review IS
  'TRUE quando Eva chamou escalar_humano. Aparece como badge no CRM e pausa follow-up automatico.';
COMMENT ON COLUMN leads.human_review_reason IS
  'Motivo: cancelamento, reagendamento, reclamacao, duvida_complexa.';
COMMENT ON COLUMN leads.human_review_details IS
  'Contexto: ex. para reagendamento, dia/horario solicitado pela paciente.';

-- Confirmacao
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'leads'
  AND column_name LIKE 'human_review%' OR column_name = 'needs_human_review';
