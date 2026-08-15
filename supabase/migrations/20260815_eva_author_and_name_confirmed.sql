-- Bloco 1 da correção da Eva: autoria de mensagens + trava de nome.
--
-- Problema 1 — Eva se perdia em conversa manual:
--   Toda mensagem que sai do número da clínica era gravada com role='assistant',
--   tenha sido escrita pela Eva ou digitada por uma atendente pelo celular.
--   Sem distinção de autoria, a Eva lia as mensagens da equipe como memória
--   própria: assumia ter consultado agenda, passado preço, cumprimentado — e
--   emendava por cima, contradizendo o que a pessoa combinou.
--
-- Problema 2 — Eva chamava a paciente por apelido do WhatsApp:
--   O pushName era gravado em leads.name, o que derrotava a blindagem do
--   prompt. Produção registrou "Oi ednafernandescorrea26 !" e "Nega, vou
--   verificar essa informação com a equipe".

alter table public.eva_conversations
  add column if not exists author text;

comment on column public.eva_conversations.author is
  'Quem escreveu a mensagem: patient (paciente), eva (IA), human (atendente da clínica digitando no WhatsApp/painel), automation (disparo automático do sistema). Diferente de role, que é o papel na conversa para a API do Claude.';

alter table public.eva_conversations
  drop constraint if exists eva_conversations_author_check;
alter table public.eva_conversations
  add constraint eva_conversations_author_check
  check (author is null or author in ('patient','eva','human','automation'));

-- Backfill heurístico do histórico existente
update public.eva_conversations
set author = case
  when role = 'user' then 'patient'
  when last_agent = 'eva' or metadata->>'engine' = 'edge-function' then 'eva'
  when metadata->>'outbound_purpose' is not null
    or metadata->>'generated_by' is not null then 'automation'
  else 'human'
end
where author is null;

create index if not exists idx_eva_conversations_author
  on public.eva_conversations (clinic_id, phone, author, created_at desc);

alter table public.leads
  add column if not exists name_confirmed_at timestamptz;

comment on column public.leads.name_confirmed_at is
  'Preenchido quando a própria paciente informou o nome na conversa (tool atualizar_nome_lead) ou quando o cadastro veio de fonte confiável. Enquanto for NULL, leads.name pode ser apenas o pushName do WhatsApp e a Eva NÃO deve chamar a paciente pelo nome.';

create index if not exists idx_leads_name_confirmed
  on public.leads (clinic_id, name_confirmed_at);

notify pgrst, 'reload schema';
