-- ============================================================================
-- RPC: donna_load_context (v2)
-- Retorna em uma chamada todo o contexto que a Eva precisa por turno:
-- histórico, profissionais, procedimentos, clínica (incluindo settings),
-- paciente, lead, config Evolution e last_assistant_at (pra heurística de
-- saudação calorosa quando passou tempo).
--
-- Uso:
--   POST /rest/v1/rpc/donna_load_context
--   body: { "p_clinic_id": "...", "p_phone": "..." }
--
-- v2 (mai/2026):
--   - inclui clinic.settings (jsonb) -> endereço, contato, horário, instagram
--   - inclui last_assistant_at (pra detectar conversa "esfriou")
--   - usa normalize_br_phone pra evitar duplicidade quando há "9" ou não
-- ============================================================================

CREATE OR REPLACE FUNCTION donna_load_context(p_clinic_id uuid, p_phone text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH
    -- Phone normalizado (com e sem o "9" depois do DDD)
    phone_alts AS (
      SELECT
        ARRAY[
          p_phone,
          public.normalize_br_phone(p_phone),
          regexp_replace(p_phone, '^(\d{4})9', '\1'),     -- remove "9" pós-DDD
          regexp_replace(p_phone, '^(\d{4})(\d{8})$','\19\2')  -- adiciona "9" pós-DDD
        ] AS list
    )
  SELECT jsonb_build_object(
    -- Últimas 40 mensagens (cronológicas, mais antigas primeiro)
    'history', COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object('role', role, 'content', content) ORDER BY created_at ASC)
        FROM (
          SELECT role, content, created_at
          FROM eva_conversations
          WHERE clinic_id = p_clinic_id
            AND phone = ANY((SELECT list FROM phone_alts))
            AND content IS NOT NULL
            AND length(trim(content)) > 0
          ORDER BY created_at DESC
          LIMIT 40
        ) AS recent
      ),
      '[]'::jsonb
    ),

    -- Profissionais que fazem pelo menos 1 procedimento ativo
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

    -- Procedimentos ativos
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

    -- Dados da clínica + settings (endereço, telefone, horário, instagram)
    'clinic', (
      SELECT jsonb_build_object(
        'name', name,
        'slug', slug,
        'settings', COALESCE(settings, '{}'::jsonb)
      )
      FROM clinics
      WHERE id = p_clinic_id
    ),

    -- Paciente (se phone bater em qualquer variação BR)
    'patient', (
      SELECT jsonb_build_object('id', id, 'name', name, 'birth_date', birth_date)
      FROM patients
      WHERE clinic_id = p_clinic_id
        AND phone = ANY((SELECT list FROM phone_alts))
      LIMIT 1
    ),

    -- Lead mais recente
    'lead', (
      SELECT jsonb_build_object(
        'id', id,
        'name', name,
        'status', status,
        'interest', interest,
        'procedure_id', procedure_id
      )
      FROM leads
      WHERE clinic_id = p_clinic_id
        AND phone = ANY((SELECT list FROM phone_alts))
      ORDER BY created_at DESC
      LIMIT 1
    ),

    -- Última mensagem do assistente (pra Eva saudar de novo se passou >12h)
    'last_assistant_at', (
      SELECT MAX(created_at)
      FROM eva_conversations
      WHERE clinic_id = p_clinic_id
        AND phone = ANY((SELECT list FROM phone_alts))
        AND role = 'assistant'
    ),

    -- Config Evolution (envio da resposta)
    'evolution', jsonb_build_object(
      'url',         (SELECT value FROM app_settings WHERE key = 'evolution_url'),
      'master_key',  (SELECT value FROM app_settings WHERE key = 'evolution_master_key'),
      'instance',    (SELECT instance_name FROM clinic_whatsapp WHERE clinic_id = p_clinic_id),
      'phone',       (SELECT phone_number  FROM clinic_whatsapp WHERE clinic_id = p_clinic_id),
      'status',      (SELECT status        FROM clinic_whatsapp WHERE clinic_id = p_clinic_id)
    )
  );
$$;

REVOKE EXECUTE ON FUNCTION donna_load_context(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION donna_load_context(uuid, text) TO service_role;

-- ============================================================================
-- Teste rápido
-- ============================================================================
-- SELECT donna_load_context(
--   '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190'::uuid,
--   '5534991805722'
-- );
