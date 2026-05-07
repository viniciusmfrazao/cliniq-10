-- ============================================================================
-- Setup pra migrar a Eva do n8n pra Supabase Edge Function
--
-- Este SQL:
--   1) Adiciona flag eva_engine em app_settings ('n8n' ou 'edge')
--   2) Adiciona URL da Edge Function (eva_edge_url)
--   3) Adiciona secret interno opcional pra autenticar app -> edge
--
-- ATENÇÃO:
--   - Por padrão deixa eva_engine = 'n8n' (sem mudar comportamento)
--   - Você só precisa trocar pra 'edge' DEPOIS do deploy da Edge Function
--   - Pra reverter, basta UPDATE eva_engine = 'n8n'
-- ============================================================================

-- ── 1) Flag de engine ──────────────────────────────────────────────────────
INSERT INTO app_settings (key, value, is_secret, description)
VALUES (
  'eva_engine',
  'n8n',
  false,
  'Qual motor processa as mensagens da Eva: "n8n" (legado) ou "edge" (Supabase Edge Function eva-process)'
)
ON CONFLICT (key) DO UPDATE
  SET description = EXCLUDED.description,
      updated_at  = now();

-- ── 2) URL da Edge Function ────────────────────────────────────────────────
-- Após o deploy, esta URL é geralmente:
--   https://<PROJECT_REF>.supabase.co/functions/v1/eva-process
INSERT INTO app_settings (key, value, is_secret, description)
VALUES (
  'eva_edge_url',
  'https://yqrjbyaucimvmzpfipgs.supabase.co/functions/v1/eva-process',
  false,
  'URL da Edge Function da Eva no Supabase'
)
ON CONFLICT (key) DO UPDATE
  SET description = EXCLUDED.description,
      updated_at  = now();

-- ── 3) Secret interno opcional ─────────────────────────────────────────────
-- Gere um valor aleatório e cole abaixo (e configure o mesmo valor como
-- secret EVA_INTERNAL_SECRET na Edge Function via:
--   supabase secrets set EVA_INTERNAL_SECRET=<mesmo_valor>
--
-- Pode deixar vazio: nesse caso o app usa SUPABASE_SERVICE_ROLE_KEY mesmo,
-- que a Edge Function aceita por padrão.
INSERT INTO app_settings (key, value, is_secret, description)
VALUES (
  'eva_internal_secret',
  '',
  true,
  'Secret extra (opcional) pra autenticar chamadas do app -> Edge Function eva-process'
)
ON CONFLICT (key) DO NOTHING;


-- ── Verificar ──────────────────────────────────────────────────────────────
SELECT key, CASE WHEN is_secret THEN 'SENSITIVE' ELSE value END AS value, description
FROM app_settings
WHERE key IN ('eva_engine', 'eva_edge_url', 'eva_internal_secret')
ORDER BY key;
