-- procedures.eva_policy: controla o que a Eva pode fazer com cada procedimento.
--   'ofertar' (default) -> comportamento normal
--   'escalar'           -> Eva reconhece o nome mas NAO oferece, NAO precifica
--                          e NAO agenda; chama escalar_humano
--   'ocultar'           -> nem entra no prompt
-- Caso Sarah Pina: a Eva so pode ofertar "Botox Terco Superior" e
-- "Clube do Botox"; qualquer outro botox vai pra humano.
--
-- Tambem expoe eva_policy e as datas de procedure_available_dates dentro de
-- donna_load_context, para o prompt e o criar_agendamento respeitarem sem
-- consulta extra por turno.
ALTER TABLE procedures
  ADD COLUMN IF NOT EXISTS eva_policy text NOT NULL DEFAULT 'ofertar';

DO $mig$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'procedures_eva_policy_check') THEN
    ALTER TABLE procedures
      ADD CONSTRAINT procedures_eva_policy_check
      CHECK (eva_policy IN ('ofertar','escalar','ocultar'));
  END IF;
END
$mig$;

COMMENT ON COLUMN procedures.eva_policy IS
  'Como a Eva trata o procedimento: ofertar (normal), escalar (encaminha pra humano se perguntarem), ocultar (nem menciona).';

DO $mig$
DECLARE
  v_def text; v_new text; v_eol text; v_old text; v_rep text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def FROM pg_proc WHERE proname = 'donna_load_context' LIMIT 1;
  IF v_def IS NULL THEN RAISE EXCEPTION 'donna_load_context nao encontrada'; END IF;
  IF position('eva_policy' in v_def) > 0 THEN RETURN; END IF;

  v_eol := CASE WHEN position(E'\r\n' in v_def) > 0 THEN E'\r\n' ELSE E'\n' END;

  v_old := '          ''category'', category' || v_eol
        || '        ) ORDER BY name ASC)' || v_eol
        || '        FROM procedures';

  v_rep := '          ''category'', category,' || v_eol
        || '          ''eva_policy'', COALESCE(p_proc.eva_policy, ''ofertar''),' || v_eol
        || '          ''restricted_dates'', (' || v_eol
        || '            SELECT jsonb_agg(d.available_date ORDER BY d.available_date)' || v_eol
        || '            FROM procedure_available_dates d' || v_eol
        || '            WHERE d.procedure_id = p_proc.id AND d.available_date >= CURRENT_DATE' || v_eol
        || '          )' || v_eol
        || '        ) ORDER BY name ASC)' || v_eol
        || '        FROM procedures p_proc';

  IF position(v_old in v_def) = 0 THEN
    RAISE EXCEPTION 'snippet de procedures nao bateu em donna_load_context — abortando patch textual';
  END IF;

  v_new := replace(v_def, v_old, v_rep);
  EXECUTE v_new;
END
$mig$;
