-- ============================================================================
-- Atualiza SOMENTE o endereço da clínica em clinics.settings.address
-- (preserva todos os outros campos: phone, hours, instagram, parking, etc.)
--
-- Eva passa a usar o novo endereço imediatamente nas próximas conversas.
-- ============================================================================

UPDATE clinics
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{address}',
  '"R. Roosevelt de Oliveira, 305 - Centro, Uberlândia/MG"'::jsonb,
  true  -- create_if_missing = true
)
WHERE id = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190';   -- ← clinic_id

-- Confirmação
SELECT
  name,
  settings->>'address' AS address,
  settings->>'phone' AS phone,
  settings->>'hours' AS hours,
  settings->>'instagram' AS instagram
FROM clinics
WHERE id = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190';
