-- ============================================================================
-- STAGING SEED — cria clínica + admin de teste pra você conseguir logar
-- ============================================================================
-- IMPORTANTE: rode DEPOIS de staging-bootstrap.sql
--
-- O que faz:
--   1. Cria 1 clínica de teste ("Clínica Teste Staging")
--   2. Insere uma subscription ativa
--   3. Cria automações default
--   4. Cria 3 procedimentos de exemplo
--   5. Cria 2 salas
--   6. Insere você como super_admin
--
-- IMPORTANTE: o usuário admin precisa ser criado no Auth do Supabase ANTES
-- de rodar este script. Ou seja, vai em:
--   https://supabase.com/dashboard/project/folcgzoxfpelogspivot/auth/users
--   → Add user → Create new user
--   → email: SEU_EMAIL@aqui.com
--   → password: SUA_SENHA_DE_TESTE
--
-- Depois copie o UUID gerado e SUBSTITUA na variável v_admin_id ABAIXO.
-- ============================================================================

DO $$
DECLARE
  v_clinic_id uuid;
  v_admin_id  uuid := 'b960f0be-1d43-4816-ab54-9d38f521e4ae';   -- UUID do auth.users
  v_admin_email text;                                            -- Buscado automaticamente
  v_admin_name  text := 'Admin Staging';
  v_plan_id   uuid;
BEGIN
  -- Busca email automaticamente do auth.users
  SELECT email INTO v_admin_email FROM auth.users WHERE id = v_admin_id;

  IF v_admin_email IS NULL THEN
    RAISE EXCEPTION 'Usuário % não existe em auth.users. Crie ele em Auth > Users primeiro.', v_admin_id;
  END IF;

  -- ── 1) Cria clínica ────────────────────────────────────────────────
  INSERT INTO clinics (name, slug, plan, settings, brand_color)
  VALUES (
    'Clínica Teste Staging',
    'teste-staging',
    'pro',
    jsonb_build_object(
      'address', 'Rua de Teste, 123 - Centro, Cidade Teste',
      'phone',   '(00) 0000-0000',
      'hours',   'Segunda a sexta: 09h às 18h',
      'instagram','@clinike.staging',
      'observations', 'Clínica de teste do ambiente staging — não use dados reais'
    ),
    '#6366f1'
  )
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_clinic_id;

  IF v_clinic_id IS NULL THEN
    SELECT id INTO v_clinic_id FROM clinics WHERE slug = 'teste-staging';
  END IF;

  -- ── 2) Insere admin user ────────────────────────────────────────────
  INSERT INTO users (id, clinic_id, name, email, role, active)
  VALUES (v_admin_id, v_clinic_id, v_admin_name, v_admin_email, 'admin', true)
  ON CONFLICT (id) DO UPDATE SET
    clinic_id = EXCLUDED.clinic_id,
    role = 'admin',
    active = true;

  -- ── 3) Insere super_admin (acesso ao painel admin) ──────────────────
  INSERT INTO super_admins (id, email, name)
  VALUES (v_admin_id, v_admin_email, v_admin_name)
  ON CONFLICT (id) DO NOTHING;

  -- ── 4) Subscription ativa ───────────────────────────────────────────
  SELECT id INTO v_plan_id FROM plans WHERE name = 'pro' LIMIT 1;

  INSERT INTO subscriptions (clinic_id, plan_id, status, current_period_start, current_period_end)
  VALUES (
    v_clinic_id,
    v_plan_id,
    'active',
    now(),
    now() + interval '90 days'
  )
  ON CONFLICT DO NOTHING;

  -- ── 5) Garante row em clinic_automations (trigger já cria, mas força) ─
  INSERT INTO clinic_automations (clinic_id) VALUES (v_clinic_id)
  ON CONFLICT (clinic_id) DO NOTHING;

  -- ── 6) Procedimentos de exemplo ─────────────────────────────────────
  INSERT INTO procedures (clinic_id, name, description, duration_minutes, price, category, active, professional_ids)
  VALUES
    (v_clinic_id, 'Consulta Inicial',  'Avaliação inicial gratuita', 30, 0,    'consulta',     true, ARRAY[v_admin_id]::uuid[]),
    (v_clinic_id, 'Limpeza de Pele',   'Limpeza de pele profunda',   60, 200,  'estetica',     true, ARRAY[v_admin_id]::uuid[]),
    (v_clinic_id, 'Botox',             'Aplicação de toxina botulínica', 45, 1200, 'injetavel', true, ARRAY[v_admin_id]::uuid[])
  ON CONFLICT DO NOTHING;

  -- ── 7) Salas ────────────────────────────────────────────────────────
  INSERT INTO rooms (clinic_id, name, color, active)
  VALUES
    (v_clinic_id, 'Sala 1', '#6366f1', true),
    (v_clinic_id, 'Sala 2', '#10b981', true)
  ON CONFLICT DO NOTHING;

  -- ── 8) Resultado ────────────────────────────────────────────────────
  RAISE NOTICE 'Seed completo!';
  RAISE NOTICE 'Clinic ID: %', v_clinic_id;
  RAISE NOTICE 'Admin User ID: %', v_admin_id;
  RAISE NOTICE 'Admin Email: %', v_admin_email;
  RAISE NOTICE 'Login: use o email/senha do auth.users criado no Supabase';
END $$;


-- ============================================================================
-- VERIFICAÇÃO
-- ============================================================================
SELECT
  c.name AS clinica,
  c.slug,
  c.plan,
  u.email AS admin_email,
  u.role,
  s.status AS subscription_status,
  (SELECT count(*) FROM procedures WHERE clinic_id = c.id) AS procedimentos,
  (SELECT count(*) FROM rooms      WHERE clinic_id = c.id) AS salas,
  ca.confirma_24h, ca.lembrete_2h, ca.aniversario, ca.recall_inativos
FROM clinics c
LEFT JOIN users u ON u.clinic_id = c.id AND u.role = 'admin'
LEFT JOIN subscriptions s ON s.clinic_id = c.id AND s.status = 'active'
LEFT JOIN clinic_automations ca ON ca.clinic_id = c.id
WHERE c.slug = 'teste-staging';
