-- ============================================================
-- EXPORT DO SCHEMA DA PRODUÇÃO PRA RECRIAR NO STAGING
-- ============================================================
-- Roda CADA query separadamente no SQL Editor do projeto PROD
-- (yqrjbyaucimvmzpfipgs). Copia cada saída e cola no chat
-- identificando como "Q1", "Q2" etc.
--
-- Tudo aqui é READ-ONLY — não modifica nada.
-- ============================================================

-- ─── Q1: ENUMs ──────────────────────────────────────────────
SELECT
  'CREATE TYPE public.' || t.typname || ' AS ENUM (' ||
  string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder) ||
  ');' AS ddl
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
GROUP BY t.typname
ORDER BY t.typname;


-- ─── Q2: Tabelas (DDL completo com colunas) ─────────────────
WITH cols AS (
  SELECT
    table_name,
    ordinal_position,
    '  ' || column_name || ' ' ||
    CASE
      WHEN data_type = 'USER-DEFINED' THEN udt_name
      WHEN data_type = 'ARRAY' THEN
        (SELECT format_type(t2.oid, NULL) FROM pg_type t1
         JOIN pg_type t2 ON t1.typelem = t2.oid
         WHERE t1.typname = udt_name LIMIT 1) || '[]'
      WHEN data_type IN ('character varying','varchar') AND character_maximum_length IS NOT NULL
        THEN 'varchar(' || character_maximum_length || ')'
      WHEN data_type = 'numeric' AND numeric_precision IS NOT NULL
        THEN 'numeric(' || numeric_precision || ',' || COALESCE(numeric_scale,0) || ')'
      ELSE data_type
    END ||
    CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
    CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END
    AS line
  FROM information_schema.columns
  WHERE table_schema = 'public'
)
SELECT
  'CREATE TABLE IF NOT EXISTS public.' || table_name || ' (' || E'\n' ||
  string_agg(line, ',' || E'\n' ORDER BY ordinal_position) ||
  E'\n);' AS ddl
FROM cols
GROUP BY table_name
ORDER BY table_name;


-- ─── Q3: Constraints (PK, UK, FK, CHECK) ────────────────────
SELECT
  'ALTER TABLE public.' || conrelid::regclass::text ||
  ' ADD CONSTRAINT ' || conname || ' ' ||
  pg_get_constraintdef(oid) || ';' AS ddl
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
ORDER BY conrelid::regclass::text, contype DESC, conname;


-- ─── Q4: Índices (não-PK) ───────────────────────────────────
SELECT indexdef || ';' AS ddl
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname NOT IN (
    SELECT conname FROM pg_constraint
    WHERE contype = 'p' AND connamespace = 'public'::regnamespace
  )
ORDER BY tablename, indexname;


-- ─── Q5: Funções/RPCs (definição completa) ──────────────────
SELECT
  'CREATE OR REPLACE FUNCTION public.' || p.proname || '(' ||
  pg_get_function_identity_arguments(p.oid) || ')' || E'\n' ||
  'RETURNS ' || pg_get_function_result(p.oid) || E'\n' ||
  'LANGUAGE ' || l.lanname || E'\n' ||
  CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' || E'\n' ELSE '' END ||
  'AS $$' || p.prosrc || '$$;' AS ddl
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language l ON l.oid = p.prolang
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
ORDER BY p.proname;


-- ─── Q6: RLS Policies ───────────────────────────────────────
SELECT
  'ALTER TABLE public.' || tablename || ' ENABLE ROW LEVEL SECURITY;' || E'\n' ||
  'CREATE POLICY ' || quote_ident(policyname) || ' ON public.' || tablename ||
  ' FOR ' || cmd ||
  CASE WHEN roles IS NOT NULL AND array_length(roles,1) > 0
    THEN ' TO ' || array_to_string(roles, ', ')
    ELSE '' END ||
  CASE WHEN qual IS NOT NULL THEN ' USING (' || qual || ')' ELSE '' END ||
  CASE WHEN with_check IS NOT NULL THEN ' WITH CHECK (' || with_check || ')' ELSE '' END ||
  ';' AS ddl
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


-- ─── Q7 (bonus): Triggers ───────────────────────────────────
SELECT
  'CREATE TRIGGER ' || trigger_name ||
  ' ' || action_timing || ' ' || event_manipulation ||
  ' ON public.' || event_object_table ||
  ' FOR EACH ' || action_orientation ||
  ' ' || action_statement || ';' AS ddl
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;
