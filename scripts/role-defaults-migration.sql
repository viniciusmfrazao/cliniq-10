-- =====================================================================
-- Defaults de permissoes por papel (per-clinic)
-- =====================================================================
-- Permite que cada clinica customize quais permissoes cada papel tem
-- como padrao. Quando um novo usuario eh cadastrado com role X, copia
-- os defaults dessa clinica pra users.permissions.
--
-- A edicao individual (users.permissions por usuario) continua valendo
-- e sobrescreve os defaults.
-- =====================================================================

CREATE TABLE IF NOT EXISTS clinic_role_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  permissions text[] NOT NULL DEFAULT ARRAY[]::text[],
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(clinic_id, role)
);

CREATE INDEX IF NOT EXISTS clinic_role_defaults_clinic_role_idx
  ON clinic_role_defaults(clinic_id, role);

ALTER TABLE clinic_role_defaults ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic admin manage role defaults" ON clinic_role_defaults;
CREATE POLICY "Clinic admin manage role defaults" ON clinic_role_defaults
  FOR ALL
  USING (
    clinic_id IN (
      SELECT clinic_id FROM users
      WHERE id = auth.uid()
        AND role IN ('admin','super_admin')
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM users
      WHERE id = auth.uid()
        AND role IN ('admin','super_admin')
    )
  );

COMMENT ON TABLE clinic_role_defaults IS
  'Permissoes padrao por papel/role customizadas pela clinica. Usadas como ponto de partida ao criar novos usuarios e como fallback para usuarios sem permissions individuais.';
