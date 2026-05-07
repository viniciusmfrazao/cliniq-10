-- ============================================================================
-- Trigger: ao marcar appointment como 'completed' (paciente compareceu),
-- avanca o lead correspondente (mesmo telefone) de 'scheduled' pra 'converted'.
--
-- Logica:
--   - Pega o telefone do paciente do appointment
--   - Acha o lead com mesmo phone (variantes brasileiras)
--   - Se status atual eh 'scheduled' ou 'contacted' ou 'new', avanca pra 'converted'
--   - Nao mexe se ja for 'converted' ou 'lost' (preserva decisao manual)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.tg_appointment_completed_to_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_phone text;
  v_lead_id uuid;
BEGIN
  -- So roda quando STATUS muda pra 'completed'
  IF NEW.status <> 'completed' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' THEN
    RETURN NEW; -- ja estava completed, evita re-trigger
  END IF;

  -- Busca telefone do paciente
  SELECT phone INTO v_patient_phone
  FROM patients
  WHERE id = NEW.patient_id;

  IF v_patient_phone IS NULL OR v_patient_phone = '' THEN
    RETURN NEW;
  END IF;

  -- Acha o lead mais recente com mesmo telefone (variantes BR)
  SELECT id INTO v_lead_id
  FROM leads
  WHERE clinic_id = NEW.clinic_id
    AND phone = ANY(public.phone_variants(v_patient_phone))
    AND status IN ('new', 'contacted', 'scheduled')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_lead_id IS NOT NULL THEN
    UPDATE leads
    SET
      status = 'converted',
      converted_at = COALESCE(converted_at, now()),
      conversion_notes = COALESCE(conversion_notes, 'Compareceu na clinica (appointment ' || NEW.id::text || ')'),
      last_contact_at = now(),
      eva_followup_count = 0,
      eva_next_followup_at = NULL
    WHERE id = v_lead_id;
  END IF;

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tg_appointment_completed_to_lead() TO service_role;

DROP TRIGGER IF EXISTS appointment_completed_to_lead ON appointments;

CREATE TRIGGER appointment_completed_to_lead
  AFTER INSERT OR UPDATE OF status ON appointments
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION public.tg_appointment_completed_to_lead();


-- ============================================================================
-- Teste manual (descomente para conferir):
-- ============================================================================
-- UPDATE appointments SET status = 'completed' WHERE id = 'algum-uuid';
-- SELECT id, name, status, converted_at FROM leads WHERE phone = ...;
