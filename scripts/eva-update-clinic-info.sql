-- ============================================================================
-- Atualizacoes pontuais para a Eva
--
-- 1) clinics.settings.parking = "Estacionamento disponivel" (sem detalhe de preco)
-- 2) procedures.description: registra "tratamento exclusivo para pernas"
--    no procedimento de microvasos (escleroterapia / microvasos)
--
-- A Eva passa a respeitar essas regras automaticamente no proximo turno.
-- ============================================================================

-- 1) Estacionamento ----------------------------------------------------------
UPDATE clinics
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{parking}',
  '"Estacionamento disponível"'::jsonb,
  true
)
WHERE id = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190';   -- ← clinic_id


-- 2) Microvasos: tratamento exclusivo para pernas ----------------------------
-- Bate em qualquer procedimento cujo nome contenha "microvaso" ou "esclero"
-- (case/accent-insensitive) — cobre "Microvasos", "Escleroterapia",
-- "Microvasos de membros inferiores" etc.
UPDATE procedures
SET description = 'Tratamento exclusivo para pernas (microvasos de membros inferiores). Não é realizado em rosto, mãos ou outras áreas.'
WHERE clinic_id = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190'
  AND (
    public.unaccent(lower(name)) LIKE '%microvaso%'
    OR public.unaccent(lower(name)) LIKE '%esclero%'
  );


-- Confirmacao ----------------------------------------------------------------
SELECT
  name,
  settings->>'address'  AS address,
  settings->>'parking'  AS parking,
  settings->>'phone'    AS phone,
  settings->>'hours'    AS hours
FROM clinics
WHERE id = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190';

SELECT id, name, description
FROM procedures
WHERE clinic_id = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190'
  AND (
    public.unaccent(lower(name)) LIKE '%microvaso%'
    OR public.unaccent(lower(name)) LIKE '%esclero%'
  );
