-- ============================================================================
-- Agenda: correcao de sobreposicao + busca de proximos dias com vaga
--
-- BUG CORRIGIDO: get_available_slots so checava se o INICIO do slot caia
-- dentro de um agendamento. Um slot que comecava antes e terminava DEPOIS do
-- inicio de outro atendimento era oferecido como livre.
--   Ex (prod, 29/07): Dra. Amanda tinha 17:00-18:00 ocupado e a RPC oferecia
--   o slot das 16:30 para um procedimento de 90min (16:30-18:00).
-- A Eva oferecia, a paciente aceitava, e o criar_agendamento (que ja usava a
-- checagem correta em validarSlot) devolvia HORARIO_OCUPADO — a Eva tinha que
-- se desdizer no momento exato da conversao.
--
-- Tambem nesta migration:
--  - blocked/busy agora usam overlap de intervalo em vez de start_time::DATE,
--    o que passa a cobrir bloqueios multi-dia (ferias) que antes so bloqueavam
--    o primeiro dia.
--  - p_step_min (default 15): antes o passo da grade era a propria duracao do
--    procedimento, escondendo disponibilidade real.
--  - p_min_lead_min (default 0): antecedencia minima. A UI da recepcao fica em
--    0 (encaixe de quem chegou agora); a Eva passa 60.
--  - get_next_available_days: novos dias com vaga real, pra Eva parar de
--    chutar dias quando o dia pedido esta lotado.
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_available_slots(uuid, date, uuid, integer, text, uuid);

CREATE FUNCTION public.get_available_slots(
  p_clinic_id uuid,
  p_date date,
  p_professional_id uuid DEFAULT NULL::uuid,
  p_duration_min integer DEFAULT 30,
  p_period text DEFAULT NULL::text,
  p_procedure_id uuid DEFAULT NULL::uuid,
  p_min_lead_min integer DEFAULT 0,
  p_step_min integer DEFAULT 15
)
RETURNS TABLE(professional_id uuid, professional_name text, slot_time time without time zone, slot_datetime timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_dow SMALLINT := EXTRACT(DOW FROM p_date)::SMALLINT;
  v_duration INTERVAL := make_interval(mins => GREATEST(COALESCE(p_duration_min, 30), 5));
  v_step     INTERVAL := make_interval(mins => GREATEST(COALESCE(p_step_min, 15), 5));
  v_lead     INTERVAL := make_interval(mins => GREATEST(COALESCE(p_min_lead_min, 0), 0));
  v_day_start TIMESTAMPTZ := (p_date::timestamp) AT TIME ZONE 'America/Sao_Paulo';
  v_day_end   TIMESTAMPTZ := ((p_date + 1)::timestamp) AT TIME ZONE 'America/Sao_Paulo';
  v_proc_prof_ids UUID[];
  v_has_date_restriction BOOLEAN := FALSE;
  v_date_available BOOLEAN := FALSE;
BEGIN
  IF p_procedure_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM procedure_available_dates WHERE procedure_id = p_procedure_id AND clinic_id = p_clinic_id) INTO v_has_date_restriction;
    IF v_has_date_restriction THEN
      SELECT EXISTS(SELECT 1 FROM procedure_available_dates WHERE procedure_id = p_procedure_id AND clinic_id = p_clinic_id AND available_date = p_date) INTO v_date_available;
      IF NOT v_date_available THEN RETURN; END IF;
    END IF;
    SELECT professional_ids INTO v_proc_prof_ids FROM procedures WHERE id = p_procedure_id AND clinic_id = p_clinic_id;
  END IF;

  RETURN QUERY
  WITH schedules AS (
    SELECT DISTINCT ps.professional_id, u.name AS professional_name, ps.start_time, ps.end_time
    FROM professional_schedules ps
    JOIN users u ON u.id = ps.professional_id
    WHERE ps.clinic_id = p_clinic_id AND ps.is_active = true AND u.active = true
      AND ps.day_of_week = v_dow
      AND (p_professional_id IS NULL OR ps.professional_id = p_professional_id)
      AND (v_proc_prof_ids IS NULL OR cardinality(v_proc_prof_ids) = 0 OR ps.professional_id = ANY(v_proc_prof_ids))
  ),
  slots AS (
    SELECT s.professional_id, s.professional_name,
      slot_ts::TIME AS slot_time,
      slot_ts AT TIME ZONE 'America/Sao_Paulo' AS slot_datetime
    FROM schedules s
    CROSS JOIN LATERAL generate_series(
      (p_date::TIMESTAMP + s.start_time),
      (p_date::TIMESTAMP + s.end_time - v_duration),
      v_step
    ) AS slot_ts
  ),
  busy AS (
    SELECT a.professional_id, a.start_time AS busy_start, a.end_time AS busy_end
    FROM appointments a
    WHERE a.clinic_id = p_clinic_id
      AND a.status IN ('scheduled','confirmed','pending_confirmation','checked_in','in_progress')
      AND a.start_time < v_day_end AND a.end_time > v_day_start
      AND (p_professional_id IS NULL OR a.professional_id = p_professional_id)
  ),
  blocked AS (
    SELECT pb.professional_id, pb.start_time AS block_start, pb.end_time AS block_end
    FROM professional_blocks pb
    WHERE pb.clinic_id = p_clinic_id
      AND pb.start_time < v_day_end AND pb.end_time > v_day_start
      AND (p_professional_id IS NULL OR pb.professional_id = p_professional_id)
  )
  SELECT DISTINCT sl.professional_id, sl.professional_name, sl.slot_time, sl.slot_datetime
  FROM slots sl
  WHERE (p_period IS NULL
         OR (p_period = 'manha' AND sl.slot_time < '12:00')
         OR (p_period = 'tarde' AND sl.slot_time >= '12:00' AND sl.slot_time < '18:00')
         OR (p_period = 'noite' AND sl.slot_time >= '18:00'))
    AND NOT EXISTS (
      SELECT 1 FROM busy b
      WHERE b.professional_id = sl.professional_id
        AND sl.slot_datetime < b.busy_end
        AND (sl.slot_datetime + v_duration) > b.busy_start
    )
    AND NOT EXISTS (
      SELECT 1 FROM blocked bl
      WHERE bl.professional_id = sl.professional_id
        AND sl.slot_datetime < bl.block_end
        AND (sl.slot_datetime + v_duration) > bl.block_start
    )
    AND sl.slot_datetime >= now() + v_lead
  ORDER BY sl.professional_name, sl.slot_time;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_next_available_days(
  p_clinic_id uuid,
  p_procedure_id uuid DEFAULT NULL::uuid,
  p_from date DEFAULT NULL::date,
  p_days_to_scan integer DEFAULT 21,
  p_limit integer DEFAULT 3,
  p_duration_min integer DEFAULT NULL::integer,
  p_period text DEFAULT NULL::text,
  p_min_lead_min integer DEFAULT 0
)
RETURNS TABLE(available_date date, slots_count integer, first_slot time without time zone, professionals text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_from  date := COALESCE(p_from, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  v_scan  int  := LEAST(GREATEST(COALESCE(p_days_to_scan, 21), 1), 60);
  v_limit int  := LEAST(GREATEST(COALESCE(p_limit, 3), 1), 10);
  v_dur   int  := p_duration_min;
  v_found int  := 0;
  v_i     int  := 0;
  v_d     date;
  v_cnt   int;
  v_first time;
  v_profs text[];
BEGIN
  IF v_dur IS NULL AND p_procedure_id IS NOT NULL THEN
    SELECT duration_minutes INTO v_dur FROM procedures
    WHERE id = p_procedure_id AND clinic_id = p_clinic_id;
  END IF;
  v_dur := COALESCE(v_dur, 30);

  WHILE v_i < v_scan AND v_found < v_limit LOOP
    v_d := v_from + v_i;

    SELECT count(*)::int, min(s.slot_time), array_agg(DISTINCT s.professional_name)
      INTO v_cnt, v_first, v_profs
      FROM get_available_slots(
        p_clinic_id, v_d, NULL, v_dur, p_period, p_procedure_id, p_min_lead_min, 15
      ) s;

    IF COALESCE(v_cnt, 0) > 0 THEN
      available_date := v_d;
      slots_count    := v_cnt;
      first_slot     := v_first;
      professionals  := v_profs;
      RETURN NEXT;
      v_found := v_found + 1;
    END IF;

    v_i := v_i + 1;
  END LOOP;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_available_slots(uuid, date, uuid, integer, text, uuid, integer, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_next_available_days(uuid, uuid, date, integer, integer, integer, text, integer) TO anon, authenticated, service_role;
