-- Bloco 2 da correção da Eva: memória dos horários realmente ofertados.
--
-- Problema: quando a paciente escolhia um horário num turno POSTERIOR ao que a
-- Eva mostrou a agenda ("16:50" solto), o código tentava recuperar o
-- agendamento a partir de `conv.steps` — que só contém as tools do turno
-- ATUAL. Como a condição da CAMADA 1.0 exigia justamente que consultar_agenda
-- NÃO tivesse sido chamada nesse turno, a recuperação nunca encontrava nada e
-- retornava sempre 'sem consultar_agenda previo com horarios'. Código morto.
--
-- Pior: o pouco que funcionava re-parseava o texto livre do período ("amanhã")
-- na hora de confirmar. Se a agenda foi consultada perto da virada do dia, ou
-- a paciente confirmou no dia seguinte, "amanhã" resolvia para outra data e o
-- agendamento ia para o dia errado.
--
-- Esta tabela guarda a oferta resolvida (data ISO já calculada, profissionais
-- e horários exatos que foram mostrados). Uma linha viva por (clinic, phone).

create table if not exists public.eva_slot_offers (
  clinic_id   uuid not null references public.clinics(id) on delete cascade,
  phone       text not null,
  -- Data ISO JÁ RESOLVIDA (YYYY-MM-DD). Nunca texto livre tipo 'amanha'.
  data_iso    date not null,
  periodo     text,
  procedimento_nome text,
  procedure_id uuid,
  -- [{ professional_id, professional_name, horarios: ['09:00','09:30'] }]
  slots       jsonb not null default '[]'::jsonb,
  -- true quando os horários vieram do fallback SEM filtro de procedimento
  -- (profissionais que podem não realizar o procedimento pedido).
  fallback_sem_procedimento boolean not null default false,
  created_at  timestamptz not null default now(),
  primary key (clinic_id, phone)
);

comment on table public.eva_slot_offers is
  'Última oferta de horários que a Eva realmente mostrou para cada paciente. Usada para criar o agendamento quando a paciente escolhe um horário num turno posterior, sem re-parsear datas relativas.';

alter table public.eva_slot_offers enable row level security;

-- Acesso só via service role (Edge Function). Nenhuma policy = nenhum acesso
-- por usuário autenticado, que é o desejado: é estado interno da Eva.

create index if not exists idx_eva_slot_offers_created
  on public.eva_slot_offers (created_at);

notify pgrst, 'reload schema';
