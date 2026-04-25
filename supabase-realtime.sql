-- ============================================
-- MÓDULO: REALTIME
--
-- Habilita Supabase Realtime nas tabelas que se beneficiam
-- de atualização em tempo real (multi-usuário).
--
-- Rode este arquivo no SQL Editor do Supabase.
-- Seguro pra rodar mais de uma vez (idempotente).
-- ============================================

-- Garante que a publication existe (já vem criada por padrão no Supabase,
-- mas é seguro checar)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- ============================================
-- Tabelas que queremos em Realtime
--
-- appointments          - Agenda atualizando em tempo real (check-in, status, drag)
-- notifications         - Sino de notificações sem polling
-- patients              - Novo paciente aparece pra todos (buscas sincronizadas)
-- eva_conversations     - Chat com a Donna (se houver operador humano assistindo)
-- chat_messages         - Chat interno entre usuários
-- leads                 - CRM atualizando em tempo real
-- stock_movements       - Movimentações de estoque vistas em tempo real
-- ============================================

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'appointments',
    'notifications',
    'patients',
    'eva_conversations',
    'chat_messages',
    'leads',
    'stock_movements'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    -- Só adiciona se a tabela não está na publication ainda
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', tbl);
      RAISE NOTICE 'Realtime habilitado em %', tbl;
    ELSE
      RAISE NOTICE 'Realtime já estava habilitado em %', tbl;
    END IF;
  END LOOP;
END $$;


-- ============================================
-- Configura REPLICA IDENTITY FULL para capturar o estado antigo
-- em UPDATE/DELETE (útil pra UIs que precisam saber o que mudou)
-- ============================================
ALTER TABLE appointments      REPLICA IDENTITY FULL;
ALTER TABLE notifications     REPLICA IDENTITY FULL;
ALTER TABLE patients          REPLICA IDENTITY FULL;
ALTER TABLE eva_conversations REPLICA IDENTITY FULL;
ALTER TABLE chat_messages     REPLICA IDENTITY FULL;
ALTER TABLE leads             REPLICA IDENTITY FULL;
ALTER TABLE stock_movements   REPLICA IDENTITY FULL;


-- ============================================
-- Verificação — lista o que está em realtime
-- ============================================
-- SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
