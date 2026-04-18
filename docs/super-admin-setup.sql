-- ============================================
-- SUPER ADMIN SETUP - Execute no Supabase SQL Editor
-- ============================================

-- 1. Adicionar role super_admin ao enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';

-- 2. Criar tabela de super admins (separada das clínicas)
CREATE TABLE IF NOT EXISTS super_admins (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 3. Criar função para verificar se usuário é super admin
CREATE OR REPLACE FUNCTION is_super_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM super_admins WHERE id = user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. View para métricas globais (Super Admin)
CREATE OR REPLACE VIEW admin_metrics AS
SELECT 
  (SELECT COUNT(*) FROM clinics WHERE deleted_at IS NULL) as total_clinics,
  (SELECT COUNT(*) FROM clinics WHERE trial_ends_at > now()) as clinics_on_trial,
  (SELECT COUNT(*) FROM users WHERE active = true) as total_users,
  (SELECT COUNT(*) FROM patients) as total_patients,
  (SELECT COUNT(*) FROM appointments WHERE start_time >= CURRENT_DATE) as appointments_today,
  (SELECT COUNT(*) FROM appointments WHERE start_time >= date_trunc('month', CURRENT_DATE)) as appointments_this_month,
  (SELECT COUNT(*) FROM leads WHERE created_at >= date_trunc('month', CURRENT_DATE)) as leads_this_month;

-- 5. RLS para super_admins
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view all super_admins"
  ON super_admins FOR SELECT
  TO authenticated
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can insert super_admins"
  ON super_admins FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin(auth.uid()));

-- 6. Política para super admin ver todas as clínicas
CREATE POLICY "Super admins can view all clinics"
  ON clinics FOR SELECT
  TO authenticated
  USING (is_super_admin(auth.uid()) OR id IN (
    SELECT clinic_id FROM users WHERE id = auth.uid()
  ));

-- 7. Política para super admin ver todos os usuários
CREATE POLICY "Super admins can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (is_super_admin(auth.uid()) OR clinic_id IN (
    SELECT clinic_id FROM users WHERE id = auth.uid()
  ));

-- ============================================
-- CRIAR PRIMEIRO SUPER ADMIN
-- Substitua pelo seu email e ID do Supabase Auth
-- ============================================

-- Para descobrir seu user ID, rode:
-- SELECT id, email FROM auth.users WHERE email = 'SEU_EMAIL';

-- Depois insira:
-- INSERT INTO super_admins (id, email, name) VALUES (
--   'SEU_USER_ID_AQUI',
--   'seu@email.com',
--   'Seu Nome'
-- );
