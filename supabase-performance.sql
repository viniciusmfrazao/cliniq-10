-- ============================================
-- MÓDULO: PERFORMANCE (índices)
--
-- Índices adicionais para as queries mais frequentes do dashboard.
-- Rode no SQL Editor do Supabase. Idempotente.
-- ============================================

-- AGENDA: queries por clinic_id + start_time (range de datas)
-- A consulta mais pesada do sistema (agenda carrega todos agendamentos do período)
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_start
  ON appointments(clinic_id, start_time);

-- APPOINTMENTS: filtrar por profissional (usado no get_available_slots)
CREATE INDEX IF NOT EXISTS idx_appointments_professional_start
  ON appointments(professional_id, start_time)
  WHERE status IN ('scheduled','confirmed','pending_confirmation','checked_in','in_progress');

-- APPOINTMENTS: filtrar por paciente (histórico do prontuário)
CREATE INDEX IF NOT EXISTS idx_appointments_patient_start
  ON appointments(patient_id, start_time DESC);

-- PATIENTS: buscas case-insensitive por nome (PatientSearch)
-- trigram melhora LIKE/ILIKE com prefixos parciais (e.g. "va" encontra "Valentina")
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_patients_name_trgm
  ON patients USING gin (name gin_trgm_ops);

-- PATIENTS: filtrar por clinic_id (base da maioria das queries)
CREATE INDEX IF NOT EXISTS idx_patients_clinic_name
  ON patients(clinic_id, name);

-- PATIENTS: busca por telefone
CREATE INDEX IF NOT EXISTS idx_patients_clinic_phone
  ON patients(clinic_id, phone)
  WHERE phone IS NOT NULL;

-- NOTIFICATIONS: buscar não-lidas do usuário
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

-- NOTIFICATIONS: últimas 20 do usuário (sino)
CREATE INDEX IF NOT EXISTS idx_notifications_user_recent
  ON notifications(user_id, created_at DESC);

-- EVA_CONVERSATIONS: buscar conversa por telefone (Donna)
CREATE INDEX IF NOT EXISTS idx_eva_conv_phone
  ON eva_conversations(clinic_id, phone, updated_at DESC);

-- LEAD_INTERACTIONS: histórico por lead
CREATE INDEX IF NOT EXISTS idx_lead_interactions_lead
  ON lead_interactions(lead_id, created_at DESC);

-- LEADS: filtro por clinic + status (Kanban CRM)
CREATE INDEX IF NOT EXISTS idx_leads_clinic_status
  ON leads(clinic_id, status, stage_order);

-- STOCK_MOVEMENTS: histórico de produto
CREATE INDEX IF NOT EXISTS idx_stock_movements_product
  ON stock_movements(product_id, created_at DESC);

-- AUDIT_LOGS: busca por clínica e tempo
CREATE INDEX IF NOT EXISTS idx_audit_logs_clinic_created
  ON audit_logs(clinic_id, created_at DESC);

-- ENTRADAS: filtro por clínica e data (dashboard financeiro)
CREATE INDEX IF NOT EXISTS idx_entradas_clinic_date
  ON entradas(clinic_id, data_venda DESC);

-- SAIDAS: filtro por clínica e data
CREATE INDEX IF NOT EXISTS idx_saidas_clinic_date
  ON saidas(clinic_id, data DESC);

-- PROCEDURES: filtros por clinic + active
CREATE INDEX IF NOT EXISTS idx_procedures_clinic_active
  ON procedures(clinic_id, active);

-- PROCEDURES: busca por profissionais (gin em array)
CREATE INDEX IF NOT EXISTS idx_procedures_prof_ids
  ON procedures USING gin (professional_ids);

-- USERS: filtro por clínica
CREATE INDEX IF NOT EXISTS idx_users_clinic_active
  ON users(clinic_id, active);


-- ============================================
-- Análise & estatísticas
--
-- Rode ANALYZE depois de criar índices pra atualizar o planner
-- ============================================
ANALYZE appointments;
ANALYZE patients;
ANALYZE notifications;
ANALYZE eva_conversations;
ANALYZE leads;
ANALYZE procedures;
