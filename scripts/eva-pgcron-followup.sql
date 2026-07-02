-- ============================================================================
-- pg_cron schedule: dispara o endpoint /api/cron/eva-followup a cada 2 min
--
-- Por que isso? O plano HOBBY do Vercel limita crons a 1x/dia. O follow-up
-- automatico da Eva precisa rodar com frequencia alta pra funcionar junto
-- com o pacer anti-ban (gap de 15-35s por instancia, ver whatsapp_pace_send):
-- lotes pequenos (10) rodando a cada 2min evitam que o pacer descarte
-- (rate_limited) a maior parte do lote por falta de tempo de espera.
-- Solucao: o Vercel cron roda apenas 1x/dia (defesa) e o pg_cron do Supabase
-- chama o endpoint com a frequencia certa.
--
-- IMPORTANTE: antes de rodar, substitua os placeholders abaixo:
--   {{VERCEL_URL}} -> https://clinike.vercel.app  (sua URL de producao)
--   {{CRON_SECRET}} -> mesmo valor da env var CRON_SECRET no Vercel
--
-- Pra ver o valor atual de CRON_SECRET no Vercel:
--   1. https://vercel.com/dashboard -> projeto -> Settings -> Environment Variables
--   2. Procure CRON_SECRET e clique no olhinho pra ver o valor
--
-- Idempotente: pode rodar varias vezes (drop antes de criar).
-- ============================================================================

-- 1) Garante extensions necessarias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2) Funcao que dispara o webhook do Vercel
CREATE OR REPLACE FUNCTION public.eva_followup_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url text := '{{VERCEL_URL}}/api/cron/eva-followup';
  v_token text := '{{CRON_SECRET}}';
  v_request_id bigint;
BEGIN
  v_request_id := net.http_get(
    url := v_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_token,
      'User-Agent', 'pg_cron/eva-followup'
    ),
    timeout_milliseconds := 30000
  );
  -- Log opcional (remova se nao quiser)
  RAISE NOTICE 'eva_followup_tick disparado: request_id=%', v_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.eva_followup_tick() TO postgres;

-- 3) Remove agendamento antigo (se existir) e cria novo
SELECT cron.unschedule('eva-followup-30min')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'eva-followup-30min'
);
SELECT cron.unschedule('eva-followup-2min')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'eva-followup-2min'
);

SELECT cron.schedule(
  'eva-followup-2min',
  '*/2 * * * *',           -- a cada 2 minutos
  $$ SELECT public.eva_followup_tick() $$
);


-- ============================================================================
-- Verificacao
-- ============================================================================
SELECT jobid, jobname, schedule, active, command
FROM cron.job
WHERE jobname = 'eva-followup-2min';

-- Ver historico das ultimas execucoes (apos rodar):
-- SELECT runid, jobname, status, return_message, start_time, end_time
-- FROM cron.job_run_details
-- WHERE jobname = 'eva-followup-2min'
-- ORDER BY start_time DESC
-- LIMIT 10;
