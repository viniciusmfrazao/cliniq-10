-- donna_load_context passa a expor a AUTORIA de cada mensagem do histórico e
-- a calcular last_assistant_at olhando SOMENTE mensagens escritas pela Eva.
--
-- Motivo: toda mensagem que sai do número da clínica é gravada como
-- role='assistant'. Quando a atendente responde manualmente pelo celular, a
-- Eva lia aquilo como memória própria — assumia que já tinha consultado a
-- agenda, que já tinha passado preço, que já tinha cumprimentado. E
-- last_assistant_at contava a mensagem humana, quebrando isNewConversation.
--
-- Também expõe leads.name_confirmed_at e leads.whatsapp_name para a Eva só
-- usar o nome quando a própria paciente informou.
--
-- Depende de: 20260815_eva_author_and_name_confirmed.sql

CREATE OR REPLACE FUNCTION public.donna_load_context(p_clinic_id uuid, p_phone text, p_customer_name text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'history', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'role', role,
            'content', content,
            'author', COALESCE(author, CASE WHEN role = 'user' THEN 'patient' ELSE 'human' END),
            'created_at', created_at
          ) ORDER BY created_at ASC
        )
        FROM (
          SELECT role, content, author, created_at
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
          AND role NOT IN ('receptionist', 'super_admin')
      ),
      '[]'::jsonb
    ),

    'professional_schedules', COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object(
          'professional_id', ps.professional_id,
          'professional_name', u.name,
          'day_of_week', ps.day_of_week,
          'start_time', ps.start_time,
          'end_time', ps.end_time
        ) ORDER BY u.name ASC, ps.day_of_week ASC, ps.start_time ASC)
        FROM professional_schedules ps
        JOIN users u ON ps.professional_id = u.id
        WHERE ps.clinic_id = p_clinic_id
          AND ps.is_active = true
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
          'category', category,
          'eva_policy', COALESCE(p_proc.eva_policy, 'ofertar'),
          'restricted_dates', (
            SELECT jsonb_agg(d.available_date ORDER BY d.available_date)
            FROM procedure_available_dates d
            WHERE d.procedure_id = p_proc.id AND d.available_date >= CURRENT_DATE
          )
        ) ORDER BY name ASC)
        FROM procedures p_proc
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
        'whatsapp_name', whatsapp_name,
        'name_confirmed_at', name_confirmed_at,
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

    -- SOMENTE mensagens escritas pela propria Eva. Mensagem digitada por
    -- humano nao pode contar como "a Eva falou agora ha pouco".
    'last_assistant_at', (
      SELECT MAX(created_at)
      FROM eva_conversations
      WHERE clinic_id = p_clinic_id
        AND phone = ANY(public.phone_variants(p_phone))
        AND role = 'assistant'
        AND COALESCE(author, 'human') = 'eva'
    ),

    -- Ultima intervencao humana real na conversa (atendente digitando).
    -- A Eva usa isso pra saber que tem gente cuidando desse atendimento.
    'last_human_at', (
      SELECT MAX(created_at)
      FROM eva_conversations
      WHERE clinic_id = p_clinic_id
        AND phone = ANY(public.phone_variants(p_phone))
        AND role = 'assistant'
        AND COALESCE(author, 'human') = 'human'
    ),

    'evolution', jsonb_build_object(
      'url',        (SELECT value FROM app_settings WHERE key = 'evolution_url' LIMIT 1),
      'master_key', (SELECT value FROM app_settings WHERE key = 'evolution_master_key' LIMIT 1),
      'instance',   (SELECT instance_name FROM clinic_whatsapp WHERE clinic_id = p_clinic_id AND is_default = true LIMIT 1),
      'phone',      (SELECT phone_number  FROM clinic_whatsapp WHERE clinic_id = p_clinic_id AND is_default = true LIMIT 1),
      'status',     (SELECT status        FROM clinic_whatsapp WHERE clinic_id = p_clinic_id AND is_default = true LIMIT 1)
    )
  );
$function$;

notify pgrst, 'reload schema';
