-- ============================================
-- AJUSTE DE TIMEZONE — IMPORTANTE!
-- ============================================
-- Quando voce cria um projeto Supabase, a regiao escolhida (ex: us-east)
-- afeta APENAS onde o servidor esta hospedado (latencia).
-- O TIMEZONE padrao do Postgres continua sendo UTC.
--
-- Resultado: funcoes como now(), CURRENT_DATE e conversoes ::DATE
-- usam UTC. As 21h de Brasilia (UTC-3) ja sao 00h UTC do dia seguinte.
-- Por isso o sistema "vira o dia" antes da meia-noite local.
--
-- Esta migration:
--   1) Configura o timezone DEFAULT do banco/role pra America/Sao_Paulo.
--   2) NAO altera nenhum dado armazenado (timestamptz e armazenado em UTC,
--      apenas a EXIBICAO/comparacao na sessao muda).
--
-- COMO RODAR:
--   - Va no Supabase > SQL Editor
--   - Cole TUDO e clique RUN
--   - Pronto.
-- ============================================

-- 1) Timezone padrao do banco inteiro
ALTER DATABASE postgres SET TIMEZONE TO 'America/Sao_Paulo';

-- 2) Timezone padrao para os roles que conectam (PostgREST, Realtime, etc)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT rolname FROM pg_roles
    WHERE rolname IN ('postgres','authenticator','authenticated','anon','service_role')
  LOOP
    EXECUTE format('ALTER ROLE %I SET TIMEZONE TO %L', r.rolname, 'America/Sao_Paulo');
  END LOOP;
END $$;

-- 3) Conferencia rapida (deve retornar America/Sao_Paulo apos reconectar)
-- SELECT current_setting('TIMEZONE'), now(), CURRENT_DATE;

-- ============================================
-- IMPORTANTE: depois de rodar, FECHE e ABRA novamente
-- a aba do Supabase pra a sessao pegar o novo timezone.
-- ============================================
