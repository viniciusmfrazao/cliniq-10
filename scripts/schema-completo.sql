-- ============================================
-- CLINIKE - SCHEMA COMPLETO
-- Execute no SQL Editor do Supabase Staging
-- ============================================

-- ============================================
-- 1. ENUMS (tipos personalizados)
-- ============================================

CREATE TYPE user_role AS ENUM (
  'admin', 'doctor', 'biomedic', 'nurse', 'esthetician', 
  'physiotherapist', 'nutritionist', 'psychologist',
  'receptionist', 'financial', 'manager', 'assistant', 'viewer', 'super_admin'
);

CREATE TYPE appointment_status AS ENUM (
  'scheduled', 'confirmed', 'checked_in', 'in_progress', 
  'completed', 'cancelled', 'no_show', 'pending_confirmation'
);

CREATE TYPE lead_status AS ENUM (
  'new', 'contacted', 'scheduled', 'converted', 'lost'
);

CREATE TYPE lead_source AS ENUM (
  'instagram', 'whatsapp', 'indication', 'google', 'facebook', 'website', 'other'
);

CREATE TYPE document_status AS ENUM (
  'pending', 'viewed', 'signed', 'expired', 'cancelled'
);

CREATE TYPE evolution_type AS ENUM (
  'consultation', 'procedure', 'note', 'prescription', 'exam'
);

CREATE TYPE injectable_type AS ENUM (
  'toxin', 'filler'
);

CREATE TYPE stock_movement_type AS ENUM (
  'entrada', 'saida', 'ajuste', 'uso_atendimento'
);

-- ============================================
-- 2. TABELAS PRINCIPAIS
-- ============================================

-- Clínicas
CREATE TABLE clinics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cnpj text,
  slug text UNIQUE NOT NULL,
  plan text DEFAULT 'starter',
  active_modules text[],
  settings jsonb DEFAULT '{}',
  brand_color text,
  logo_url text,
  trial_ends_at timestamptz DEFAULT (now() + interval '14 days'),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Usuários
CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES clinics(id),
  name text NOT NULL,
  email text NOT NULL,
  role user_role DEFAULT 'receptionist',
  permissions jsonb DEFAULT '{}',
  avatar_url text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Pacientes
CREATE TABLE patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id),
  name text NOT NULL,
  email text,
  phone text,
  cpf text,
  birth_date date,
  gender text CHECK (gender IN ('M', 'F', 'O')),
  photo_url text,
  address text,
  city text,
  state text,
  zip_code text,
  notes text,
  tags text[],
  whatsapp_opt_in boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Procedimentos
CREATE TABLE procedures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id),
  name text NOT NULL,
  description text,
  duration_minutes integer DEFAULT 60,
  price numeric DEFAULT 0,
  category text,
  active boolean DEFAULT true,
  variation text,
  installment_price numeric,
  installments integer,
  professional_ids uuid[],
  includes_return boolean DEFAULT false,
  return_days integer,
  is_promotion boolean DEFAULT false,
  original_price numeric,
  promotion_dates text[],
  unit text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Salas
CREATE TABLE rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id),
  name text NOT NULL,
  color text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Agendamentos
CREATE TABLE appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id),
  patient_id uuid REFERENCES patients(id),
  professional_id uuid REFERENCES users(id),
  procedure_id uuid REFERENCES procedures(id),
  room_id uuid REFERENCES rooms(id),
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  status appointment_status DEFAULT 'scheduled',
  notes text,
  price numeric,
  checked_in_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Leads (CRM)
CREATE TABLE leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id),
  name text NOT NULL,
  phone text,
  email text,
  source lead_source DEFAULT 'other',
  status lead_status DEFAULT 'new',
  stage_order integer DEFAULT 0,
  interest text,
  procedure_id uuid REFERENCES procedures(id),
  estimated_value numeric,
  assigned_to uuid REFERENCES users(id),
  next_contact_at timestamptz,
  last_contact_at timestamptz,
  converted_at timestamptz,
  lost_reason text,
  conversion_notes text,
  whatsapp_chat_id text,
  last_whatsapp_at timestamptz,
  whatsapp_opt_in boolean DEFAULT false,
  ai_score integer,
  ai_priority text CHECK (ai_priority IN ('hot', 'warm', 'cold')),
  ai_suggested_action text,
  ai_last_analysis timestamptz,
  ai_sentiment text,
  tags text[],
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 3. PRONTUÁRIO / EVOLUÇÕES
-- ============================================

-- Ficha Médica
CREATE TABLE medical_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id),
  patient_id uuid NOT NULL REFERENCES patients(id) UNIQUE,
  blood_type text,
  allergies text[],
  chronic_conditions text[],
  medications text[],
  emergency_contact_name text,
  emergency_contact_phone text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Evoluções
CREATE TABLE evolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id),
  patient_id uuid NOT NULL REFERENCES patients(id),
  professional_id uuid REFERENCES users(id),
  appointment_id uuid REFERENCES appointments(id),
  type evolution_type DEFAULT 'note',
  title text NOT NULL,
  content text,
  procedure_name text,
  photos text[],
  created_at timestamptz DEFAULT now()
);

-- Aplicações de Injetáveis
CREATE TABLE injectable_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id),
  patient_id uuid NOT NULL REFERENCES patients(id),
  professional_id uuid REFERENCES users(id),
  appointment_id uuid REFERENCES appointments(id),
  product_id uuid,
  application_date date NOT NULL,
  type injectable_type NOT NULL,
  product_name text NOT NULL,
  product_brand text,
  lot_number text,
  total_units numeric,
  notes text,
  photos_before text[],
  photos_after text[],
  stock_deducted boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Pontos de Aplicação
CREATE TABLE injectable_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES injectable_applications(id) ON DELETE CASCADE,
  zone text NOT NULL,
  muscle text,
  side text CHECK (side IN ('left', 'right', 'center')),
  x_position numeric NOT NULL,
  y_position numeric NOT NULL,
  units numeric,
  depth text,
  technique text,
  notes text
);

-- ============================================
-- 4. DOCUMENTOS
-- ============================================

-- Templates de Documentos
CREATE TABLE document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id),
  name text NOT NULL,
  description text,
  content text NOT NULL,
  category text,
  is_active boolean DEFAULT true,
  theme_color text DEFAULT '#6366f1',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Documentos Enviados
CREATE TABLE documents_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id),
  template_id uuid REFERENCES document_templates(id),
  patient_id uuid NOT NULL REFERENCES patients(id),
  appointment_id uuid REFERENCES appointments(id),
  name text NOT NULL,
  content text NOT NULL,
  status document_status DEFAULT 'pending',
  sent_at timestamptz DEFAULT now(),
  viewed_at timestamptz,
  signed_at timestamptz,
  expires_at timestamptz,
  signature_data text,
  signature_ip text,
  sent_by uuid REFERENCES users(id),
  sign_token text UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- Anamneses
CREATE TABLE anamneses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id),
  patient_id uuid NOT NULL REFERENCES patients(id),
  token text UNIQUE NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'viewed', 'completed')),
  responses jsonb,
  signature_data text,
  signature_ip text,
  sent_by uuid REFERENCES users(id),
  viewed_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 5. ESTOQUE
-- ============================================

-- Produtos
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id),
  name text NOT NULL,
  brand text,
  category text,
  unit text,
  min_stock integer DEFAULT 0,
  current_stock integer DEFAULT 0,
  cost_price numeric,
  sale_price numeric,
  expiry_date date,
  batch_number text,
  supplier text,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Movimentações de Estoque
CREATE TABLE stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id),
  product_id uuid NOT NULL REFERENCES products(id),
  type stock_movement_type NOT NULL,
  quantity integer NOT NULL,
  previous_stock integer,
  new_stock integer,
  unit_cost numeric,
  reason text,
  reference_id uuid,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 6. FINANCEIRO
-- ============================================

-- Entradas (Receitas)
CREATE TABLE entradas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id),
  data_venda date NOT NULL,
  paciente_id uuid REFERENCES patients(id),
  paciente_nome text,
  procedimento_id uuid REFERENCES procedures(id),
  procedimento_nome text,
  profissional_id uuid REFERENCES users(id),
  profissional_nome text,
  forma_pagamento text NOT NULL,
  bandeira text,
  valor_bruto numeric NOT NULL,
  taxa_percentual numeric,
  valor_taxa numeric,
  valor_liquido numeric NOT NULL,
  n_parcelas integer DEFAULT 1,
  observacoes text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- Saídas (Despesas)
CREATE TABLE saidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id),
  data date NOT NULL,
  descricao text NOT NULL,
  categoria_dre text,
  fornecedor text,
  valor numeric NOT NULL,
  forma_pagamento text,
  observacoes text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- Débitos de Pacientes
CREATE TABLE debitos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id),
  paciente_id uuid NOT NULL REFERENCES patients(id),
  valor numeric NOT NULL,
  descricao text,
  data_vencimento date NOT NULL,
  status text DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'cancelado')),
  data_pagamento date,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 7. LISTA DE ESPERA
-- ============================================

CREATE TABLE waiting_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id),
  patient_id uuid NOT NULL REFERENCES patients(id),
  procedure_id uuid REFERENCES procedures(id),
  professional_id uuid REFERENCES users(id),
  preferred_period text,
  preferred_days text[],
  priority text DEFAULT 'normal' CHECK (priority IN ('normal', 'alta', 'urgente')),
  status text DEFAULT 'aguardando' CHECK (status IN ('aguardando', 'contatado', 'agendado', 'cancelado')),
  notes text,
  created_at timestamptz DEFAULT now(),
  contacted_at timestamptz,
  scheduled_appointment_id uuid REFERENCES appointments(id)
);

-- ============================================
-- 8. EVA / CONVERSAS
-- ============================================

CREATE TABLE eva_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id),
  phone text NOT NULL,
  role text CHECK (role IN ('user', 'assistant')),
  content text,
  user_message text,
  assistant_message text,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 9. AUDITORIA E LOGS
-- ============================================

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES clinics(id),
  user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  entity_name text,
  details jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Notificações
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  type text,
  title text NOT NULL,
  message text,
  link text,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 10. ADMIN / SUPER ADMIN
-- ============================================

-- Super Admins
CREATE TABLE super_admins (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Planos Admin
CREATE TABLE admin_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  price_monthly numeric NOT NULL DEFAULT 0,
  price_yearly numeric,
  modules text[] NOT NULL DEFAULT '{}',
  max_professionals integer,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Roles e Permissões
CREATE TABLE roles_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id),
  role_name text NOT NULL,
  permissions jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(clinic_id, role_name)
);

-- Integrações de Clínica
CREATE TABLE clinic_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) UNIQUE,
  evolution_instance text,
  evolution_api_key text,
  openai_api_key text,
  google_calendar_token jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 11. ÍNDICES PARA PERFORMANCE
-- ============================================

CREATE INDEX idx_users_clinic ON users(clinic_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_patients_clinic ON patients(clinic_id);
CREATE INDEX idx_patients_phone ON patients(phone);
CREATE INDEX idx_patients_cpf ON patients(cpf);
CREATE INDEX idx_appointments_clinic ON appointments(clinic_id);
CREATE INDEX idx_appointments_start_time ON appointments(start_time);
CREATE INDEX idx_appointments_professional ON appointments(professional_id);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_leads_clinic ON leads(clinic_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_phone ON leads(phone);
CREATE INDEX idx_entradas_clinic ON entradas(clinic_id);
CREATE INDEX idx_entradas_data ON entradas(data_venda);
CREATE INDEX idx_saidas_clinic ON saidas(clinic_id);
CREATE INDEX idx_saidas_data ON saidas(data);
CREATE INDEX idx_audit_logs_clinic ON audit_logs(clinic_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX idx_evolutions_patient ON evolutions(patient_id);
CREATE INDEX idx_products_clinic ON products(clinic_id);

-- ============================================
-- 12. FUNÇÕES AUXILIARES
-- ============================================

-- Verificar se é super admin
CREATE OR REPLACE FUNCTION is_super_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM super_admins WHERE id = user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 13. ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE evolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE injectable_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE injectable_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents_sent ENABLE ROW LEVEL SECURITY;
ALTER TABLE anamneses ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE entradas ENABLE ROW LEVEL SECURITY;
ALTER TABLE saidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE debitos ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiting_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE eva_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_integrations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 14. POLÍTICAS RLS BÁSICAS
-- ============================================

-- Clínicas: usuários veem apenas sua clínica
CREATE POLICY "Users can view own clinic" ON clinics
  FOR SELECT USING (
    id IN (SELECT clinic_id FROM users WHERE id = auth.uid())
    OR is_super_admin(auth.uid())
  );

-- Usuários: veem apenas usuários da mesma clínica  
CREATE POLICY "Users view same clinic" ON users
  FOR SELECT USING (
    clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid())
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (id = auth.uid());

-- Pacientes
CREATE POLICY "Clinic users can view patients" ON patients
  FOR SELECT USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Clinic users can insert patients" ON patients
  FOR INSERT WITH CHECK (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Clinic users can update patients" ON patients
  FOR UPDATE USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

-- Procedimentos
CREATE POLICY "Clinic users can manage procedures" ON procedures
  FOR ALL USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

-- Agendamentos
CREATE POLICY "Clinic users can manage appointments" ON appointments
  FOR ALL USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

-- Salas
CREATE POLICY "Clinic users can manage rooms" ON rooms
  FOR ALL USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

-- Leads
CREATE POLICY "Clinic users can manage leads" ON leads
  FOR ALL USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

-- Evoluções
CREATE POLICY "Clinic users can manage evolutions" ON evolutions
  FOR ALL USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

-- Ficha Médica
CREATE POLICY "Clinic users can manage medical_records" ON medical_records
  FOR ALL USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

-- Injetáveis
CREATE POLICY "Clinic users can manage injectables" ON injectable_applications
  FOR ALL USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can manage injectable_points" ON injectable_points
  FOR ALL USING (
    application_id IN (
      SELECT id FROM injectable_applications 
      WHERE clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid())
    )
  );

-- Documentos
CREATE POLICY "Clinic users can manage templates" ON document_templates
  FOR ALL USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Clinic users can manage sent docs" ON documents_sent
  FOR ALL USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Clinic users can manage anamneses" ON anamneses
  FOR ALL USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

-- Estoque
CREATE POLICY "Clinic users can manage products" ON products
  FOR ALL USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Clinic users can manage stock" ON stock_movements
  FOR ALL USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

-- Financeiro
CREATE POLICY "Clinic users can manage entradas" ON entradas
  FOR ALL USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Clinic users can manage saidas" ON saidas
  FOR ALL USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Clinic users can manage debitos" ON debitos
  FOR ALL USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

-- Lista de Espera
CREATE POLICY "Clinic users can manage waiting_list" ON waiting_list
  FOR ALL USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

-- EVA Conversas
CREATE POLICY "Clinic users can manage eva_conversations" ON eva_conversations
  FOR ALL USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

-- Audit Logs
CREATE POLICY "Clinic users can view audit_logs" ON audit_logs
  FOR SELECT USING (
    clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid())
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Anyone can insert audit_logs" ON audit_logs
  FOR INSERT WITH CHECK (true);

-- Notificações
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Super Admins
CREATE POLICY "Super admins only" ON super_admins
  FOR ALL USING (is_super_admin(auth.uid()));

-- Admin Plans
CREATE POLICY "Super admins manage plans" ON admin_plans
  FOR ALL USING (is_super_admin(auth.uid()));

CREATE POLICY "Anyone can view active plans" ON admin_plans
  FOR SELECT USING (active = true);

-- Roles Permissions
CREATE POLICY "Clinic admins can manage roles" ON roles_permissions
  FOR ALL USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

-- Integrações
CREATE POLICY "Clinic admins can manage integrations" ON clinic_integrations
  FOR ALL USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

-- ============================================
-- 15. DADOS INICIAIS
-- ============================================

-- Planos padrão
INSERT INTO admin_plans (name, description, price_monthly, price_yearly, modules, max_professionals) VALUES
  ('Starter', 'Ideal para clínicas iniciantes', 199, 1990, 
   ARRAY['agenda', 'pacientes', 'recepcao', 'procedimentos', 'financeiro', 'equipe'], 2),
  ('Professional', 'Para clínicas em crescimento', 399, 3990, 
   ARRAY['agenda', 'pacientes', 'recepcao', 'procedimentos', 'prontuario', 'injetaveis', 'documentos', 'estoque', 'crm', 'financeiro', 'equipe'], 5),
  ('Enterprise', 'Recursos completos para grandes clínicas', 699, 6990, 
   ARRAY['agenda', 'pacientes', 'recepcao', 'procedimentos', 'prontuario', 'injetaveis', 'documentos', 'lista_espera', 'estoque', 'crm', 'whatsapp', 'eva_ia', 'financeiro', 'equipe', 'auditoria'], NULL)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- PRONTO! Schema completo criado.
-- ============================================
