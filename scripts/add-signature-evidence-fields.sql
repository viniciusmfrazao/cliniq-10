-- ============================================================
-- Reforco da evidencia probatoria de assinaturas eletronicas
-- (anamneses + documents_sent)
-- ============================================================
-- Migracao idempotente. Pode rodar varias vezes sem erro.
--
-- Adiciona dois campos a cada tabela de assinatura:
--   signature_user_agent  - User-Agent completo do navegador no ato
--   signature_country     - pais aproximado (header da Vercel)
--
-- Combinados com signature_ip (Fix #5), signature_data, completed_at,
-- token e patient_id, formam o conjunto probatorio para assinatura
-- eletronica simples (Lei 14.063/2020).
--
-- Politicas RLS existentes ja cobrem essas colunas via "select *".
-- ============================================================

alter table public.anamneses
  add column if not exists signature_user_agent text,
  add column if not exists signature_country text;

alter table public.documents_sent
  add column if not exists signature_user_agent text,
  add column if not exists signature_country text;

-- Comentarios pra ficar explicito no schema
comment on column public.anamneses.signature_user_agent is
  'User-Agent do navegador no momento da assinatura. Parte do conjunto probatorio (Lei 14.063/2020).';
comment on column public.anamneses.signature_country is
  'Pais aproximado de origem da assinatura (header x-vercel-ip-country).';

comment on column public.documents_sent.signature_user_agent is
  'User-Agent do navegador no momento da assinatura. Parte do conjunto probatorio (Lei 14.063/2020).';
comment on column public.documents_sent.signature_country is
  'Pais aproximado de origem da assinatura (header x-vercel-ip-country).';
