-- ============================================
-- CORREÇÕES PARA O CLINIQ - RODE NO SUPABASE SQL EDITOR
-- ============================================

-- 1. CORRIGIR user_role - Adicionar novas roles ao enum
-- Se der erro "type already has value", a role já existe (pode ignorar)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'biomedic';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'nurse';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'physiotherapist';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'nutritionist';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'psychologist';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'financial';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'assistant';

-- 2. ALTERNATIVA: Se preferir liberar qualquer role (mais flexível)
-- Descomente as linhas abaixo se o ALTER TYPE der erro

-- ALTER TABLE users ALTER COLUMN role TYPE text;

-- 3. CORRIGIR injectable_points - Garantir colunas corretas
-- Se as colunas x e y não existirem, criar como alias ou renomear

-- Verificar se x_position existe, se não existir mas x existir:
-- ALTER TABLE injectable_points RENAME COLUMN x TO x_position;
-- ALTER TABLE injectable_points RENAME COLUMN y TO y_position;

-- 4. CORRIGIR gender constraint (se necessário)
-- O constraint espera 'M' ou 'F', não 'male' ou 'female'
-- Verificar constraint atual:
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'patients_gender_check';

