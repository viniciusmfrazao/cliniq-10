-- ============================================================================
-- RPC: donna_load_context (v3)
-- Retorna em uma chamada todo o contexto que a Eva precisa por turno:
-- histórico, profissionais, procedimentos, clínica (incluindo settings),
-- paciente, lead, config Evolution e last_assistant_at (pra heurística de
-- saudação calorosa quando passou tempo).
--
-- v2 (mai/2026):
--   - inclui clinic.settings (jsonb) -> endereço, contato, horário, instagram
--   - inclui last_assistant_at (pra detectar conversa "esfriou")
--   - normaliza phone com/sem o "9" pos-DDD pra nao duplicar paciente/lead
--
-- v3 (mai/2026):
--   - aceita p_customer_name (pushName do WhatsApp): quando varios pacientes
--     compartilham o mesmo telefone (base sebsada/duplicada), prioriza match
--     pelo nome real ao inves de pegar arbitrariamente.
--   - usa unaccent pra ignorar acentuacao no match.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS unaccent;
DROP FUNCTION IF EXISTS donna_load_context(uuid, text);

-- 0) Garante que normalize_br_phone existe (idempotente)
CREATE OR REPLACE FUNCTION public.normalize_br_phone(p text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  digits text := regexp_replace(coalesce(p,''), '[^0-9]', '', 'g');
BEGIN
  IF digits = '' THEN RETURN NULL; END IF;
  -- Brasil: se vier sem DDI, adiciona 55. Se tem 12 digitos (sem o "9"
  -- pos-DDD), insere o 9; se tem 13 digitos (já com "9"), mantém.
  IF length(digits) = 11 THEN          -- DDD + 9 + 8 (faltando 55)
    digits := '55' || digits;
  ELSIF length(digits) = 10 THEN        -- DDD + 8 (faltando 55 e 9)
    digits := '55' || substr(digits,1,2) || '9' || substr(digits,3);
  ELSIF length(digits) = 12 THEN        -- 55 + DDD + 8 (faltando 9)
    digits := substr(digits,1,4) || '9' || substr(digits,5);
  END IF;
  RETURN digits;
END;
$$;

GRANT EXECUTE ON FUNCTION public.normalize_br_phone(text) TO PUBLIC, anon, authenticated, service_role;


-- 1) Helper: gera todas as variantes do telefone que devemos checar.
--    Aceita formatos com ou sem o "9" pos-DDD (Brasil).
CREATE OR REPLACE FUNCTION public.phone_variants(p_phone text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY(
    SELECT DISTINCT v
    FROM unnest(ARRAY[
      p_phone,
      public.normalize_br_phone(p_phone),
      regexp_replace(p_phone, '^(\d{4})9', '\1'),         -- remove "9" pos-DDD
      regexp_replace(p_phone, '^(\d{4})(\d{8})$', '\19\2') -- adiciona "9" pos-DDD
    ]) AS v
    WHERE v IS NOT NULL AND v <> ''
  );
$$;

GRANT EXECUTE ON FUNCTION public.phone_variants(text) TO PUBLIC, anon, authenticated, service_role;


-- 2) RPC principal
CREATE OR REPLACE FUNCTION donna_load_context(
  p_clinic_id     uuid,
  p_phone         text,
  p_customer_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'history', COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object('role', role, 'content', content) ORDER BY created_at ASC)
        FROM (
          SELECT role, content, created_at
          FROM eva_conversations
          WHERE clinic_id = p_clinic_id
            AND phone = ANY(public.phone_variants(p_phone))
            AND content IS NOT NULL
            AND length(trim(content)) > 0
          ORDER BY created_at DESC
          LIMIT 40
        ) AS recent
      ),
      '[]'::jsonb
    ),

    'professionals', COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'role', role))
        FROM users
        WHERE clinic_id = p_clinic_id
          AND active = true
          AND id IN (
            SELECT DISTINCT unnest(professional_ids)
            FROM procedures
            WHERE clinic_id = p_clinic_id AND active = true
              AND professional_ids IS NOT NULL
          )
      ),
      '[]'::jsonb
    ),

    'procedures', COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object(
          'id', id,
          'name', name,
          'description', description,
          'price', price,
          'installments', installments,
          'installment_price', installment_price,
          'professional_ids', professional_ids,
          'duration_minutes', duration_minutes,
          'category', category
        ) ORDER BY name ASC)
        FROM procedures
        WHERE clinic_id = p_clinic_id AND active = true
      ),
      '[]'::jsonb
    ),

    'clinic', (
      SELECT jsonb_build_object(
        'name', name,
        'slug', slug,
        'settings', COALESCE(settings, '{}'::jsonb)
      )
      FROM clinics
      WHERE id = p_clinic_id
    ),

    'patient', (
      SELECT jsonb_build_object('id', id, 'name', name, 'birth_date', birth_date)
      FROM patients
      WHERE clinic_id = p_clinic_id
        AND phone = ANY(public.phone_variants(p_phone))
      ORDER BY
        CASE
          WHEN p_customer_name IS NOT NULL
               AND lower(unaccent(name)) = lower(unaccent(p_customer_name))
            THEN 0
          WHEN p_customer_name IS NOT NULL
               AND (lower(unaccent(name)) LIKE lower(unaccent(p_customer_name)) || '%'
                 OR lower(unaccent(name)) LIKE '%' || lower(unaccent(p_customer_name)))
            THEN 1
          ELSE 2
        END,
        updated_at DESC NULLS LAST,
        created_at DESC
      LIMIT 1
    ),

    'lead', (
      SELECT jsonb_build_object(
        'id', id,
        'name', name,
        'status', status,
        'interest', interest,
        'procedure_id', procedure_id,
        'eva_followup_count', eva_followup_count
      )
      FROM leads
      WHERE clinic_id = p_clinic_id
        AND phone = ANY(public.phone_variants(p_phone))
      ORDER BY
        CASE
          WHEN p_customer_name IS NOT NULL
               AND lower(unaccent(name)) = lower(unaccent(p_customer_name))
            THEN 0
          ELSE 1
        END,
        created_at DESC
      LIMIT 1
    ),

    'last_assistant_at', (
      SELECT MAX(created_at)
      FROM eva_conversations
      WHERE clinic_id = p_clinic_id
        AND phone = ANY(public.phone_variants(p_phone))
        AND role = 'assistant'
    ),

    'evolution', jsonb_build_object(
      'url',         (SELECT value FROM app_settings WHERE key = 'evolution_url'),
      'master_key',  (SELECT value FROM app_settings WHERE key = 'evolution_master_key'),
      'instance',    (SELECT instance_name FROM clinic_whatsapp WHERE clinic_id = p_clinic_id),
      'phone',       (SELECT phone_number  FROM clinic_whatsapp WHERE clinic_id = p_clinic_id),
      'status',      (SELECT status        FROM clinic_whatsapp WHERE clinic_id = p_clinic_id)
    )
  );
$$;

REVOKE EXECUTE ON FUNCTION donna_load_context(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION donna_load_context(uuid, text, text) TO service_role;


-- ============================================================================
-- Teste rápido
-- ============================================================================
-- SELECT donna_load_context(
--   '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190'::uuid,
--   '5534991805722',
--   'Vinicius Frazão'
-- );

-- E o helper:
-- SELECT public.phone_variants('5534991805722');
-- → {5534991805722, 553491805722}
