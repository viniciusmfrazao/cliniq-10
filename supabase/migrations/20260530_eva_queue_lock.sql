-- Anti-duplicação da eva_queue: claim atômico com FOR UPDATE SKIP LOCKED.
-- Aplicado em produção (yqrjbyaucimvmzpfipgs) e staging (folcgzoxfpelogspivot) em 30/05/2026.
--
-- Problema: o worker (cron 10s) podia se sobrepor a si mesmo quando um ciclo
-- demorava >10s, fazendo dois ciclos pegarem a mesma linha da fila e gerar
-- resposta duplicada pro paciente. A eva_queue não tinha mecanismo de lock.

-- Coluna de lock: até quando o item está reservado por um worker.
ALTER TABLE eva_queue ADD COLUMN IF NOT EXISTS locked_until timestamptz;

-- Claim atômico. O UPDATE ... FOR UPDATE SKIP LOCKED garante que workers
-- concorrentes nunca peguem o mesmo item. Reserva por p_lock_seconds; se o
-- worker travar, o item volta a ser elegível após o lock expirar.
CREATE OR REPLACE FUNCTION claim_eva_queue(p_limit int DEFAULT 50, p_lock_seconds int DEFAULT 90)
RETURNS TABLE (id uuid, clinic_id uuid, phone text, instance text, customer_name text)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE eva_queue q
  SET locked_until = now() + make_interval(secs => p_lock_seconds)
  WHERE q.id IN (
    SELECT q2.id FROM eva_queue q2
    WHERE q2.process_after <= now()
      AND (q2.locked_until IS NULL OR q2.locked_until < now())
    ORDER BY q2.process_after
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  RETURNING q.id, q.clinic_id, q.phone, q.instance, q.customer_name;
END;
$$;
