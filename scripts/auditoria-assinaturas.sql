-- ============================================================
-- Auditoria de assinaturas eletronicas (LGPD + Lei 14.063/2020)
-- ============================================================
-- Use no Supabase SQL Editor pra validar o conjunto probatorio
-- gravado em anamneses e documentos. Apos o Fix #5 (28/04/2026)
-- signature_ip vem do header x-forwarded-for, nao mais do body.
-- A migracao add-signature-evidence-fields.sql tambem grava
-- signature_user_agent e signature_country.
--
-- O que cada coluna prova:
--   signature_ip          - de onde a assinatura partiu
--   signature_user_agent  - dispositivo/navegador usado
--   signature_country     - pais aproximado (geo IP)
--   signature_data        - imagem da assinatura (data URL base64)
--   completed_at /        - timestamp do ato
--     signed_at
--   token                 - link unico que so o paciente tinha
--   patient_id            - vincula ao paciente
-- ============================================================


-- 1) Ultimas anamneses preenchidas (audit trail completo)
-- ============================================================
select
  a.id                                    as anamnese_id,
  p.name                                  as paciente,
  a.status,
  a.signature_ip,
  case
    when a.signature_ip is null              then '⚠️ SEM IP'
    when a.signature_ip ilike 'captured%'    then '🚨 BUG ANTIGO (Fix #5 nao aplicado)'
    when a.signature_ip ~ '^(\d{1,3}\.){3}\d{1,3}$' then '✅ IPv4 valido'
    when a.signature_ip ~ ':'                then '✅ IPv6 valido'
    else                                       '❓ formato inesperado'
  end                                     as status_ip,
  a.signature_country,
  -- Resumo do UA pra leitura rapida (Chrome 119, Firefox, Safari iOS, etc)
  case
    when a.signature_user_agent is null         then null
    when a.signature_user_agent ilike '%firefox%' then 'Firefox'
    when a.signature_user_agent ilike '%edg/%'    then 'Edge'
    when a.signature_user_agent ilike '%chrome%'  then 'Chrome'
    when a.signature_user_agent ilike '%safari%'  then 'Safari'
    else                                              'Outro'
  end                                     as navegador,
  length(coalesce(a.signature_data,''))   as tam_assinatura_bytes,
  a.completed_at,
  a.token
from anamneses a
left join patients p on p.id = a.patient_id
where a.status = 'completed'
order by a.completed_at desc nulls last
limit 20;


-- 2) Ultimos documentos assinados (mesma logica)
-- ============================================================
select
  d.id                                    as documento_id,
  d.name                                  as documento_nome,
  p.name                                  as paciente,
  d.status,
  d.signature_ip,
  case
    when d.signature_ip is null              then '⚠️ SEM IP'
    when d.signature_ip ilike 'captured%'    then '🚨 BUG ANTIGO (Fix #5 nao aplicado)'
    when d.signature_ip ~ '^(\d{1,3}\.){3}\d{1,3}$' then '✅ IPv4 valido'
    when d.signature_ip ~ ':'                then '✅ IPv6 valido'
    else                                       '❓ formato inesperado'
  end                                     as status_ip,
  d.signature_country,
  case
    when d.signature_user_agent is null         then null
    when d.signature_user_agent ilike '%firefox%' then 'Firefox'
    when d.signature_user_agent ilike '%edg/%'    then 'Edge'
    when d.signature_user_agent ilike '%chrome%'  then 'Chrome'
    when d.signature_user_agent ilike '%safari%'  then 'Safari'
    else                                              'Outro'
  end                                     as navegador,
  length(coalesce(d.signature_data,''))   as tam_assinatura_bytes,
  d.signed_at,
  d.sign_token
from documents_sent d
left join patients p on p.id = d.patient_id
where d.signed_at is not null
order by d.signed_at desc
limit 20;


-- 3) Resumo de saude da captura (quantos OK x quebrados)
-- ============================================================
select
  'anamneses' as origem,
  count(*) filter (where signature_ip is not null
                   and signature_ip not ilike 'captured%') as ok,
  count(*) filter (where signature_ip is null
                   and status = 'completed')               as sem_ip,
  count(*) filter (where signature_ip ilike 'captured%')   as bug_antigo,
  count(*) filter (where status = 'completed')             as total
from anamneses

union all

select
  'documents_sent' as origem,
  count(*) filter (where signature_ip is not null
                   and signature_ip not ilike 'captured%') as ok,
  count(*) filter (where signature_ip is null
                   and signed_at is not null)              as sem_ip,
  count(*) filter (where signature_ip ilike 'captured%')   as bug_antigo,
  count(*) filter (where signed_at is not null)            as total
from documents_sent;
