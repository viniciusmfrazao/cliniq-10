// ============================================================================
// Implementação das tools que a Eva pode chamar
// ============================================================================

import type { DonnaContext, IncomingPayload, ProcedureRow, ProfessionalRow } from './types.ts';
import { fetchJson, formatarDataBR, norm, parseData, formatBRL, matchProcedimento } from './utils.ts';

interface ToolEnv {
  supabaseUrl: string;
  serviceKey: string;
}

interface SbHeaders extends Record<string, string> {
  apikey: string;
  Authorization: string;
}

function sbHeaders(env: ToolEnv): SbHeaders {
  return {
    apikey: env.serviceKey,
    Authorization: `Bearer ${env.serviceKey}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Agendas de recurso (Cursos, Aparelhos) não são profissionais atendentes.
 * Não podem ser oferecidas pra paciente nem contar como "clínica aberta".
 */
const NON_BOOKABLE = ['curso', 'aparelho', 'equipamento'];

// Antecedencia minima que a Eva respeita ao OFERECER horario (min). A agenda
// interna (recepcao) continua com 0 — a secretaria pode encaixar alguem que
// acabou de chegar. So a Eva nao oferece horario pra daqui a 5 minutos.
const EVA_MIN_LEAD_MIN = 60;

// Passo da grade de horarios. Antes o passo era a propria duracao do
// procedimento, o que escondia disponibilidade real (ex: 90min numa janela
// 13:30-18:00 so gerava 13:30/15:00/16:30 — 14:00 cabia e nunca aparecia).
const SLOT_STEP_MIN = 15;

// Quantos dias a frente varrer quando o dia pedido nao tem vaga
/**
 * Politica da Eva pro procedimento (procedures.eva_policy). 'escalar' significa
 * que a Eva reconhece o nome mas nao pode ofertar/precificar/agendar — o caso
 * vai pra humano. Ex (Sarah Pina): a Eva so pode oferecer 'Botox Terco Superior'
 * e 'Clube do Botox'; qualquer outro botox e escalado.
 */
function politicaProcedimento(p: { eva_policy?: string | null } | null | undefined): 'ofertar' | 'escalar' | 'ocultar' {
  const v = p?.eva_policy;
  return v === 'escalar' || v === 'ocultar' ? v : 'ofertar';
}

function respostaEscalar(nome: string): string {
  return [
    `PROCEDIMENTO_RESTRITO: "${nome}" nao pode ser ofertado, precificado nem agendado por voce.`,
    'NAO diga valor, NAO ofereca horario e NAO chame criar_agendamento.',
    'Acolha com naturalidade (algo como "esse a gente avalia caso a caso, pra ver o que faz mais sentido pra voce"),',
    `diga que vai chamar alguem da equipe, e chame escalar_humano com motivo='duvida_complexa' e detalhes='Paciente perguntou sobre ${nome} — procedimento restrito, precisa de atendimento humano'.`,
  ].join('\n');
}

const PROXIMAS_DATAS_SCAN = 21;
const PROXIMAS_DATAS_LIMIT = 3;

/**
 * Busca os proximos dias com vaga real (RPC get_next_available_days) e devolve
 * uma frase pronta pra Eva. Antes, quando o dia pedido estava lotado, a Eva
 * so recebia "sem vagas, ofereca outro dia" — sem saber QUAIS dias tinham
 * vaga. Isso virava ping-pong (terca? nao. quarta? nao.) ate a paciente sumir.
 */
async function proximasDatasComVaga(params: {
  clinicId: string;
  procedureId: string | null;
  fromIso: string;
  durationMin: number | null;
  periodo: 'manha' | 'tarde' | null;
  env: ToolEnv;
}): Promise<string | null> {
  const { clinicId, procedureId, fromIso, durationMin, periodo, env } = params;
  try {
    const r = await fetchJson<Array<{ available_date: string; slots_count: number; first_slot: string; professionals: string[] }>>(
      `${env.supabaseUrl}/rest/v1/rpc/get_next_available_days`,
      {
        method: 'POST',
        headers: sbHeaders(env),
        body: JSON.stringify({
          p_clinic_id: clinicId,
          p_procedure_id: procedureId,
          p_from: fromIso,
          p_days_to_scan: PROXIMAS_DATAS_SCAN,
          p_limit: PROXIMAS_DATAS_LIMIT,
          p_duration_min: durationMin,
          p_period: periodo,
          p_min_lead_min: EVA_MIN_LEAD_MIN,
        }),
      },
    );
    if (!r.ok || !Array.isArray(r.data) || r.data.length === 0) return null;
    const linhas = r.data.map((d) => {
      const hora = String(d.first_slot ?? '').slice(0, 5);
      return `${formatarDataBR(d.available_date)}${hora ? ` (a partir das ${hora})` : ''}`;
    });
    return linhas.join('; ');
  } catch (_e) {
    return null;
  }
}

function isBookableName(name: string | null | undefined): boolean {
  const n = (name || '').toLowerCase();
  return !NON_BOOKABLE.some((kw) => n.includes(kw));
}

const DIAS_SEMANA = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

/**
 * DOW (0=dom, 6=sab) de uma data YYYY-MM-DD sem depender do fuso do runtime.
 * new Date(yyyy, mm-1, dd) é interpretado como local, então ignora o offset.
 */
function dowFromIsoDate(dataIso: string): number {
  const [y, m, d] = dataIso.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

const hhmm = (t: string): string => String(t).slice(0, 5);

/**
 * Detecta se a clínica está "fechada" naquele dia, ou seja, nenhum
 * profissional ATENDENTE tem schedule pra aquele day_of_week. Útil pra
 * Eva diferenciar "domingo a clínica não abre" de "agenda cheia".
 *
 * Usa ctx.professional_schedules (já carregado pelo donna_load_context, só
 * com is_active=true) — sem custo de rede. Agendas de recurso são ignoradas:
 * antes, uma agenda "Cursos / Aparelhos" com grade no sábado fazia a Eva
 * achar que sábado era dia útil da clínica.
 */
function isClinicClosed(ctx: DonnaContext, dataIso: string): boolean {
  try {
    const dow = dowFromIsoDate(dataIso);
    return !ctx.professional_schedules.some(
      (ps) => ps.day_of_week === dow && isBookableName(ps.professional_name),
    );
  } catch {
    return false; // em caso de erro, assume aberto
  }
}

// ─── Guard de slot (usado antes de gravar qualquer agendamento) ─────────────

type SlotCheck =
  | { ok: true }
  | { ok: false; codigo: string; detalhe: string };

/**
 * Valida se um horário pode virar agendamento de verdade. Precisa existir
 * porque o modelo pode confirmar horário que a paciente pediu mesmo depois de
 * consultar_agenda ter dito que não há vaga (caso real: sábado, 25/07/2026).
 *
 * Checa, nesta ordem:
 *  1. profissional tem grade nesse dia da semana  (contexto, sem rede)
 *  2. o intervalo cabe dentro de uma das janelas  (contexto, sem rede)
 *  3. não colide com professional_blocks           (1 request)
 *  4. não colide com outro agendamento ativo       (1 request)
 */
async function validarSlot(params: {
  ctx: DonnaContext;
  clinicId: string;
  professionalId: string;
  dataIso: string;
  horaInicio: string; // "HH:MM"
  horaFim: string;    // "HH:MM"
  startIso: string;
  endIso: string;
  env: ToolEnv;
}): Promise<SlotCheck> {
  const { ctx, clinicId, professionalId, dataIso, horaInicio, horaFim, startIso, endIso, env } = params;

  // 1) Grade do profissional nesse dia da semana
  const dow = dowFromIsoDate(dataIso);
  const grade = ctx.professional_schedules.filter((ps) => ps.professional_id === professionalId);
  const doDia = grade.filter((ps) => ps.day_of_week === dow);

  if (doDia.length === 0) {
    const dias = [...new Set(grade.map((ps) => ps.day_of_week))]
      .sort((a, b) => a - b)
      .map((d) => DIAS_SEMANA[d])
      .filter(Boolean);
    return {
      ok: false,
      codigo: 'NAO_ATENDE_NESSE_DIA',
      detalhe: dias.length
        ? `ela nao atende nesse dia da semana — atende ${dias.join(', ')}`
        : 'ela nao tem agenda cadastrada no sistema',
    };
  }

  // 2) O intervalo inteiro precisa caber numa janela de atendimento
  const cabe = doDia.some((ps) => horaInicio >= hhmm(ps.start_time) && horaFim <= hhmm(ps.end_time));
  if (!cabe) {
    const faixas = doDia
      .map((ps) => `${hhmm(ps.start_time)} as ${hhmm(ps.end_time)}`)
      .join(' e ');
    return {
      ok: false,
      codigo: 'FORA_DO_HORARIO',
      detalhe: `nesse dia ela atende so das ${faixas}`,
    };
  }

  const overlapQs = `start_time=lt.${encodeURIComponent(endIso)}&end_time=gt.${encodeURIComponent(startIso)}`;

  // 3) Bloqueio de agenda
  const blockUrl = `${env.supabaseUrl}/rest/v1/professional_blocks?clinic_id=eq.${clinicId}&professional_id=eq.${professionalId}&${overlapQs}&select=id&limit=1`;
  const bl = await fetchJson<Array<{ id: string }>>(blockUrl, { method: 'GET', headers: sbHeaders(env) });
  if (bl.ok && Array.isArray(bl.data) && bl.data.length > 0) {
    return { ok: false, codigo: 'AGENDA_BLOQUEADA', detalhe: 'a agenda dela esta bloqueada nesse horario' };
  }

  // 4) Conflito com outro atendimento ativo
  const busyUrl = `${env.supabaseUrl}/rest/v1/appointments?clinic_id=eq.${clinicId}&professional_id=eq.${professionalId}&status=in.(scheduled,confirmed,pending_confirmation,checked_in,in_progress)&${overlapQs}&select=id&limit=1`;
  const bs = await fetchJson<Array<{ id: string }>>(busyUrl, { method: 'GET', headers: sbHeaders(env) });
  if (bs.ok && Array.isArray(bs.data) && bs.data.length > 0) {
    return { ok: false, codigo: 'HORARIO_OCUPADO', detalhe: 'ja existe outro atendimento marcado nesse horario' };
  }

  return { ok: true };
}

// ─── consultar_agenda ──────────────────────────────────────────────────────

export async function consultarAgenda(args: {
  periodo: string;
  procedimento?: string;
}, ctx: DonnaContext, payload: IncomingPayload, env: ToolEnv): Promise<string> {
  const { dataAlvo, periodoAlvo } = parseData(args.periodo || 'amanha');
  const dataLabel = formatarDataBR(dataAlvo); // declarar aqui para evitar 'Cannot access before initialization'

  // Tenta resolver o procedimento pelo nome — usado pra
  // (a) duração e (b) filtrar profs que fazem aquilo (via p_procedure_id)
  let procedureId: string | null = null;
  let durationMin: number | null = null;
  if (args.procedimento) {
    // Pontuacao (utils.matchProcedimento) em vez do find() com includes
    // bidirecional. Com 47 procedimentos e nomes parecidos ("Botox 1 regiao",
    // "Botox Terco Superior", "Botox completo"), o find() pegava o primeiro
    // parecido e puxava duracao e filtro de profissional errados.
    const found = matchProcedimento(args.procedimento, ctx.procedures);
    if (found) {
      // Procedimento restrito: nem chega a consultar a agenda
      if (politicaProcedimento(found.item) !== 'ofertar') {
        return respostaEscalar(found.item.name);
      }
      procedureId = found.item.id;
      durationMin = found.item.duration_minutes ?? null;
    }
  }

  // RPC: (p_clinic_id, p_date, p_professional_id, p_duration_min, p_period, p_procedure_id)
  const rpcUrl = `${env.supabaseUrl}/rest/v1/rpc/get_available_slots`;

  async function callRpc(useProcedureId: boolean) {
    const body: Record<string, unknown> = {
      p_clinic_id: payload.clinicId,
      p_date: dataAlvo,
      p_professional_id: null,
      p_duration_min: durationMin ?? 30,
      p_period: periodoAlvo, // 'manha' | 'tarde' | null
      p_procedure_id: useProcedureId ? procedureId : null,
      p_min_lead_min: EVA_MIN_LEAD_MIN,
      p_step_min: SLOT_STEP_MIN,
    };
    return await fetchJson<Array<{ professional_id: string; professional_name: string; slot_time: string }>>(rpcUrl, {
      method: 'POST',
      headers: sbHeaders(env),
      body: JSON.stringify(body),
    });
  }

  // 1ª tentativa: com procedure_id (se tem)
  let resp = await callRpc(!!procedureId);
  let usouFallback = false;

  // Verificar ANTES do fallback se é procedimento com data disponível mas sem agenda
  // (Lavieen/Hipro em dia marcado mas sem horários cadastrados para o profissional)
  if (procedureId && (!resp.ok || !Array.isArray(resp.data) || resp.data.length === 0)) {
    const dateAvailUrl = `${env.supabaseUrl}/rest/v1/procedure_available_dates?procedure_id=eq.${procedureId}&clinic_id=eq.${payload.clinicId}&available_date=eq.${dataAlvo}&select=id&limit=1`;
    const dateAvail = await fetchJson<Array<{ id: string }>>(dateAvailUrl, { method: 'GET', headers: sbHeaders(env) });
    if (dateAvail.ok && Array.isArray(dateAvail.data) && dateAvail.data.length > 0) {
      // Dia está marcado como disponível mas não tem agenda de profissional
      // Retornar o dia como disponível e pedir que a equipe confirme o horário
      return [
        `Horario disponivel para ${dataLabel} — DIA MARCADO PARA ESTE EQUIPAMENTO:`,
        `Este procedimento esta disponivel nessa data mas sem horarios fixos cadastrados.`,
        `Ofereça o dia ${dataLabel} para a paciente e pergunte qual horario funciona melhor pra ela (manha ou tarde).`,
        `Quando ela confirmar o horario preferido, crie o agendamento usando o professional_id de quem opera o equipamento ou escale para humano com detalhes='Paciente quer ${args.procedimento} em ${dataLabel} — aguarda confirmacao de horario'.`,
      ].join('\n');
    }
  }

  // Se procedureId existe e não tem resultado, verificar ANTES se é procedimento restrito
  // NUNCA fazer fallback sem procedureId para procedimentos com datas específicas (Lavieen, Hipro, etc.)
  if ((!resp.ok || !Array.isArray(resp.data) || resp.data.length === 0) && procedureId) {
    // Verificar se esse procedimento tem datas restritas
    const checkRestrictUrl = `${env.supabaseUrl}/rest/v1/procedure_available_dates?procedure_id=eq.${procedureId}&clinic_id=eq.${payload.clinicId}&select=id&limit=1`;
    const checkRestrict = await fetchJson<Array<{ id: string }>>(checkRestrictUrl, { method: 'GET', headers: sbHeaders(env) });
    const hasDateRestriction = checkRestrict.ok && Array.isArray(checkRestrict.data) && checkRestrict.data.length > 0;

    if (hasDateRestriction) {
      // Procedimento com datas específicas — NUNCA fazer fallback geral
      // Verificar se a data solicitada está disponível
      const dateAvailUrl2 = `${env.supabaseUrl}/rest/v1/procedure_available_dates?procedure_id=eq.${procedureId}&clinic_id=eq.${payload.clinicId}&available_date=eq.${dataAlvo}&select=id&limit=1`;
      const dateAvail2 = await fetchJson<Array<{ id: string }>>(dateAvailUrl2, { method: 'GET', headers: sbHeaders(env) });
      if (!dateAvail2.ok || !Array.isArray(dateAvail2.data) || dateAvail2.data.length === 0) {
        // Data não disponível — mostrar próximas datas
        const restrictUrl2 = `${env.supabaseUrl}/rest/v1/procedure_available_dates?procedure_id=eq.${procedureId}&available_date=gte.${dataAlvo}&order=available_date.asc&limit=3&select=available_date`;
        const restrictResp2 = await fetchJson<Array<{ available_date: string }>>(restrictUrl2, { method: 'GET', headers: sbHeaders(env) });
        if (restrictResp2.ok && Array.isArray(restrictResp2.data) && restrictResp2.data.length > 0) {
          const proximas = restrictResp2.data.map(d => formatarDataBR(d.available_date)).join(', ');
          return `PROCEDIMENTO_SEM_DATA_DISPONIVEL: Esse procedimento nao esta disponivel em ${dataLabel} — ele so funciona em datas especificas. Proximas datas disponiveis: ${proximas}. Pergunte qual dessas datas funciona melhor pra ela e use consultar_agenda com essa data.`;
        }
        return `PROCEDIMENTO_SEM_DATA_DISPONIVEL: Nao ha datas cadastradas para esse procedimento. Escale para humano.`;
      }
      // Data disponível mas sem horários — oferecer o dia e perguntar horário
      return [
        `Horario disponivel para ${dataLabel} — DIA MARCADO PARA ESTE EQUIPAMENTO:`,
        `Ofereça o dia ${dataLabel} para a paciente e pergunte qual horario funciona melhor pra ela (manha ou tarde).`,
        `Quando ela confirmar o horario preferido, crie o agendamento ou escale para humano com detalhes.`,
      ].join('\n');
    }

    // Procedimento sem restrição de data — fazer fallback normal
    resp = await callRpc(false);
    usouFallback = true;
  }

  const periodoLabel = periodoAlvo ? ` (${periodoAlvo})` : '';

  if (!resp.ok || !Array.isArray(resp.data) || resp.data.length === 0) {
    // Verificar se e restricao de data do procedimento (Lavieen, Hipro, etc.)
    if (procedureId) {
      const restrictUrl = `${env.supabaseUrl}/rest/v1/procedure_available_dates?procedure_id=eq.${procedureId}&available_date=gte.${dataAlvo}&order=available_date.asc&limit=3&select=available_date`;
      const restrictResp = await fetchJson<Array<{ available_date: string }>>(restrictUrl, {
        method: 'GET', headers: sbHeaders(env),
      });
      if (restrictResp.ok && Array.isArray(restrictResp.data) && restrictResp.data.length > 0) {
        const proximas = restrictResp.data.map(d => formatarDataBR(d.available_date)).join(', ');
        return `PROCEDIMENTO_SEM_DATA_DISPONIVEL: Esse procedimento nao esta disponivel em ${dataLabel} — ele funciona em datas especificas conforme agenda do equipamento. Proximas datas disponiveis: ${proximas}. Pergunte qual dessas datas funciona melhor pra ela e use consultar_agenda com essa data.`;
      }
      // Sem nenhuma data futura — escalar
      return `PROCEDIMENTO_SEM_DATA_DISPONIVEL: Nao ha datas cadastradas para esse procedimento no momento. Diga com elegancia que esse procedimento funciona em datas especiais e que voce vai confirmar a proxima disponibilidade. Chame escalar_humano com motivo='duvida_complexa' e detalhes='Paciente tem interesse em ${args.procedimento} — sem datas cadastradas no sistema'.`;
    }
    // Antes de devolver "sem vaga", descobre QUAIS sao os proximos dias com
    // vaga real. Sem isso a Eva ficava chutando dias e a paciente desistia.
    const proximas = await proximasDatasComVaga({
      clinicId: payload.clinicId,
      procedureId,
      fromIso: dataAlvo,
      durationMin,
      periodo: periodoAlvo,
      env,
    });

    const closed = isClinicClosed(ctx, dataAlvo);
    if (closed) {
      return proximas
        ? `FECHADO_NESSE_DIA: ${dataLabel}. A clinica nao atende nesse dia da semana. PROXIMAS DATAS COM VAGA REAL: ${proximas}. Diga com elegancia que nesse dia nao ha atendimento e ofereca 2 dessas datas — nunca invente outras.`
        : `FECHADO_NESSE_DIA: ${dataLabel}. A clinica nao atende nesse dia da semana. Diga com elegancia e sugira outro dia util.`;
    }

    if (proximas) {
      return `SEM_VAGAS_NO_PERIODO: ${dataLabel}${periodoLabel} esta sem horario. PROXIMAS DATAS COM VAGA REAL: ${proximas}. Diga que esse dia esta concorrido e ja ofereca 2 dessas datas de forma natural — nunca invente data que nao esteja nessa lista. Depois que ela escolher, chame consultar_agenda com essa data pra pegar os horarios.`;
    }

    return `SEM_VAGAS_NO_PERIODO: ${dataLabel}${periodoLabel}. Nao encontrei vaga nos proximos ${PROXIMAS_DATAS_SCAN} dias. Diga com elegancia que a agenda esta cheia e chame escalar_humano com motivo='duvida_complexa' e detalhes='Agenda sem vaga nos proximos ${PROXIMAS_DATAS_SCAN} dias — paciente quer ${args.procedimento ?? 'atendimento'}'.`;
  }

  const slots = resp.data;
  const porProf = new Map<string, string[]>();
  for (const s of slots) {
    const key = `${s.professional_name}|${s.professional_id}`;
    if (!porProf.has(key)) porProf.set(key, []);
    porProf.get(key)!.push(String(s.slot_time).slice(0, 5));
  }

  const linhas: string[] = [];
  for (const [key, horas] of porProf.entries()) {
    const [nome, id] = key.split('|');
    if (horas.length === 0) continue;
    linhas.push(`${nome} (id: ${id}): ${horas.slice(0, 6).join(', ')}`);
  }

  return [
    `Horarios REAIS disponiveis para ${dataLabel}${periodoLabel}:`,
    ...linhas,
    '',
    'Quando a paciente confirmar um horario, chame criar_agendamento com o professional_id correto (acima entre parênteses). Apresente apenas 2-3 horarios pra ela escolher.',
  ].join('\n');
}

// ─── consultar_meu_agendamento ──────────────────────────────────────────────
//
// Caso real (Patricia): paciente pergunta "confirma meu retorno?" / "que dia
// que ficou marcado?" e a Eva nao tinha NENHUMA tool pra olhar o agendamento
// ja existente — so sabia consultar VAGAS livres. Resultado: 3h de idas e
// vindas oferecendo remarcar algo que ja estava marcado, ate escalar humano.
// Esta tool resolve na hora: busca os proximos agendamentos da propria
// paciente (patient_id resolvido no contexto pelo telefone) e devolve pronto
// pra Eva informar, sem inventar nem sugerir remarcacao.
export async function consultarMeuAgendamento(
  _args: Record<string, unknown>,
  ctx: DonnaContext,
  payload: IncomingPayload,
  env: ToolEnv,
): Promise<string> {
  const patientId = ctx.patient?.id;
  if (!patientId) {
    return 'SEM_PACIENTE_CADASTRADO: Esse telefone nao tem cadastro de paciente vinculado no sistema, entao nao ha como consultar agendamento existente. Diga com elegancia que nao encontrou nada nesse numero e pergunte o nome completo dela pra equipe localizar, ou chame escalar_humano com motivo=\'duvida_complexa\' se ela insistir que tem agendamento.';
  }

  const nowIso = new Date().toISOString();
  const url = `${env.supabaseUrl}/rest/v1/appointments?patient_id=eq.${patientId}&clinic_id=eq.${payload.clinicId}&status=in.(scheduled,confirmed,pending_confirmation,checked_in)&start_time=gte.${nowIso}&order=start_time.asc&limit=3&select=start_time,status,professional_id,procedure_id`;

  const resp = await fetchJson<Array<{ start_time: string; status: string; professional_id: string | null; procedure_id: string | null }>>(url, {
    method: 'GET', headers: sbHeaders(env),
  });

  if (!resp.ok || !Array.isArray(resp.data) || resp.data.length === 0) {
    return 'SEM_AGENDAMENTO_FUTURO: Essa paciente nao tem nenhum agendamento futuro cadastrado no sistema. Diga com elegancia que nao encontrou nada marcado no momento e pergunte se ela gostaria de marcar um horario agora (chame consultar_agenda em seguida).';
  }

  const profById = new Map(ctx.professionals.map((p) => [p.id, p.name]));
  const procById = new Map(ctx.procedures.map((p) => [p.id, p.name]));

  const linhas = resp.data.map((a) => {
    const data = formatarDataBR(a.start_time.slice(0, 10));
    const hora = a.start_time.slice(11, 16);
    const prof = (a.professional_id && profById.get(a.professional_id)) || 'a confirmar';
    const proc = (a.procedure_id && procById.get(a.procedure_id)) || null;
    return `${data} as ${hora} com ${prof}${proc ? ` — ${proc}` : ''} (status: ${a.status})`;
  });

  return [
    'AGENDAMENTO(S) REAL(IS) JA MARCADOS PARA ESSA PACIENTE:',
    ...linhas,
    '',
    'Informe esses dados exatamente como estao acima, de forma calorosa. NAO ofereca outros horarios nem sugira remarcar — a menos que a propria paciente peca pra mudar. Se ela pedir pra cancelar ou remarcar, chame escalar_humano.',
  ].join('\n');
}

// ─── criar_agendamento ─────────────────────────────────────────────────────

export async function criarAgendamento(args: {
  professional_id: string;
  data: string;
  horario: string;
  nome_paciente: string;
  procedimento?: string;
}, ctx: DonnaContext, payload: IncomingPayload, env: ToolEnv): Promise<{
  toolResultStr: string;
  appointmentCreated: boolean;
  leadConvertedId?: string | null;
  patientId?: string | null;
}> {
  const { professionals: allProfessionals, procedures, history, patient } = ctx;
  // Excluir agendas de recursos (Cursos, Aparelhos) — não são profissionais atendentes
  const professionals = allProfessionals.filter((p) => isBookableName(p.name));
  const validProfIds = new Set<string>(professionals.map((p) => p.id));

  // 1) Validar/resolver professional_id
  let professionalId = args.professional_id;
  let profSource = 'claude';

  if (!validProfIds.has(professionalId)) {
    let matched: ProfessionalRow | null = null;

    // Fallback: nome do profissional — busca do mais recente pro mais antigo
    // para pegar quem foi CONFIRMADO por último (evita pegar Amanda quando Sarah foi confirmada)
    const lastMsgs = history.slice(-8).reverse();
    outerLoop:
    for (const msg of lastMsgs) {
      const t = norm(msg.content);
      for (const p of professionals) {
        const pNorm = norm(p.name).replace(/^dra?\.?\s+/, '');
        const firstName = pNorm.split(/\s+/)[0];
        if (!firstName) continue;
        if (t.includes(firstName)) {
          matched = p;
          profSource = 'historico';
          break outerLoop;
        }
      }
    }

    // Procedimento → primeiro profissional dele
    if (!matched && args.procedimento) {
      const needle = norm(args.procedimento);
      const proc = procedures.find((p) => {
        const hay = norm(p.name);
        return hay.includes(needle) || needle.includes(hay);
      });
      if (proc?.professional_ids?.length) {
        matched = professionals.find((p) => p.id === proc.professional_ids![0]) || null;
        if (matched) profSource = 'procedimento';
      }
    }

    if (!matched && professionals.length === 1) {
      matched = professionals[0];
      profSource = 'unico';
    }

    // Fallback final: usar SOMENTE profissional com agenda cadastrada
    // Nunca usar admin/recepcionista que não atendem pacientes
    if (!matched) {
      const CLINICAL = ['doctor','dentist','biomedic','nurse','esthetician',
                        'physiotherapist','nutritionist','psychologist'];
      // Só profissionais clínicos COM horários cadastrados
      const withSchedule = professionals.filter(p =>
        CLINICAL.includes(p.role || '') || CLINICAL.includes(p.professional_role || '')
      );
      if (withSchedule.length > 0) {
        matched = withSchedule[0];
        profSource = 'fallback_clinical';
      }
      // Se nenhum encontrado, não agenda — escala para humano
    }

    if (matched) professionalId = matched.id;
  }

  if (!validProfIds.has(professionalId)) {
    return {
      toolResultStr:
        'Profissional nao identificado. Responda com elegancia que precisa confirmar com qual profissional ela quer o horario. Apresente as opcoes.',
      appointmentCreated: false,
    };
  }

  // 2) Resolver procedure_id pelo nome (e a duração real dele)
  let procedureId: string | null = null;
  let duracaoMin = 30; // fallback quando o procedimento não é identificado
  let procedimentoResolvido: (typeof procedures)[number] | null = null;
  if (args.procedimento) {
    const proc = matchProcedimento(args.procedimento, procedures)?.item ?? null;
    if (proc) {
      procedimentoResolvido = proc;
      procedureId = proc.id;
      const d = Number(proc.duration_minutes);
      // clamp defensivo: cadastro errado não pode gerar end_time absurdo
      if (Number.isFinite(d) && d >= 5 && d <= 480) duracaoMin = Math.round(d);
    }
  }

  // Procedimento restrito (eva_policy): a Eva nao agenda, encaminha pra humano.
  // Checagem aqui e nao so na consultar_agenda porque a paciente pode escolher
  // um horario oferecido antes e a Eva emendar direto no criar_agendamento.
  if (procedimentoResolvido && politicaProcedimento(procedimentoResolvido) !== 'ofertar') {
    return {
      toolResultStr: respostaEscalar(procedimentoResolvido.name),
      appointmentCreated: false,
    };
  }

  // 3) Resolver/criar paciente
  // Nome a usar: prioridade para o nome confirmado (lead/patient cadastrado),
  // depois o que Claude passou (que veio da conversa), e só como último fallback
  // o pushName do WhatsApp (pode ser apelido, nome de empresa, etc).
  const trustedName = (patient?.name?.trim() || ctx.lead?.name?.trim() || args.nome_paciente?.trim() || payload.customerName?.trim() || '').trim();

  let patientId: string | null = patient?.id ?? null;

  // Anti-duplicata: antes de criar, procura paciente existente cujo telefone
  // bate pela chave canônica (ignora 55, 9 extra e máscara). Evita criar um
  // segundo cadastro pro mesmo número em formato diferente.
  if (!patientId && payload.phone) {
    const canon = (raw: string | null | undefined): string => {
      if (!raw) return '';
      let p = raw.replace(/\D/g, '');
      if (p.length >= 12 && p.startsWith('55')) p = p.slice(2);
      if (p.length === 11 && p[2] === '9') p = p.slice(0, 2) + p.slice(3);
      return p;
    };
    const alvo = canon(payload.phone);
    if (alvo) {
      try {
        const listUrl = `${env.supabaseUrl}/rest/v1/patients?clinic_id=eq.${payload.clinicId}&phone=not.is.null&select=id,phone`;
        const lr = await fetchJson<Array<{ id: string; phone: string }>>(listUrl, { headers: sbHeaders(env) });
        if (lr.ok && Array.isArray(lr.data)) {
          const match = lr.data.find((p) => canon(p.phone) === alvo);
          if (match) patientId = match.id;
        }
      } catch (_e) {
        // se a busca falhar, segue o fluxo normal de criar (nao bloqueia agendamento)
      }
    }
  }

  if (!patientId) {
    const url = `${env.supabaseUrl}/rest/v1/patients`;
    const headers = { ...sbHeaders(env), Prefer: 'return=representation' };
    const r = await fetchJson<Array<{ id: string }>>(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        clinic_id: payload.clinicId,
        name: trustedName || args.nome_paciente,
        phone: payload.phone,
      }),
    });
    if (!r.ok) {
      return {
        toolResultStr: `ERRO ao cadastrar paciente: ${r.error || 'falha desconhecida'}. Peca desculpas com elegancia e diga que vai re-verificar.`,
        appointmentCreated: false,
      };
    }
    const arr = Array.isArray(r.data) ? r.data : null;
    patientId = arr?.[0]?.id || null;
    if (!patientId) {
      return {
        toolResultStr: 'ERRO ao cadastrar paciente (sem id retornado). Peca desculpas com elegancia.',
        appointmentCreated: false,
      };
    }
  }

  // 4) Montar o intervalo (usa a duração REAL do procedimento, não 30min fixo)
  const [hh, mm] = String(args.horario).split(':').map(Number);
  const dataOk = /^\d{4}-\d{2}-\d{2}$/.test(String(args.data));
  if (!dataOk || !Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return {
      toolResultStr:
        'DATA_OU_HORA_INVALIDA: nao consegui interpretar a data/horario. NAO confirme nada. Pergunte de novo o dia e o horario e chame consultar_agenda antes de agendar.',
      appointmentCreated: false,
      patientId,
    };
  }

  const horaInicio = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  const startIso = `${args.data}T${horaInicio}:00-03:00`;
  const endMin = hh * 60 + mm + duracaoMin;
  const endH = Math.floor(endMin / 60);
  const endM = endMin % 60;
  const horaFim = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  const endIso = `${args.data}T${horaFim}:00-03:00`;

  // Checar duplicata: mesmo paciente + mesmo horário + status ativo
  const checkUrl = `${env.supabaseUrl}/rest/v1/appointments?clinic_id=eq.${payload.clinicId}&patient_id=eq.${patientId}&start_time=eq.${encodeURIComponent(startIso)}&status=in.(scheduled,confirmed,pending_confirmation)&select=id&limit=1`;
  const checkR = await fetchJson<Array<{ id: string }>>(checkUrl, {
    method: 'GET',
    headers: sbHeaders(env),
  });
  if (checkR.ok && Array.isArray(checkR.data) && checkR.data.length > 0) {
    // Agendamento já existe — retornar como sucesso sem criar duplicata
    return {
      toolResultStr: `Agendamento ja confirmado para ${args.nome_paciente} em ${args.data} as ${args.horario}. Confirme com elegancia que o horario ja esta reservado.`,
      appointmentCreated: true,
      patientId,
    };
  }

  // 4.1) GUARD: o horário existe de verdade na agenda?
  //
  // Sem isto, qualquer horário que o modelo confirmar entra no banco — inclusive
  // dia em que a profissional não atende. Caso real: paciente pediu "sábado às
  // 10h", consultar_agenda respondeu que não havia vaga e a Eva agendou mesmo
  // assim. Prompt não segura isso; tem que ser no código.
  const profNome = professionals.find((p) => p.id === professionalId)?.name || 'a profissional';
  const [yy, mo, dd] = args.data.split('-');
  const dataFmt = `${dd}/${mo}/${yy}`;
  const diaNome = DIAS_SEMANA[dowFromIsoDate(args.data)] || '';

  const recusar = (codigo: string, detalhe: string) => ({
    toolResultStr: [
      `${codigo}: O AGENDAMENTO NAO FOI CRIADO.`,
      `${dataFmt} (${diaNome}) as ${horaInicio} com ${profNome}: ${detalhe}.`,
      'NUNCA confirme esse horario pra paciente e nao invente que esta reservado.',
      'Peca desculpas com elegancia, explique que esse horario nao esta disponivel e chame consultar_agenda pra oferecer 2-3 opcoes reais antes de tentar agendar de novo.',
    ].join('\n'),
    appointmentCreated: false,
    patientId,
  });

  if (new Date(startIso).getTime() <= Date.now()) {
    return recusar('DATA_NO_PASSADO', 'esse horario ja passou');
  }

  // Datas restritas (procedure_available_dates, ja vem no contexto). Antes so a
  // consultar_agenda respeitava isso — a criar_agendamento nao checava, entao a
  // Eva conseguia marcar "Paciente Modelo" (que so existe em dia de curso) em
  // qualquer dia em que o profissional tivesse grade livre.
  const datasPermitidas = Array.isArray(procedimentoResolvido?.restricted_dates)
    ? procedimentoResolvido!.restricted_dates!
    : null;
  if (datasPermitidas && datasPermitidas.length > 0 && !datasPermitidas.includes(args.data)) {
    const proximas = datasPermitidas.slice(0, 3).map((d) => formatarDataBR(d)).join(', ');
    return recusar(
      'DATA_NAO_PERMITIDA_PARA_ESSE_PROCEDIMENTO',
      `esse procedimento so acontece em datas especificas — as proximas sao ${proximas}. Ofereca uma dessas datas e refaca o agendamento; nunca invente outra data.`,
    );
  }

  const slot = await validarSlot({
    ctx,
    clinicId: payload.clinicId,
    professionalId,
    dataIso: args.data,
    horaInicio,
    horaFim,
    startIso,
    endIso,
    env,
  });

  if (!slot.ok) {
    return recusar(slot.codigo, slot.detalhe);
  }

  const apptUrl = `${env.supabaseUrl}/rest/v1/appointments`;
  const apptHeaders = { ...sbHeaders(env), Prefer: 'return=representation' };
  const apptBody = {
    clinic_id: payload.clinicId,
    patient_id: patientId,
    professional_id: professionalId,
    procedure_id: procedureId,
    start_time: startIso,
    end_time: endIso,
    status: 'scheduled',
    notes: args.procedimento ? `Procedimento: ${args.procedimento} (agendado pela Eva)` : 'Agendado pela Eva via WhatsApp',
  };
  const apptR = await fetchJson<Array<{ id: string }>>(apptUrl, {
    method: 'POST',
    headers: apptHeaders,
    body: JSON.stringify(apptBody),
  });

  if (!apptR.ok) {
    return {
      toolResultStr: `ERRO ao criar agendamento: ${apptR.error || 'falha desconhecida'}. Peca desculpas com elegancia, sugira outro horario.`,
      appointmentCreated: false,
      patientId,
    };
  }

  // 5) Se tinha lead -> avanca pra 'scheduled' (Agendado).
  // 'converted' = cliente que compareceu, sera marcado por trigger quando
  // appointment virar 'completed'. Aqui apenas registramos o agendamento.
  let leadConvertedId: string | null = null;
  if (ctx.lead?.id) {
    leadConvertedId = ctx.lead.id;
    const leadUrl = `${env.supabaseUrl}/rest/v1/leads?id=eq.${leadConvertedId}`;
    await fetchJson(leadUrl, {
      method: 'PATCH',
      headers: sbHeaders(env),
      body: JSON.stringify({
        status: 'scheduled',
        last_contact_at: new Date().toISOString(),
        ai_priority: 'hot',
        ai_suggested_action: `Agendou ${args.procedimento ?? 'consulta'} via Eva`,
        ai_last_analysis: new Date().toISOString(),
        // Para a Eva tambem: zera follow-up pendente, ja agendou
        eva_followup_count: 0,
        eva_next_followup_at: null,
      }),
    });
  }

  const [y, m, d] = args.data.split('-');
  const procPart = args.procedimento ? `Procedimento: ${args.procedimento}\n` : '';
  const nomeFinal = trustedName || args.nome_paciente;

  return {
    toolResultStr: [
      'AGENDAMENTO CRIADO COM SUCESSO!',
      `Paciente: ${nomeFinal}`,
      `Data: ${d}/${m}/${y} as ${args.horario}`,
      procPart.trim(),
      'Confirme com a paciente, mencione que ela recebera lembrete D-1 e seja calorosa. NAO repita o nome dela mais de uma vez.',
    ].filter(Boolean).join('\n'),
    appointmentCreated: true,
    leadConvertedId,
    patientId,
  };
}

// ─── atualizar_nome_lead ───────────────────────────────────────────────────

/**
 * Eva chama assim que descobre o nome real da paciente (geralmente apos a
 * mensagem de boas-vindas). Atualiza leads.name pra o card do CRM mostrar
 * o nome real (em vez de "Lead WhatsApp" ou pushName generico).
 */
export async function atualizarNomeLead(
  args: { nome_completo: string },
  ctx: DonnaContext,
  _payload: IncomingPayload,
  env: ToolEnv,
): Promise<string> {
  const novo = (args.nome_completo || '').trim();
  if (novo.length < 2) {
    return 'Nome muito curto pra registrar. Continue conversando normalmente, pergunte de novo se necessario.';
  }
  if (!ctx.lead?.id) {
    return 'Nome anotado, mas nao ha lead vinculado. Continue conversando normalmente.';
  }

  const url = `${env.supabaseUrl}/rest/v1/leads?id=eq.${ctx.lead.id}`;
  const r = await fetchJson(url, {
    method: 'PATCH',
    headers: sbHeaders(env),
    body: JSON.stringify({
      name: novo.slice(0, 200),
      last_contact_at: new Date().toISOString(),
    }),
  });

  if (!r.ok) {
    return `Nao consegui atualizar o nome no sistema (${r.error || 'erro desconhecido'}), mas continue conversando normalmente.`;
  }

  // Retorno simples — não instrui o Claude a escrever mensagem (evita segunda call)
  // O modelo já sabe continuar naturalmente após registrar o nome.
  return `Nome "${novo}" registrado com sucesso.`;
}

// ─── escalar_humano ────────────────────────────────────────────────────────

/**
 * Marca o lead como needing human review. Tipos de motivo possiveis:
 * - 'cancelamento' - paciente quer cancelar agendamento
 * - 'reagendamento' - paciente quer mudar dia/horario
 * - 'reclamacao' - paciente insatisfeita
 * - 'duvida_complexa' - pergunta que Eva nao sabe responder
 * - outros
 *
 * Side effect: ai_priority='hot', needs_human_review=true,
 * preenche human_review_* pra aparecer com badge no CRM.
 */
export async function escalarHumano(
  args: { motivo: string; detalhes?: string },
  ctx: DonnaContext,
  _payload: IncomingPayload,
  env: ToolEnv,
): Promise<string> {
  const motivo = args.motivo || 'duvida_complexa';
  const detalhes = args.detalhes || '';

  if (ctx.lead?.id) {
    const url = `${env.supabaseUrl}/rest/v1/leads?id=eq.${ctx.lead.id}`;
    await fetchJson(url, {
      method: 'PATCH',
      headers: sbHeaders(env),
      body: JSON.stringify({
        ai_priority: 'hot',
        ai_suggested_action: `[ATENDIMENTO HUMANO] ${motivo}: ${detalhes}`.slice(0, 500),
        ai_last_analysis: new Date().toISOString(),
        needs_human_review: true,
        human_review_reason: motivo,
        human_review_details: detalhes.slice(0, 1000) || null,
        human_review_at: new Date().toISOString(),
        // Pausa follow-up automatico — quem cuida agora eh o humano
        eva_followup_count: 0,
        eva_next_followup_at: null,
      }),
    });
  }

  // Resposta da Eva eh DEFINIDA NO PROMPT (regra #5) por motivo,
  // entao aqui so sinalizamos sucesso.
  return `Sinalizado para atendente humano (motivo: ${motivo}). Lead marcado pra revisao humana e badge "Atendimento" aparece no CRM. Sua resposta para a paciente deve seguir o template da regra #5 de acordo com o motivo. NUNCA confirme cancelamento/reagendamento como ja resolvido — humano vai concluir.`;
}

// ─── registrar_interesse ───────────────────────────────────────────────────

/**
 * Sinais de "alto interesse" pra classificar lead como warm/hot.
 * Usado pra dar prioridade no CRM sem atrapalhar o fluxo conversacional.
 */
/**
 * Calcula a temperatura do lead baseada no ENGAJAMENTO ao longo da conversa,
 * não na primeira mensagem.
 *
 * Problema anterior: tráfego pago chega com mensagem pré-pronta ("Olá, tenho
 * interesse em...") que disparava 'warm' ou 'hot' imediatamente, sem nenhuma
 * interação real.
 *
 * Nova lógica:
 * - cold: menos de 2 trocas reais (só chegou, não engajou)
 * - warm: engajamento real (perguntou algo, respondeu perguntas da Eva)
 * - hot: sinais claros de intenção de agendar (pediu horário, preço, urgência)
 *
 * @param observacoes texto das observações registradas pela Eva
 * @param procedimento nome do procedimento de interesse
 * @param historyLength número de mensagens já trocadas (ida+volta)
 */
function detectarPrioridade(
  observacoes: string | undefined,
  procedimento: string,
  historyLength: number = 0,
): 'cold' | 'warm' | 'hot' {
  // Menos de 4 mensagens = ainda não houve engajamento real
  // (1ª msg do tráfego + resposta da Eva = 2 mensagens; esperamos pelo menos mais 1 resposta real)
  if (historyLength < 4) {
    return 'cold';
  }

  const txt = norm(`${observacoes ?? ''} ${procedimento}`);

  // Hot: intenção clara de agendar, pediu preço, urgência
  if (/agendar|marcar|preco|valor|quanto|hoje|amanha|essa semana|urgente|quero fazer|quero agendar|tem hoje|tem amanha|disponibilidade|horario|quando tem|qual horario/.test(txt)) {
    return 'hot';
  }

  // Warm: engajamento real (chegou a esse ponto = pelo menos 4 mensagens)
  return 'warm';
}

export async function registrarInteresse(
  args: { procedimento: string; observacoes?: string },
  ctx: DonnaContext,
  _payload: IncomingPayload,
  env: ToolEnv,
): Promise<string> {
  const procedimento = args.procedimento;
  const proc = ctx.procedures.find((p) => norm(p.name).includes(norm(procedimento)));
  const historyLength = ctx.history?.length ?? 0;
  const prioridade = detectarPrioridade(args.observacoes, procedimento, historyLength);

  if (!ctx.lead?.id) {
    return `Interesse em "${procedimento}" anotado, mas sem lead vinculado no CRM. Continue a conversa naturalmente.`;
  }

  // Status: se ainda esta como 'new', avanca pra 'contacted'. Nao retrocede status.
  const nextStatus = ctx.lead.status === 'new' ? 'contacted' : ctx.lead.status;

  const patch: Record<string, unknown> = {
    interest: procedimento,
    procedure_id: proc?.id ?? null,
    last_contact_at: new Date().toISOString(),
    ai_priority: prioridade,
    ai_last_analysis: new Date().toISOString(),
    ai_suggested_action: `Interesse: ${procedimento}${args.observacoes ? ` — ${args.observacoes.slice(0, 200)}` : ''}`,
  };
  if (nextStatus && nextStatus !== ctx.lead.status) {
    patch.status = nextStatus;
  }
  if (args.observacoes && args.observacoes.trim().length > 0) {
    patch.notes = args.observacoes.slice(0, 500);
  }

  const url = `${env.supabaseUrl}/rest/v1/leads?id=eq.${ctx.lead.id}`;
  const r = await fetchJson(url, {
    method: 'PATCH',
    headers: sbHeaders(env),
    body: JSON.stringify(patch),
  });

  if (!r.ok) {
    return `Falha ao registrar interesse no CRM (${r.error || 'erro desconhecido'}). Continue a conversa normalmente.`;
  }

  return `Interesse em "${procedimento}" registrado no CRM (prioridade: ${prioridade}). Continue a conversa naturalmente, sem mencionar registro/CRM. Conduza pra avaliacao se fizer sentido.`;
}


// ─── sendResultImages ──────────────────────────────────────────────────────
//
// Chamada APÓS registrar_interesse (tanto pela CAMADA 0 quanto pelo dispatcher).
// Busca até N imagens ativas do procedimento e envia via Evolution API.
// Idempotente: não reenvia se images_sent_procedures já contém o procedure_id.
//
export async function sendResultImages(
  procedureId: string | null | undefined,
  procedureName: string,
  ctx: DonnaContext,
  payload: IncomingPayload,
  env: ToolEnv,
  imagesSentProcedures: Set<string>,
): Promise<void> {
  // Helper de log que persiste em eva_logs (visível no painel admin)
  const logGaleria = async (status: string, details: Record<string, unknown>) => {
    try {
      await fetchJson(`${env.supabaseUrl}/rest/v1/rpc/insert_eva_log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: env.serviceKey,
          Authorization: `Bearer ${env.serviceKey}`,
        },
        body: JSON.stringify({
          p_clinic_id: payload.clinicId,
          p_phone: payload.phone?.replace(/\D/g, '').slice(-11) ?? null,
          p_source: 'eva-process',
          p_event: 'galeria_resultado',
          p_status: status,
          p_details: { procedure_id: procedureId, procedure_name: procedureName, ...details },
        }),
      });
    } catch (_e) { /* nunca quebra o fluxo por causa de log */ }
  };

  // Sem procedure_id não conseguimos buscar as imagens
  if (!procedureId) { await logGaleria('skip', { motivo: 'sem_procedure_id' }); return; }

  // Já enviou imagens desse procedimento nessa sessão — não reenviar
  if (imagesSentProcedures.has(procedureId)) { await logGaleria('skip', { motivo: 'ja_enviado_na_sessao' }); return; }

  const ev = ctx.evolution;
  if (!ev?.url || !ev?.master_key) { await logGaleria('skip', { motivo: 'evolution_sem_credencial', tem_url: !!ev?.url, tem_key: !!ev?.master_key }); return; }

  const instanceName =
    (typeof payload.instance === 'string' && payload.instance.trim()) || ev.instance || '';
  if (!instanceName) { await logGaleria('skip', { motivo: 'sem_instancia' }); return; }

  try {
    // 1) Verificar se a clínica tem o toggle ativo
    const autoUrl = `${env.supabaseUrl}/rest/v1/clinic_automations?clinic_id=eq.${payload.clinicId}&select=eva_send_result_images,eva_max_result_images`;
    const autoRes = await fetchJson<{ eva_send_result_images: boolean; eva_max_result_images: number }[]>(autoUrl, {
      method: 'GET',
      headers: { apikey: env.serviceKey, Authorization: `Bearer ${env.serviceKey}` },
    });
    if (!autoRes.ok || !autoRes.data?.length) { await logGaleria('skip', { motivo: 'sem_automations', ok: autoRes.ok }); return; }
    const automations = autoRes.data[0];
    if (!automations.eva_send_result_images) { await logGaleria('skip', { motivo: 'toggle_desligado' }); return; }
    const maxImages = Math.min(automations.eva_max_result_images ?? 3, 6);

    // 2) Buscar imagens ativas do procedimento (ordenadas por display_order)
    const imgUrl = `${env.supabaseUrl}/rest/v1/procedure_result_images?clinic_id=eq.${payload.clinicId}&procedure_id=eq.${procedureId}&active=eq.true&lgpd_consent=eq.true&order=display_order.asc&limit=${maxImages}&select=image_url,caption`;
    const imgRes = await fetchJson<{ image_url: string; caption: string | null }[]>(imgUrl, {
      method: 'GET',
      headers: { apikey: env.serviceKey, Authorization: `Bearer ${env.serviceKey}` },
    });
    if (!imgRes.ok || !imgRes.data?.length) { await logGaleria('skip', { motivo: 'sem_imagens', ok: imgRes.ok, count: imgRes.data?.length ?? 0 }); return; }

    const images = imgRes.data;

    // 3) Enviar cada imagem via Evolution API sendMedia
    let enviadas = 0;
    const respostas: unknown[] = [];
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const caption = i === 0
        ? (img.caption || `✨ Resultado real de ${procedureName}`)
        : (img.caption || '');

      const sendRes = await fetchJson(`${ev.url}/message/sendMedia/${encodeURIComponent(instanceName)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: ev.master_key,
        },
        body: JSON.stringify({
          number: payload.phone,
          mediatype: 'image',
          mimetype: 'image/jpeg',
          media: img.image_url,
          caption,
          fileName: `resultado-${Date.now()}.jpg`,
        }),
      });

      if (sendRes.ok) enviadas++;
      // Captura status e resposta da Evolution para diagnóstico
      respostas.push({ ok: sendRes.ok, status: (sendRes as any).status, error: (sendRes as any).error });

      // Pequeno delay entre imagens para não sobrecarregar
      if (i < images.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    // 4) Marcar como enviado para evitar reenvio na mesma sessão
    if (enviadas > 0) imagesSentProcedures.add(procedureId);

    await logGaleria(enviadas > 0 ? 'ok' : 'error', {
      instancia: instanceName,
      total_imagens: images.length,
      enviadas,
      respostas_evolution: respostas,
    });
  } catch (e) {
    // Fail silencioso — não interrompe o fluxo principal da Eva
    await logGaleria('error', { erro: e instanceof Error ? e.message : String(e) });
  }
}

// ─── enviar_fotos_resultado ────────────────────────────────────────────────

/**
 * Tool chamada pela Eva quando a paciente pede para ver fotos/resultados de um
 * procedimento. Diferente do envio automático (sendResultImages na CAMADA 0),
 * aqui a Eva ESCOLHE o momento e escreve o texto de apresentação com calor.
 *
 * Fluxo: 1) acha o procedimento certo por pontuação (nome completo > palavras,
 * empate a favor de quem tem imagem), 2) envia as imagens via sendResultImages,
 * 3) retorna instrução para o Claude apresentar com contexto e calor.
 */
export async function enviarFotosResultado(
  args: { procedimento?: string },
  ctx: DonnaContext,
  payload: IncomingPayload,
  env: ToolEnv,
  imagesSentProcedures: Set<string>,
): Promise<string> {
  // Texto base do match: o que a Eva passou + interesse já registrado do lead
  const pedido = norm(args.procedimento || '');
  const interesse = norm(ctx.lead?.interest || '');
  const textoMatch = `${pedido} ${interesse}`.trim();

  if (!textoMatch) {
    return 'A paciente nao especificou o procedimento. Pergunte com simpatia de qual procedimento ela quer ver os resultados antes de prosseguir.';
  }

  // Descobre quais procedimentos têm imagens (desempate a favor deles)
  let procIdsComImagem = new Set<string>();
  try {
    const idsUrl = `${env.supabaseUrl}/rest/v1/procedure_result_images?clinic_id=eq.${payload.clinicId}&active=eq.true&lgpd_consent=eq.true&select=procedure_id`;
    const idsRes = await fetchJson<{ procedure_id: string }[]>(idsUrl, {
      method: 'GET',
      headers: { apikey: env.serviceKey, Authorization: `Bearer ${env.serviceKey}` },
    });
    if (idsRes.ok && idsRes.data) {
      procIdsComImagem = new Set(idsRes.data.map((r) => r.procedure_id));
    }
  } catch (_e) { /* segue sem o desempate */ }

  // Pontuacao de match — agora compartilhada com consultar_agenda (utils.ts),
  // com bonus de desempate pra quem tem imagem cadastrada.
  const escolhido = matchProcedimento(textoMatch, ctx.procedures, { boostIds: procIdsComImagem, boost: 5 });
  const melhor = escolhido
    ? { id: escolhido.item.id, name: escolhido.item.name, temImagem: procIdsComImagem.has(escolhido.item.id) }
    : null;

  if (!melhor) {
    return `Nao identifiquei o procedimento "${args.procedimento || ctx.lead?.interest || ''}" na lista. Confirme com a paciente qual procedimento ela quer ver, de forma natural.`;
  }

  // Procedimento identificado mas SEM imagem cadastrada
  if (!melhor.temImagem) {
    return [
      `O procedimento "${melhor.name}" ainda nao tem fotos de resultado cadastradas.`,
      'NAO invente que tem fotos. Conduza com calor: explique que o melhor e uma avaliacao presencial com a profissional, que mostra referencias e planeja o resultado. Convide para agendar.',
    ].join('\n');
  }

  // Envia as imagens (reaproveita sendResultImages — respeita toggle, LGPD, idempotência)
  await sendResultImages(
    melhor.id,
    melhor.name,
    ctx,
    payload,
    env,
    imagesSentProcedures,
  );

  return [
    `FOTOS DE RESULTADO DE "${melhor.name}" FORAM ENVIADAS pelo WhatsApp agora.`,
    'As imagens ja chegaram para a paciente. Sua resposta deve APRESENTAR essas fotos com calor e contexto, como se voce estivesse mostrando pessoalmente.',
    'Exemplos de tom (adapte, nao copie): "Olha que resultado lindo desse procedimento 😍", "Da uma olhada nesse antes e depois, ficou natural e harmonioso".',
    'Depois de apresentar, conduza com leveza para uma avaliacao ou agendamento. Seja genuina e calorosa, nunca robotica.',
  ].join('\n');
}

// ─── informar_valor_avista ─────────────────────────────────────────────────

/**
 * Retorna o valor A VISTA real cadastrado do procedimento. A Eva so chama
 * quando a paciente pergunta o valor a vista/Pix/dinheiro/desconto a vista.
 * O valor a vista NAO esta no prompt (blindagem) — so esta aqui, lido direto
 * de procedures.price. Assim e impossivel a Eva vazar o valor cheio antes da
 * paciente pedir explicitamente.
 */
export async function informarValorAvista(
  args: { procedimento: string },
  ctx: DonnaContext,
  _payload: IncomingPayload,
  _env: ToolEnv,
): Promise<string> {
  const needle = norm(args.procedimento || '');
  if (!needle) {
    return 'Procedimento nao informado. Pergunte com elegancia qual procedimento ela quer saber o valor.';
  }

  // Match pelo nome — mesma pontuacao usada nas outras tools (utils.ts)
  const proc = matchProcedimento(args.procedimento, ctx.procedures)?.item ?? null;

  if (!proc) {
    return `Nao encontrei "${args.procedimento}" na lista de procedimentos. Confirme com a paciente qual procedimento ela quer ou ofereca os disponiveis.`;
  }

  // Procedimento restrito: nao vazar preco nem a vista nem parcelado
  if (politicaProcedimento(proc) !== 'ofertar') {
    return respostaEscalar(proc.name);
  }

  if (!proc.price || proc.price <= 0) {
    return `O procedimento "${proc.name}" nao tem valor a vista cadastrado. Informe o valor parcelado (12x) que voce ja conhece, ou diga que vai confirmar o valor a vista com a clinica.`;
  }

  const aVista = formatBRL(proc.price) ?? '—';
  const inst = proc.installments && proc.installments > 0 ? proc.installments : 12;
  const parcela = proc.installment_price ? proc.installment_price : proc.price / inst;
  const parcelaFmt = formatBRL(parcela) ?? '—';

  return [
    `VALOR DO PROCEDIMENTO "${proc.name}":`,
    `- A vista (Pix ou dinheiro): R$ ${aVista}`,
    `- Parcelado no cartao: 12x R$ ${parcelaFmt} sem juros`,
    '',
    'Informe o valor a vista pra paciente de forma natural e calorosa, ja que ela pediu. Voce pode mencionar as duas formas (a vista e parcelado) pra ela escolher. Depois conduza pra avaliacao/agendamento se fizer sentido.',
  ].join('\n');
}

// ─── consultar_datas_curso ──────────────────────────────────────────────────

/**
 * Lista as proximas datas de turma cadastradas para um procedimento de curso.
 * DIFERENTE de consultar_agenda: nao verifica horarios/profissional, nao cria
 * agendamento. Curso nao e slot de agenda — e turma/matricula. A Eva so
 * informa as datas; o fechamento e sempre humano (ver escalar_humano).
 */
export async function consultarDatasCurso(
  args: { procedimento?: string },
  ctx: DonnaContext,
  payload: IncomingPayload,
  env: ToolEnv,
): Promise<string> {
  const needle = norm(args.procedimento || '');
  if (!needle) {
    return 'Nao foi informado qual curso. Pergunte com simpatia de qual curso a pessoa quer saber as datas.';
  }

  const proc = ctx.procedures.find((p) => {
    const hay = norm(p.name);
    return hay.includes(needle) || needle.includes(hay);
  });

  if (!proc) {
    return `Nao encontrei o curso "${args.procedimento}" na lista. Confirme o nome do curso com a pessoa.`;
  }

  const url = `${env.supabaseUrl}/rest/v1/procedure_available_dates?procedure_id=eq.${proc.id}&clinic_id=eq.${payload.clinicId}&available_date=gte.${new Date().toISOString().split('T')[0]}&order=available_date.asc&limit=5&select=available_date,notes`;
  const res = await fetchJson<Array<{ available_date: string; notes: string | null }>>(url, {
    method: 'GET',
    headers: sbHeaders(env),
  });

  if (!res.ok || !Array.isArray(res.data) || res.data.length === 0) {
    return `PROCEDIMENTO_SEM_DATA_DISPONIVEL: Nao ha turmas de "${proc.name}" cadastradas no momento. Diga com elegancia que ainda nao ha data confirmada pra proxima turma e que voce vai verificar. Chame escalar_humano com motivo='duvida_complexa' e detalhes='Interesse em turma de ${proc.name} — sem datas cadastradas'.`;
  }

  const datas = res.data.map((d) => {
    const dataBR = formatarDataBR(d.available_date);
    return d.notes ? `${dataBR} (${d.notes})` : dataBR;
  }).join(', ');

  return [
    `PROXIMAS TURMAS DE "${proc.name}": ${datas}.`,
    'Informe essas datas pra pessoa de forma natural. NAO chame consultar_agenda nem criar_agendamento para curso — nao e um horario de atendimento, e uma turma.',
    'Se a pessoa demonstrar interesse em fechar/matricular: chame registrar_interesse e depois escalar_humano com motivo=\'fechamento_curso\' e detalhes com o curso e a data escolhida. A matricula e sempre concluida por um humano, voce nunca confirma vaga fechada sozinha.',
  ].join('\n');
}

// ─── enviar_material_curso ──────────────────────────────────────────────────

async function sendCourseMaterials(
  procedureId: string,
  procedureName: string,
  ctx: DonnaContext,
  payload: IncomingPayload,
  env: ToolEnv,
  materialsSentProcedures: Set<string>,
): Promise<{ enviados: number }> {
  if (materialsSentProcedures.has(procedureId)) return { enviados: 0 };

  const ev = ctx.evolution;
  if (!ev?.url || !ev?.master_key) return { enviados: 0 };
  const instanceName = (typeof payload.instance === 'string' && payload.instance.trim()) || ev.instance || '';
  if (!instanceName) return { enviados: 0 };

  const autoUrl = `${env.supabaseUrl}/rest/v1/clinic_automations?clinic_id=eq.${payload.clinicId}&select=eva_send_course_materials`;
  const autoRes = await fetchJson<{ eva_send_course_materials: boolean }[]>(autoUrl, {
    method: 'GET',
    headers: sbHeaders(env),
  });
  if (!autoRes.ok || !autoRes.data?.length || !autoRes.data[0].eva_send_course_materials) return { enviados: 0 };

  const docsUrl = `${env.supabaseUrl}/rest/v1/procedure_documents?clinic_id=eq.${payload.clinicId}&procedure_id=eq.${procedureId}&active=eq.true&order=display_order.asc&limit=3&select=file_url,title`;
  const docsRes = await fetchJson<{ file_url: string; title: string | null }[]>(docsUrl, {
    method: 'GET',
    headers: sbHeaders(env),
  });
  if (!docsRes.ok || !docsRes.data?.length) return { enviados: 0 };

  let enviados = 0;
  for (const doc of docsRes.data) {
    const sendRes = await fetchJson(`${ev.url}/message/sendMedia/${encodeURIComponent(instanceName)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ev.master_key },
      body: JSON.stringify({
        number: payload.phone,
        mediatype: 'document',
        mimetype: 'application/pdf',
        media: doc.file_url,
        fileName: `${(doc.title || procedureName).replace(/[^a-zA-Z0-9-_ ]/g, '')}.pdf`,
      }),
    });
    if (sendRes.ok) enviados++;
  }

  if (enviados > 0) materialsSentProcedures.add(procedureId);
  return { enviados };
}

export async function enviarMaterialCurso(
  args: { procedimento?: string },
  ctx: DonnaContext,
  payload: IncomingPayload,
  env: ToolEnv,
  materialsSentProcedures: Set<string>,
): Promise<string> {
  const needle = norm(args.procedimento || '');
  const interesse = norm(ctx.lead?.interest || '');
  const textoMatch = `${needle} ${interesse}`.trim();
  if (!textoMatch) {
    return 'Nao foi identificado qual curso. Pergunte com simpatia de qual curso a pessoa quer o material antes de prosseguir.';
  }

  const proc = ctx.procedures.find((p) => {
    const hay = norm(p.name);
    return hay.includes(needle) || needle.includes(hay);
  });

  if (!proc) {
    return `Nao encontrei o curso "${args.procedimento || ctx.lead?.interest || ''}" na lista. Confirme com a pessoa qual curso ela quer o material.`;
  }

  const { enviados } = await sendCourseMaterials(proc.id, proc.name, ctx, payload, env, materialsSentProcedures);

  if (enviados === 0) {
    return `Nao ha material em PDF cadastrado (ou ja enviado) para "${proc.name}". NAO invente que enviou. Explique com naturalidade e ofereca tirar duvidas por texto mesmo, ou escale se necessario.`;
  }

  return `MATERIAL EM PDF DE "${proc.name}" FOI ENVIADO pelo WhatsApp agora. Sua resposta deve confirmar o envio com calor, sem repetir o conteudo do PDF, e seguir a conversa naturalmente (ex: perguntar se ela quer saber as proximas datas de turma).`;
}

// ─── Dispatcher ────────────────────────────────────────────────────────────

export interface ToolExecutionResult {
  resultStr: string;
  /** Algumas tools retornam metadados extras (ex: appointment criado) */
  meta?: Record<string, unknown>;
}

// ── agendar_retorno_lead ────────────────────────────────────────────────────

/**
 * Pausa os follow-ups automáticos até a data que a paciente informou.
 * Exemplo: "te chamo depois do dia 10" → pausa até 10/07 às 9h.
 * O cron de follow-up respeita eva_pause_until e não dispara antes disso.
 */
export async function agendarRetornoLead(
  args: { data_retorno: string; observacao?: string },
  ctx: DonnaContext,
  _payload: IncomingPayload,
  env: ToolEnv,
): Promise<string> {
  const { data_retorno, observacao } = args;
  if (!ctx.leadId) return 'Lead não identificado — não foi possível agendar o retorno.';

  // Validar formato YYYY-MM-DD
  const match = data_retorno.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return `Data inválida: "${data_retorno}". Use o formato YYYY-MM-DD.`;

  const [, y, m, d] = match;
  const year = parseInt(y), month = parseInt(m), day = parseInt(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return `Data inválida: "${data_retorno}".`;
  }

  // Não aceitar datas no passado
  const hoje = new Date();
  const dataAlvo = new Date(year, month - 1, day);
  if (dataAlvo < new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) {
    return `A data ${formatarDataBR(data_retorno)} já passou. Confirme a data correta com a paciente.`;
  }

  // Montar ISO às 9h BRT (UTC-3) para o cron disparar no período correto
  const pauseUntil = `${data_retorno}T12:00:00.000Z`; // 9h BRT = 12h UTC

  const h = sbHeaders(env);
  const { SUPABASE_URL: url } = { SUPABASE_URL: env.supabaseUrl };

  const res = await fetchJson(`${url}/rest/v1/leads?id=eq.${ctx.leadId}`, {
    method: 'PATCH',
    headers: { ...h, Prefer: 'return=minimal' },
    body: JSON.stringify({
      eva_pause_until: pauseUntil,
      eva_next_followup_at: pauseUntil, // cron vai disparar no dia certo
    }),
  });

  const dataBR = formatarDataBR(data_retorno);
  const obs = observacao ? ` (${observacao})` : '';
  return `Retorno agendado para ${dataBR}${obs}. Follow-ups pausados até essa data.`;
}


export async function executeToolByName(
  name: string,
  input: Record<string, unknown>,
  ctx: DonnaContext,
  payload: IncomingPayload,
  env: ToolEnv,
  imagesSentProcedures?: Set<string>,
  materialsSentProcedures?: Set<string>,
): Promise<ToolExecutionResult> {
  switch (name) {
    case 'consultar_agenda': {
      const r = await consultarAgenda(input as any, ctx, payload, env);
      return { resultStr: r };
    }
    case 'consultar_meu_agendamento': {
      const r = await consultarMeuAgendamento(input as any, ctx, payload, env);
      return { resultStr: r };
    }
    case 'criar_agendamento': {
      const r = await criarAgendamento(input as any, ctx, payload, env);
      return { resultStr: r.toolResultStr, meta: r as unknown as Record<string, unknown> };
    }
    case 'escalar_humano': {
      const r = await escalarHumano(input as any, ctx, payload, env);
      return { resultStr: r };
    }
    case 'atualizar_nome_lead': {
      const r = await atualizarNomeLead(input as any, ctx, payload, env);
      return { resultStr: r };
    }
    case 'registrar_interesse': {
      const r = await registrarInteresse(input as any, ctx, payload, env);
      return { resultStr: r };
    }
    case 'informar_valor_avista': {
      const r = await informarValorAvista(input as any, ctx, payload, env);
      return { resultStr: r };
    }
    case 'enviar_fotos_resultado': {
      const r = await enviarFotosResultado(input as any, ctx, payload, env, imagesSentProcedures ?? new Set<string>());
      return { resultStr: r };
    }
    case 'agendar_retorno_lead': {
      const r = await agendarRetornoLead(input as any, ctx, payload, env);
      return { resultStr: r };
    }
    case 'consultar_datas_curso': {
      const r = await consultarDatasCurso(input as any, ctx, payload, env);
      return { resultStr: r };
    }
    case 'enviar_material_curso': {
      const r = await enviarMaterialCurso(input as any, ctx, payload, env, materialsSentProcedures ?? new Set<string>());
      return { resultStr: r };
    }
    default:
      return { resultStr: `Tool "${name}" desconhecida. Responda com elegancia que vai checar e retornar.` };
  }
}
