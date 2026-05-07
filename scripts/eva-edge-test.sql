-- ============================================================================
-- Smoke test da Edge Function eva-process — direto pelo SQL Editor.
--
-- Pré-requisitos:
--   1) supabase functions deploy eva-process  (com verify_jwt=false)
--   2) extensão pg_net habilitada (default em projetos novos)
--   3) ANTHROPIC_API_KEY configurada via supabase secrets set
--
-- O teste:
--   - Chama a Edge Function via pg_net (HTTP request assíncrono)
--   - Aguarda a resposta
--   - Mostra o JSON retornado e o histórico salvo em eva_conversations
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;


-- ─── 1) Disparar a chamada ─────────────────────────────────────────────────
-- Como verify_jwt=false na função, o Authorization é só pro registro/log.
-- Você pode usar 'x' que passa. (Em produção colocaremos x-eva-secret.)

DO $$
DECLARE
  v_request_id bigint;
BEGIN
  SELECT net.http_post(
    url := 'https://yqrjbyaucimvmzpfipgs.supabase.co/functions/v1/eva-process',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer x'
    ),
    body := jsonb_build_object(
      'clinicId', '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190',
      'instance', 'clinica-sarah-pina',
      'phone', '553491805722',
      'userText', 'oi, tem horario pra botox quarta de tarde?',
      'customerName', 'Vinicius Frazao',
      'skipSend', true   -- não envia pro WhatsApp real, só processa
    ),
    timeout_milliseconds := 60000
  ) INTO v_request_id;

  RAISE NOTICE 'Request enviado. ID=%', v_request_id;
END $$;


-- ─── 2) Aguardar resposta ──────────────────────────────────────────────────
-- Claude pode demorar 5-15s. Se vier vazio, rode esse SELECT de novo em uns segundos.
SELECT pg_sleep(8);


-- ─── 3) Ver as últimas 5 respostas (mais recente primeiro) ─────────────────
SELECT
  id,
  status_code,
  LEFT(content::text, 2500) AS body,
  created                    AS responded_at,
  error_msg
FROM net._http_response
ORDER BY created DESC
LIMIT 5;


-- ─── 4) Conferir se a Eva salvou turno em eva_conversations ────────────────
SELECT id, role, LEFT(content, 300) AS preview, created_at, last_agent
FROM eva_conversations
WHERE phone = '553491805722'
ORDER BY created_at DESC
LIMIT 6;


-- ─── 5) Conferir se houve agendamento criado ───────────────────────────────
SELECT
  a.id,
  a.start_time,
  a.status,
  p.name AS paciente,
  pr.name AS profissional,
  proc.name AS procedimento,
  a.notes
FROM appointments a
LEFT JOIN patients p     ON p.id = a.patient_id
LEFT JOIN users pr       ON pr.id = a.professional_id
LEFT JOIN procedures proc ON proc.id = a.procedure_id
WHERE a.notes ILIKE '%pela Eva%'
ORDER BY a.created_at DESC
LIMIT 5;
