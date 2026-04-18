-- ============================================
-- INDEXES PARA PERFORMANCE - CliniQ
-- ============================================
-- Execute este script no Supabase SQL Editor
-- 
-- IMPORTANTE: Indexes ocupam espaço e podem deixar 
-- INSERTs/UPDATEs um pouco mais lentos, mas aceleram
-- SELECTs significativamente.
-- ============================================

-- ============================================
-- APPOINTMENTS (Tabela mais consultada)
-- ============================================

-- Index composto para listagem da agenda (query mais comum)
-- Usado em: agenda/page.tsx, recepcao/page.tsx
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_start 
ON appointments(clinic_id, start_time);

-- Index para filtro por profissional
CREATE INDEX IF NOT EXISTS idx_appointments_professional 
ON appointments(professional_id, start_time);

-- Index para filtro por status
CREATE INDEX IF NOT EXISTS idx_appointments_status 
ON appointments(clinic_id, status);

-- Index para buscar agendamentos de um paciente
CREATE INDEX IF NOT EXISTS idx_appointments_patient 
ON appointments(patient_id, start_time DESC);

-- ============================================
-- PATIENTS (Busca frequente)
-- ============================================

-- Index para busca por nome (LIKE queries)
CREATE INDEX IF NOT EXISTS idx_patients_name 
ON patients(clinic_id, name);

-- Index para busca por telefone (exato)
CREATE INDEX IF NOT EXISTS idx_patients_phone 
ON patients(clinic_id, phone);

-- Index para busca por CPF
CREATE INDEX IF NOT EXISTS idx_patients_cpf 
ON patients(clinic_id, cpf);

-- Index para trigram (busca parcial) - requer extensão pg_trgm
-- Descomente se quiser busca mais flexível
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX IF NOT EXISTS idx_patients_name_trgm 
-- ON patients USING gin(name gin_trgm_ops);

-- ============================================
-- USERS (Filtro por role frequente)
-- ============================================

-- Index para listagem de profissionais
CREATE INDEX IF NOT EXISTS idx_users_clinic_role 
ON users(clinic_id, role, active);

-- Index para busca por email
CREATE INDEX IF NOT EXISTS idx_users_email 
ON users(email);

-- ============================================
-- LEADS (CRM)
-- ============================================

-- Index para funil de vendas
CREATE INDEX IF NOT EXISTS idx_leads_clinic_status 
ON leads(clinic_id, status, created_at DESC);

-- Index para follow-up
CREATE INDEX IF NOT EXISTS idx_leads_next_contact 
ON leads(clinic_id, next_contact_at) 
WHERE next_contact_at IS NOT NULL;

-- Index para busca por telefone (identificar lead existente)
CREATE INDEX IF NOT EXISTS idx_leads_phone 
ON leads(clinic_id, phone);

-- ============================================
-- ENTRADAS (Financeiro)
-- ============================================

-- Index para relatórios por período
CREATE INDEX IF NOT EXISTS idx_entradas_clinic_data 
ON entradas(clinic_id, data_venda DESC);

-- Index para relatórios por paciente
CREATE INDEX IF NOT EXISTS idx_entradas_paciente 
ON entradas(paciente_id, data_venda DESC);

-- Index para relatórios por profissional
CREATE INDEX IF NOT EXISTS idx_entradas_profissional 
ON entradas(profissional_id, data_venda DESC);

-- ============================================
-- SAIDAS (Financeiro)
-- ============================================

-- Index para relatórios por período
CREATE INDEX IF NOT EXISTS idx_saidas_clinic_data 
ON saidas(clinic_id, data DESC);

-- Index para DRE por categoria
CREATE INDEX IF NOT EXISTS idx_saidas_categoria 
ON saidas(clinic_id, categoria_dre, data DESC);

-- ============================================
-- EVA_CONVERSATIONS (WhatsApp/IA)
-- ============================================

-- Index para histórico de conversa por telefone
CREATE INDEX IF NOT EXISTS idx_eva_conversations_phone 
ON eva_conversations(clinic_id, phone, created_at DESC);

-- ============================================
-- EVOLUTIONS (Prontuário)
-- ============================================

-- Index para histórico do paciente
CREATE INDEX IF NOT EXISTS idx_evolutions_patient 
ON evolutions(patient_id, created_at DESC);

-- Index para listagem por profissional
CREATE INDEX IF NOT EXISTS idx_evolutions_professional 
ON evolutions(professional_id, created_at DESC);

-- ============================================
-- AUDIT_LOGS
-- ============================================

-- Index para listagem por clínica e data
CREATE INDEX IF NOT EXISTS idx_audit_logs_clinic_date 
ON audit_logs(clinic_id, created_at DESC);

-- Index para filtro por ação
CREATE INDEX IF NOT EXISTS idx_audit_logs_action 
ON audit_logs(clinic_id, action, created_at DESC);

-- Index para filtro por entidade
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity 
ON audit_logs(entity_type, entity_id);

-- ============================================
-- PROCEDURES
-- ============================================

-- Index para listagem ativa
CREATE INDEX IF NOT EXISTS idx_procedures_clinic_active 
ON procedures(clinic_id, active, name);

-- ============================================
-- PRODUCTS (Estoque)
-- ============================================

-- Index para produtos ativos
CREATE INDEX IF NOT EXISTS idx_products_clinic_active 
ON products(clinic_id, is_active, name);

-- Index para alertas de estoque baixo
CREATE INDEX IF NOT EXISTS idx_products_low_stock 
ON products(clinic_id, current_stock, min_stock) 
WHERE is_active = true;

-- ============================================
-- DOCUMENTS_SENT
-- ============================================

-- Index para documentos pendentes
CREATE INDEX IF NOT EXISTS idx_documents_sent_status 
ON documents_sent(clinic_id, status, sent_at DESC);

-- Index para busca por token (assinatura)
CREATE INDEX IF NOT EXISTS idx_documents_sent_token 
ON documents_sent(sign_token) 
WHERE sign_token IS NOT NULL;

-- ============================================
-- WAITING_LIST
-- ============================================

-- Index para lista de espera ativa
CREATE INDEX IF NOT EXISTS idx_waiting_list_status 
ON waiting_list(clinic_id, status, created_at DESC);

-- ============================================
-- INJECTABLE_APPLICATIONS
-- ============================================

-- Index para histórico de aplicações do paciente
CREATE INDEX IF NOT EXISTS idx_injectable_applications_patient 
ON injectable_applications(patient_id, application_date DESC);

-- ============================================
-- VERIFICAR INDEXES CRIADOS
-- ============================================

-- Execute para ver todos os indexes:
-- SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename;

-- ============================================
-- ANALISAR USO DOS INDEXES (após alguns dias)
-- ============================================

-- Execute para ver se os indexes estão sendo usados:
-- SELECT 
--   schemaname, 
--   relname as table, 
--   indexrelname as index, 
--   idx_scan as times_used,
--   pg_size_pretty(pg_relation_size(indexrelid)) as size
-- FROM pg_stat_user_indexes 
-- WHERE schemaname = 'public'
-- ORDER BY idx_scan DESC;
