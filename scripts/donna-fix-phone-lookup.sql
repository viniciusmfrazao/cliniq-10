-- ============================================================================
-- FIX: lookup de paciente/lead pelo telefone tolerando o "9" do celular BR
-- 
-- Problema:
--   - WhatsApp manda às vezes  "5534991805722" (13 dígitos, com 9 após DDD)
--   - Banco às vezes tem        "553491805722"  (12 dígitos, sem o 9)
--   - O RPC donna_load_context não achava o paciente, e o n8n criava duplicado
--
-- Solução:
--   1) Função normalize_br_phone() — remove o "9" do celular (formato canônico)
--   2) RPC donna_load_context atualizada usando essa normalização
--   3) Diagnóstico de duplicados
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────
-- 1) Helper: normaliza celular brasileiro (sempre formato curto, sem 9)
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION normalize_br_phone(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    -- Só dígitos
    WHEN regexp_replace(COALESCE(p,''), '\D', '', 'g') ~ '^55\d{2}9\d{8}$' THEN
      -- 55 + DDD(2) + 9 + 8 dígitos → remove o 9
      substring(regexp_replace(p, '\D', '', 'g'), 1, 4) ||
      substring(regexp_replace(p, '\D', '', 'g'), 6)
    ELSE
      regexp_replace(COALESCE(p,''), '\D', '', 'g')
  END;
$$;

-- Teste rápido
SELECT
  normalize_br_phone('5534991805722') AS com_9,    -- esperado: 553491805722
  normalize_br_phone('553491805722')  AS sem_9,    -- esperado: 553491805722
  normalize_br_phone('+55 (34) 99180-5722') AS formatado;  -- esperado: 553491805722


-- ────────────────────────────────────────────────────────────────────────
-- 2) Atualiza donna_load_context pra usar o normalizador
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION donna_load_context(p_clinic_id uuid, p_phone text)
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
            AND normalize_br_phone(phone) = normalize_br_phone(p_phone)
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
          'id', id, 'name', name, 'description', description,
          'price', price, 'installments', installments,
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
      SELECT jsonb_build_object('name', name, 'slug', slug)
      FROM clinics WHERE id = p_clinic_id
    ),

    -- 🔥 Paciente: lookup tolerante ao 9 do celular
    'patient', (
      SELECT jsonb_build_object('id', id, 'name', name, 'birth_date', birth_date)
      FROM patients
      WHERE clinic_id = p_clinic_id
        AND normalize_br_phone(phone) = normalize_br_phone(p_phone)
      ORDER BY created_at DESC NULLS LAST
      LIMIT 1
    ),

    -- 🔥 Lead: também tolerante
    'lead', (
      SELECT jsonb_build_object(
        'id', id, 'name', name, 'status', status,
        'interest', interest, 'procedure_id', procedure_id
      )
      FROM leads
      WHERE clinic_id = p_clinic_id
        AND normalize_br_phone(phone) = normalize_br_phone(p_phone)
      ORDER BY created_at DESC
      LIMIT 1
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

REVOKE EXECUTE ON FUNCTION donna_load_context(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION donna_load_context(uuid, text) TO service_role;


-- ────────────────────────────────────────────────────────────────────────
-- 3) Diagnóstico: ver pacientes duplicados (mesmo nome+clínica, phones similares)
-- ────────────────────────────────────────────────────────────────────────
SELECT
  clinic_id,
  normalize_br_phone(phone) AS phone_canonico,
  COUNT(*) AS qtd_duplicados,
  array_agg(id ORDER BY created_at NULLS LAST) AS ids,
  array_agg(name ORDER BY created_at NULLS LAST) AS nomes,
  array_agg(phone ORDER BY created_at NULLS LAST) AS phones_originais,
  MIN(created_at) AS primeiro_criado,
  MAX(created_at) AS ultimo_criado
FROM patients
WHERE phone IS NOT NULL
  AND length(regexp_replace(phone, '\D', '', 'g')) >= 12
GROUP BY clinic_id, normalize_br_phone(phone)
HAVING COUNT(*) > 1
ORDER BY qtd_duplicados DESC, ultimo_criado DESC
LIMIT 50;


-- ────────────────────────────────────────────────────────────────────────
-- 4) Teste do RPC com o phone do Vinicius (qualquer formato deve achar)
-- ────────────────────────────────────────────────────────────────────────
SELECT donna_load_context(
  '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190'::uuid,
  '553491805722'   -- formato curto (sem 9)
) -> 'patient' AS achou_com_formato_curto;

SELECT donna_load_context(
  '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190'::uuid,
  '5534991805722'  -- formato longo (com 9)
) -> 'patient' AS achou_com_formato_longo;
