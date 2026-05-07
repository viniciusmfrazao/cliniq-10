-- =====================================================================
-- NPS Imediato pos-atendimento
-- =====================================================================
-- Adiciona uma flag em clinic_automations que, quando ligada,
-- dispara o envio do NPS *na hora* em que o atendimento e finalizado
-- (status -> 'completed'), em vez de esperar o cron diario das 11h.
--
-- O cron diario continua existindo como fallback: se o NPS imediato
-- falhar (WhatsApp desconectado, paciente sem telefone, etc),
-- o cron pega no dia seguinte (a coluna nps_sent_at no appointment
-- segue como guarda de idempotencia).
-- =====================================================================

ALTER TABLE clinic_automations
  ADD COLUMN IF NOT EXISTS nps_imediato boolean NOT NULL DEFAULT false;

ALTER TABLE clinic_automations
  ADD COLUMN IF NOT EXISTS nps_delay_minutes integer NOT NULL DEFAULT 30;

COMMENT ON COLUMN clinic_automations.nps_imediato IS
  'Quando true, envia o NPS assim que o atendimento e marcado como completed (em vez de esperar o cron diario das 11h).';

COMMENT ON COLUMN clinic_automations.nps_delay_minutes IS
  'Quantos minutos esperar depois do atendimento mudar pra completed antes de disparar o NPS imediato (default 30min, pra dar tempo do paciente sair).';

-- =====================================================================
-- Coluna na fila de atendimentos
-- =====================================================================
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS nps_scheduled_at timestamptz NULL;

COMMENT ON COLUMN appointments.nps_scheduled_at IS
  'Quando preenchido, o cron de NPS imediato deve disparar a mensagem assim que esse horario passar (e nps_sent_at ainda for null).';

CREATE INDEX IF NOT EXISTS appointments_nps_scheduled_idx
  ON appointments(nps_scheduled_at)
  WHERE nps_scheduled_at IS NOT NULL AND nps_sent_at IS NULL;

-- =====================================================================
-- Trigger: quando o status do appointment muda pra 'completed',
-- agenda o NPS imediato se a flag da clinica estiver ligada.
-- =====================================================================
CREATE OR REPLACE FUNCTION trg_nps_schedule_on_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_imediato boolean;
  v_delay int;
BEGIN
  IF NEW.status = 'completed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed')
     AND NEW.nps_sent_at IS NULL
     AND NEW.nps_scheduled_at IS NULL
  THEN
    SELECT nps_imediato, COALESCE(nps_delay_minutes, 30)
    INTO v_imediato, v_delay
    FROM clinic_automations
    WHERE clinic_id = NEW.clinic_id;

    IF COALESCE(v_imediato, false) THEN
      NEW.nps_scheduled_at := now() + (v_delay || ' minutes')::interval;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS appointments_nps_schedule_on_complete ON appointments;
CREATE TRIGGER appointments_nps_schedule_on_complete
  BEFORE INSERT OR UPDATE OF status ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION trg_nps_schedule_on_complete();

-- =====================================================================
-- Backfill defensivo: se ja existe alguma clinica com nps_imediato true
-- e tem atendimentos completados nas ultimas 6h sem nps_sent_at, agenda agora.
-- (Roda uma vez na primeira aplicacao. Idempotente.)
-- =====================================================================
UPDATE appointments a
SET nps_scheduled_at = now() + (COALESCE(ca.nps_delay_minutes, 30) || ' minutes')::interval
FROM clinic_automations ca
WHERE a.clinic_id = ca.clinic_id
  AND ca.nps_imediato = true
  AND ca.nps_pos_atendimento = true
  AND a.status = 'completed'
  AND a.nps_sent_at IS NULL
  AND a.nps_scheduled_at IS NULL
  AND a.start_time > now() - interval '6 hours';
