-- ============================================
-- MÓDULO: HORÁRIOS DE ATENDIMENTO
--
-- Tabelas para definir horários de trabalho dos profissionais
-- e gerar disponibilidade dinâmica de slots.
--
-- Uso: cole o arquivo inteiro no SQL Editor do Supabase e execute.
-- Seguro pra rodar mais de uma vez (idempotente).
-- ============================================


-- ============================================
-- 1) TABELA: professional_schedules
-- Horários semanais recorrentes por profissional
-- ============================================
CREATE TABLE IF NOT EXISTS professional_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=domingo, 6=sábado
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_prof_schedules_prof_day
  ON professional_schedules(professional_id, day_of_week)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_prof_schedules_clinic
  ON professional_schedules(clinic_id);


-- ============================================
-- 2) TABELA: professional_unavailability
-- Indisponibilidades pontuais (férias, folgas, feriados)
-- professional_id NULL => aplica à clínica inteira (feriado)
-- ============================================
CREATE TABLE IF NOT EXISTS professional_unavailability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  professional_id UUID REFERENCES users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME,   -- NULL = dia todo
  end_time TIME,     -- NULL = dia todo
  reason TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (end_date >= start_date),
  CHECK ((start_time IS NULL AND end_time IS NULL) OR (end_time > start_time))
);

CREATE INDEX IF NOT EXISTS idx_prof_unavail_clinic_dates
  ON professional_unavailability(clinic_id, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_prof_unavail_prof
  ON professional_unavailability(professional_id);


-- ============================================
-- 3) FUNÇÃO: get_available_slots
-- Retorna slots disponíveis de um profissional (ou todos) em uma data.
--
-- Parâmetros:
--   p_clinic_id       - obrigatório
--   p_date            - data desejada
--   p_professional_id - opcional (NULL = todos profissionais ativos com schedule)
--   p_duration_min    - duração do slot em minutos (default 30)
--   p_period          - 'manha' | 'tarde' | 'noite' | NULL
--   p_procedure_id    - opcional: filtra profissionais elegíveis pelo procedimento
-- ============================================
CREATE OR REPLACE FUNCTION get_available_slots(
  p_clinic_id UUID,
  p_date DATE,
  p_professional_id UUID DEFAULT NULL,
  p_duration_min INT DEFAULT 30,
  p_period TEXT DEFAULT NULL,
  p_procedure_id UUID DEFAULT NULL
)
RETURNS TABLE (
  professional_id UUID,
  professional_name TEXT,
  slot_time TIME,
  slot_datetime TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dow SMALLINT := EXTRACT(DOW FROM p_date)::SMALLINT;
  v_duration INTERVAL := make_interval(mins => COALESCE(p_duration_min, 30));
  v_proc_prof_ids UUID[];
BEGIN
  -- Se um procedimento foi informado, descobrir quais profissionais o realizam
  IF p_procedure_id IS NOT NULL THEN
    SELECT professional_ids INTO v_proc_prof_ids
    FROM procedures
    WHERE id = p_procedure_id AND clinic_id = p_clinic_id;
    -- v_proc_prof_ids NULL ou array vazio => qualquer profissional pode (não filtra)
  END IF;

  RETURN QUERY
  WITH schedules AS (
    SELECT
      ps.professional_id,
      u.name AS professional_name,
      ps.start_time,
      ps.end_time
    FROM professional_schedules ps
    JOIN users u ON u.id = ps.professional_id
    WHERE ps.clinic_id = p_clinic_id
      AND ps.is_active = true
      AND u.active = true
      AND ps.day_of_week = v_dow
      AND (p_professional_id IS NULL OR ps.professional_id = p_professional_id)
      AND (
        v_proc_prof_ids IS NULL
        OR cardinality(v_proc_prof_ids) = 0
        OR ps.professional_id = ANY(v_proc_prof_ids)
      )
  ),
  slots AS (
    SELECT
      s.professional_id,
      s.professional_name,
      slot_ts::TIME                    AS slot_time,
      slot_ts AT TIME ZONE 'America/Sao_Paulo' AS slot_datetime
    FROM schedules s
    CROSS JOIN LATERAL generate_series(
      (p_date::TIMESTAMP + s.start_time),
      (p_date::TIMESTAMP + s.end_time - v_duration),
      v_duration
    ) AS slot_ts
  ),
  busy AS (
    SELECT
      a.professional_id,
      a.start_time AS busy_start,
      a.end_time   AS busy_end
    FROM appointments a
    WHERE a.clinic_id = p_clinic_id
      AND a.status IN ('scheduled','confirmed','pending_confirmation','checked_in','in_progress')
      AND a.start_time::DATE = p_date
      AND (p_professional_id IS NULL OR a.professional_id = p_professional_id)
  ),
  unavail AS (
    SELECT
      u.professional_id,
      COALESCE(u.start_time, '00:00:00'::TIME) AS u_start,
      COALESCE(u.end_time,   '23:59:59'::TIME) AS u_end
    FROM professional_unavailability u
    WHERE u.clinic_id = p_clinic_id
      AND p_date BETWEEN u.start_date AND u.end_date
  )
  SELECT
    sl.professional_id,
    sl.professional_name,
    sl.slot_time,
    sl.slot_datetime
  FROM slots sl
  WHERE
    (
      p_period IS NULL
      OR (p_period = 'manha' AND sl.slot_time <  '12:00'::TIME)
      OR (p_period = 'tarde' AND sl.slot_time >= '12:00'::TIME AND sl.slot_time < '18:00'::TIME)
      OR (p_period = 'noite' AND sl.slot_time >= '18:00'::TIME)
    )
    AND NOT EXISTS (
      SELECT 1 FROM busy b
      WHERE b.professional_id = sl.professional_id
        AND sl.slot_datetime >= b.busy_start
        AND sl.slot_datetime <  b.busy_end
    )
    AND NOT EXISTS (
      SELECT 1 FROM unavail un
      WHERE (un.professional_id = sl.professional_id OR un.professional_id IS NULL)
        AND sl.slot_time >= un.u_start
        AND sl.slot_time <  un.u_end
    )
    AND sl.slot_datetime > now()
  ORDER BY sl.professional_name, sl.slot_time;
END;
$$;

-- Drop antigas assinaturas (sem p_procedure_id) para evitar ambiguidade
DROP FUNCTION IF EXISTS get_available_slots(UUID, DATE, UUID, INT, TEXT);

GRANT EXECUTE ON FUNCTION get_available_slots(UUID, DATE, UUID, INT, TEXT, UUID)
  TO authenticated, service_role, anon;


-- ============================================
-- 4) RLS — seguindo exatamente o padrão do schema-completo.sql
-- (apenas USING, sem WITH CHECK — mesma forma que procedures/appointments/etc)
-- ============================================
ALTER TABLE professional_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_unavailability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic users can manage prof_schedules" ON professional_schedules;
CREATE POLICY "Clinic users can manage prof_schedules" ON professional_schedules
  FOR ALL USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Clinic users can manage prof_unavailability" ON professional_unavailability;
CREATE POLICY "Clinic users can manage prof_unavailability" ON professional_unavailability
  FOR ALL USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));


-- ============================================
-- 5) TRIGGER: atualiza updated_at automaticamente
-- ============================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prof_schedules_updated_at ON professional_schedules;
CREATE TRIGGER trg_prof_schedules_updated_at
  BEFORE UPDATE ON professional_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================
-- 6) SEED — horários padrão para todos profissionais ativos
--
-- Cria horário 09:00-12:00 e 13:30-18:00 de segunda a sexta
-- para cada profissional ativo da clínica Sarah Pina que ainda
-- não tem horário cadastrado.
--
-- Rode manualmente ajustando o clinic_id, ou deixe rodar que já
-- está configurado pra Sarah Pina.
-- ============================================
DO $$
DECLARE
  v_clinic_id UUID := '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190'; -- Clínica Sarah Pina
  v_prof RECORD;
  v_count INT := 0;
BEGIN
  -- só roda se a clínica existe (pra não dar erro em outros ambientes)
  IF NOT EXISTS (SELECT 1 FROM clinics WHERE id = v_clinic_id) THEN
    RAISE NOTICE 'Clínica % não encontrada, seed pulado.', v_clinic_id;
    RETURN;
  END IF;

  FOR v_prof IN
    SELECT id, name FROM users
    WHERE clinic_id = v_clinic_id
      AND active = true
      -- Usamos cast ::text pra evitar erro caso o enum user_role não tenha todos os valores cadastrados.
      -- Pega todos exceto roles administrativos.
      AND role::text NOT IN ('admin','super_admin','receptionist','financial','manager','assistant','viewer')
      AND NOT EXISTS (
        SELECT 1 FROM professional_schedules ps WHERE ps.professional_id = users.id
      )
  LOOP
    -- Manhã seg-sex
    INSERT INTO professional_schedules (clinic_id, professional_id, day_of_week, start_time, end_time)
    SELECT v_clinic_id, v_prof.id, dow, '09:00'::TIME, '12:00'::TIME
    FROM generate_series(1, 5) dow;

    -- Tarde seg-sex
    INSERT INTO professional_schedules (clinic_id, professional_id, day_of_week, start_time, end_time)
    SELECT v_clinic_id, v_prof.id, dow, '13:30'::TIME, '18:00'::TIME
    FROM generate_series(1, 5) dow;

    v_count := v_count + 1;
    RAISE NOTICE 'Seed de horários criado para %', v_prof.name;
  END LOOP;

  RAISE NOTICE 'Seed concluído: % profissionais configurados.', v_count;
END $$;


-- ============================================
-- EXEMPLOS DE USO
-- ============================================
-- Horários disponíveis de todos profissionais em 15/05/2026:
--   SELECT * FROM get_available_slots(
--     '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190'::uuid,
--     '2026-05-15'::date
--   );
--
-- Horários de uma profissional específica, à tarde, com slot de 60min:
--   SELECT * FROM get_available_slots(
--     '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190'::uuid,
--     '2026-05-15'::date,
--     'uuid-da-amanda'::uuid,
--     60,
--     'tarde'
--   );


-- ============================================
-- ROLLBACK (use apenas se precisar começar do zero)
-- ============================================
-- DROP TABLE IF EXISTS professional_unavailability CASCADE;
-- DROP TABLE IF EXISTS professional_schedules CASCADE;
-- DROP FUNCTION IF EXISTS get_available_slots(UUID, DATE, UUID, INT, TEXT, UUID);
-- DROP FUNCTION IF EXISTS get_available_slots(UUID, DATE, UUID, INT, TEXT);
