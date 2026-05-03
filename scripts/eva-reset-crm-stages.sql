-- ============================================================================
-- Limpa custom_stages do crm_settings para usar os labels novos do codigo
-- (Novo Lead / Em Conversa / Agendado / Cliente / Perdido)
--
-- Setando para NULL, o front passa a usar DEFAULT_STAGES do crm-view.tsx,
-- que ja tem os labels atualizados.
-- ============================================================================

UPDATE crm_settings
SET custom_stages = NULL
WHERE clinic_id = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190';

-- Confirmacao
SELECT clinic_id, custom_stages, custom_sources
FROM crm_settings
WHERE clinic_id = '6a718c1d-9a79-4e80-ad71-1c5c8a2ea190';
