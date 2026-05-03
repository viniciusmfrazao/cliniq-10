-- ============================================================================
-- RESET COMPLETO + FIX DOS LABELS DO CRM
--
-- 1) Limpa custom_stages do CRM (front passa a usar labels novos do codigo:
--    Em Conversa / Agendado / Cliente)
-- 2) Apaga conversas/leads/appointments criados via Eva pra teste limpo
-- 3) Reseta follow-up de qualquer lead que sobrou
--
-- Rode INTEIRO no SQL Editor do Supabase. Idempotente.
-- ============================================================================

-- ====================== 1) FIX LABELS DO KANBAN =============================
UPDATE crm_settings SET custom_stages = NULL;


-- ====================== 2) LIMPA CONVERSAS DA EVA ===========================
-- a) Historico de mensagens da Eva (so existe essa tabela)
TRUNCATE TABLE eva_conversations RESTART IDENTITY;

-- b) Appointments que foram criados via Eva/Donna/WhatsApp
DELETE FROM appointments
WHERE notes ILIKE '%via Eva%'
   OR notes ILIKE '%via Donna%'
   OR notes ILIKE '%via WhatsApp%'
   OR notes ILIKE '%agendado pela Eva%'
   OR notes ILIKE '%agendado pela Donna%';

-- c) Leads vindos do WhatsApp ou criados pela Eva
DELETE FROM leads
WHERE source = 'whatsapp'
   OR ai_suggested_action ILIKE '%Eva%'
   OR ai_suggested_action ILIKE '%Donna%'
   OR notes ILIKE '%Eva%'
   OR notes ILIKE '%Donna%'
   OR name ILIKE '%Lead WhatsApp%';

-- d) Reset follow-up + atendimento humano de TODOS os leads que sobraram
UPDATE leads
SET eva_followup_count = 0,
    eva_next_followup_at = NULL,
    needs_human_review = false,
    human_review_reason = NULL,
    human_review_details = NULL,
    human_review_at = NULL;


-- ====================== 3) CONFIRMACAO ======================================
SELECT
  (SELECT COUNT(*) FROM eva_conversations) AS msgs_eva_restantes,
  (SELECT COUNT(*) FROM leads)             AS leads_restantes,
  (SELECT COUNT(*) FROM appointments
   WHERE notes ILIKE '%Eva%' OR notes ILIKE '%Donna%' OR notes ILIKE '%WhatsApp%')
                                           AS appts_eva_restantes,
  (SELECT custom_stages FROM crm_settings LIMIT 1) AS custom_stages_value;
