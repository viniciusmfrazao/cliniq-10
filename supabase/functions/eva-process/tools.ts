// ============================================================================
// Implementação das tools que a Eva pode chamar
// ============================================================================

import type { DonnaContext, IncomingPayload, ProcedureRow, ProfessionalRow } from './types.ts';
import { fetchJson, formatarDataBR, norm, parseData } from './utils.ts';

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
 * Detecta se a clínica está "fechada" naquele dia, ou seja, nenhum
 * profissional ativo tem schedule pra aquele day_of_week. Útil pra
 * Eva diferenciar "domingo a clínica não abre" de "agenda cheia".
 */
async function isClinicClosed(clinicId: string, dataIso: string, env: ToolEnv): Promise<boolean> {
  try {
    // dataIso é YYYY-MM-DD no fuso da clínica; getDay seria do fuso local do
    // server. Usamos new Date(yyyy, mm-1, dd) que ignora TZ pra calcular DOW.
    const [y, m, d] = dataIso.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay(); // 0=dom, 6=sab
    const url = `${env.supabaseUrl}/rest/v1/professional_schedules?clinic_id=eq.${clinicId}&is_active=eq.true&day_of_week=eq.${dow}&select=id&limit=1`;
    const r = await fetchJson<unknown[]>(url, {
      method: 'GET',
      headers: sbHeaders(env),
    });
    if (!r.ok) return false; // em caso de erro de leitura, assume aberto
    return Array.isArray(r.data) ? r.data.length === 0 : true;
  } catch {
    return false;
  }
}

// ─── consultar_agenda ──────────────────────────────────────────────────────

export async function consultarAgenda(args: {
  periodo: string;
  procedimento?: string;
}, ctx: DonnaContext, payload: IncomingPayload, env: ToolEnv): Promise<string> {
  const { dataAlvo, periodoAlvo } = parseData(args.periodo || 'amanha');

  // Tenta resolver o procedimento pelo nome — usado pra
  // (a) duração e (b) filtrar profs que fazem aquilo (via p_procedure_id)
  let procedureId: string | null = null;
  let durationMin: number | null = null;
  if (args.procedimento) {
    const needle = norm(args.procedimento);
    const found = ctx.procedures.find((p) => {
      const hay = norm(p.name);
      return hay.includes(needle) || needle.includes(hay);
    });
    if (found) {
      procedureId = found.id;
      durationMin = found.duration_minutes ?? null;
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
  // Fallback: se veio vazio E tinha procedure_id, tenta sem ele
  if ((!resp.ok || !Array.isArray(resp.data) || resp.data.length === 0) && procedureId) {
    resp = await callRpc(false);
    usouFallback = true;
  }

  const dataLabel = formatarDataBR(dataAlvo);
  const periodoLabel = periodoAlvo ? ` (${periodoAlvo})` : '';

  if (!resp.ok || !Array.isArray(resp.data) || resp.data.length === 0) {
    // Distingue "clínica fechada nesse dia" (sem schedule no day_of_week)
    // de "agenda cheia nesse período".
    const closed = await isClinicClosed(payload.clinicId, dataAlvo, env);
    if (closed) {
      return `FECHADO_NESSE_DIA: ${dataLabel}. A clinica nao atende nesse dia da semana. Diga com elegancia e sugira outro dia util.`;
    }
    return `SEM_VAGAS_NO_PERIODO: ${dataLabel}${periodoLabel}. Diga que esse periodo esta concorrido e ofereça outro periodo/dia.`;
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

  const debugLine = `[debug procedureId=${procedureId ?? 'null'} duration=${durationMin ?? 30} fallback=${usouFallback}]`;

  return [
    `Horarios REAIS disponiveis para ${dataLabel}${periodoLabel}:`,
    ...linhas,
    '',
    'Quando a paciente confirmar um horario, chame criar_agendamento com o professional_id correto (acima entre parênteses).',
    'Apresente apenas 2-3 horarios pra ela escolher (nao a lista toda). Mantenha o tom elegante.',
    debugLine,
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
  const { professionals, procedures, history, patient } = ctx;
  const validProfIds = new Set<string>(professionals.map((p) => p.id));

  // 1) Validar/resolver professional_id
  let professionalId = args.professional_id;
  let profSource = 'claude';

  if (!validProfIds.has(professionalId)) {
    let matched: ProfessionalRow | null = null;

    // Fallback: nome do profissional nas últimas msgs
    const lastTexts = history.slice(-6).map((m) => norm(m.content));
    for (const p of professionals) {
      const pNorm = norm(p.name).replace(/^dra?\.?\s+/, '');
      const firstName = pNorm.split(/\s+/)[0];
      if (!firstName) continue;
      if (lastTexts.some((t) => t.includes(firstName))) {
        matched = p;
        profSource = 'historico';
        break;
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

    if (matched) professionalId = matched.id;
  }

  if (!validProfIds.has(professionalId)) {
    return {
      toolResultStr:
        'Profissional nao identificado. Responda com elegancia que precisa confirmar com qual profissional ela quer o horario. Apresente as opcoes.',
      appointmentCreated: false,
    };
  }

  // 2) Resolver procedure_id pelo nome
  let procedureId: string | null = null;
  if (args.procedimento) {
    const needle = norm(args.procedimento);
    const proc = procedures.find((p) => {
      const hay = norm(p.name);
      return hay.includes(needle) || needle.includes(hay);
    });
    if (proc) procedureId = proc.id;
  }

  // 3) Resolver/criar paciente
  let patientId: string | null = patient?.id ?? null;

  if (!patientId) {
    const url = `${env.supabaseUrl}/rest/v1/patients`;
    const headers = { ...sbHeaders(env), Prefer: 'return=representation' };
    const r = await fetchJson<Array<{ id: string }>>(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        clinic_id: payload.clinicId,
        name: args.nome_paciente,
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

  // 4) Criar appointment
  const [hh, mm] = String(args.horario).split(':').map(Number);
  const startIso = `${args.data}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00-03:00`;
  const endMin = hh * 60 + mm + 30;
  const endH = Math.floor(endMin / 60);
  const endM = endMin % 60;
  const endIso = `${args.data}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00-03:00`;

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

  // 5) Se tinha lead → marcar convertido
  let leadConvertedId: string | null = null;
  if (ctx.lead?.id) {
    leadConvertedId = ctx.lead.id;
    const leadUrl = `${env.supabaseUrl}/rest/v1/leads?id=eq.${leadConvertedId}`;
    await fetchJson(leadUrl, {
      method: 'PATCH',
      headers: sbHeaders(env),
      body: JSON.stringify({
        status: 'converted',
        converted_at: new Date().toISOString(),
        conversion_notes: 'Convertido via Eva (WhatsApp)',
      }),
    });
  }

  const [y, m, d] = args.data.split('-');
  const procPart = args.procedimento ? `Procedimento: ${args.procedimento}\n` : '';

  return {
    toolResultStr: [
      'AGENDAMENTO CRIADO COM SUCESSO!',
      `Paciente: ${args.nome_paciente}`,
      `Data: ${d}/${m}/${y} as ${args.horario}`,
      procPart.trim(),
      'Confirme com a paciente, mencione que ela recebera lembrete D-1 e seja calorosa. NAO repita o nome dela mais de uma vez.',
      `[debug profSource=${profSource}]`,
    ].filter(Boolean).join('\n'),
    appointmentCreated: true,
    leadConvertedId,
    patientId,
  };
}

// ─── escalar_humano ────────────────────────────────────────────────────────

export async function escalarHumano(
  args: { motivo: string; detalhes?: string },
  ctx: DonnaContext,
  _payload: IncomingPayload,
  env: ToolEnv,
): Promise<string> {
  const motivo = args.motivo || 'duvida';
  const detalhes = args.detalhes || '';

  if (ctx.lead?.id) {
    const url = `${env.supabaseUrl}/rest/v1/leads?id=eq.${ctx.lead.id}`;
    await fetchJson(url, {
      method: 'PATCH',
      headers: sbHeaders(env),
      body: JSON.stringify({
        ai_priority: 'hot',
        ai_suggested_action: `[ESCALAR HUMANO] ${motivo}: ${detalhes}`.slice(0, 500),
        ai_last_analysis: new Date().toISOString(),
      }),
    });
  }

  return `Sinalizado para atendente humano. Motivo: ${motivo}. Lead marcado como hot. Responda com elegancia: "Vou avisar a Dra. pessoalmente, e nossa secretaria entrara em contato com voce em breve."`;
}

// ─── registrar_interesse ───────────────────────────────────────────────────

export async function registrarInteresse(
  args: { procedimento: string; observacoes?: string },
  ctx: DonnaContext,
  _payload: IncomingPayload,
  env: ToolEnv,
): Promise<string> {
  const procedimento = args.procedimento;
  const proc = ctx.procedures.find((p) => norm(p.name).includes(norm(procedimento)));

  if (ctx.lead?.id) {
    const url = `${env.supabaseUrl}/rest/v1/leads?id=eq.${ctx.lead.id}`;
    await fetchJson(url, {
      method: 'PATCH',
      headers: sbHeaders(env),
      body: JSON.stringify({
        interest: procedimento,
        procedure_id: proc?.id ?? null,
        last_contact_at: new Date().toISOString(),
        ...(args.observacoes ? { notes: args.observacoes.slice(0, 500) } : {}),
      }),
    });
  }

  return `Interesse em "${procedimento}" registrado no CRM. Continue a conversa naturalmente, sem mencionar registro/CRM. Conduza pra avaliacao se fizer sentido.`;
}

// ─── Dispatcher ────────────────────────────────────────────────────────────

export interface ToolExecutionResult {
  resultStr: string;
  /** Algumas tools retornam metadados extras (ex: appointment criado) */
  meta?: Record<string, unknown>;
}

export async function executeToolByName(
  name: string,
  input: Record<string, unknown>,
  ctx: DonnaContext,
  payload: IncomingPayload,
  env: ToolEnv,
): Promise<ToolExecutionResult> {
  switch (name) {
    case 'consultar_agenda': {
      const r = await consultarAgenda(input as any, ctx, payload, env);
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
    case 'registrar_interesse': {
      const r = await registrarInteresse(input as any, ctx, payload, env);
      return { resultStr: r };
    }
    default:
      return { resultStr: `Tool "${name}" desconhecida. Responda com elegancia que vai checar e retornar.` };
  }
}
