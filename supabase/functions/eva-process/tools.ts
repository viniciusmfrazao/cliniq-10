// ============================================================================
// Implementação das tools que a Eva pode chamar
// ============================================================================

import type { DonnaContext, IncomingPayload, ProcedureRow, ProfessionalRow } from './types.ts';
import { fetchJson, formatarDataBR, norm, parseData, formatBRL } from './utils.ts';

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
  const dataLabel = formatarDataBR(dataAlvo); // declarar aqui para evitar 'Cannot access before initialization'

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
    const closed = await isClinicClosed(payload.clinicId, dataAlvo, env);
    if (closed) {
      return `FECHADO_NESSE_DIA: ${dataLabel}. A clinica nao atende nesse dia da semana. Diga com elegancia e sugira outro dia util.`;
    }
    return `SEM_VAGAS_NO_PERIODO: ${dataLabel}${periodoLabel}. Diga que esse periodo esta concorrido e ofereca outro periodo/dia.`;
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

  // 4) Verificar se já existe agendamento igual (idempotência)
  const [hh, mm] = String(args.horario).split(':').map(Number);
  const startIso = `${args.data}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00-03:00`;
  const endMin = hh * 60 + mm + 30;
  const endH = Math.floor(endMin / 60);
  const endM = endMin % 60;
  const endIso = `${args.data}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00-03:00`;

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

  return `NOME_REGISTRADO: "${novo}". Agora escreva IMEDIATAMENTE uma mensagem curta de WhatsApp cumprimentando pelo nome e dando continuidade à conversa (ex: perguntar o procedimento, comentar sobre o interesse dela ou oferecer horários se já souber o interesse). NAO chame nenhuma outra tool. NAO mencione que registrou o nome. Escreva SÓ o texto final da mensagem.`;
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
  // Sem procedure_id não conseguimos buscar as imagens
  if (!procedureId) return;

  // Já enviou imagens desse procedimento nessa sessão — não reenviar
  if (imagesSentProcedures.has(procedureId)) return;

  const ev = ctx.evolution;
  if (!ev?.url || !ev?.master_key) return;

  const instanceName =
    (typeof payload.instance === 'string' && payload.instance.trim()) || ev.instance || '';
  if (!instanceName) return;

  try {
    // 1) Verificar se a clínica tem o toggle ativo
    const autoUrl = `${env.supabaseUrl}/rest/v1/clinic_automations?clinic_id=eq.${payload.clinicId}&select=eva_send_result_images,eva_max_result_images`;
    const autoRes = await fetchJson<{ eva_send_result_images: boolean; eva_max_result_images: number }[]>(autoUrl, {
      method: 'GET',
      headers: { apikey: env.serviceKey, Authorization: `Bearer ${env.serviceKey}` },
    });
    if (!autoRes.ok || !autoRes.data?.length) return;
    const automations = autoRes.data[0];
    if (!automations.eva_send_result_images) return;
    const maxImages = Math.min(automations.eva_max_result_images ?? 3, 6);

    // 2) Buscar imagens ativas do procedimento (ordenadas por display_order)
    const imgUrl = `${env.supabaseUrl}/rest/v1/procedure_result_images?clinic_id=eq.${payload.clinicId}&procedure_id=eq.${procedureId}&active=eq.true&lgpd_consent=eq.true&order=display_order.asc&limit=${maxImages}&select=image_url,caption`;
    const imgRes = await fetchJson<{ image_url: string; caption: string | null }[]>(imgUrl, {
      method: 'GET',
      headers: { apikey: env.serviceKey, Authorization: `Bearer ${env.serviceKey}` },
    });
    if (!imgRes.ok || !imgRes.data?.length) return;

    const images = imgRes.data;

    // 3) Enviar cada imagem via Evolution API sendMedia
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const caption = i === 0
        ? (img.caption || `✨ Resultado real de ${procedureName}`)
        : (img.caption || '');

      await fetchJson(`${ev.url}/message/sendMedia/${encodeURIComponent(instanceName)}`, {
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

      // Pequeno delay entre imagens para não sobrecarregar
      if (i < images.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    // 4) Marcar como enviado para evitar reenvio na mesma sessão
    imagesSentProcedures.add(procedureId);

    console.log(JSON.stringify({
      evt: 'result_images_sent',
      clinic: payload.clinicId,
      procedure_id: procedureId,
      procedure_name: procedureName,
      count: images.length,
    }));
  } catch (e) {
    // Fail silencioso — não interrompe o fluxo principal da Eva
    console.warn(JSON.stringify({
      evt: 'result_images_error',
      clinic: payload.clinicId,
      procedure_id: procedureId,
      error: e instanceof Error ? e.message : String(e),
    }));
  }
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

  // Match pelo nome — mesma logica de fuzzy match usada nas outras tools
  const proc = ctx.procedures.find((p) => {
    const hay = norm(p.name);
    return hay.includes(needle) || needle.includes(hay);
  });

  if (!proc) {
    return `Nao encontrei "${args.procedimento}" na lista de procedimentos. Confirme com a paciente qual procedimento ela quer ou ofereca os disponiveis.`;
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
    default:
      return { resultStr: `Tool "${name}" desconhecida. Responda com elegancia que vai checar e retornar.` };
  }
}
