-- ============================================
-- DIAGNÓSTICO: por que a tool consultar_agenda não responde?
--
-- Roda esse arquivo INTEIRO no SQL Editor do Supabase.
-- Cada bloco mostra UM passo do fluxo. O 1º que vier vazio é o problema.
-- ============================================

-- ============================================
-- 1) A RPC get_available_slots EXISTE?
-- ============================================
SELECT
  proname AS funcao,
  pg_get_function_arguments(p.oid) AS args,
  pg_get_function_result(p.oid) AS returns
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND proname = 'get_available_slots';

-- ESPERADO: 1 linha. Se vier 0 → rodar `supabase-horarios.sql` inteiro.
-- ============================================


-- ============================================
-- 2) Quantos profissionais ATIVOS tem a Clínica Sarah Pina?
-- ============================================
SELECT
  count(*) FILTER (WHERE active = true) AS profissionais_ativos,
  count(*) FILTER (WHERE role::text NOT IN ('admin','super_admin','receptionist','financial','manager','assistant','viewer')) AS nao_administrativos,
  count(*) AS total_users
FROM users
WHERE clinic_id = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190';

-- ESPERADO: profissionais_ativos > 0. Se 0 → marca alguém como `active = true`.
-- ============================================


-- ============================================
-- 3) Existem professional_schedules cadastrados?
-- ============================================
SELECT
  count(*) AS total_schedules,
  count(DISTINCT professional_id) AS profissionais_com_schedule,
  count(*) FILTER (WHERE is_active = true) AS schedules_ativos
FROM professional_schedules
WHERE clinic_id = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190';

-- ESPERADO: total_schedules > 0 (idealmente >= 10 = 5 dias úteis × 2 turnos × 1 prof).
-- Se 0 → o SEED do `supabase-horarios.sql` não rodou.
--   Rode novamente OU cadastre na tela /dashboard/configuracoes (menu Horários).
-- ============================================


-- ============================================
-- 4) Detalhe dos schedules da clínica
-- ============================================
SELECT
  u.name AS profissional,
  CASE ps.day_of_week
    WHEN 0 THEN 'domingo'
    WHEN 1 THEN 'segunda'
    WHEN 2 THEN 'terca'
    WHEN 3 THEN 'quarta'
    WHEN 4 THEN 'quinta'
    WHEN 5 THEN 'sexta'
    WHEN 6 THEN 'sabado'
  END AS dia_semana,
  ps.start_time,
  ps.end_time,
  ps.is_active
FROM professional_schedules ps
JOIN users u ON u.id = ps.professional_id
WHERE ps.clinic_id = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190'
ORDER BY u.name, ps.day_of_week, ps.start_time;

-- ESPERADO: lista de horários por profissional/dia. Se vazia → idem item 3.
-- ============================================


-- ============================================
-- 5) TESTE REAL DA RPC — mesma chamada que o n8n faz
-- Para AMANHÃ (qualquer dia útil): deve retornar slots
-- ============================================
SELECT *
FROM get_available_slots(
  '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190'::uuid,    -- clinic_id
  (CURRENT_DATE + INTERVAL '1 day')::date,         -- amanhã
  NULL,                                             -- todos profissionais
  30,                                               -- 30min
  NULL,                                             -- qualquer período
  NULL                                              -- qualquer procedimento
)
LIMIT 20;

-- ESPERADO: lista de slots (professional_id, name, slot_time, slot_datetime).
-- SE VAZIO mas itens 2-4 ok → ver item 6 (filtro de procedimento).
-- ============================================


-- ============================================
-- 6) Checagem específica: o procedimento "Preenchimento Facial"
-- tem profissionais cadastrados que TÊM schedule?
-- ============================================
WITH proc AS (
  SELECT id, name, professional_ids
  FROM procedures
  WHERE clinic_id = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190'
    AND name ILIKE '%preenchimento%facial%'
    AND active = true
  LIMIT 1
)
SELECT
  p.name AS procedimento,
  array_length(p.professional_ids, 1) AS qtd_prof_no_procedimento,
  (SELECT count(*) FROM professional_schedules ps
   WHERE ps.clinic_id = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190'
     AND ps.professional_id = ANY(p.professional_ids)
     AND ps.is_active = true) AS schedules_compativeis
FROM proc p;

-- Se schedules_compativeis = 0 → os profissionais que fazem
-- "Preenchimento Facial" não têm horário cadastrado.
-- Solução: ou cadastra schedule pra eles, ou tira o filtro de
-- profissional do procedimento (deixa vazio).
-- ============================================


-- ============================================
-- 7) TESTE DA RPC com filtro de procedimento
-- ============================================
WITH proc AS (
  SELECT id FROM procedures
  WHERE clinic_id = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190'
    AND name ILIKE '%preenchimento%facial%'
    AND active = true
  LIMIT 1
)
SELECT *
FROM get_available_slots(
  '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190'::uuid,
  (CURRENT_DATE + INTERVAL '1 day')::date,
  NULL,
  30,
  NULL,
  (SELECT id FROM proc)
)
LIMIT 20;

-- Se item 5 retorna slots mas este vem vazio → o filtro de procedimento
-- está cortando todos os profissionais. Resolva com item 6.
-- ============================================
