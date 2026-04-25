-- ============================================================
-- Permite que cada super_admin leia o próprio registro
-- (resolve o caso de checagem em SSR sem service role)
-- ============================================================

DROP POLICY IF EXISTS "Super admins read self" ON super_admins;
CREATE POLICY "Super admins read self" ON super_admins
  FOR SELECT USING (id = auth.uid());

-- Garante que a função is_super_admin é chamável pelo cliente autenticado
GRANT EXECUTE ON FUNCTION is_super_admin(uuid) TO authenticated, anon;

-- Verificação
SELECT
  'is_super_admin existe?' AS check,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'is_super_admin' AND n.nspname = 'public'
  ) AS ok;
